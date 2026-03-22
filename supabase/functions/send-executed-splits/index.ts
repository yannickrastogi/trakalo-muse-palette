import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { track_id } = await req.json() as { track_id: string };

    if (!track_id) {
      return new Response(JSON.stringify({ error: "track_id required" }), {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch track info
    const { data: track, error: trackError } = await supabase
      .from("tracks")
      .select("title, artist")
      .eq("id", track_id)
      .single();

    if (trackError || !track) {
      return new Response(JSON.stringify({ error: "Track not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all signed signature_requests for this track
    const { data: signatures, error: sigError } = await supabase
      .from("signature_requests")
      .select("collaborator_name, collaborator_email, role, split_share, pro, ipi, publisher, signed_at")
      .eq("track_id", track_id)
      .eq("status", "signed")
      .order("split_share", { ascending: false });

    if (sigError || !signatures || signatures.length === 0) {
      return new Response(JSON.stringify({ error: "No signed agreements found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trackTitle = track.title;
    const trackArtist = track.artist;

    // Build splits recap table rows with signed dates
    const splitsRows = signatures
      .map((s) => {
        const signedDate = s.signed_at ? new Date(s.signed_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
        return "<tr>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#333;\">" + s.collaborator_name + "</td>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#666;\">" + s.role + "</td>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#333;font-weight:bold;text-align:right;\">" + s.split_share + "%</td>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#666;font-size:12px;\">" + (s.pro || "\u2014") + "</td>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#666;font-size:12px;\">" + (s.ipi || "\u2014") + "</td>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#666;font-size:12px;\">" + (s.publisher || "\u2014") + "</td>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#16a34a;font-size:12px;\">\u2705 " + signedDate + "</td>"
          + "</tr>";
      })
      .join("");

    let sent = 0;

    for (const sig of signatures) {
      if (!sig.collaborator_email) {
        console.log("Skipping executed copy for " + sig.collaborator_name + ": no email");
        continue;
      }

      console.log("Sending executed copy to:", sig.collaborator_email);

      const htmlBody = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
        + "<body style=\"font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;background:#f5f5f5;\">"
        + "<div style=\"background:#ffffff;border-radius:12px;padding:32px;margin:20px 0;\">"
        + "<div style=\"text-align:center;margin-bottom:24px;\">"
        + "<h1 style=\"color:#f97316;margin:0;font-size:28px;\">Trakalog</h1>"
        + "</div>"
        + "<div style=\"text-align:center;margin-bottom:24px;padding:16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;\">"
        + "<p style=\"color:#16a34a;font-size:18px;font-weight:bold;margin:0;\">\u2705 Agreement Fully Executed</p>"
        + "</div>"
        + "<p style=\"color:#333;font-size:16px;line-height:1.6;\">Hi " + sig.collaborator_name + ",</p>"
        + "<p style=\"color:#333;font-size:16px;line-height:1.6;\">The split agreement for <strong>" + trackTitle + "</strong> by <strong>" + trackArtist + "</strong> has been fully executed. All parties have signed.</p>"
        + "<div style=\"margin:24px 0;\">"
        + "<h3 style=\"color:#333;margin-bottom:12px;\">Final Split Breakdown</h3>"
        + "<table style=\"width:100%;border-collapse:collapse;font-size:14px;\">"
        + "<thead><tr style=\"background:#fff7ed;\">"
        + "<th style=\"padding:10px 12px;text-align:left;color:#f97316;font-weight:600;\">Name</th>"
        + "<th style=\"padding:10px 12px;text-align:left;color:#f97316;font-weight:600;\">Role</th>"
        + "<th style=\"padding:10px 12px;text-align:right;color:#f97316;font-weight:600;\">Share</th>"
        + "<th style=\"padding:10px 12px;text-align:left;color:#f97316;font-weight:600;\">PRO</th>"
        + "<th style=\"padding:10px 12px;text-align:left;color:#f97316;font-weight:600;\">IPI</th>"
        + "<th style=\"padding:10px 12px;text-align:left;color:#f97316;font-weight:600;\">Publisher</th>"
        + "<th style=\"padding:10px 12px;text-align:left;color:#f97316;font-weight:600;\">Signed</th>"
        + "</tr></thead>"
        + "<tbody>" + splitsRows + "</tbody>"
        + "</table>"
        + "</div>"
        + "<div style=\"margin:24px 0;padding:16px;background:#fafafa;border-radius:8px;border:1px solid #eee;\">"
        + "<p style=\"color:#333;font-size:14px;line-height:1.6;margin:0;\">This document serves as confirmation of the agreed ownership splits for <strong>" + trackTitle + "</strong>. All listed parties have reviewed and signed this agreement.</p>"
        + "</div>"
        + "<hr style=\"border:none;border-top:1px solid #eee;margin:32px 0;\">"
        + "<p style=\"text-align:center;color:#999;font-size:12px;\">This agreement was executed via Trakalog \u2014 trakalog.com</p>"
        + "</div></body></html>";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: "Trakalog <noreply@trakalog.com>",
          to: [sig.collaborator_email],
          subject: "Executed Split Agreement \u2014 " + trackTitle,
          html: htmlBody,
        }),
      });

      if (res.ok) {
        console.log("Executed copy sent to:", sig.collaborator_email);
        sent++;
      } else {
        const errData = await res.json();
        console.error("Resend error for " + sig.collaborator_email + ": " + (errData.message || res.statusText));
      }
    }

    console.log("Total executed copies sent:", sent);

    return new Response(JSON.stringify({ success: true, sent }), {
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
