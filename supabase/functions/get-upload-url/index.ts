// Supabase Edge Function: get-upload-url
// Returns a provider-agnostic signed upload descriptor (URL + method + headers)
// so the frontend can PUT bytes DIRECTLY to the underlying object store
// (Cloudflare R2 when STORAGE_PROVIDER=r2, Supabase Storage otherwise).
//
// This fixes the split caused by the R2 read-only migration: reads went
// through R2 immediately but writes still landed in Supabase Storage,
// producing 503/404 on freshly-uploaded objects.
//
// POST /get-upload-url
// Body: { bucket: "tracks"|"stems"|"covers"|"documents",
//         key: string,                   // storage path, e.g. "<workspace_id>/<file_id>.ext"
//         contentType?: string,          // optional, default "application/octet-stream"
//         expiresInSec?: number }        // optional, default 600, max 3600
// Headers: Authorization: Bearer <JWT>
// Returns: { uploadUrl: string, method: "PUT", headers: Record<string,string>, expiresIn: number }
//
// Security:
// - Auth header required (JWT-based user identification via Supabase auth)
// - Bucket whitelist enforced — "watermarked" forbidden (server-only write target)
// - Path traversal protection (".." / "//" / "\0" / "\\" / leading "/")
// - Workspace permission check: first path segment must be a UUID and caller
//   must be a member of that workspace (no catalog_shares fallback — writes
//   should only happen on the owning workspace)
// - Rate limit: 60 req/min per IP
// - Generic error messages to client; detailed errors via console.error server-side
//
// Deploy: supabase functions deploy get-upload-url

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/ip.ts";
import { isValidUUID } from "../_shared/validation.ts";
import { getStorageProvider, type BucketName } from "../_shared/storage.ts";

// "watermarked" intentionally excluded — only get-watermarked-audio writes there.
const ALLOWED_BUCKETS: BucketName[] = ["tracks", "stems", "covers", "documents"];
const DEFAULT_EXPIRES_SEC = 600;
const MAX_EXPIRES_SEC = 3600;
const MIN_EXPIRES_SEC = 60;

function isValidStoragePath(p: string): boolean {
  return !!p
    && !p.includes("..")
    && !p.includes("//")
    && !p.startsWith("/")
    && !p.includes("\0")
    && !p.includes("\\")
    && p.length <= 512;
}

function isValidContentType(ct: string): boolean {
  // RFC 7231 media-type — keep permissive but reject control chars / injection.
  return /^[\w!#$&^.+\-]+\/[\w!#$&^.+\-]+(\s*;\s*[\w!#$&^.+\-]+\s*=\s*[\w!#$&^.+\-"]+)*$/.test(ct)
    && ct.length <= 128;
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

    // Authenticate FIRST so anonymous attackers can't burn the IP rate-limit
    // quota with unauthenticated junk requests.
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
    }
    const userId = userData.user.id;
    if (!isValidUUID(userId)) {
      console.error("get-upload-url: non-UUID user id from auth.getUser");
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const ip = getClientIp(req);
    const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", {
      _key: "get-upload-url:" + ip,
      _max_requests: 60,
      _window_seconds: 60,
    });
    if (rateLimitOk === false) {
      return jsonResponse({ error: "Too many requests" }, 429, corsHeaders);
    }

    let body: { bucket?: string; key?: string; contentType?: string; expiresInSec?: number };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, corsHeaders);
    }

    const bucketStr = (body.bucket || "").toLowerCase();
    const key = body.key || "";
    const contentTypeRaw = (body.contentType || "application/octet-stream").trim();
    const expiresInRaw = typeof body.expiresInSec === "number" ? body.expiresInSec : DEFAULT_EXPIRES_SEC;

    if (!ALLOWED_BUCKETS.includes(bucketStr as BucketName)) {
      return jsonResponse({ error: "Invalid bucket" }, 400, corsHeaders);
    }
    const bucket = bucketStr as BucketName;

    if (!isValidStoragePath(key)) {
      return jsonResponse({ error: "Invalid key" }, 400, corsHeaders);
    }

    if (!isValidContentType(contentTypeRaw)) {
      return jsonResponse({ error: "Invalid contentType" }, 400, corsHeaders);
    }

    const expiresInSec = Math.max(MIN_EXPIRES_SEC, Math.min(MAX_EXPIRES_SEC, Math.floor(expiresInRaw)));

    // All upload buckets require workspace membership of the path's first segment.
    const firstSegment = key.split("/")[0] || "";
    if (!isValidUUID(firstSegment)) {
      return jsonResponse({ error: "Invalid key (workspace prefix missing)" }, 400, corsHeaders);
    }
    const workspaceId = firstSegment;

    const { data: isMember, error: memberErr } = await supabaseAdmin.rpc("is_workspace_member", {
      _user_id: userId,
      _workspace_id: workspaceId,
    });
    if (memberErr) {
      console.error("get-upload-url: is_workspace_member error", memberErr.message);
      return jsonResponse({ error: "Permission check failed" }, 500, corsHeaders);
    }
    if (!isMember) {
      return jsonResponse({ error: "Forbidden" }, 403, corsHeaders);
    }

    let descriptor;
    try {
      descriptor = await getStorageProvider().createSignedUploadUrl(
        bucket,
        key,
        contentTypeRaw,
        expiresInSec,
      );
    } catch (e) {
      console.error(
        "get-upload-url: sign failed (bucket=" + bucket + ", key=" + key.substring(0, 64) + "): "
        + (e instanceof Error ? e.message : "unknown"),
      );
      return jsonResponse({ error: "Failed to generate upload URL" }, 500, corsHeaders);
    }

    return jsonResponse({
      uploadUrl: descriptor.url,
      method: descriptor.method,
      headers: descriptor.headers,
      expiresIn: expiresInSec,
    }, 200, corsHeaders);
  } catch (err) {
    console.error("get-upload-url: internal error (" + (err instanceof Error ? err.name : "unknown") + ")");
    return jsonResponse({ error: "Internal server error" }, 500, corsHeaders);
  }
});
