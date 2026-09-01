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
import { getClientIp } from "../_shared/ip.ts";
import { isValidUUID, boundStr, LIMITS, readJsonBounded, InputError } from "../_shared/validation.ts";
import { getStorageProvider } from "../_shared/storage.ts";
import { getAuthedUser, assertWorkspaceMember, resolveTrackWorkspace, HttpError } from "../_shared/auth.ts";

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
    const body = await readJsonBounded(req);
    const slug = boundStr(body.slug, LIMITS.SLUG);
    const track_id = typeof body.track_id === "string" ? body.track_id : "";
    const quality = boundStr(body.quality, 32);

    if (!track_id) {
      return new Response(JSON.stringify({ error: "Missing track_id" }), {
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

    // Use service_role key to bypass RLS and access storage
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ip = getClientIp(req);
    const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "get-audio-url:" + ip, _max_requests: 60, _window_seconds: 60 });
    if (rateLimitOk === false) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If slug is provided, validate the shared link (public access flow)
    if (slug) {
      // 1. Verify the shared link exists and is active
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("shared_links")
        .select("id, share_type, track_id, playlist_id, status, expires_at, allow_download")
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

      // Hi-res download (quality="original") requires the link to allow downloads.
      // Playback uses quality="preview", so this never blocks listening.
      if (quality === "original" && !link.allow_download) {
        return new Response(JSON.stringify({ error: "Download not allowed for this link" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // No slug: authenticated user flow (Smart A&R, catalog preview, etc.).
      // The caller must be a member (>= viewer) of the track's own workspace.
      const { user } = await getAuthedUser(req);
      const ws = await resolveTrackWorkspace(supabaseAdmin, track_id);
      if (!ws) {
        return new Response(JSON.stringify({ error: "Track not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await assertWorkspaceMember(supabaseAdmin, user.id, ws, "viewer");
    }

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

    // Decide which audio variant to serve. Default: preview when asked, original
    // otherwise. We layer a readiness probe on top so that a freshly-uploaded
    // track whose `_preview.mp3` has been written to the DB but isn't yet
    // visible to R2 doesn't return a 404-bound signed URL to the player.
    const provider = getStorageProvider();
    const previewPath = track.audio_preview_url as string | null;
    const originalPath = track.audio_url as string;

    let audioPath: string = originalPath;
    if (quality === "preview" && previewPath) {
      // Only serve the preview path if the object is actually retrievable from
      // the active storage backend. If absent (e.g. eventual-consistency window
      // right after upload), transparently fall back to the original so the
      // player never sees a broken URL.
      try {
        const previewExists = await provider.exists("tracks", previewPath);
        audioPath = previewExists ? previewPath : originalPath;
        if (!previewExists) {
          console.warn("get-audio-url: preview missing in " + provider.name + " for track " + track_id + " — falling back to original");
        }
      } catch (e) {
        console.warn("get-audio-url: preview HEAD probe threw (" + (e instanceof Error ? e.message : "unknown") + ") — falling back to original");
        audioPath = originalPath;
      }
    }

    // If it's already a full URL (legacy), return as-is
    if (audioPath.startsWith("http")) {
      return new Response(JSON.stringify({ url: audioPath }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a signed URL (5 min validity — DRM: short-lived URLs).
    // Routed through the storage abstraction (Supabase or R2 via STORAGE_PROVIDER env).
    //
    // Legacy Supabase-direct call (kept here as comment for Phase 2 rollback reference):
    //   const { data: signedData, error: signErr } = await supabaseAdmin
    //     .storage.from("tracks").createSignedUrl(audioPath, 300);
    let signedUrl: string;
    try {
      signedUrl = await provider.createSignedUrl("tracks", audioPath, 300);
    } catch (e) {
      console.error("get-audio-url: createSignedUrl failed (" + (e instanceof Error ? e.message : "unknown") + ")");
      return new Response(JSON.stringify({ error: "Failed to generate audio URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: signedUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof InputError) {
      console.error("get-audio-url: rejected body (" + err.message + ")");
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (err instanceof HttpError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
