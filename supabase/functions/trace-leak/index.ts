// Supabase Edge Function: trace-leak
// Decodes an audio watermark and traces the leak source.
//
// POST /trace-leak (multipart/form-data)
// Fields: audio (file), workspace_id, user_id
// Returns: { match: boolean, hash_hex?, confidence?, visitor_email?, visitor_name?, link_id?, raw_payload?, trace_id? }
//
// Deploy: supabase functions deploy trace-leak

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

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

    if (!audioFile || !workspaceId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: audio, workspace_id, user_id" }),
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
