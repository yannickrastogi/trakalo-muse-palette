// Supabase Edge Function: analyze-sonic-dna
// Sends audio to Sonic DNA API for analysis, stores results in tracks table.
//
// POST /analyze-sonic-dna
// Body: { track_id: uuid, storage_path: string }
// Returns: { success: true, sonic_dna: object } or { error: string }
//
// Deploy: supabase functions deploy analyze-sonic-dna

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

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
    const { track_id, storage_path, force } = await req.json();

    if (!track_id || !storage_path) {
      return new Response(JSON.stringify({ error: "Missing track_id or storage_path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Create a signed URL for the audio file
    const { data: signedData, error: signErr } = await supabaseAdmin
      .storage
      .from("tracks")
      .createSignedUrl(storage_path, 600); // 10 min validity

    if (signErr || !signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: "Failed to generate signed URL for audio" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Call Sonic DNA API
    const sonicDnaApiUrl = Deno.env.get("SONIC_DNA_API_URL");
    const sonicDnaApiKey = Deno.env.get("SONIC_DNA_API_KEY");

    // DEBUG: log API key presence for troubleshooting
    console.log('[SonicDNA] API URL:', sonicDnaApiUrl);
    console.log('[SonicDNA] API KEY exists:', !!sonicDnaApiKey);
    console.log('[SonicDNA] API KEY length:', sonicDnaApiKey?.length);
    if (sonicDnaApiKey) {
      console.log('[SonicDNA] Key preview:', sonicDnaApiKey.substring(0, 6) + '...' + sonicDnaApiKey.substring(sonicDnaApiKey.length - 6));
    }

    if (!sonicDnaApiUrl || !sonicDnaApiKey) {
      return new Response(JSON.stringify({ error: "Sonic DNA API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

    console.log('[SonicDNA] Calling Railway:', sonicDnaApiUrl + '/analyze');

    let analyzeResponse: Response;
    try {
      analyzeResponse = await fetch(sonicDnaApiUrl + "/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": sonicDnaApiKey,
        },
        body: JSON.stringify({ source_url: signedData.signedUrl }),
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

    console.log('[SonicDNA] Railway response status:', analyzeResponse.status);
    if (!analyzeResponse.ok) {
      const errText = await analyzeResponse.text().catch(() => "Unknown error");
      console.log('[SonicDNA] Railway error body:', errText);
      return new Response(JSON.stringify({ error: "Sonic DNA API error: " + errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sonicDna = await analyzeResponse.json();

    console.log('[SonicDNA] Sonic DNA result keys:', Object.keys(sonicDna));
    console.log('[SonicDNA] BPM:', JSON.stringify(sonicDna.bpm));
    console.log('[SonicDNA] Saving to DB for track:', track_id);

    // 3. Build update payload: always set sonic_dna, conditionally update bpm/key
    // BPM and key are nested objects: sonicDna.bpm = { bpm, confidence, ... }, sonicDna.key = { key, mode, confidence }
    const updatePayload: Record<string, unknown> = { sonic_dna: sonicDna };

    // Fetch existing track to check if user already provided BPM/Key
    const { data: existingTrack } = await supabaseAdmin
      .from("tracks")
      .select("bpm, key")
      .eq("id", track_id)
      .single();

    const hasUserBpm = !force && existingTrack?.bpm != null && existingTrack.bpm > 0;
    const hasUserKey = !force && existingTrack?.key != null && existingTrack.key !== "";

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

    console.log('[SonicDNA] Existing BPM:', existingTrack?.bpm, 'Key:', existingTrack?.key);
    console.log('[SonicDNA] Updating track BPM:', updatePayload.bpm ?? 'skipped (user-provided)', 'Key:', updatePayload.key ?? 'skipped (user-provided)');

    // 4. Update the track in DB
    try {
      const { error: updateErr } = await supabaseAdmin
        .from("tracks")
        .update(updatePayload)
        .eq("id", track_id);

      if (updateErr) {
        console.log('[SonicDNA] DB update error:', updateErr.message);
        return new Response(JSON.stringify({ error: "Failed to update track: " + updateErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (dbErr) {
      console.log('[SonicDNA] DB update exception:', dbErr);
      return new Response(JSON.stringify({ error: "DB update exception: " + String(dbErr) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('[SonicDNA] Successfully saved sonic_dna for track:', track_id);
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
