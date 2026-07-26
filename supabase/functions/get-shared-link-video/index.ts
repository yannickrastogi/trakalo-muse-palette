// Supabase Edge Function: get-shared-link-video
// Public (anon) issuer for signed video URLs surfaced on a shared link.
//
// POST /get-shared-link-video
// Body: { slug: string, track_id: string }
// Returns: { url: string } or { error: string }
//
// Security:
// - Rate limit: 60 req/min per IP via existing check_rate_limit RPC
// - CORS preflight via shared helper
// - Verifies the shared link exists, is active, not expired
// - Verifies the track is associated with the link (single-track) OR with the
//   linked playlist (playlist share)
// - Verifies `video_visible_on_share = true` and `video_url` is set
// - Errors are intentionally generic for the client; details go to console.error
//
// Deploy: supabase functions deploy get-shared-link-video

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { isValidUUID, boundStr, LIMITS, readJsonBounded, InputError } from "../_shared/validation.ts";
import { getStorageProvider } from "../_shared/storage.ts";

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// Defensive check: even though the path lives in our DB, never sign a key that
// could traverse buckets or escape the documents prefix. Mirrors get-storage-url.
function isSafeStoragePath(p: string): boolean {
  return !!p
    && !p.includes("..")
    && !p.includes("//")
    && !p.startsWith("/")
    && !p.includes("\0")
    && !p.includes("\\")
    && p.length <= 512;
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", {
      _key: "shared-link-video:" + ip,
      _max_requests: 60,
      _window_seconds: 60,
    });
    if (rateLimitOk === false) {
      return jsonResponse({ error: "Rate limit exceeded" }, 429, corsHeaders);
    }

    const body = await readJsonBounded(req);
    const slug = boundStr(body.slug, LIMITS.SLUG);
    const track_id = typeof body.track_id === "string" ? body.track_id : "";
    if (!slug) {
      return jsonResponse({ error: "slug is required" }, 400, corsHeaders);
    }
    if (!isValidUUID(track_id)) {
      return jsonResponse({ error: "Invalid track_id" }, 400, corsHeaders);
    }

    // 1. Verify the shared link is alive and resolve its (track_id | playlist_id).
    const { data: link, error: linkErr } = await supabaseAdmin
      .from("shared_links")
      .select("id, status, expires_at, track_id, playlist_id")
      .eq("link_slug", slug)
      .maybeSingle();

    if (linkErr || !link) {
      console.error("get-shared-link-video: link lookup failed", linkErr?.message);
      return jsonResponse({ error: "Not found" }, 404, corsHeaders);
    }
    if (link.status !== "active") {
      return jsonResponse({ error: "Link inactive" }, 403, corsHeaders);
    }
    if (link.expires_at && new Date(link.expires_at as string).getTime() < Date.now()) {
      return jsonResponse({ error: "Link expired" }, 403, corsHeaders);
    }

    // 2. Verify the requested track is part of this share (direct or via playlist).
    let trackAllowed = false;
    if (link.track_id === track_id) {
      trackAllowed = true;
    } else if (link.playlist_id) {
      const { data: pt } = await supabaseAdmin
        .from("playlist_tracks")
        .select("track_id")
        .eq("playlist_id", link.playlist_id)
        .eq("track_id", track_id)
        .maybeSingle();
      if (pt) trackAllowed = true;
    }
    if (!trackAllowed) {
      return jsonResponse({ error: "Track not in share" }, 403, corsHeaders);
    }

    // 3. Verify the track has a visible video.
    const { data: track, error: trackErr } = await supabaseAdmin
      .from("tracks")
      .select("video_url, video_visible_on_share")
      .eq("id", track_id)
      .maybeSingle();
    if (trackErr || !track) {
      console.error("get-shared-link-video: track lookup failed", trackErr?.message);
      return jsonResponse({ error: "Not found" }, 404, corsHeaders);
    }
    if (!track.video_visible_on_share || !track.video_url) {
      return jsonResponse({ error: "Video not available" }, 404, corsHeaders);
    }

    const videoPath = track.video_url as string;
    if (!isSafeStoragePath(videoPath)) {
      console.error("get-shared-link-video: unsafe path rejected", videoPath.slice(0, 64));
      return jsonResponse({ error: "Invalid path" }, 400, corsHeaders);
    }

    // 4. Sign and return.
    let signedUrl: string;
    try {
      const storage = getStorageProvider();
      signedUrl = await storage.createSignedUrl("documents", videoPath, 1800);
    } catch (e) {
      console.error("get-shared-link-video: signing failed", e instanceof Error ? e.message : String(e));
      return jsonResponse({ error: "Failed to generate URL" }, 500, corsHeaders);
    }

    return jsonResponse({ url: signedUrl }, 200, corsHeaders);
  } catch (err) {
    if (err instanceof InputError) {
      console.error("get-shared-link-video: rejected body (" + err.message + ")");
      return jsonResponse({ error: "Invalid request" }, 400, getCorsHeaders(req));
    }
    console.error("get-shared-link-video: unexpected error", err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: "Internal error" }, 500, getCorsHeaders(req));
  }
});
