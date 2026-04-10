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
    const { track_id, storage_path } = await req.json();

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

    if (!analyzeResponse.ok) {
      const errText = await analyzeResponse.text().catch(() => "Unknown error");
      return new Response(JSON.stringify({ error: "Sonic DNA API error: " + errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sonicDna = await analyzeResponse.json();

    // 3. Build update payload: always set sonic_dna, conditionally update bpm/key
    const updatePayload: Record<string, unknown> = { sonic_dna: sonicDna };

    if (sonicDna.bpm && sonicDna.bpm_confidence > 0.7) {
      updatePayload.bpm = Math.round(sonicDna.bpm);
    }
    if (sonicDna.key && sonicDna.key_confidence > 0.7) {
      updatePayload.key = sonicDna.key;
    }

    // 4. Update the track in DB
    const { error: updateErr } = await supabaseAdmin
      .from("tracks")
      .update(updatePayload)
      .eq("id", track_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: "Failed to update track: " + updateErr.message }), {
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
