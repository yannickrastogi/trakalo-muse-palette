import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { buildEmail } from "../_shared/email-template.ts";

const maskIpi = (ipi: string | undefined) => ipi ? "***" + ipi.slice(-3) : "\u2014";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { track_id, pdf_base64 } = await req.json() as { track_id: string; pdf_base64?: string };

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

    // Fetch track info including splits JSON
    const { data: track, error: trackError } = await supabase
      .from("tracks")
      .select("title, artist, splits")
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
      .select("collaborator_name, collaborator_email, signed_at")
      .eq("track_id", track_id)
      .eq("status", "signed")
      .order("created_at", { ascending: true });

    if (sigError || !signatures || signatures.length === 0) {
      return new Response(JSON.stringify({ error: "No signed agreements found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trackTitle = track.title;
    const trackArtist = track.artist;
    const trackSplits = (track.splits || []) as Array<{
      name?: string;
      role?: string;
      share?: number;
      pro?: string;
      ipi?: string;
      publisher?: string;
    }>;

    // Build a map of signed dates by collaborator name
    const signedDateMap: Record<string, string> = {};
    for (const sig of signatures) {
      if (sig.collaborator_name && sig.signed_at) {
        signedDateMap[sig.collaborator_name] = new Date(sig.signed_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      }
    }

    // Build splits recap table rows from tracks.splits with signed dates from signature_requests
    const splitsRows = trackSplits
      .map((s) => {
        const signedDate = signedDateMap[s.name || ""] || "";
        const signedLabel = signedDate ? ("\u2705 " + signedDate) : "\u2014";
        return "<tr>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#333;\">" + (s.name || "\u2014") + "</td>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#666;\">" + (s.role || "\u2014") + "</td>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#333;font-weight:bold;text-align:right;\">" + (s.share || 0) + "%</td>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#666;font-size:12px;\">" + (s.pro || "\u2014") + "</td>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#666;font-size:12px;\">" + maskIpi(s.ipi) + "</td>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#666;font-size:12px;\">" + (s.publisher || "\u2014") + "</td>"
          + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#16a34a;font-size:12px;\">" + signedLabel + "</td>"
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

      const emailBody = "<div style=\"text-align:center;margin-bottom:24px;padding:16px;background:rgba(16,185,129,0.1);border-radius:8px;border:1px solid rgba(16,185,129,0.2);\">"
        + "<p style=\"color:#10b981;font-size:18px;font-weight:bold;margin:0;\">\u2705 Agreement Fully Executed</p>"
        + "</div>"
        + "<p>Hi " + sig.collaborator_name + ",</p>"
        + "<p>The split agreement for <strong>" + trackTitle + "</strong> by <strong>" + trackArtist + "</strong> has been fully executed. All parties have signed.</p>"
        + "<div style=\"margin:24px 0;\">"
        + "<h3 style=\"margin-bottom:12px;color:#ffffff;\">Final Split Breakdown</h3>"
        + "<table style=\"width:100%;border-collapse:collapse;font-size:14px;\">"
        + "<thead><tr style=\"background:rgba(249,115,22,0.15);\">"
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
        + "<div style=\"margin:24px 0;padding:16px;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid rgba(255,255,255,0.1);\">"
        + "<p style=\"color:#a1a1aa;font-size:14px;line-height:1.6;margin:0;\">This document serves as confirmation of the agreed ownership splits for <strong>" + trackTitle + "</strong>. All listed parties have reviewed and signed this agreement.</p>"
        + "</div>";

      const htmlBody = buildEmail({
        preheader: "Executed split agreement for " + trackTitle,
        heading: "Executed Split Agreement",
        body: emailBody,
        ctaLabel: "View on Trakalog",
        ctaUrl: "https://app.trakalog.com/tracks",
      });

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + RESEND_API_KEY,
        },
        body: JSON.stringify(Object.assign({
          from: "Trakalog <noreply@trakalog.com>",
          to: [sig.collaborator_email],
          subject: "Executed Split Agreement \u2014 " + trackTitle,
          html: htmlBody,
        }, pdf_base64 ? {
          attachments: [{
            filename: trackTitle + " - Split Agreement.pdf",
            content: pdf_base64,
          }],
        } : {})),
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
