import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { isValidUUID } from "../_shared/validation.ts";
import { getAuthedUser, assertWorkspaceMember, resolveTrackWorkspace, HttpError } from "../_shared/auth.ts";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "compress:" + ip, _max_requests: 10, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // Authenticate the caller FIRST (fail-closed before any work).
    const { user } = await getAuthedUser(req);

    const { track_id, audio_path } = await req.json();

    if (!track_id || !audio_path) {
      return new Response(JSON.stringify({ error: "track_id and audio_path required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidUUID(track_id)) {
      return new Response(JSON.stringify({ error: "Invalid track_id format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof audio_path !== "string" || audio_path.includes('..') || audio_path.includes('//') || audio_path.startsWith('/')) {
      return new Response(JSON.stringify({ error: "Invalid file path" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: only an editor of the track's own workspace may compress it,
    // and audio_path must belong to that same workspace (prefix scoping) so a
    // valid track_id can't be paired with a foreign path.
    const ws = await resolveTrackWorkspace(supabaseAdmin, track_id);
    if (!ws) {
      return new Response(JSON.stringify({ error: "Track not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await assertWorkspaceMember(supabaseAdmin, user.id, ws, "editor");

    if (!audio_path.startsWith(ws + "/")) {
      return new Response(JSON.stringify({ error: "Invalid file path" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Download original file from storage
    const { data: fileData, error: dlError } = await supabaseAdmin.storage
      .from("tracks")
      .download(audio_path);

    if (dlError || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download original file" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Run FFmpeg WASM to convert to MP3 128kbps
    const ffmpegModule = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/+esm");
    const { FFmpeg } = ffmpegModule;
    const ffmpeg = new FFmpeg();

    const coreURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js";
    const wasmURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm";

    await ffmpeg.load({ coreURL, wasmURL });

    const inputBuffer = new Uint8Array(await fileData.arrayBuffer());
    const inputExt = audio_path.split(".").pop() || "wav";

    await ffmpeg.writeFile("input." + inputExt, inputBuffer);
    await ffmpeg.exec(["-i", "input." + inputExt, "-codec:a", "libmp3lame", "-b:a", "128k", "-y", "output.mp3"]);
    const outputData = await ffmpeg.readFile("output.mp3");

    // 3. Upload compressed MP3 to storage
    const previewPath = audio_path.replace(/\.[^.]+$/, "_preview.mp3");
    const mp3Blob = new Blob([outputData], { type: "audio/mp3" });

    const { error: uploadError } = await supabaseAdmin.storage
      .from("tracks")
      .upload(previewPath, mp3Blob, { contentType: "audio/mp3", upsert: true });

    if (uploadError) {
      console.error("compress-audio upload error:", uploadError.message);
      return new Response(JSON.stringify({ error: "Failed to compress audio" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Update track record with preview URL
    const { error: updateError } = await supabaseAdmin
      .from("tracks")
      .update({ audio_preview_url: previewPath })
      .eq("id", track_id)
      .eq("workspace_id", ws);

    if (updateError) {
      console.error("compress-audio update error:", updateError.message);
      return new Response(JSON.stringify({ error: "Failed to compress audio" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, preview_path: previewPath }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
