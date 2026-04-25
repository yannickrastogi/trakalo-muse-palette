import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { buildEmail, isValidEmail, htmlEscape } from "../_shared/email-template.ts";
import { isValidUUID } from "../_shared/validation.ts";

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

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const supabaseRl = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rateLimitOk } = await supabaseRl.rpc("check_rate_limit", { _key: "split-sig:" + ip, _max_requests: 10, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { track_id, splits } = await req.json() as { track_id: string; splits: Split[] };

    if (!track_id || !splits || !Array.isArray(splits) || splits.length === 0) {
      return new Response(JSON.stringify({ error: "track_id and splits[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidUUID(track_id)) {
      return new Response(JSON.stringify({ error: "Invalid track_id format" }), {
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
        + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#333;\">" + htmlEscape(s.name) + "</td>"
        + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#666;\">" + htmlEscape(s.role) + "</td>"
        + "<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#333;font-weight:bold;text-align:right;\">" + s.share + "%</td>"
        + "</tr>"
      )
      .join("");

    let sent = 0;

    for (const split of splits) {
      if (!split.email || !isValidEmail(split.email)) {
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
        continue;
      }

      let signUrl: string;

      if (existing && existing.status === "pending") {
        // Resend email with existing token — no new row
        signUrl = "https://app.trakalog.com/sign/" + existing.token;
      } else {
        // No existing entry — create new one
        const token = generateToken();
        signUrl = "https://app.trakalog.com/sign/" + token;

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

      const emailBody = "<p>Hi " + htmlEscape(split.name) + ",</p>"
        + "<p>You are invited to review and sign the split agreement for <strong>" + htmlEscape(trackTitle) + "</strong>.</p>"
        + "<div style=\"margin:24px 0;\">"
        + "<h3 style=\"margin-bottom:12px;color:#ffffff;\">Split Breakdown</h3>"
        + "<table style=\"width:100%;border-collapse:collapse;font-size:14px;\">"
        + "<thead><tr style=\"background:rgba(249,115,22,0.15);\">"
        + "<th style=\"padding:10px 12px;text-align:left;color:#f97316;font-weight:600;\">Name</th>"
        + "<th style=\"padding:10px 12px;text-align:left;color:#f97316;font-weight:600;\">Role</th>"
        + "<th style=\"padding:10px 12px;text-align:right;color:#f97316;font-weight:600;\">Share</th>"
        + "</tr></thead>"
        + "<tbody>" + splitsRows + "</tbody>"
        + "</table>"
        + "</div>"
        + "<p style=\"color:#71717a;font-size:13px;line-height:1.5;\">This agreement was prepared via Trakalog. If you disagree with these splits, please contact the track owner directly before signing.</p>";

      const htmlBody = buildEmail({
        preheader: "Split agreement for " + htmlEscape(trackTitle),
        heading: "Split Agreement — Signature Required",
        body: emailBody,
        ctaLabel: "Review & Sign",
        ctaUrl: signUrl,
      });

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
        sent++;
      } else {
        const errData = await res.json();
        console.error("Resend error for " + split.email + ": " + (errData.message || res.statusText));
      }
    }

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
