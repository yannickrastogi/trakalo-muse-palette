import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { isValidUUID } from "../_shared/validation.ts";
import { getStorageProvider } from "../_shared/storage.ts";
import { getAuthedUser, assertWorkspaceMember, resolveTrackWorkspace, HttpError } from "../_shared/auth.ts";

// tracks.language stores free-text English names ("English", "French",
// "English, Punjabi", "Instrumental"). Whisper wants an ISO-639-1 code to force
// the language. Map the names we know; anything unknown (incl. "Instrumental")
// → null, which triggers the detect-then-force fallback.
const LANG_NAME_TO_ISO: Record<string, string> = {
  afrikaans: "af", albanian: "sq", amharic: "am", arabic: "ar", armenian: "hy", azerbaijani: "az",
  bengali: "bn", bosnian: "bs", bulgarian: "bg", burmese: "my",
  cantonese: "zh", catalan: "ca", chinese: "zh", "chinese (mandarin)": "zh", mandarin: "zh", croatian: "hr", czech: "cs",
  danish: "da", dutch: "nl",
  english: "en", estonian: "et",
  farsi: "fa", persian: "fa", filipino: "tl", finnish: "fi", french: "fr",
  galician: "gl", georgian: "ka", german: "de", greek: "el", gujarati: "gu",
  "haitian creole": "ht", hausa: "ha", hebrew: "he", hindi: "hi", hungarian: "hu",
  icelandic: "is", indonesian: "id", irish: "ga", italian: "it",
  japanese: "ja", javanese: "jw",
  kannada: "kn", kazakh: "kk", khmer: "km", korean: "ko",
  lao: "lo", latin: "la", latvian: "lv", lithuanian: "lt",
  macedonian: "mk", malay: "ms", malayalam: "ml", maltese: "mt", maori: "mi", marathi: "mr", mongolian: "mn",
  nepali: "ne", norwegian: "no",
  pashto: "ps", polish: "pl", portuguese: "pt", punjabi: "pa",
  romanian: "ro", russian: "ru",
  serbian: "sr", sinhala: "si", slovak: "sk", slovenian: "sl", somali: "so", spanish: "es", swahili: "sw", swedish: "sv",
  tagalog: "tl", tamil: "ta", telugu: "te", thai: "th", tibetan: "bo", turkish: "tr",
  ukrainian: "uk", urdu: "ur", uzbek: "uz",
  vietnamese: "vi",
  welsh: "cy",
  yiddish: "yi", yoruba: "yo",
};
const ISO_CODES = new Set(Object.values(LANG_NAME_TO_ISO));

// Convert a free-text language name (or an already-ISO code) to ISO-639-1, or
// null when we can't (empty / "Instrumental" / unknown). Multi-language values
// ("English, Punjabi") resolve to the first entry.
function toISO639_1(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(/[,/&]/)[0].trim().toLowerCase();
  if (!first) return null;
  if (LANG_NAME_TO_ISO[first]) return LANG_NAME_TO_ISO[first];
  if (/^[a-z]{2}$/.test(first) && ISO_CODES.has(first)) return first;
  return null;
}

function titleCaseLang(name: string): string {
  const n = (name || "").trim();
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : n;
}

// First N seconds of audio as a Blob prefix, sliced from the already-downloaded
// bytes (no extra network round-trip). For WAV we read the exact ByteRate from
// the canonical 44-byte header; for MP3 we assume ~128 kbps. Truncated audio is
// still decodable by Whisper's ffmpeg backend up to the cut point.
async function firstNSecondsBlob(blob: Blob, isWav: boolean, seconds: number): Promise<Blob> {
  let bytesPerSec = 16000; // MP3 ~128 kbps
  let headerBytes = 0;
  if (isWav) {
    headerBytes = 44;
    bytesPerSec = 176400; // 44.1 kHz / 16-bit / stereo fallback
    try {
      const head = new Uint8Array(await blob.slice(0, 44).arrayBuffer());
      if (head.length >= 32) {
        const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
        const br = dv.getUint32(28, true); // ByteRate field
        if (br >= 8000 && br <= 4_000_000) bytesPerSec = br;
      }
    } catch { /* keep fallback bytesPerSec */ }
  }
  const wanted = headerBytes + bytesPerSec * seconds;
  return blob.size <= wanted ? blob : blob.slice(0, wanted);
}

// One Groq Whisper call. Appends `language` when an ISO code is given (forces the
// language, preventing mid-song drift). Throws on a non-2xx upstream; the caller
// decides whether that's fatal (full pass) or ignorable (detection pass). Never
// echoes the upstream body or the API key to the client.
async function callGroqTranscription(
  apiKey: string, blob: Blob, fileName: string, mimeType: string, isoLang: string | null,
): Promise<{ text?: string; language?: string; segments?: Array<Record<string, unknown>> }> {
  const formData = new FormData();
  formData.append("file", new File([blob], fileName, { type: mimeType }));
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "verbose_json");
  formData.append("temperature", "0.0");
  if (isoLang) formData.append("language", isoLang);

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey },
    body: formData,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    console.error("transcribe-lyrics: Groq API error (HTTP " + res.status + "): " + errText);
    throw new Error("groq_http_" + res.status);
  }
  return await res.json();
}

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
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
    // Authenticate the caller FIRST (fail-closed before any work).
    const { user } = await getAuthedUser(req);

    const body = await req.json();
    const track_id = body.track_id;
    // Optional caller-chosen language (from the "re-transcribe in…" picker).
    // Overrides tracks.language for this run. Bounded; validated via toISO639_1.
    const languageOverride = typeof body.language === "string" ? body.language.trim().slice(0, 64) : "";

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

    // Authorization: only an editor of the track's own workspace may transcribe
    // (reads the master audio + writes lyrics).
    const ws = await resolveTrackWorkspace(supabaseAdmin, track_id);
    if (!ws) {
      return new Response(JSON.stringify({ error: "Track not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await assertWorkspaceMember(supabaseAdmin, user.id, ws, "editor");

    // Billing gate: lyrics transcription is an INCLUDED Starter+ feature (Free =
    // false), consuming NO credits. Read the user's plan feature flag.
    const { data: sub } = await supabaseAdmin
      .from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle();
    const plan = (sub?.plan as string) || "free";
    const { data: planRow } = await supabaseAdmin
      .from("plan_limits").select("features").eq("plan", plan).maybeSingle();
    const features = (planRow?.features ?? {}) as Record<string, unknown>;
    if (features.lyrics_transcription !== true) {
      return new Response(JSON.stringify({ error: "plan_limit_reached", feature: "lyrics_transcription" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti-abuse: cap repeated re-transcription of the SAME track by this user
    // (5 / hour). Uses the shared check_rate_limit infra — not a billing quota.
    const { data: perTrackOk } = await supabaseAdmin.rpc("check_rate_limit", {
      _key: "transcribe-track:" + user.id + ":" + track_id,
      _max_requests: 5,
      _window_seconds: 3600,
    });
    if (perTrackOk === false) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Usage guards — refuse BEFORE any paid Groq call, narrowest → widest, stopping
    // at the first refusal. No MONTHLY quota here on purpose: transcription is
    // included in paid plans and already bounded by the plan's track limit.
    // (a) Per-track: 3 / 24h — re-transcribing a track a few times is legit; thousands isn't.
    const { data: dayTrackOk } = await supabaseAdmin.rpc("check_rate_limit", {
      _key: "transcribe:track:" + track_id, _max_requests: 3, _window_seconds: 86400,
    });
    if (dayTrackOk === false) {
      console.log("transcribe-lyrics: quota hit guard=track user=" + user.id + " track=" + track_id + " limit=3/24h");
      return new Response(JSON.stringify({ error: "rate_limited", scope: "track" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // (b) Per-user: 500 / 24h — deliberately generous so a big import passes without friction.
    const { data: dayUserOk } = await supabaseAdmin.rpc("check_rate_limit", {
      _key: "transcribe:user:" + user.id, _max_requests: 500, _window_seconds: 86400,
    });
    if (dayUserOk === false) {
      console.log("transcribe-lyrics: quota hit guard=user user=" + user.id + " limit=500/24h");
      return new Response(JSON.stringify({ error: "rate_limited", scope: "user" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // (c) Platform fuse: 2000 / 24h across all users — never trips in normal use.
    const { data: dayGlobalOk } = await supabaseAdmin.rpc("check_rate_limit", {
      _key: "transcribe:global", _max_requests: 2000, _window_seconds: 86400,
    });
    if (dayGlobalOk === false) {
      console.log("transcribe-lyrics: quota hit guard=global user=" + user.id + " limit=2000/24h");
      return new Response(JSON.stringify({ error: "rate_limited", scope: "global" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      .select("audio_preview_url, audio_url, language")
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

    // 2. Download audio via fresh signed URL — try original first, fallback to preview if too large.
    // Routed through the storage abstraction (Supabase or R2 via STORAGE_PROVIDER env).
    //
    // Legacy Supabase-direct call (kept here as comment for Phase 2 rollback reference):
    //   const { data: signedData, error: signErr } = await supabaseAdmin.storage
    //     .from("tracks").createSignedUrl(path, 3600);
    let audioPath = originalPath || previewPath;
    let fileData: Blob | null = null;
    const storage = getStorageProvider();

    // Helper: create a fresh signed URL and fetch the file
    async function fetchViaSignedUrl(path: string): Promise<Blob | null> {
      let signedUrl: string;
      try {
        signedUrl = await storage.createSignedUrl("tracks", path, 3600);
      } catch (e) {
        console.error("transcribe-lyrics: sign failed for " + path + " (" + (e instanceof Error ? e.message : "unknown") + ")");
        return null;
      }
      const res = await fetch(signedUrl);
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

    // 3. Resolve the language to force, then transcribe.
    const fileName = audioPath.split("/").pop() || "audio.mp3";
    const isWav = fileName.toLowerCase().endsWith(".wav");
    const mimeType = isWav ? "audio/wav" : "audio/mpeg";

    // Language priority: caller override → tracks.language → auto-detect on the
    // first 90s, then FORCE that language on the full pass so Whisper can't drift
    // mid-song. "Instrumental"/unknown → null → detection path.
    const requestedLang = languageOverride || ((track.language as string | null) || "");
    let isoLang = toISO639_1(requestedLang);
    let detectedName: string | null = null;

    if (!isoLang) {
      try {
        const detectBlob = await firstNSecondsBlob(fileData, isWav, 90);
        const detect = await callGroqTranscription(groqApiKey, detectBlob, fileName, mimeType, null);
        const dn = (typeof detect.language === "string" ? detect.language : "").trim();
        const dIso = toISO639_1(dn);
        if (dIso) { isoLang = dIso; detectedName = titleCaseLang(dn); }
      } catch (e) {
        // Detection is best-effort: on failure fall through to an unforced full
        // pass — the confidence filter below still guards against hallucination.
        console.error("transcribe-lyrics: language detection pass failed (" + (e instanceof Error ? e.name : "unknown") + ")");
      }
    }

    // 4. Full transcription pass (language forced when known).
    let result: { text?: string; language?: string; segments?: Array<Record<string, unknown>> };
    try {
      result = await callGroqTranscription(groqApiKey, fileData, fileName, mimeType, isoLang);
    } catch {
      return new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Drop hallucinated segments. verbose_json reports per-segment confidence:
    //    no_speech_prob (likely no voice), avg_logprob (model uncertainty) and
    //    compression_ratio (repetitive-loop hallucination). A segment must clear
    //    ALL three thresholds to be kept.
    const NO_SPEECH_MAX = 0.6;
    const LOGPROB_MIN = -1.0;
    const COMPRESSION_MAX = 2.4;
    const rawSegments = Array.isArray(result.segments) ? result.segments : [];
    const received = rawSegments.length;

    const kept = rawSegments.filter((seg) => {
      const text = (typeof seg.text === "string" ? seg.text : "").trim();
      if (!text) return false;
      const nsp = typeof seg.no_speech_prob === "number" ? seg.no_speech_prob : 0;
      const alp = typeof seg.avg_logprob === "number" ? seg.avg_logprob : 0;
      const cr = typeof seg.compression_ratio === "number" ? seg.compression_ratio : 0;
      return nsp <= NO_SPEECH_MAX && alp >= LOGPROB_MIN && cr <= COMPRESSION_MAX;
    });
    const retained = kept.length;
    const rejected = received - retained;

    // Server-side observability — counts + language only, never lyric content.
    console.log("transcribe-lyrics: lang=" + (isoLang || "auto") + " received=" + received + " retained=" + retained + " rejected=" + rejected);

    // Build the lyrics text + timed segments from the SURVIVING segments only.
    const lyricsSegments: { start: number; end: number; text: string }[] = [];
    const lines: string[] = [];
    for (let i = 0; i < kept.length; i++) {
      const seg = kept[i];
      const text = (typeof seg.text === "string" ? seg.text : "").trim();
      const start = typeof seg.start === "number" ? seg.start : 0;
      const end = typeof seg.end === "number" ? seg.end : 0;
      lyricsSegments.push({ start, end, text });
      if (i > 0 && lines.length > 0) {
        const prevEnd = typeof kept[i - 1].end === "number" ? (kept[i - 1].end as number) : 0;
        if (start - prevEnd > 2) lines.push("");
      }
      lines.push(text);
    }
    const transcribedText = lines.join("\n").trim();

    // 6. Refuse rather than invent. If too few segments survived, or the kept text
    //    is too short, treat the track as having no reliable lyrics and write
    //    NOTHING — never persist a low-confidence transcription.
    const retentionRatio = received > 0 ? retained / received : 0;
    if (received === 0 || retentionRatio < 0.30 || transcribedText.length < 40) {
      return new Response(JSON.stringify({ success: true, lyrics: "", empty: true, reason: "low_confidence" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Persist the accepted lyrics (+ timed segments). If we auto-detected the
    //    language for a track that had none, store it too.
    const lyricsWithMarker = "[auto-transcribed]\n" + transcribedText;
    const updatePayload: Record<string, unknown> = { lyrics: lyricsWithMarker };
    if (lyricsSegments.length > 0) updatePayload.lyrics_segments = lyricsSegments;
    if (detectedName) updatePayload.language = detectedName;

    const { error: updateError } = await supabaseAdmin
      .from("tracks")
      .update(updatePayload)
      .eq("id", track_id);

    if (updateError) {
      console.error("transcribe-lyrics update error:", updateError.message);
      return new Response(JSON.stringify({ error: "Failed to save transcription" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, lyrics: transcribedText, language: isoLang }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("transcribe-lyrics: internal error (" + (err instanceof Error ? err.name : "unknown") + ")");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
