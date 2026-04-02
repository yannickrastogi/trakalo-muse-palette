import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { buildEmail } from "../_shared/email-template.ts";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "send-invitation-email:" + ip, _max_requests: 10, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { to_email, to_name, inviter_name, workspace_name, workspace_id, role, invite_link } = await req.json();

    if (!to_email || !workspace_name || !invite_link) {
      return new Response(JSON.stringify({ error: "to_email, workspace_name, and invite_link required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch workspace branding
    let logoUrl = "";
    let brandColor = "";
    if (workspace_id) {
      const { data: ws } = await supabaseAdmin.from("workspaces").select("logo_url, brand_color").eq("id", workspace_id).single();
      if (ws) {
        logoUrl = ws.logo_url || "";
        brandColor = ws.brand_color || "";
      }
    }

    const greeting = to_name ? "<p>Hi " + to_name + ",</p>" : "<p>Hi,</p>";
    const inviter = inviter_name || "Someone";
    const roleLine = role ? " as <strong>" + role + "</strong>" : "";

    const bodyContent = greeting
      + "<p><strong>" + inviter + "</strong> has invited you to join <strong>" + workspace_name + "</strong>" + roleLine + ".</p>"
      + '<p style="color:#52525b;font-size:13px;margin-top:24px;">If you didn\'t expect this invitation, you can safely ignore this email.</p>';

    const htmlBody = buildEmail({
      workspaceName: workspace_name,
      workspaceLogoUrl: logoUrl || null,
      brandColor: brandColor || null,
      preheader: inviter + " invited you to join " + workspace_name,
      heading: "You're invited to join " + workspace_name,
      body: bodyContent,
      ctaLabel: "Join Workspace",
      ctaUrl: invite_link,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Trakalog <noreply@trakalog.com>",
        to: [to_email],
        subject: inviter + " invited you to join " + workspace_name + " on Trakalog",
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
