// Supabase Edge Function: get-watermarked-audio
// Generates a watermarked audio file for shared link playback.
//
// POST /get-watermarked-audio
// Body: { storage_path: string, link_id: string, visitor_email: string, visitor_name: string }
// Returns: { url: string } or { error: string }
//
// Deploy: supabase functions deploy get-watermarked-audio

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  // CORS preflight
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
    const { storage_path, link_id, visitor_email, visitor_name } = await req.json();

    if (!storage_path || !link_id || !visitor_email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: storage_path, link_id, visitor_email" }),
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Build cache key: hash of link_id + visitor_email + storage_path
    const cacheKey = await sha256Hex(`${link_id}_${visitor_email}_${storage_path}`);
    const watermarkedPath = `${cacheKey}.wav`;

    // Check if watermarked file already exists in cache (bucket "watermarked")
    const { data: existingFile } = await supabaseAdmin.storage
      .from("watermarked")
      .createSignedUrl(watermarkedPath, 300);

    if (existingFile?.signedUrl) {
      return new Response(JSON.stringify({ url: existingFile.signedUrl }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create a signed URL for the original audio (60s)
    const { data: originalSigned, error: signErr } = await supabaseAdmin.storage
      .from("tracks")
      .createSignedUrl(storage_path, 60);

    if (signErr || !originalSigned?.signedUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to access original audio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Build watermark payload — hash to 128-bit hex for audiowmark
    const rawPayload = `lid_${link_id}_v_${visitor_email}`;
    const payloadHashFull = await sha256Hex(rawPayload);
    const payload = payloadHashFull.substring(0, 32); // 128 bits = 16 bytes = 32 hex chars

    // Store mapping hash_hex → original payload for leak tracing
    await supabaseAdmin
      .from("watermark_payloads")
      .upsert({ hash_hex: payload, raw_payload: rawPayload, link_id, visitor_email, visitor_name: visitor_name || null }, { onConflict: "hash_hex" });

    // 3. Call watermark service with source_url
    const wmResponse = await fetch(`${WATERMARK_API_URL}/encode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": WATERMARK_API_KEY,
      },
      body: JSON.stringify({
        source_url: originalSigned.signedUrl,
        payload,
      }),
    });

    if (!wmResponse.ok) {
      const wmError = await wmResponse.text();
      return new Response(
        JSON.stringify({ error: "Watermark encoding failed", details: wmError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Upload watermarked audio to "watermarked" bucket
    const watermarkedBuffer = await wmResponse.arrayBuffer();

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("watermarked")
      .upload(watermarkedPath, watermarkedBuffer, {
        contentType: "audio/wav",
        upsert: false,
      });

    if (uploadErr) {
      return new Response(
        JSON.stringify({ error: "Failed to store watermarked audio", details: uploadErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Create signed URL for the watermarked file (300s)
    const { data: wmSigned, error: wmSignErr } = await supabaseAdmin.storage
      .from("watermarked")
      .createSignedUrl(watermarkedPath, 300);

    if (wmSignErr || !wmSigned?.signedUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to generate watermarked audio URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ url: wmSigned.signedUrl }), {
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
