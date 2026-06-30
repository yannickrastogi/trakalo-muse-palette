// Supabase Edge Function: trace-leak
// Decodes an audio watermark and traces the leak source.
//
// POST /trace-leak (multipart/form-data)
// Fields: audio (file), workspace_id, user_id
// Returns: { match: boolean, hash_hex?, confidence?, visitor_email?, visitor_name?, link_id?, raw_payload?, trace_id? }
//
// Deploy: supabase functions deploy trace-leak

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { isValidUUID } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const supabaseRateLimit = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rateLimitOk } = await supabaseRateLimit.rpc("check_rate_limit", { _key: "trace-leak:" + ip, _max_requests: 5, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ error: "Expected multipart/form-data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const workspaceId = formData.get("workspace_id") as string | null;
    const userId = formData.get("user_id") as string | null;
    const fileName = formData.get("file_name") as string | null;

    const missingFields: string[] = [];
    if (!audioFile) missingFields.push("audio");
    if (!workspaceId) missingFields.push("workspace_id");
    if (!userId) missingFields.push("user_id");

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ error: `Missing required fields: ${missingFields.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidUUID(workspaceId) || !isValidUUID(userId)) {
      return new Response(
        JSON.stringify({ error: "Invalid workspace_id or user_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const WATERMARK_API_URL = Deno.env.get("WATERMARK_API_URL");
    const WATERMARK_API_KEY = Deno.env.get("WATERMARK_API_KEY");

    if (!WATERMARK_API_URL || !WATERMARK_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Watermark service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Send audio to watermark service /decode
    const decodeForm = new FormData();
    decodeForm.append("audio", audioFile);

    const decodeRes = await fetch(`${WATERMARK_API_URL}/decode`, {
      method: "POST",
      headers: { "x-api-key": WATERMARK_API_KEY },
      body: decodeForm,
    });

    if (!decodeRes.ok) {
      const errText = await decodeRes.text();
      return new Response(
        JSON.stringify({ error: "Watermark decode failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const decodeResult = await decodeRes.json();
    const hashHex = decodeResult.payload;
    const confidence = decodeResult.confidence;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Look up hash in watermark_payloads
    let match = false;
    let visitorEmail: string | null = null;
    let visitorName: string | null = null;
    let linkId: string | null = null;
    let rawPayload: string | null = null;

    if (hashHex && confidence && confidence > 0) {
      const { data: payloadRow } = await supabaseAdmin
        .from("watermark_payloads")
        .select("*")
        .eq("hash_hex", hashHex)
        .single();

      if (payloadRow) {
        match = true;
        visitorEmail = payloadRow.visitor_email;
        visitorName = payloadRow.visitor_name;
        linkId = payloadRow.link_id;
        rawPayload = payloadRow.raw_payload;
      }
    }

    // 2b. Resolve the leaker's IP. Best-effort and fully additive: any failure here
    // leaves leakerIp/ipSource null and never affects the decode/match result.
    let leakerIp: string | null = null;
    let ipSource: "download" | "listen" | "link_only" | null = null;
    const normIp = (v: unknown): string | null => {
      if (typeof v !== "string") return null;
      const s = v.trim();
      return s && s.toLowerCase() !== "unknown" ? s : null;
    };
    if (match && linkId) {
      try {
        // Priority 1: a download by this visitor on this link — the leak act itself.
        if (visitorEmail) {
          const { data: dl } = await supabaseAdmin
            .from("link_downloads")
            .select("visitor_ip, ip_address, downloaded_at")
            .eq("link_id", linkId)
            .eq("downloader_email", visitorEmail)
            .order("downloaded_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (dl) {
            const ip2 = normIp(dl.visitor_ip) || normIp(dl.ip_address);
            if (ip2) { leakerIp = ip2; ipSource = "download"; }
          }
        }
        // Priority 2: a listen/play event by this visitor on this link.
        if (!leakerIp && visitorEmail) {
          const { data: ev } = await supabaseAdmin
            .from("link_events")
            .select("visitor_ip, created_at")
            .eq("link_id", linkId)
            .eq("visitor_email", visitorEmail)
            .not("visitor_ip", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (ev) {
            const ip2 = normIp(ev.visitor_ip);
            if (ip2) { leakerIp = ip2; ipSource = "listen"; }
          }
        }
        // Priority 3 (fallback): fake / non-matching email — resolve by link_id alone.
        // Most recent valid IP across this link's downloads + events.
        if (!leakerIp) {
          const [dlRes, evRes] = await Promise.all([
            supabaseAdmin
              .from("link_downloads")
              .select("visitor_ip, ip_address, downloaded_at")
              .eq("link_id", linkId)
              .order("downloaded_at", { ascending: false })
              .limit(10),
            supabaseAdmin
              .from("link_events")
              .select("visitor_ip, created_at")
              .eq("link_id", linkId)
              .not("visitor_ip", "is", null)
              .order("created_at", { ascending: false })
              .limit(10),
          ]);
          const candidates: { ip: string; ts: string }[] = [];
          for (const r of (dlRes.data || [])) {
            const ip2 = normIp(r.visitor_ip) || normIp(r.ip_address);
            if (ip2) candidates.push({ ip: ip2, ts: r.downloaded_at });
          }
          for (const r of (evRes.data || [])) {
            const ip2 = normIp(r.visitor_ip);
            if (ip2) candidates.push({ ip: ip2, ts: r.created_at });
          }
          candidates.sort((a, b) => (a.ts < b.ts ? 1 : -1));
          if (candidates.length > 0) { leakerIp = candidates[0].ip; ipSource = "link_only"; }
        }
      } catch (_e) {
        // IP resolution is best-effort; leave leakerIp/ipSource null on any error.
      }
    }

    // 3. Insert trace record
    const { data: trace, error: traceErr } = await supabaseAdmin
      .from("leak_traces")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        file_name: fileName || audioFile.name || "unknown",
        hash_hex: hashHex || null,
        confidence: confidence || 0,
        match,
        visitor_email: visitorEmail,
        visitor_name: visitorName,
        link_id: linkId,
        raw_payload: rawPayload,
        leaker_ip: leakerIp,
        ip_source: ipSource,
      })
      .select("id")
      .single();

    return new Response(JSON.stringify({
      match,
      hash_hex: hashHex || null,
      confidence: confidence || 0,
      visitor_email: visitorEmail,
      visitor_name: visitorName,
      link_id: linkId,
      raw_payload: rawPayload,
      trace_id: trace?.id || null,
      leaker_ip: leakerIp,
      ip_source: ipSource,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
