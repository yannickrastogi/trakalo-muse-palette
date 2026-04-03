// Supabase Edge Function: send-notification-email
// Called internally by other Edge Functions to send notification emails.
//
// POST /send-notification-email
// Body: { event_type: string, user_id: uuid, data: object }
// Returns: { sent: boolean } or { error: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { buildEmail } from "../_shared/email-template.ts";

// Map event_type to notification_preferences column
const EVENT_TO_COLUMN: Record<string, string> = {
  link_activity: "link_activity",
  comment: "comments",
  signature: "signatures",
  new_member: "new_member_joined",
  track_upload: "track_uploads",
};

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { event_type, user_id, data } = await req.json();

    if (!event_type || !user_id || !data) {
      return new Response(JSON.stringify({ error: "event_type, user_id, and data are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const column = EVENT_TO_COLUMN[event_type];
    if (!column) {
      return new Response(JSON.stringify({ error: "Unknown event_type: " + event_type }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Check notification preference
    const { data: pref } = await supabaseAdmin
      .from("notification_preferences")
      .select(column)
      .eq("user_id", user_id)
      .maybeSingle();

    // If no row or column is false, skip
    if (pref && pref[column] === false) {
      return new Response(JSON.stringify({ sent: false, reason: "notification disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get user email from profiles
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", user_id)
      .maybeSingle();

    if (!profile?.email) {
      return new Response(JSON.stringify({ sent: false, reason: "no email found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Self-notification check
    if (data.visitor_email && data.visitor_email.toLowerCase() === profile.email.toLowerCase()) {
      return new Response(JSON.stringify({ sent: false, reason: "self-notification skipped" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Build email content based on event type
    let subject = "";
    let heading = "";
    let body = "";
    let ctaLabel = "";
    let ctaUrl = "";

    if (event_type === "link_activity") {
      const visitorName = data.visitor_name || "Someone";
      const visitorEmail = data.visitor_email || "";
      const trackTitle = data.track_title || "your track";
      subject = "[Trakalog] " + visitorName + " viewed " + trackTitle;
      heading = "New activity on your shared link";
      body = "<strong>" + visitorName + "</strong>"
        + (visitorEmail ? " (" + visitorEmail + ")" : "")
        + " accessed <strong>" + trackTitle + "</strong> via your shared link.";
      ctaLabel = "View Activity";
      ctaUrl = "https://app.trakalog.com/shared-links";
    } else if (event_type === "comment") {
      subject = "[Trakalog] New comment on " + (data.track_title || "your track");
      heading = "New comment";
      body = "<strong>" + (data.commenter_name || "Someone") + "</strong> commented on <strong>" + (data.track_title || "your track") + "</strong>.";
      ctaLabel = "View Comment";
      ctaUrl = data.track_url || "https://app.trakalog.com/tracks";
    } else if (event_type === "signature") {
      subject = "[Trakalog] Splits signed on " + (data.track_title || "your track");
      heading = "Splits signed";
      body = "<strong>" + (data.signer_name || "A collaborator") + "</strong> signed their splits on <strong>" + (data.track_title || "your track") + "</strong>.";
      ctaLabel = "View Splits";
      ctaUrl = data.track_url || "https://app.trakalog.com/tracks";
    } else if (event_type === "new_member") {
      subject = "[Trakalog] " + (data.member_name || "Someone") + " joined your workspace";
      heading = "New member joined";
      body = "<strong>" + (data.member_name || "A new member") + "</strong>" + (data.member_email ? " (" + data.member_email + ")" : "") + " accepted your invitation and joined <strong>" + (data.workspace_name || "your workspace") + "</strong>.";
      ctaLabel = "View Team";
      ctaUrl = "https://app.trakalog.com/workspace-settings";
    } else if (event_type === "track_upload") {
      subject = "[Trakalog] New track uploaded: " + (data.track_title || "Untitled");
      heading = "New track uploaded";
      body = "<strong>" + (data.uploader_name || "A member") + "</strong> uploaded <strong>" + (data.track_title || "a new track") + "</strong> to the catalog.";
      ctaLabel = "View Track";
      ctaUrl = data.track_url || "https://app.trakalog.com/tracks";
    }

    // 5. Send via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlBody = buildEmail({
      preheader: subject,
      heading,
      body,
      ctaLabel,
      ctaUrl,
      footerText: "You received this because notifications are enabled in your Trakalog settings.",
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Trakalog <noreply@trakalog.com>",
        to: [profile.email],
        subject,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errData = await res.json();
      console.error("[send-notification-email] Resend error:", errData);
      return new Response(JSON.stringify({ error: errData.message || "Failed to send" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-notification-email] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
