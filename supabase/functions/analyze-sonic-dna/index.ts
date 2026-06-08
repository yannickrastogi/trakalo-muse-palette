// Supabase Edge Function: analyze-sonic-dna
// Sends audio to Sonic DNA API for analysis, stores results in tracks table.
//
// POST /analyze-sonic-dna
// Body: { track_id: uuid, storage_path: string }
// Returns: { success: true, sonic_dna: object } or { error: string }
//
// Deploy: supabase functions deploy analyze-sonic-dna

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { isValidUUID } from "../_shared/validation.ts";
import { getStorageProvider } from "../_shared/storage.ts";

Deno.serve(async (req) => {
  // CORS preflight
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
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "sonic-dna:" + ip, _max_requests: 20, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { track_id, storage_path, force } = await req.json();

    if (!track_id || !storage_path) {
      return new Response(JSON.stringify({ error: "Missing track_id or storage_path" }), {
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

    // 1. Create a signed URL for the audio file (10 min validity for the Sonic DNA service).
    // Routed through the storage abstraction (Supabase or R2 via STORAGE_PROVIDER env).
    //
    // Legacy Supabase-direct call (kept here as comment for Phase 2 rollback reference):
    //   const { data: signedData, error: signErr } = await supabaseAdmin
    //     .storage.from("tracks").createSignedUrl(storage_path, 600);
    let audioSignedUrl: string;
    try {
      audioSignedUrl = await getStorageProvider().createSignedUrl("tracks", storage_path, 600);
    } catch (e) {
      console.error("analyze-sonic-dna: sign failed (" + (e instanceof Error ? e.message : "unknown") + ")");
      return new Response(JSON.stringify({ error: "Failed to generate signed URL for audio" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Call Sonic DNA API
    const sonicDnaApiUrl = Deno.env.get("SONIC_DNA_API_URL");
    const sonicDnaApiKey = Deno.env.get("SONIC_DNA_API_KEY");

    if (!sonicDnaApiUrl || !sonicDnaApiKey) {
      return new Response(JSON.stringify({ error: "Sonic DNA API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

    let analyzeResponse: Response;
    try {
      analyzeResponse = await fetch(sonicDnaApiUrl + "/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": sonicDnaApiKey,
        },
        body: JSON.stringify({ source_url: audioSignedUrl }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error && err.name === "AbortError"
        ? "Sonic DNA API timeout (120s)"
        : "Failed to reach Sonic DNA API";
      return new Response(JSON.stringify({ error: message }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(timeout);

    if (!analyzeResponse.ok) {
      const errText = await analyzeResponse.text().catch(() => "Unknown error");
      return new Response(JSON.stringify({ error: "Sonic DNA API error: " + errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sonicDna = await analyzeResponse.json();

    // 3. Build update payload: always set sonic_dna, conditionally update bpm/key
    // BPM and key are nested objects: sonicDna.bpm = { bpm, confidence, ... }, sonicDna.key = { key, mode, confidence }

    // Fetch existing track metadata + existing sonic_dna to:
    //   - sync columns into sonic_dna.user_metadata
    //   - read user_overrides so we never overwrite user-corrected fields (sticky, ignored by `force`)
    const { data: existingTrack } = await supabaseAdmin
      .from("tracks")
      .select("bpm, key, title, artist, featuring, genre, mood, gender, language, track_type, tags, sonic_dna")
      .eq("id", track_id)
      .single();

    const existingSonicDnaObj = (existingTrack?.sonic_dna as Record<string, unknown> | null) || null;
    const existingUserMeta = (existingSonicDnaObj?.user_metadata as Record<string, unknown>) || {};
    const userOverrides = (existingSonicDnaObj?.user_overrides as Record<string, boolean>) || {};

    // Preserve user_overrides on the new analysis payload
    if (Object.keys(userOverrides).length > 0) {
      sonicDna.user_overrides = userOverrides;
    }

    // Sync track metadata into sonic_dna.user_metadata; prefer user-overridden values
    if (existingTrack) {
      sonicDna.user_metadata = {
        ...(sonicDna.user_metadata || {}),
        title: existingTrack.title,
        artist: existingTrack.artist,
        featuring: existingTrack.featuring,
        genre: existingTrack.genre,
        type: existingTrack.track_type || "Song",
        mood: existingTrack.mood || [],
        gender: existingTrack.gender,
        language: existingTrack.language,
        bpm: userOverrides.bpm ? (existingUserMeta.bpm ?? existingTrack.bpm) : existingTrack.bpm,
        key: userOverrides.key ? (existingUserMeta.key ?? existingTrack.key) : existingTrack.key,
        tags: existingTrack.tags || {},
      };
    }

    const updatePayload: Record<string, unknown> = { sonic_dna: sonicDna };

    // User overrides are STICKY: a true flag protects the column even when force=true.
    // For non-overridden fields, the original guard (don't clobber an existing value) still applies unless force.
    const hasUserBpm = userOverrides.bpm === true || (!force && existingTrack?.bpm != null && existingTrack.bpm > 0);
    const hasUserKey = userOverrides.key === true || (!force && existingTrack?.key != null && existingTrack.key !== "");

    const bpmData = sonicDna.bpm;
    if (bpmData && typeof bpmData === "object" && bpmData.bpm && bpmData.confidence > 0.7 && !hasUserBpm) {
      updatePayload.bpm = Math.round(bpmData.bpm);
    }
    const keyData = sonicDna.key;
    if (keyData && typeof keyData === "object" && keyData.key && keyData.confidence > 0.7 && !hasUserKey) {
      // Format key to match DB format: "A Min", "C# Maj", etc.
      const mode = keyData.mode === "Minor" ? "Min" : "Maj";
      updatePayload.key = keyData.key + " " + mode;
    }

    // 4. Update the track in DB
    try {
      const { error: updateErr } = await supabaseAdmin
        .from("tracks")
        .update(updatePayload)
        .eq("id", track_id);

      if (updateErr) {
        console.error("analyze-sonic-dna update error:", updateErr.message);
        return new Response(JSON.stringify({ error: "Failed to update track analysis" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (dbErr) {
      console.error("analyze-sonic-dna: DB exception (" + (dbErr instanceof Error ? dbErr.name : "unknown") + ")");
      return new Response(JSON.stringify({ error: "Failed to update track analysis" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, sonic_dna: sonicDna }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
