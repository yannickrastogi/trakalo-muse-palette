import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { to_email, to_name, from_name, from_email, subject, message, tracks, share_link } = await req.json();

    if (!to_email || !subject) {
      return new Response(JSON.stringify({ error: "to_email and subject required" }), {
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

    const trackList = tracks && tracks.length > 0
      ? tracks.map((t: { title: string; artist: string }) => "<li style=\"padding:8px 0;border-bottom:1px solid #eee;\">" + t.title + " &mdash; <span style=\"color:#666;\">" + t.artist + "</span></li>").join("")
      : "";

    const messageBlock = message
      ? "<blockquote style=\"border-left:3px solid #8b5cf6;padding:12px 16px;margin:20px 0;background:#f9f7ff;color:#444;font-style:italic;border-radius:0 8px 8px 0;\">" + message + "</blockquote>"
      : "";

    const trackSection = trackList
      ? "<div style=\"margin:24px 0;\"><h3 style=\"color:#333;margin-bottom:12px;\">Tracks</h3><ul style=\"list-style:none;padding:0;margin:0;\">" + trackList + "</ul></div>"
      : "";

    const buttonSection = share_link
      ? "<div style=\"text-align:center;margin:32px 0;\"><a href=\"" + share_link + "\" style=\"display:inline-block;background:#8b5cf6;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;\">Listen Now</a></div>"
      : "";

    const greeting = to_name ? "Hi " + to_name + "," : "Hi,";

    const htmlBody = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
      + "<body style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5;\">"
      + "<div style=\"background:#ffffff;border-radius:12px;padding:32px;margin:20px 0;\">"
      + "<div style=\"text-align:center;margin-bottom:24px;\">"
      + "<h1 style=\"color:#8b5cf6;margin:0;font-size:28px;\">Trakalog</h1>"
      + "</div>"
      + "<p style=\"color:#333;font-size:16px;line-height:1.6;\">" + greeting + "</p>"
      + "<p style=\"color:#333;font-size:16px;line-height:1.6;\"><strong>" + (from_name || "Someone") + "</strong> sent you a pitch.</p>"
      + messageBlock
      + trackSection
      + buttonSection
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
