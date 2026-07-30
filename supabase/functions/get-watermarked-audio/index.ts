// Supabase Edge Function: get-watermarked-audio
// Asynchronous watermarked-audio delivery for shared-link playback + download.
//
// POST /get-watermarked-audio
// Body (encode): { storage_path, link_id, visitor_email, visitor_name }
//   → cache hit:  200 { status: "done", url }
//   → cache miss: 202 { status: "processing", job_id }  (a 'watermark_encode' job
//                 is enqueued; the Railway worker produces + uploads the file)
// Body (status): { storage_path, link_id, visitor_email, action: "status" }
//   → 200 { status: "done", url } | 202 { status: "processing" } | 503 { status: "failed" }
//
// This function NEVER returns a URL to unwatermarked/original audio. On definitive
// failure it returns 503 { status: "failed" } — the caller must NOT fall back to
// the clean file.
//
// Deploy: supabase functions deploy get-watermarked-audio

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { isValidUUID, boundStr, LIMITS, readJsonBounded, InputError } from "../_shared/validation.ts";
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
    const body = await readJsonBounded(req);
    // "encode" (default) enqueues on cache miss; "status" only reports job state.
    const action = body.action === "status" ? "status" : "encode";
    const rawStoragePath = typeof body.storage_path === "string" ? body.storage_path : "";
    const link_id = typeof body.link_id === "string" ? body.link_id : "";
    const visitor_email = boundStr(body.visitor_email, LIMITS.EMAIL);
    const visitor_name = boundStr(body.visitor_name, LIMITS.NAME);

    // Extract relative path if a full signed URL was sent instead of a relative
    // path (a signed URL can exceed the path cap, so cap AFTER extraction).
    let storage_path = rawStoragePath;
    if (storage_path && storage_path.includes("/object/sign/tracks/")) {
      storage_path = decodeURIComponent(storage_path.split("/object/sign/tracks/")[1].split("?")[0]);
    }
    storage_path = storage_path.slice(0, LIMITS.STORAGE_PATH);

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Build cache key: hash of link_id + visitor_email + storage_path. The "-v2"
    // suffix invalidates legacy objects from the old 128k/strength-12 pipeline — they
    // stay in the bucket (not deleted, still traceable) but are never matched again.
    const cacheBase = (await sha256Hex(`${link_id}_${visitor_email}_${storage_path}`)) + "-v2";
    const mp3Path = `${cacheBase}.mp3`;
    const wavPath = `${cacheBase}.wav`;

    // All storage I/O routed through the storage abstraction (Supabase or R2 via STORAGE_PROVIDER).
    const storage = getStorageProvider();

    // Cache is the single source of truth for "ready": a delivery copy is MP3
    // (verified) or WAV (fallback) — accept either. Returns a signed URL or null.
    async function signedCacheUrl(): Promise<string | null> {
      for (const cachedPath of [mp3Path, wavPath]) {
        if (await storage.exists("watermarked", cachedPath)) {
          try {
            return await storage.createSignedUrl("watermarked", cachedPath, 300);
          } catch (e) {
            console.error("get-watermarked-audio: cache sign failed (" + (e instanceof Error ? e.message : "unknown") + ")");
          }
        }
      }
      return null;
    }

    const jsonRes = (obj: unknown, status: number) =>
      new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Ready in cache → hand back the watermarked URL (both encode + status paths).
    const cachedUrl = await signedCacheUrl();
    if (cachedUrl) return jsonRes({ status: "done", url: cachedUrl }, 200);

    // Observability: on a cache miss, log the EXACT target this EF reads from
    // (provider + bucket + candidate paths). Line this up against the worker's
    // "uploading … provider=… bucket=… path=…" log to spot a target divergence
    // instantly instead of guessing through 40 repeated 202s.
    console.error("get-watermarked-audio: cache MISS provider=" + storage.name + " bucket=watermarked action=" + action + " paths=[" + mp3Path + "," + wavPath + "]");

    // STATUS: no cache yet → report the job's state (never enqueue, never fall back).
    if (action === "status") {
      const { data: job } = await supabaseAdmin
        .from("jobs")
        .select("status")
        .eq("dedupe_key", cacheBase)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (job && (job.status === "failed" || job.status === "cancelled")) {
        return jsonRes({ status: "failed" }, 503);
      }
      return jsonRes({ status: "processing" }, 202);
    }

    // ENCODE (cache miss) → enqueue a watermark_encode job for the Railway worker.
    // The clean source_url is embedded ONLY in the job payload (visible to owning
    // workspace members, never to the shared-link visitor) and never returned here.
    let originalSignedUrl: string;
    try {
      // 1h TTL so the queued source URL stays valid until the worker claims the job.
      originalSignedUrl = await storage.createSignedUrl("tracks", storage_path, 3600);
    } catch (e) {
      console.error("get-watermarked-audio: original sign failed (" + (e instanceof Error ? e.message : "unknown") + ")");
      return jsonRes({ status: "failed" }, 503);
    }

    // Watermark payload — hash to 128-bit hex for audiowmark (unchanged).
    const rawPayload = `lid_${link_id}_v_${visitor_email}`;
    const payloadHashFull = await sha256Hex(rawPayload);
    const payload = payloadHashFull.substring(0, 32); // 128 bits = 16 bytes = 32 hex chars

    // Store mapping hash_hex → original payload for leak tracing (unchanged).
    await supabaseAdmin
      .from("watermark_payloads")
      .upsert({ hash_hex: payload, raw_payload: rawPayload, link_id, visitor_email, visitor_name: visitor_name || null }, { onConflict: "hash_hex" });

    // Owning workspace (for job visibility / audit). Best-effort; null is fine.
    const { data: link } = await supabaseAdmin
      .from("shared_links")
      .select("workspace_id, created_by")
      .eq("id", link_id)
      .maybeSingle();

    // Enqueue. dedupe_key = the cache key → a visitor mashing "play" produces ONE job.
    // priority 10 (a listener is waiting) beats background work. Worker uploads the
    // result to watermarked/<cacheBase>.mp3 (content-type reflects the real format).
    const { data: jobId, error: enqErr } = await supabaseAdmin.rpc("enqueue_job", {
      _job_type: "watermark_encode",
      _payload: {
        source_url: originalSignedUrl,
        payload_hex: payload,
        output_bucket: "watermarked",
        output_path: mp3Path,
        format: "mp3",
        // Stamp the provider the EF ACTUALLY reads from (storage.name, from the
        // already-instantiated provider) so the worker writes to the same target
        // instead of deriving it from its own env — the root cause of the outage.
        output_provider: storage.name,
      },
      _workspace_id: link?.workspace_id ?? null,
      _created_by: link?.created_by ?? null,
      _dedupe_key: cacheBase,
      _priority: 10,
      _max_attempts: 3,
    });
    if (enqErr || !jobId) {
      console.error("get-watermarked-audio: enqueue failed (" + (enqErr?.message || "no id") + ", payload_prefix=" + payload.substring(0, 8) + ")");
      return jsonRes({ status: "failed" }, 503);
    }

    return jsonRes({ status: "processing", job_id: jobId }, 202);
  } catch (err) {
    if (err instanceof InputError) {
      console.error("get-watermarked-audio: rejected body (" + err.message + ")");
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
