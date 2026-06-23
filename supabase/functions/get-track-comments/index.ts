import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { isValidUUID } from "../_shared/validation.ts";

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

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: rateLimitOk } = await supabase.rpc("check_rate_limit", { _key: "get-comments:" + ip, _max_requests: 240, _window_seconds: 60 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const slug = body.slug;
    const track_id = body.track_id;

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
      .select("id, track_id, playlist_id, status")
      .eq("link_slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (linkError || !link) {
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

    const { data: comments, error: selError } = await supabase
      .from("track_comments")
      .select("*")
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

    return new Response(JSON.stringify({ success: true, comments: comments || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
