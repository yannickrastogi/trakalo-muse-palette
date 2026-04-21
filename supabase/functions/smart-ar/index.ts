import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { brief, track_count, workspace_id } = await req.json();

    if (!brief || !workspace_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: brief, workspace_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tracks, error: tracksError } = await supabase
      .from("tracks")
      .select("id, title, artist, genre, bpm, key, mood, gender, duration_sec, status, featuring, language, sonic_dna")
      .eq("workspace_id", workspace_id);

    if (tracksError) {
      return new Response(
        JSON.stringify({ error: tracksError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch shared tracks via catalog_shares
    const allTracks = [...(tracks || [])];

    const { data: shares } = await supabase
      .from("catalog_shares")
      .select("source_workspace_id, track_id")
      .eq("target_workspace_id", workspace_id)
      .eq("status", "active");

    if (shares && shares.length > 0) {
      // Individual track shares (track_id is set)
      const individualTrackIds = shares.filter(s => s.track_id).map(s => s.track_id);
      if (individualTrackIds.length > 0) {
        const { data: individualTracks } = await supabase
          .from("tracks")
          .select("id, title, artist, genre, bpm, key, mood, gender, duration_sec, status, featuring, language, sonic_dna")
          .in("id", individualTrackIds);
        if (individualTracks) {
          allTracks.push(...individualTracks);
        }
      }

      // Full catalog shares (track_id is null)
      const fullCatalogWsIds = [...new Set(shares.filter(s => !s.track_id).map(s => s.source_workspace_id))];
      for (const wsId of fullCatalogWsIds) {
        const { data: wsTracks } = await supabase
          .from("tracks")
          .select("id, title, artist, genre, bpm, key, mood, gender, duration_sec, status, featuring, language, sonic_dna")
          .eq("workspace_id", wsId);
        if (wsTracks) {
          allTracks.push(...wsTracks);
        }
      }
    }

    // Deduplicate by track id
    const seenIds = new Set<string>();
    const dedupedTracks = allTracks.filter(t => {
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    });

    console.log("smart-ar: workspace_id=" + workspace_id + " own_tracks=" + (tracks?.length || 0) + " shared_tracks=" + (dedupedTracks.length - (tracks?.length || 0)) + " total=" + dedupedTracks.length);

    if (dedupedTracks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No tracks found in workspace" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isLargeCatalog = dedupedTracks.length > 40;
    const formattedTracks = dedupedTracks
      .map(
        (t, i) => {
          let line =
            (i + 1) +
            ". [" +
            t.id +
            "] " +
            t.title +
            " - " +
            (t.artist || "Unknown") +
            " | genre: " +
            (t.genre || "N/A") +
            " | bpm: " +
            (t.bpm || "N/A") +
            " | key: " +
            (t.key || "N/A") +
            " | mood: " +
            (t.mood || "N/A") +
            " | voice/gender: " +
            (t.gender || "N/A") +
            " | duration: " +
            (t.duration_sec || "N/A") +
            "s";
          if (!isLargeCatalog) {
            line +=
              " | status: " +
              (t.status || "N/A") +
              " | featuring: " +
              (t.featuring || "N/A") +
              " | language: " +
              (t.language || "N/A");
          }
          if (t.sonic_dna) {
            line +=
              " | dna: bpm_conf=" + (t.sonic_dna.bpm?.confidence || "N/A") +
              " val=" + (t.sonic_dna.mood?.valence || "N/A") +
              " aro=" + (t.sonic_dna.mood?.arousal || "N/A") +
              " bright=" + (t.sonic_dna.spectral?.brightness || "N/A") +
              " warm=" + (t.sonic_dna.spectral?.warmth || "N/A") +
              " sync=" + (t.sonic_dna.intro_clearance?.sync_ready || "N/A") +
              " type=" + (t.sonic_dna.user_metadata?.type || "N/A");
          }
          return line;
        }
      )
      .join("\n");

    const selectionInstruction =
      track_count === "all"
        ? "Select ALL tracks that match the brief, ranked by relevance."
        : "Select the top " + track_count + " tracks that best match the brief, ranked by relevance.";

    let groqResponse;
    try {
    groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + Deno.env.get("GROQ_API_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are a senior music A&R assistant working with producers, music supervisors, and label A&Rs. " +
              "Given a brief and a catalog of tracks with metadata and internal audio analysis data, select the best matching tracks ranked by relevance.\n\n" +
              "CRITICAL RULES FOR YOUR RESPONSES:\n" +
              "- NEVER use internal analysis terms in your output: arousal, valence, brightness, warmth, spectral, energy score, bpm_conf, or raw numeric scores (0.822, etc.). These are internal data for YOUR matching logic only.\n" +
              "- Use music industry language: \"high energy\", \"dark vibe\", \"upbeat feel\", \"mellow tone\", \"aggressive\", \"chill\", \"cinematic\", \"driving\", \"ethereal\", \"gritty\", \"anthemic\", \"laid-back\", etc.\n" +
              "- Each track's \"reason\" must be 1 short sentence explaining why THIS track fits THIS brief. Focus on: BPM, key, genre proximity, mood/vibe, vocal vs instrumental, duration, structure.\n" +
              "- If the brief mentions a specific usage (ad, film, sync, playlist, trailer), adapt your vocabulary accordingly.\n\n" +
              "HOW TO USE THE INTERNAL DATA (for matching only, never expose in output):\n" +
              "- val (valence): low = dark/melancholic, high = happy/uplifting\n" +
              "- aro (arousal): low = calm/chill, high = intense/energetic\n" +
              "- bright: low = warm/dark tone, high = bright/airy tone\n" +
              "- warm: high = rich/full sound, low = thin/cold sound\n" +
              "- sync: true = clean intro suitable for sync placements\n" +
              "- type: song/instrumental/sample/acapella\n\n" +
              "Return valid JSON only, no markdown fences.",
          },
          {
            role: "user",
            content:
              "Brief: " +
              brief +
              "\n\nCatalog (" +
              dedupedTracks.length +
              " tracks):\n" +
              formattedTracks +
              "\n\n" +
              selectionInstruction +
              "\n\nRespond with JSON in this exact format:\n" +
              '{ "playlist_name": string, "criteria": string[], "tracks": [{ "id": string, "score": number, "reason": string }] }',
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    } catch (groqFetchError) {
      console.error("smart-ar: Groq API fetch error:", groqFetchError);
      return new Response(
        JSON.stringify({ error: "Groq API fetch failed: " + groqFetchError.message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("smart-ar: Groq API returned " + groqResponse.status + ": " + errorText);
      return new Response(
        JSON.stringify({ error: "Groq API error: " + errorText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqResponse.json();
    const content = groqData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Empty response from Groq API" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(content);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
