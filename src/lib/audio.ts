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

export interface SignedUrlOpts {
  /** Desired TTL for the signed URL, in seconds. Clamped 60..3600 server-side. */
  expiresInSec?: number;
  /** Bypass the in-memory cache (forces a fresh signing). */
  noCache?: boolean;
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
      // Else: network / 5xx — one retry.
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

/**
 * Returns a signed URL for a watermarked audio stream (shared link flow).
 */
export async function getWatermarkedAudioUrl(
  args: {
    storagePath: string;
    linkId: string;
    visitorEmail: string;
    visitorName?: string;
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

  const data = await callEdgeFunction<{ url?: string }>("get-watermarked-audio", {
    storage_path: args.storagePath,
    link_id: args.linkId,
    visitor_email: args.visitorEmail,
    visitor_name: args.visitorName ?? null,
  });
  if (!data?.url) {
    throw new Error("get-watermarked-audio: no url in response");
  }
  cacheSet(cacheKey, data.url);
  return data.url;
}
