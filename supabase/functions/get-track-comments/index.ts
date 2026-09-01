import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/ip.ts";
import { isValidUUID, boundStr, LIMITS, readJsonBounded, InputError } from "../_shared/validation.ts";

// Read comments for a track inside a shared link (anonymous recipients).
//
// Anon can't SELECT track_comments directly: the anon RLS policy filters via a
// shared_links subquery that anon can't read (no anon select policy on
// shared_links). The service role validates the slug → active link → track
// membership and returns only that track's comments for this link.

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  const ip = getClientIp(req);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: rateLimitOk } = await supabase.rpc("check_rate_limit", { _key: "get-comments:" + ip, _max_requests: 240, _window_seconds: 60 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await readJsonBounded(req);
    const slug = boundStr(body.slug, LIMITS.SLUG);
    const track_id = typeof body.track_id === "string" ? body.track_id : "";
    // The visitor's own email (from the gate) — used only to mark their own
    // comments. Never used to disclose other visitors' emails.
    const visitorEmail = boundStr(body.visitor_email, LIMITS.EMAIL).toLowerCase();

    if (!slug || !track_id) {
      return new Response(JSON.stringify({ error: "slug and track_id are required" }), {
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

    // Don't serve comments on an expired link (consistent with get-audio-url /
    // log-link-access, which both gate on expires_at).
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Link has expired" }), {
        status: 403,
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

    // author_email is fetched server-side (needed to identify the caller's own
    // comments) but is NEVER returned for other visitors' comments — otherwise
    // every link visitor could harvest every commenter's email.
    const { data: comments, error: selError } = await supabase
      .from("track_comments")
      .select("id, track_id, shared_link_id, author_name, author_email, author_type, timestamp_sec, content, created_at, updated_at, is_edited")
      .eq("track_id", track_id)
      .eq("shared_link_id", link.id)
      .order("timestamp_sec", { ascending: true });

    if (selError) {
      console.error("get-track-comments: select failed (code=" + (selError.code || "unknown") + ")");
      return new Response(JSON.stringify({ error: "Failed to load comments" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Never return author_email to the client (commenter PII). Instead expose a
    // server-computed `is_own` boolean so the UI can flag the visitor's own
    // comments (edit/delete are authorized separately via a token RPC). This also
    // closes the confirmation-oracle channel of echoing the supplied email back.
    const safeComments = (comments || []).map((c) => {
      const own = !!visitorEmail && typeof c.author_email === "string"
        && c.author_email.toLowerCase() === visitorEmail;
      const { author_email: _omit, ...rest } = c;
      return { ...rest, is_own: own };
    });

    return new Response(JSON.stringify({ success: true, comments: safeComments }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof InputError) {
      console.error("get-track-comments: rejected body (" + err.message + ")");
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("get-track-comments: internal error (" + (err instanceof Error ? err.name : "unknown") + ")");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
