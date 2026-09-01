// Supabase Edge Function: get-shared-link-asset
// Lists + signs the stem/document files of the track(s) exposed by a PUBLIC
// shared link, for the Trakalog Pack download (anonymous flow).
//
// The SELECT RLS on stems/track_documents is authenticated-only, so an anonymous
// visitor cannot read these rows directly. This function authorizes via the
// shared-link slug (like get-audio-url) and, using the service role, returns ONLY
// the assets belonging to the track(s) on that active link — each with a
// short-lived signed R2 URL. No raw table access reaches the browser.
//
// POST /get-shared-link-asset
// Body: { slug: string, bucket: "stems" | "documents" }
// Returns: { assets: { file_name: string, mime_type: string|null, signed_url: string }[] }
//          or { error: string }
//
// Signatures mode (closes the signature_requests PII leak — that table had an
// anon SELECT USING(true) policy exposing every collaborator email + signature
// image across all workspaces). Anonymous visitors now read split signatures only
// through this slug-validated service-role path, scoped to the link's track(s).
// POST /get-shared-link-asset
// Body: { slug: string, action: "signatures", trackId?: string }
// Returns: { signatures: { collaborator_name, collaborator_email, status,
//            signed_at, signature_data, split_share, track_id }[] }
//
// Deploy: supabase functions deploy get-shared-link-asset

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/ip.ts";
import { getStorageProvider } from "../_shared/storage.ts";

const ALLOWED_BUCKETS = ["stems", "documents"] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];
const SLUG_RE = /^[A-Za-z0-9_-]{1,128}$/;
const SIGN_EXPIRES_SEC = 300;

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { slug, bucket, action, trackId } = await req.json();
    const isSignatures = action === "signatures";

    if (!slug || typeof slug !== "string" || !SLUG_RE.test(slug)) return json({ error: "Invalid slug" }, 400);
    if (!isSignatures && !ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) return json({ error: "Invalid bucket" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ip = getClientIp(req);
    const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "get-shared-link-asset:" + ip, _max_requests: 60, _window_seconds: 60 });
    if (rateLimitOk === false) return json({ error: "Too many requests. Please try again later." }, 429);

    // 1. Validate the shared link.
    const { data: link, error: linkErr } = await supabaseAdmin
      .from("shared_links")
      .select("id, share_type, track_id, playlist_id, status, expires_at")
      .eq("link_slug", slug)
      .single();
    if (linkErr || !link) return json({ error: "Link not found" }, 404);
    if (link.status !== "active") return json({ error: "Link is not active" }, 403);
    if (link.expires_at && new Date(link.expires_at) < new Date()) return json({ error: "Link has expired" }, 403);

    // 2. Build the set of track_ids this link grants access to.
    let allowedTrackIds: string[] = [];
    if (link.share_type === "playlist" && link.playlist_id) {
      const { data: ptRows } = await supabaseAdmin
        .from("playlist_tracks")
        .select("track_id")
        .eq("playlist_id", link.playlist_id);
      allowedTrackIds = Array.isArray(ptRows)
        ? ptRows.map((r) => r.track_id as string).filter((id): id is string => !!id)
        : [];
    } else if (link.track_id) {
      allowedTrackIds = [link.track_id as string];
    }
    if (allowedTrackIds.length === 0) return json(isSignatures ? { signatures: [] } : { assets: [] }, 200);

    // 2b. Signatures mode — return split signatures for the link's track(s),
    // optionally narrowed to a single track that must belong to this link.
    if (isSignatures) {
      let ids = allowedTrackIds;
      if (trackId && typeof trackId === "string") {
        if (!allowedTrackIds.includes(trackId)) return json({ signatures: [] }, 200);
        ids = [trackId];
      }
      // collaborator_email is intentionally NOT selected — it is PII the public
      // pack never renders, so it must not reach the anonymous browser.
      const { data: sigs } = await supabaseAdmin
        .from("signature_requests")
        .select("collaborator_name, status, signed_at, signature_data, split_share, track_id")
        .in("track_id", ids)
        .order("split_share", { ascending: false });
      return json({ signatures: sigs ?? [] }, 200);
    }

    // 3. Fetch the link-scoped assets and sign each (short-lived R2 URLs).
    const provider = getStorageProvider();
    const assets: { file_name: string; mime_type: string | null; signed_url: string }[] = [];

    const signKey = async (b: AllowedBucket, key: string): Promise<string | null> => {
      if (!key) return null;
      if (/^https?:\/\//i.test(key)) return key; // legacy full-URL rows
      try { return await provider.createSignedUrl(b, key, SIGN_EXPIRES_SEC); }
      catch (e) { console.error("get-shared-link-asset: sign failed (bucket=" + b + "): " + (e instanceof Error ? e.message : "unknown")); return null; }
    };

    if (bucket === "stems") {
      const { data: rows } = await supabaseAdmin
        .from("stems")
        .select("file_url, file_name")
        .in("track_id", allowedTrackIds);
      for (const r of rows || []) {
        const url = await signKey("stems", (r.file_url as string) || "");
        if (url) assets.push({ file_name: (r.file_name as string) || "stem", mime_type: null, signed_url: url });
      }
    } else {
      const { data: rows } = await supabaseAdmin
        .from("track_documents")
        .select("file_path, file_name, mime_type")
        .in("track_id", allowedTrackIds);
      for (const r of rows || []) {
        const url = await signKey("documents", (r.file_path as string) || "");
        if (url) assets.push({ file_name: (r.file_name as string) || "document", mime_type: (r.mime_type as string) || null, signed_url: url });
      }
    }

    return json({ assets }, 200);
  } catch (_err) {
    return json({ error: "Internal server error" }, 500);
  }
});
