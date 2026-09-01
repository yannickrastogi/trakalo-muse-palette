import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/ip.ts";
import { isValidUUID, boundStr, LIMITS, readJsonBounded, InputError } from "../_shared/validation.ts";

// Anonymous (recipient) comments on a shared link.
//
// Why an Edge Function instead of a direct anon INSERT: the track_comments
// anon-insert RLS policy validates the link via an EXISTS subquery on
// shared_links, but anon has no SELECT policy on shared_links → the subquery
// sees zero rows and the INSERT is denied (401/403). Here the service role
// validates the slug → active link → track membership itself, then inserts
// (bypassing RLS), so the check is enforced server-side without exposing
// shared_links to anon.

const MAX_CONTENT = 2000;
const MAX_NAME = 200;

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);

  const ip = getClientIp(req);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: rateLimitOk } = await supabase.rpc("check_rate_limit", { _key: "add-comment:" + ip, _max_requests: 60, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await readJsonBounded(req);
    const slug = boundStr(body.slug, LIMITS.SLUG);
    const track_id = typeof body.track_id === "string" ? body.track_id : "";
    const author_name = typeof body.author_name === "string" ? body.author_name.trim().slice(0, MAX_NAME) : "";
    const author_email = typeof body.author_email === "string" && body.author_email.trim() ? body.author_email.trim().slice(0, MAX_NAME) : null;
    const content = typeof body.content === "string" ? body.content.trim().slice(0, MAX_CONTENT) : "";
    const tsRaw = Number(body.timestamp_sec);
    const timestamp_sec = Number.isFinite(tsRaw) && tsRaw >= 0 ? Math.round(tsRaw * 100) / 100 : 0;

    if (!slug || !track_id || !content) {
      return new Response(JSON.stringify({ error: "slug, track_id and content are required" }), {
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

    // Resolve the active shared link for this slug.
    const { data: link, error: linkError } = await supabase
      .from("shared_links")
      .select("id, track_id, playlist_id, status, expires_at")
      .eq("link_slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Never accept a comment on an expired link (status is not auto-flipped on
    // expiry — consistent with get-audio-url / get-track-comments).
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The track must belong to the link — directly or through its playlist.
    let belongs = link.track_id === track_id;
    if (!belongs && link.playlist_id) {
      const { data: pt } = await supabase
        .from("playlist_tracks")
        .select("track_id")
        .eq("playlist_id", link.playlist_id)
        .eq("track_id", track_id)
        .maybeSingle();
      belongs = !!pt;
    }
    if (!belongs) {
      return new Response(JSON.stringify({ error: "Track not part of this shared link" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert through the token-validated RPC so the DB mints the author_secret
    // (returned once to the creator, only its hash is stored) — the same secret
    // the visitor needs to edit/delete later. The pre-checks above give precise
    // 404/403s; the RPC re-validates the link as defense in depth.
    const { data: rpcComment, error: rpcError } = await supabase.rpc("insert_track_comment_via_token", {
      _track_id: track_id,
      _shared_link_token: slug,
      _content: content,
      _author_name: author_name || "Anonymous",
      _author_email: author_email,
      _timestamp_sec: timestamp_sec,
    });

    if (rpcError || !rpcComment) {
      // 42501 = insufficient_privilege → invalid/expired link or track not on it.
      const denied = rpcError?.code === "42501";
      console.error("add-track-comment: rpc insert failed (code=" + (rpcError?.code || "unknown") + ")");
      return new Response(JSON.stringify({ error: denied ? "Link not found" : "Failed to save comment" }), {
        status: denied ? 404 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // rpcComment carries author_secret (plaintext, once) — never log it.
    return new Response(JSON.stringify({ success: true, comment: rpcComment }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof InputError) {
      console.error("add-track-comment: rejected body (" + err.message + ")");
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("add-track-comment: internal error");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
