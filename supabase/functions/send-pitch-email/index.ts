import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { buildEmail, isValidEmail, htmlEscape } from "../_shared/email-template.ts";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "send-pitch-email:" + ip, _max_requests: 10, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { to_email, to_name, from_name, from_email, subject, message, tracks, share_link, workspace_id } = await req.json();

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

    // Fetch workspace branding
    let logoUrl = "";
    let brandColor = "";
    let workspaceName = "";
    if (workspace_id) {
      const { data: ws } = await supabaseAdmin.from("workspaces").select("logo_url, brand_color, name").eq("id", workspace_id).single();
      if (ws) {
        logoUrl = ws.logo_url || "";
        brandColor = ws.brand_color || "";
        workspaceName = ws.name || "";
      }
    }

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
        subject: subject,
        html: htmlBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.message || "Failed to send email" }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
