import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { buildEmail } from "../_shared/email-template.ts";

function generateToken(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { workspace_id, workspace_name, invited_by, inviter_name, email, first_name, last_name, role, access_level, professional_title } = await req.json();

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
      invited_by,
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
    const inviter = inviter_name || "Someone";
    const wsName = workspace_name || "a workspace";
    const greeting = first_name ? "<p>Hi " + first_name + ",</p>" : "<p>Hi,</p>";
    const roleLine = role ? " as <strong>" + role + "</strong>" : "";
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
