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
import { isValidUUID } from "../_shared/validation.ts";
import { getStorageProvider } from "../_shared/storage.ts";

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

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const supabaseRl = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rateLimitOk } = await supabaseRl.rpc("check_rate_limit", { _key: "watermark:" + ip, _max_requests: 60, _window_seconds: 60 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { storage_path: rawStoragePath, link_id, visitor_email, visitor_name } = await req.json();

    // Extract relative path if a full signed URL was sent instead of a relative path
    let storage_path = rawStoragePath;
    if (storage_path && storage_path.includes("/object/sign/tracks/")) {
      storage_path = decodeURIComponent(storage_path.split("/object/sign/tracks/")[1].split("?")[0]);
    }

    if (!storage_path || !link_id || !visitor_email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: storage_path, link_id, visitor_email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidUUID(link_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid link_id format" }),
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

    // Build cache key: hash of link_id + visitor_email + storage_path.
    // Delivery copy is MP3 128k (.mp3) — the new extension means legacy ".wav"
    // cache objects are never matched, so we never serve a stale WAV.
    const cacheKey = await sha256Hex(`${link_id}_${visitor_email}_${storage_path}`);
    const watermarkedPath = `${cacheKey}.mp3`;

    // All storage I/O routed through the storage abstraction (Supabase or R2 via STORAGE_PROVIDER).
    const storage = getStorageProvider();

    // Check if watermarked file already exists in cache (bucket "watermarked")
    if (await storage.exists("watermarked", watermarkedPath)) {
      try {
        const cachedUrl = await storage.createSignedUrl("watermarked", watermarkedPath, 300);
        return new Response(JSON.stringify({ url: cachedUrl }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        // Cache hit but URL signing failed — fall through and regenerate.
        console.error("get-watermarked-audio: cache sign failed (" + (e instanceof Error ? e.message : "unknown") + ")");
      }
    }

    // 1. Create a signed URL for the original audio (60s) — passed to the Railway watermark service.
    let originalSignedUrl: string;
    try {
      originalSignedUrl = await storage.createSignedUrl("tracks", storage_path, 60);
    } catch (e) {
      console.error("get-watermarked-audio: original sign failed (" + (e instanceof Error ? e.message : "unknown") + ")");
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
        source_url: originalSignedUrl,
        payload,
      }),
    });

    if (!wmResponse.ok) {
      console.error("get-watermarked-audio: watermark encode failed (status=" + wmResponse.status + ", payload_prefix=" + payload.substring(0, 8) + ")");
      return new Response(
        JSON.stringify({ error: "Failed to generate watermarked audio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Upload watermarked audio to "watermarked" bucket via storage abstraction.
    const watermarkedBuffer = await wmResponse.arrayBuffer();
    try {
      await storage.upload("watermarked", watermarkedPath, watermarkedBuffer, "audio/mpeg");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      console.error("get-watermarked-audio upload error:", msg);
      return new Response(
        JSON.stringify({ error: "Failed to generate watermarked audio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Create signed URL for the watermarked file (300s)
    let watermarkedUrl: string;
    try {
      watermarkedUrl = await storage.createSignedUrl("watermarked", watermarkedPath, 300);
    } catch (e) {
      console.error("get-watermarked-audio: watermarked sign failed (" + (e instanceof Error ? e.message : "unknown") + ")");
      return new Response(
        JSON.stringify({ error: "Failed to generate watermarked audio URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ url: watermarkedUrl }), {
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
