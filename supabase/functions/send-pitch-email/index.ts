import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { buildEmail, isValidEmail, htmlEscape } from "../_shared/email-template.ts";
import { isValidUUID, sanitizeEmailSubject } from "../_shared/validation.ts";
import { getAuthedUser, assertWorkspaceMember, HttpError } from "../_shared/auth.ts";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "send-pitch-email:" + ip, _max_requests: 10, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // Authenticate the caller FIRST (fail-closed before any work).
    const { user } = await getAuthedUser(req);

    const { to_email, to_name, subject, message, tracks, share_link, workspace_id } = await req.json();

    if (!to_email || !subject) {
      return new Response(JSON.stringify({ error: "to_email and subject required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidEmail(to_email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // workspace_id is REQUIRED: the caller must be a pitcher (>=) of the workspace
    // whose branding/identity the pitch is sent under.
    if (!workspace_id || !isValidUUID(workspace_id)) {
      return new Response(JSON.stringify({ error: "Invalid or missing workspace_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await assertWorkspaceMember(supabaseAdmin, user.id, workspace_id, "pitcher");

    // Per-user rate limit (in addition to the per-IP one above) so a single
    // account can't fan out pitches from behind rotating IPs.
    const { data: userRateOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "send-pitch-email-user:" + user.id, _max_requests: 30, _window_seconds: 3600 });
    if (userRateOk === false) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch workspace branding + sender identity SERVER-SIDE. Never trust the body
    // for who the pitch is from — derive it from the authed user's profile and the
    // workspace, so a caller can't spoof another sender/brand.
    let logoUrl = "";
    let brandColor = "";
    let workspaceName = "";
    const { data: ws } = await supabaseAdmin.from("workspaces").select("logo_url, brand_color, name").eq("id", workspace_id).single();
    if (ws) {
      logoUrl = ws.logo_url || "";
      brandColor = ws.brand_color || "";
      workspaceName = ws.name || "";
    }

    const { data: senderProfile } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
    const from_name = senderProfile?.full_name || user.email || "Someone";
    const from_email = senderProfile?.email || user.email || undefined;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const greeting = to_name ? "<p>Hi " + htmlEscape(to_name) + ",</p>" : "<p>Hi,</p>";

    const messageBlock = message
      ? '<p style="border-left:3px solid ' + (brandColor || '#ec4899') + ';padding:12px 16px;margin:20px 0;background:rgba(255,255,255,0.03);color:#d4d4d8;font-style:italic;border-radius:0 8px 8px 0;">' + htmlEscape(message) + '</p>'
      : '';

    const trackList = tracks && tracks.length > 0
      ? '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;">'
        + '<tr><td style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#ffffff;padding:0 0 8px 0;text-transform:uppercase;letter-spacing:1px;">Tracks</td></tr>'
        + tracks.map((t: { title: string; artist: string }) =>
          '<tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-family:Arial,sans-serif;font-size:14px;color:#d4d4d8;">'
          + htmlEscape(t.title) + ' <span style="color:#71717a;">&mdash; ' + htmlEscape(t.artist) + '</span></td></tr>'
        ).join('')
        + '</table>'
      : '';

    const bodyContent = greeting + messageBlock + trackList;

    const safeName = htmlEscape(from_name || "Someone");
    const safeWsName = htmlEscape(workspaceName);
    const htmlBody = buildEmail({
      workspaceName: workspaceName || undefined,
      workspaceLogoUrl: logoUrl || null,
      brandColor: brandColor || null,
      preheader: safeName + " sent you a pitch" + (safeWsName ? " from " + safeWsName : ""),
      heading: safeName + " sent you a pitch" + (safeWsName ? " from " + safeWsName : ""),
      body: bodyContent,
      ctaLabel: share_link ? "Listen Now" : undefined,
      ctaUrl: share_link || undefined,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Trakalog <noreply@trakalog.com>",
        reply_to: from_email || undefined,
        to: [to_email],
        subject: sanitizeEmailSubject(subject),
        html: htmlBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("send-pitch-email: Resend send failed (status=" + res.status + ")");
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
