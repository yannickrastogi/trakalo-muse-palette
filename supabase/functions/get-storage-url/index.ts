// Supabase Edge Function: get-storage-url
// Generic signed-URL issuer for protected storage objects.
// Routes through the storage abstraction (Supabase Storage or Cloudflare R2
// per STORAGE_PROVIDER env var) — used by frontend audio/stems/documents reads
// so 100% of reads benefit from the R2 flip.
//
// POST /get-storage-url
// Body: { bucket: "tracks"|"stems"|"covers"|"watermarked"|"documents",
//         key: string,                  // storage path, e.g. "<workspace_id>/<file_id>.ext"
//         expiresInSec?: number }       // optional, default 300, max 3600
// Headers: Authorization: Bearer <JWT>
// Returns: { signedUrl: string, expiresIn: number }
//
// Security:
// - Auth header required (JWT-based user identification via Supabase auth)
// - Bucket whitelist enforced
// - Path traversal protection (".." / "//" / leading "/")
// - For 'tracks', 'stems', 'documents' buckets: extracts workspace_id from key
//   prefix and verifies caller is a member of that workspace (or that the track
//   has been shared with one of caller's workspaces via catalog_shares).
//   'watermarked' and 'covers' have permissive access (cache + public-ish assets)
//   but still require an authenticated session.
// - Rate limit: 60 req/min per IP via existing check_rate_limit RPC
// - Generic error messages to client; detailed errors via console.error server-side
//
// Deploy: supabase functions deploy get-storage-url

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { isValidUUID } from "../_shared/validation.ts";
import { getStorageProvider, type BucketName } from "../_shared/storage.ts";

const ALLOWED_BUCKETS: BucketName[] = ["tracks", "stems", "covers", "watermarked", "documents"];
const PERMISSION_CHECKED_BUCKETS: BucketName[] = ["tracks", "stems", "documents"];
const DEFAULT_EXPIRES_SEC = 300;
const MAX_EXPIRES_SEC = 3600;

function isValidStoragePath(p: string): boolean {
  return !!p
    && !p.includes("..")
    && !p.includes("//")
    && !p.startsWith("/")
    && !p.includes("\0")    // null bytes (string-truncation bypass)
    && !p.includes("\\")    // backslash (Windows-path / S3-parser bypass)
    && p.length <= 512;
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
    }
    const token = authHeader.slice(7);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", {
      _key: "get-storage-url:" + ip,
      _max_requests: 60,
      _window_seconds: 60,
    });
    if (rateLimitOk === false) {
      return jsonResponse({ error: "Too many requests" }, 429, corsHeaders);
    }

    // Identify caller from JWT (uses service-role client to introspect token).
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
    }
    const userId = userData.user.id;
    if (!isValidUUID(userId)) {
      // Should never happen — Supabase IDs are UUIDs — but guard anyway.
      console.error("get-storage-url: non-UUID user id from auth.getUser");
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
    }

    let body: { bucket?: string; key?: string; expiresInSec?: number };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, corsHeaders);
    }

    const bucketStr = (body.bucket || "").toLowerCase();
    const key = body.key || "";
    const expiresInRaw = typeof body.expiresInSec === "number" ? body.expiresInSec : DEFAULT_EXPIRES_SEC;

    if (!ALLOWED_BUCKETS.includes(bucketStr as BucketName)) {
      return jsonResponse({ error: "Invalid bucket" }, 400, corsHeaders);
    }
    const bucket = bucketStr as BucketName;

    if (!isValidStoragePath(key)) {
      return jsonResponse({ error: "Invalid key" }, 400, corsHeaders);
    }

    const expiresInSec = Math.max(60, Math.min(MAX_EXPIRES_SEC, Math.floor(expiresInRaw)));

    // For permission-checked buckets, the first path segment must be a UUID
    // (workspace_id) and the caller must be a member, OR the path must correspond
    // to a track that has been shared with one of the caller's workspaces.
    if (PERMISSION_CHECKED_BUCKETS.includes(bucket)) {
      const firstSegment = key.split("/")[0] || "";
      if (!isValidUUID(firstSegment)) {
        return jsonResponse({ error: "Invalid key (workspace prefix missing)" }, 400, corsHeaders);
      }
      const workspaceId = firstSegment;

      // Direct workspace membership.
      const { data: isMember, error: memberErr } = await supabaseAdmin.rpc("is_workspace_member", {
        _user_id: userId,
        _workspace_id: workspaceId,
      });
      if (memberErr) {
        console.error("get-storage-url: is_workspace_member error", memberErr.message);
        return jsonResponse({ error: "Permission check failed" }, 500, corsHeaders);
      }

      if (!isMember) {
        // Fallback: check if the object belongs to a track that has been
        // shared with a workspace the caller is a member of (catalog_shares).
        let shared = false;
        if (bucket === "tracks") {
          const { data: shareRows } = await supabaseAdmin
            .from("catalog_shares")
            .select("target_workspace_id, status, tracks!inner(audio_url, audio_preview_url)")
            .eq("source_workspace_id", workspaceId)
            .eq("status", "active");
          if (Array.isArray(shareRows)) {
            for (const row of shareRows) {
              const t = (row as { tracks?: { audio_url?: string; audio_preview_url?: string } }).tracks;
              if (!t) continue;
              if (t.audio_url === key || t.audio_preview_url === key) {
                const targetWs = (row as { target_workspace_id: string }).target_workspace_id;
                const { data: isTargetMember } = await supabaseAdmin.rpc("is_workspace_member", {
                  _user_id: userId,
                  _workspace_id: targetWs,
                });
                if (isTargetMember) {
                  shared = true;
                  break;
                }
              }
            }
          }
        }
        if (!shared) {
          return jsonResponse({ error: "Forbidden" }, 403, corsHeaders);
        }
      }
    }

    let signedUrl: string;
    try {
      signedUrl = await getStorageProvider().createSignedUrl(bucket, key, expiresInSec);
    } catch (e) {
      console.error(
        "get-storage-url: sign failed (bucket=" + bucket + ", key=" + key.substring(0, 64) + "): "
        + (e instanceof Error ? e.message : "unknown"),
      );
      return jsonResponse({ error: "Failed to generate signed URL" }, 500, corsHeaders);
    }

    return jsonResponse({ signedUrl, expiresIn: expiresInSec }, 200, corsHeaders);
  } catch (err) {
    console.error("get-storage-url: internal error (" + (err instanceof Error ? err.name : "unknown") + ")");
    return jsonResponse({ error: "Internal server error" }, 500, corsHeaders);
  }
});
