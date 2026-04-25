import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { isValidUUID } from "../_shared/validation.ts";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "transcribe:" + ip, _max_requests: 10, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { track_id } = await req.json();

    if (!track_id) {
      return new Response(JSON.stringify({ error: "track_id required" }), {
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

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get the track's audio paths
    const { data: track, error: trackErr } = await supabaseAdmin
      .from("tracks")
      .select("audio_preview_url, audio_url")
      .eq("id", track_id)
      .single();

    if (trackErr || !track) {
      return new Response(JSON.stringify({ error: "Track not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prefer original audio (WAV) for better transcription quality, fallback to MP3 preview
    const originalPath = track.audio_url as string;
    const previewPath = track.audio_preview_url as string;

    if (!originalPath && !previewPath) {
      return new Response(JSON.stringify({ error: "No audio file available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate storage paths to prevent traversal
    function isValidStoragePath(p: string): boolean {
      return !!p && !p.includes('..') && !p.includes('//') && !p.startsWith('/');
    }
    if ((originalPath && !isValidStoragePath(originalPath)) || (previewPath && !isValidStoragePath(previewPath))) {
      return new Response(JSON.stringify({ error: "Invalid file path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Download audio via fresh signed URL — try original first, fallback to preview if too large
    let audioPath = originalPath || previewPath;
    let fileData: Blob | null = null;

    // Helper: create a fresh signed URL and fetch the file
    async function fetchViaSignedUrl(path: string): Promise<Blob | null> {
      const { data: signedData, error: signErr } = await supabaseAdmin.storage
        .from("tracks")
        .createSignedUrl(path, 3600);
      if (signErr || !signedData?.signedUrl) return null;
      const res = await fetch(signedData.signedUrl);
      if (!res.ok) return null;
      return await res.blob();
    }

    if (originalPath) {
      const blob = await fetchViaSignedUrl(originalPath);
      if (blob && blob.size <= 25 * 1024 * 1024) {
        fileData = blob;
        audioPath = originalPath;
      }
    }

    // Fallback to MP3 preview if original unavailable or > 25MB
    if (!fileData && previewPath) {
      const blob = await fetchViaSignedUrl(previewPath);
      if (blob) {
        fileData = blob;
        audioPath = previewPath;
      }
    }

    if (!fileData) {
      return new Response(JSON.stringify({ error: "Failed to download audio file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Send to Groq Whisper API
    const fileName = audioPath.split("/").pop() || "audio.mp3";
    const isWav = fileName.toLowerCase().endsWith(".wav");
    const mimeType = isWav ? "audio/wav" : "audio/mpeg";
    const formData = new FormData();
    formData.append("file", new File([fileData], fileName, { type: mimeType }));
    formData.append("model", "whisper-large-v3");
    formData.append("response_format", "verbose_json");
    formData.append("temperature", "0.0");

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + groqApiKey,
      },
      body: formData,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return new Response(JSON.stringify({ error: "Groq API error: " + errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await groqRes.json();

    // Format lyrics using segments with timestamps
    let formattedLyrics = "";
    const lyricsSegments: { start: number; end: number; text: string }[] = [];
    if (result.segments && result.segments.length > 0) {
      const lines: string[] = [];
      for (let i = 0; i < result.segments.length; i++) {
        const segment = result.segments[i];
        const text = (segment.text || "").trim();
        if (!text) continue;

        // Save segment with timestamps for synchronized lyrics
        lyricsSegments.push({
          start: segment.start || 0,
          end: segment.end || 0,
          text,
        });

        // Add blank line if gap > 2s between segments (verse/chorus separation)
        if (i > 0 && lines.length > 0) {
          const prevEnd = result.segments[i - 1].end || 0;
          const currStart = segment.start || 0;
          if (currStart - prevEnd > 2) {
            lines.push("");
          }
        }

        lines.push(text);
      }
      formattedLyrics = lines.join("\n");
    } else {
      formattedLyrics = (result.text || "").trim();
    }

    const transcribedText = formattedLyrics;

    // 4. Check if meaningful text was transcribed
    if (!transcribedText || transcribedText.length < 10) {
      return new Response(JSON.stringify({ success: true, lyrics: "", empty: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Update lyrics in DB with auto-transcribed marker
    const lyricsWithMarker = "[auto-transcribed]\n" + transcribedText;

    const updatePayload: Record<string, unknown> = { lyrics: lyricsWithMarker };
    if (lyricsSegments.length > 0) {
      updatePayload.lyrics_segments = lyricsSegments;
    }

    const { error: updateError } = await supabaseAdmin
      .from("tracks")
      .update(updatePayload)
      .eq("id", track_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update lyrics: " + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, lyrics: transcribedText }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
