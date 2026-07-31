// Frontend helper for resolving signed URLs to storage objects (Supabase or R2)
// through the Edge Functions. All audio / stem / document reads should go
// through here so they benefit from STORAGE_PROVIDER=r2 in prod.
//
// Public API:
//   - getStorageSignedUrl(bucket, key, opts?)    — generic, calls get-storage-url EF
//   - getAudioPlaybackUrl(trackId, quality, opts?) — calls get-audio-url EF
//   - getWatermarkedAudioUrl(args, opts?)        — calls get-watermarked-audio EF
//
// Strategy:
//   - Auth uses the current Supabase session JWT when present; falls back to
//     the publishable key for endpoints that allow anonymous (get-audio-url
//     with a slug).
//   - LRU cache: 50 entries, TTL 4 min (signed URLs are 5 min, 1 min safety
//     margin so callers never receive an URL that will expire mid-fetch).
//   - Network retry: 1x on connection error (no retry on 4xx — non-recoverable).
//
// Callers that previously did `supabase.storage.from(bucket).createSignedUrl(...)`
// directly should be migrated to one of these helpers.

import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StorageBucket = "tracks" | "stems" | "covers" | "watermarked" | "documents";
export type UploadBucket = "tracks" | "stems" | "covers" | "documents";

export interface SignedUrlOpts {
  /** Desired TTL for the signed URL, in seconds. Clamped 60..3600 server-side. */
  expiresInSec?: number;
  /** Bypass the in-memory cache (forces a fresh signing). */
  noCache?: boolean;
}

export interface UploadDescriptor {
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresIn: number;
}

// ---------------------------------------------------------------------------
// LRU cache (Map-based — insertion order is iteration order in JS)
// ---------------------------------------------------------------------------

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const CACHE_MAX = 50;
const CACHE_TTL_MS = 4 * 60 * 1000; // 4 min (signed URLs are 5 min)

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  // refresh LRU position
  cache.delete(key);
  cache.set(key, entry);
  return entry.url;
}

function cacheSet(key: string, url: string): void {
  if (cache.size >= CACHE_MAX) {
    // evict oldest (first inserted)
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Drop all cached signed URLs (useful when STORAGE_PROVIDER changes mid-session). */
export function clearAudioCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

async function currentAccessToken(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || SUPABASE_PUBLISHABLE_KEY;
  } catch {
    return SUPABASE_PUBLISHABLE_KEY;
  }
}

/** POST to an Edge Function with 1 automatic retry on connection error. */
async function callEdgeFunction<T>(
  fnName: string,
  body: unknown,
): Promise<T> {
  const token = await currentAccessToken();
  const url = SUPABASE_URL + "/functions/v1/" + fnName;
  const init: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
      "apikey": SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let payload: unknown = null;
      try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
      if (!res.ok) {
        // Structured diagnostics. These EF requests carry no signed URL / token,
        // so logging the function name + status + size headers leaks nothing sensitive.
        console.error(
          "[audio-lib] " + fnName + " HTTP " + res.status +
          " content-type=" + (res.headers.get("content-type") || "") +
          " content-length=" + (res.headers.get("content-length") || "") +
          " attempt=" + (attempt + 1)
        );
        // 4xx is non-recoverable; bail without retry.
        if (res.status >= 400 && res.status < 500) {
          const msg = (payload && typeof payload === "object" && "error" in payload)
            ? String((payload as { error: unknown }).error)
            : "HTTP " + res.status;
          throw new Error("[" + fnName + "] " + msg);
        }
        throw new Error("[" + fnName + "] HTTP " + res.status);
      }
      return payload as T;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      // No retry on 4xx (bail immediately).
      if (msg.startsWith("[" + fnName + "] ") && !msg.includes("HTTP 5")) {
        throw e;
      }
      // Network / 5xx — log and retry once.
      console.error("[audio-lib] " + fnName + " network/5xx error (attempt " + (attempt + 1) + "): " + msg);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a signed URL for an arbitrary protected storage object.
 * Routes through the get-storage-url Edge Function (auth + perms + R2).
 */
export async function getStorageSignedUrl(
  bucket: StorageBucket,
  key: string,
  opts: SignedUrlOpts = {},
): Promise<string> {
  if (!key) throw new Error("getStorageSignedUrl: missing key");
  const expires = opts.expiresInSec ?? 300;
  const cacheKey = "storage|" + bucket + "|" + key + "|" + expires;

  if (!opts.noCache) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  const data = await callEdgeFunction<{ signedUrl?: string }>("get-storage-url", {
    bucket,
    key,
    expiresInSec: expires,
  });
  if (!data?.signedUrl) {
    throw new Error("get-storage-url: no signedUrl in response");
  }
  cacheSet(cacheKey, data.signedUrl);
  return data.signedUrl;
}

/**
 * Returns a provider-agnostic upload descriptor (PUT URL + headers) for a
 * storage object. The frontend PUTs bytes directly to the underlying object
 * store (Cloudflare R2 in prod) — no Supabase Storage proxy hop, so the
 * object is immediately readable through the matching R2 GET signed URL
 * without propagation lag.
 *
 * Auth + workspace permission check happen server-side in `get-upload-url`.
 */
export async function getStorageUploadUrl(
  bucket: UploadBucket,
  key: string,
  contentType: string,
  opts: { expiresInSec?: number } = {},
): Promise<UploadDescriptor> {
  if (!key) throw new Error("getStorageUploadUrl: missing key");
  if (!contentType) throw new Error("getStorageUploadUrl: missing contentType");

  const data = await callEdgeFunction<{
    uploadUrl?: string;
    method?: "PUT";
    headers?: Record<string, string>;
    expiresIn?: number;
  }>("get-upload-url", {
    bucket,
    key,
    contentType,
    expiresInSec: opts.expiresInSec ?? 600,
  });

  if (!data?.uploadUrl || data.method !== "PUT" || !data.headers) {
    throw new Error("get-upload-url: malformed response");
  }
  return {
    uploadUrl: data.uploadUrl,
    method: data.method,
    headers: data.headers,
    expiresIn: data.expiresIn ?? 600,
  };
}

/**
 * Returns a signed URL for a track's audio (preview or full) via the
 * track_id-based get-audio-url Edge Function. Use this when you have the
 * track UUID; use getStorageSignedUrl('tracks', path) when you only have
 * the storage path (e.g. shared link contexts).
 */
export async function getAudioPlaybackUrl(
  trackId: string,
  quality: "preview" | "full" = "preview",
  opts: { noCache?: boolean; slug?: string } = {},
): Promise<string> {
  if (!trackId) throw new Error("getAudioPlaybackUrl: missing trackId");
  const cacheKey = "audio|" + trackId + "|" + quality + "|" + (opts.slug || "");

  if (!opts.noCache) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  const data = await callEdgeFunction<{ url?: string }>("get-audio-url", {
    track_id: trackId,
    quality,
    ...(opts.slug ? { slug: opts.slug } : {}),
  });
  if (!data?.url) {
    throw new Error("get-audio-url: no url in response");
  }
  cacheSet(cacheKey, data.url);
  return data.url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Raw POST to get-watermarked-audio that reads { status, url? } from ANY response
// code (200 done / 202 processing / 503 failed). Only genuine errors (4xx
// validation, 429 rate limit, network) throw. No signed URL / token is logged.
async function postWatermark(
  body: Record<string, unknown>,
): Promise<{ status?: string; url?: string; job_id?: string }> {
  const token = await currentAccessToken();
  const res = await fetch(SUPABASE_URL + "/functions/v1/get-watermarked-audio", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
      "apikey": SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  // 503 carries the valid { status: "failed" } outcome — not an error to throw.
  if (res.status !== 503 && (res.status < 200 || res.status >= 400)) {
    console.error("[audio-lib] get-watermarked-audio HTTP " + res.status);
    throw new Error("get-watermarked-audio HTTP " + res.status);
  }
  return payload && typeof payload === "object"
    ? (payload as { status?: string; url?: string; job_id?: string })
    : {};
}

const WM_POLL_INTERVAL_MS = 2000;
const WM_MAX_WAIT_MS = 90000;

/**
 * Resolves a signed URL for the visitor's WATERMARKED audio (shared-link flow).
 *
 * Watermarking runs asynchronously on a Postgres queue: a cache miss enqueues a
 * 'watermark_encode' job, then this polls the job status every 2s (max 90s) until
 * the protected file is ready. It NEVER returns unwatermarked/original audio —
 * on job failure or timeout it THROWS, so callers must surface an error and must
 * NOT fall back to the clean file.
 */
export async function getWatermarkedAudioUrl(
  args: {
    storagePath: string;
    linkId: string;
    visitorEmail: string;
    visitorName?: string;
    sessionToken?: string;
  },
  opts: { noCache?: boolean } = {},
): Promise<string> {
  if (!args.storagePath || !args.linkId || !args.visitorEmail) {
    throw new Error("getWatermarkedAudioUrl: missing required arg");
  }
  const cacheKey = "watermark|" + args.linkId + "|" + args.visitorEmail + "|" + args.storagePath;

  if (!opts.noCache) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  const encodeBody = {
    storage_path: args.storagePath,
    link_id: args.linkId,
    visitor_email: args.visitorEmail,
    visitor_name: args.visitorName ?? null,
    session_token: args.sessionToken ?? null,
  };

  // Kick off (or hit cache): done → return; failed → throw; processing → poll.
  const first = await postWatermark(encodeBody);
  if (first.status === "done" && first.url) { cacheSet(cacheKey, first.url); return first.url; }
  if (first.status === "failed") throw new Error("get-watermarked-audio: job failed");

  const statusBody = { ...encodeBody, action: "status" };
  const deadline = Date.now() + WM_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(WM_POLL_INTERVAL_MS);
    const s = await postWatermark(statusBody);
    if (s.status === "done" && s.url) { cacheSet(cacheKey, s.url); return s.url; }
    if (s.status === "failed") throw new Error("get-watermarked-audio: job failed");
  }
  throw new Error("get-watermarked-audio: timed out preparing protected audio");
}
