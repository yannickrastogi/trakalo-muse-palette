import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to_email, to_name, inviter_name, workspace_name, role, invite_link } = await req.json();

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

    const greeting = to_name ? "Hi " + to_name + "," : "Hi,";
    const inviter = inviter_name || "Someone";
    const roleLine = role ? " as <strong>" + role + "</strong>" : "";

    const htmlBody = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
      + "<body style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5;\">"
      + "<div style=\"background:#ffffff;border-radius:12px;padding:32px;margin:20px 0;\">"
      + "<div style=\"text-align:center;margin-bottom:24px;\">"
      + "<h1 style=\"color:#8b5cf6;margin:0;font-size:28px;\">Trakalog</h1>"
      + "</div>"
      + "<p style=\"color:#333;font-size:16px;line-height:1.6;\">" + greeting + "</p>"
      + "<p style=\"color:#333;font-size:16px;line-height:1.6;\"><strong>" + inviter + "</strong> has invited you to join <strong>" + workspace_name + "</strong>" + roleLine + ".</p>"
      + "<div style=\"text-align:center;margin:32px 0;\">"
      + "<a href=\"" + invite_link + "\" style=\"display:inline-block;background:#8b5cf6;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;\">Join Workspace</a>"
      + "</div>"
      + "<p style=\"color:#666;font-size:14px;line-height:1.6;\">If you didn't expect this invitation, you can safely ignore this email.</p>"
      + "<hr style=\"border:none;border-top:1px solid #eee;margin:32px 0;\">"
      + "<p style=\"text-align:center;color:#999;font-size:12px;\">Sent via Trakalog</p>"
      + "</div></body></html>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Trakalog <onboarding@resend.dev>",
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
