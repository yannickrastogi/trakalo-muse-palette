import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateToken(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { workspace_id, workspace_name, invited_by, inviter_name, email, first_name, last_name, role } = await req.json();

    if (!workspace_id || !email || !invited_by) {
      return new Response(JSON.stringify({ error: "workspace_id, email, and invited_by are required" }), {
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
    const token = generateToken(32);

    const { error: insertError } = await supabase.from("invitations").insert({
      workspace_id,
      invited_by,
      email,
      first_name: first_name || null,
      last_name: last_name || null,
      role: role || "member",
      token,
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send invitation email via Resend
    const inviter = inviter_name || "Someone";
    const wsName = workspace_name || "a workspace";
    const greeting = first_name ? "Hi " + first_name + "," : "Hi,";
    const roleLine = role ? " as <strong>" + role + "</strong>" : "";
    const inviteLink = "https://app.trakalog.com/invite/" + token;

    const htmlBody = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
      + "<body style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5;\">"
      + "<div style=\"background:#ffffff;border-radius:12px;padding:32px;margin:20px 0;\">"
      + "<div style=\"text-align:center;margin-bottom:24px;\">"
      + "<h1 style=\"color:#8b5cf6;margin:0;font-size:28px;\">Trakalog</h1>"
      + "</div>"
      + "<p style=\"color:#333;font-size:16px;line-height:1.6;\">" + greeting + "</p>"
      + "<p style=\"color:#333;font-size:16px;line-height:1.6;\"><strong>" + inviter + "</strong> has invited you to join <strong>" + wsName + "</strong>" + roleLine + ".</p>"
      + "<p style=\"color:#333;font-size:16px;line-height:1.6;\">Click the button below to accept the invitation and join the workspace.</p>"
      + "<div style=\"text-align:center;margin:32px 0;\">"
      + "<a href=\"" + inviteLink + "\" style=\"display:inline-block;background:#8b5cf6;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;\">Join Workspace</a>"
      + "</div>"
      + "<p style=\"color:#666;font-size:14px;line-height:1.6;\">If you didn't expect this invitation, you can safely ignore this email. This link is unique to you and should not be shared.</p>"
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
        from: "Trakalog <noreply@trakalog.com>",
        to: [email],
        subject: inviter + " invited you to join " + wsName + " on Trakalog",
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
