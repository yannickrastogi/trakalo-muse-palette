import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

function generateToken(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

interface Split {
  name: string;
  email?: string;
  role: string;
  share: number;
  pro?: string;
  ipi?: string;
  publisher?: string;
}

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { track_id, splits } = await req.json() as { track_id: string; splits: Split[] };

    if (!track_id || !splits || !Array.isArray(splits) || splits.length === 0) {
      return new Response(JSON.stringify({ error: "track_id and splits[] required" }), {
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

    // Fetch track title
    const { data: track, error: trackError } = await supabase
      .from("tracks")
      .select("title")
      .eq("id", track_id)
      .single();

    if (trackError || !track) {
      return new Response(JSON.stringify({ error: "Track not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trackTitle = track.title;

    // Build splits recap HTML rows
    const splitsRows = splits
      .map((s) =>
        "<tr>"
        + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#333;\">" + s.name + "</td>"
        + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#666;\">" + s.role + "</td>"
        + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#333;font-weight:bold;text-align:right;\">" + s.share + "%</td>"
        + "</tr>"
      )
      .join("");

    let sent = 0;

    for (const split of splits) {
      if (!split.email) {
        console.log("Skipping split for " + split.name + ": no email provided");
        continue;
      }

      // Check for existing signature_request for this (track_id, email)
      const { data: existing } = await supabase
        .from("signature_requests")
        .select("id, token, status")
        .eq("track_id", track_id)
        .eq("collaborator_email", split.email)
        .order("status", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing && existing.status === "signed") {
        console.log("Skipping (already signed):", split.email);
        continue;
      }

      let signUrl: string;

      if (existing && existing.status === "pending") {
        // Resend email with existing token — no new row
        console.log("Resending existing token:", split.email);
        signUrl = "https://app.trakalog.com/sign/" + existing.token;
      } else {
        // No existing entry — create new one
        const token = generateToken();
        signUrl = "https://app.trakalog.com/sign/" + token;

        console.log("Sending to:", split.email, "(" + split.name + ")");

        const { error: insertError } = await supabase
          .from("signature_requests")
          .insert({
            track_id,
            collaborator_name: split.name,
            collaborator_email: split.email,
            role: split.role,
            split_share: split.share,
            pro: split.pro || "",
            ipi: split.ipi || "",
            publisher: split.publisher || "",
            token,
          });

        if (insertError) {
          console.error("Insert error for " + split.email + ": " + insertError.message);
          continue;
        }
      }

      const htmlBody = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
        + "<body style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5;\">"
        + "<div style=\"background:#ffffff;border-radius:12px;padding:32px;margin:20px 0;\">"
        + "<div style=\"text-align:center;margin-bottom:24px;\">"
        + "<h1 style=\"color:#f97316;margin:0;font-size:28px;\">Trakalog</h1>"
        + "</div>"
        + "<p style=\"color:#333;font-size:16px;line-height:1.6;\">Hi " + split.name + ",</p>"
        + "<p style=\"color:#333;font-size:16px;line-height:1.6;\">You are invited to review and sign the split agreement for <strong>" + trackTitle + "</strong>.</p>"
        + "<div style=\"margin:24px 0;\">"
        + "<h3 style=\"color:#333;margin-bottom:12px;\">Split Breakdown</h3>"
        + "<table style=\"width:100%;border-collapse:collapse;font-size:14px;\">"
        + "<thead><tr style=\"background:#fff7ed;\">"
        + "<th style=\"padding:10px 12px;text-align:left;color:#f97316;font-weight:600;\">Name</th>"
        + "<th style=\"padding:10px 12px;text-align:left;color:#f97316;font-weight:600;\">Role</th>"
        + "<th style=\"padding:10px 12px;text-align:right;color:#f97316;font-weight:600;\">Share</th>"
        + "</tr></thead>"
        + "<tbody>" + splitsRows + "</tbody>"
        + "</table>"
        + "</div>"
        + "<div style=\"text-align:center;margin:32px 0;\">"
        + "<a href=\"" + signUrl + "\" style=\"display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;\">Review &amp; Sign</a>"
        + "</div>"
        + "<p style=\"color:#999;font-size:13px;line-height:1.5;\">This agreement was prepared via Trakalog. If you disagree with these splits, please contact the track owner directly before signing.</p>"
        + "<hr style=\"border:none;border-top:1px solid #eee;margin:32px 0;\">"
        + "<p style=\"text-align:center;color:#999;font-size:12px;\">Sent via Trakalog</p>"
        + "</div></body></html>";

      // Send email to THIS collaborator's email address
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: "Trakalog <noreply@trakalog.com>",
          to: [split.email],
          subject: "Split Agreement \u2014 " + trackTitle + " \u2014 Signature Required",
          html: htmlBody,
        }),
      });

      if (res.ok) {
        console.log("Email sent successfully to:", split.email);
        sent++;
      } else {
        const errData = await res.json();
        console.error("Resend error for " + split.email + ": " + (errData.message || res.statusText));
      }
    }

    console.log("Total emails sent:", sent, "out of", splits.length, "splits");

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
