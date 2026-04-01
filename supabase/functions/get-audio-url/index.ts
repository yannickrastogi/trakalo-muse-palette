// Supabase Edge Function: get-audio-url
// Generates a short-lived signed URL for audio playback on public shared links.
//
// POST /get-audio-url
// Body: { slug: string, track_id: string }
// Returns: { url: string } or { error: string }
//
// Deploy: supabase functions deploy get-audio-url

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

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

  try {
    const { slug, track_id, quality } = await req.json();

    if (!track_id) {
      return new Response(JSON.stringify({ error: "Missing track_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service_role key to bypass RLS and access storage
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "get-audio-url:" + ip, _max_requests: 60, _window_seconds: 60 });
    if (rateLimitOk === false) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If slug is provided, validate the shared link (public access flow)
    if (slug) {
      // 1. Verify the shared link exists and is active
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("shared_links")
        .select("id, share_type, track_id, playlist_id, status, expires_at")
        .eq("link_slug", slug)
        .single();

      if (linkErr || !link) {
        return new Response(JSON.stringify({ error: "Link not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (link.status !== "active") {
        return new Response(JSON.stringify({ error: "Link is not active" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Link has expired" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Verify the track_id is associated with this shared link
      let trackAllowed = false;

      if (link.share_type === "playlist" && link.playlist_id) {
        const { data: ptRow } = await supabaseAdmin
          .from("playlist_tracks")
          .select("id")
          .eq("playlist_id", link.playlist_id)
          .eq("track_id", track_id)
          .maybeSingle();

        trackAllowed = !!ptRow;
      } else if (link.track_id === track_id) {
        trackAllowed = true;
      }

      if (!trackAllowed) {
        return new Response(JSON.stringify({ error: "Track not associated with this link" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // No slug: authenticated user flow (Smart A&R, catalog preview, etc.)

    // 3. Get the audio_url (storage path) from the tracks table
    const { data: track, error: trackErr } = await supabaseAdmin
      .from("tracks")
      .select("audio_url, audio_preview_url")
      .eq("id", track_id)
      .single();

    if (trackErr || !track || !track.audio_url) {
      return new Response(JSON.stringify({ error: "Track audio not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use preview URL when requested, fall back to original if no preview exists
    const audioPath = (quality === "preview" && track.audio_preview_url)
      ? (track.audio_preview_url as string)
      : (track.audio_url as string);

    // If it's already a full URL (legacy), return as-is
    if (audioPath.startsWith("http")) {
      return new Response(JSON.stringify({ url: audioPath }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Generate a signed URL (1 hour validity)
    const { data: signedData, error: signErr } = await supabaseAdmin
      .storage
      .from("tracks")
      .createSignedUrl(audioPath, 3600);

    if (signErr || !signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: "Failed to generate audio URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: signedData.signedUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
