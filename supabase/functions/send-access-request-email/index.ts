import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/ip.ts";
import { buildEmail, isValidEmail, htmlEscape } from "../_shared/email-template.ts";
import { isValidUUID, sanitizeEmailSubject } from "../_shared/validation.ts";

// Only allow hex colors into the inline CSS we build by hand (prevents CSS/HTML
// break-out via a workspace's arbitrary brand_color string).
function safeHexColor(color: unknown): string {
  return typeof color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : "#ec4899";
}

// Notifies a track owner that someone requested access via Trakalog Access.
// The owner's email is resolved server-side (never exposed to the requester),
// and we only send when the track is actually marketplace-public.

const APP_URL = "https://app.trakalog.com";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);

  const ip = getClientIp(req);
  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "send-access-request:" + ip, _max_requests: 20, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const track_id = body.track_id;
    const requester_name = typeof body.requester_name === "string" ? body.requester_name.trim().slice(0, 200) : "";
    const requester_company = typeof body.requester_company === "string" ? body.requester_company.trim().slice(0, 200) : "";
    const requester_email = typeof body.requester_email === "string" ? body.requester_email.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";

    if (!track_id || !isValidUUID(track_id)) {
      return new Response(JSON.stringify({ error: "Valid track_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!requester_email || !isValidEmail(requester_email)) {
      return new Response(JSON.stringify({ error: "Valid requester_email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve the public track + its owning workspace. Only public tracks qualify.
    const { data: track } = await supabaseAdmin
      .from("tracks")
      .select("id, title, artist, is_marketplace_public, workspace_id, workspaces(name, owner_id, logo_url, brand_color)")
      .eq("id", track_id)
      .eq("is_marketplace_public", true)
      .maybeSingle();

    if (!track) {
      return new Response(JSON.stringify({ error: "Track not available" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ws = (track as any).workspaces || {};
    const ownerId = ws.owner_id as string | undefined;
    if (!ownerId) {
      return new Response(JSON.stringify({ error: "Owner not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Owner email resolved server-side (never returned to the requester).
    const { data: ownerRes } = await supabaseAdmin.auth.admin.getUserById(ownerId);
    const ownerEmail = ownerRes?.user?.email;
    if (!ownerEmail) {
      return new Response(JSON.stringify({ error: "Owner email unavailable" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const safeRequester = htmlEscape(requester_name || "Someone");
    const safeTitle = htmlEscape(track.title || "your track");
    const fromLine = requester_company ? safeRequester + " &middot; " + htmlEscape(requester_company) : safeRequester;

    const messageBlock = message
      ? '<p style="border-left:3px solid ' + safeHexColor(ws.brand_color) + ';padding:12px 16px;margin:20px 0;background:rgba(255,255,255,0.03);color:#d4d4d8;font-style:italic;border-radius:0 8px 8px 0;">' + htmlEscape(message) + '</p>'
      : '';

    const bodyContent =
      '<p>Hi,</p>' +
      '<p><strong>' + fromLine + '</strong> is interested in your track <strong>&ldquo;' + safeTitle + '&rdquo;</strong>.</p>' +
      messageBlock +
      '<p style="color:#a1a1aa;font-size:13px;">Reply directly to this email to reach ' + safeRequester + ' (' + htmlEscape(requester_email) + ').</p>';

    const htmlBody = buildEmail({
      workspaceName: ws.name || undefined,
      workspaceLogoUrl: ws.logo_url || null,
      brandColor: ws.brand_color || null,
      preheader: safeRequester + " requested access to " + safeTitle,
      heading: "New access request",
      body: bodyContent,
      ctaLabel: "View Request",
      ctaUrl: APP_URL + "/access?tab=requests",
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + RESEND_API_KEY },
      body: JSON.stringify({
        from: "Trakalog <noreply@trakalog.com>",
        reply_to: requester_email,
        to: [ownerEmail],
        subject: sanitizeEmailSubject((requester_name || "Someone") + ' is interested in your track "' + (track.title || "") + '"'),
        html: htmlBody,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.message || "Failed to send email" }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
