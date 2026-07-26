import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { buildEmail, htmlEscape, isValidEmail } from "../_shared/email-template.ts";
import { isValidUUID, sanitizeEmailSubject } from "../_shared/validation.ts";
import { getAuthedUser, assertWorkspaceMember, HttpError } from "../_shared/auth.ts";

function generateToken(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    // Authenticate the caller FIRST (before touching the body), so an
    // unauthenticated request is rejected outright.
    const { user } = await getAuthedUser(req);

    // Rate limit per authenticated user — 20 invitations/hour — so an authed admin
    // can't spam invitations in a loop. Same pattern as the other Edge Functions.
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "create-invitation:" + user.id, _max_requests: 20, _window_seconds: 3600 });
    if (rateLimitOk === false) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { workspace_id, workspace_name, inviter_name, email, first_name, last_name, role, access_level, professional_title } = await req.json();

    if (!workspace_id || !email) {
      return new Response(JSON.stringify({ error: "workspace_id and email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidUUID(workspace_id)) {
      return new Response(JSON.stringify({ error: "Invalid workspace_id format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Supabase configuration missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Require the (already authenticated) caller to be an ADMIN of the target
    // workspace. The sender identity is forced from the authed user, never the body.
    await assertWorkspaceMember(supabase, user.id, workspace_id, "admin");
    const invitedBy = user.id;

    // Rate limiting: max 10 invitations per workspace per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("invitations")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace_id)
      .gte("created_at", oneHourAgo);

    if (count !== null && count >= 10) {
      return new Response(JSON.stringify({ error: "Too many invitations. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = generateToken(32);

    const { error: insertError } = await supabase.from("invitations").insert({
      workspace_id,
      invited_by: invitedBy,
      email,
      first_name: first_name || null,
      last_name: last_name || null,
      role: role || "member",
      access_level: access_level || "viewer",
      professional_title: professional_title || null,
      token,
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch workspace branding
    let logoUrl = "";
    let brandColor = "";
    const { data: ws } = await supabase.from("workspaces").select("logo_url, brand_color").eq("id", workspace_id).single();
    if (ws) {
      logoUrl = ws.logo_url || "";
      brandColor = ws.brand_color || "";
    }

    // Send invitation email via Resend
    const inviter = htmlEscape(inviter_name || "Someone");
    const wsName = htmlEscape(workspace_name || "a workspace");
    const greeting = first_name ? "<p>Hi " + htmlEscape(first_name) + ",</p>" : "<p>Hi,</p>";
    const roleLine = role ? " as <strong>" + htmlEscape(role) + "</strong>" : "";
    const inviteLink = "https://app.trakalog.com/invite/" + token;

    const bodyContent = greeting
      + "<p><strong>" + inviter + "</strong> has invited you to join <strong>" + wsName + "</strong>" + roleLine + ".</p>"
      + "<p>Click the button below to accept the invitation and join the workspace.</p>"
      + '<p style="color:#52525b;font-size:13px;margin-top:24px;">If you didn\'t expect this invitation, you can safely ignore this email. This link is unique to you and should not be shared.</p>';

    const htmlBody = buildEmail({
      workspaceName: wsName !== "a workspace" ? wsName : undefined,
      workspaceLogoUrl: logoUrl || null,
      brandColor: brandColor || null,
      preheader: inviter + " invited you to join " + wsName,
      heading: "You're invited to join " + wsName,
      body: bodyContent,
      ctaLabel: "Join Workspace",
      ctaUrl: inviteLink,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Trakalog <noreply@trakalog.com>",
        to: [email],
        subject: sanitizeEmailSubject(inviter + " invited you to join " + wsName + " on Trakalog"),
        html: htmlBody,
      }),
    });

    const emailData = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: emailData.message || "Failed to send invitation email" }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, token }), {
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
