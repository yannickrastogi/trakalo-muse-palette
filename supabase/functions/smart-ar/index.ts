import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { isValidUUID } from "../_shared/validation.ts";
import { getAuthedUser, assertWorkspaceMember, HttpError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: rateLimitOk } = await supabase.rpc("check_rate_limit", { _key: "smart-ar:" + ip, _max_requests: 20, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // Authenticate the caller, then enforce their plan's Smart A&R quota BEFORE
    // any AI work. assert_caller() bypasses for service_role, so the service-role
    // client passes the JWT-validated _user_id straight through.
    const { user } = await getAuthedUser(req);
    // Roll the monthly counter over if the billing period elapsed, THEN read the quota.
    await supabase.rpc("reset_monthly_usage_if_due", { _user_id: user.id });
    const { data: quota, error: quotaErr } = await supabase.rpc("check_smart_ar_quota", { _user_id: user.id });
    if (quotaErr) {
      // Fail closed, but signal a server error rather than a misleading "limit reached".
      console.error("smart-ar: quota check failed: " + quotaErr.message);
      return new Response(
        JSON.stringify({ error: "quota_check_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!quota || quota.allowed !== true) {
      console.log("smart-ar: quota reached user=" + user.id + " scope=" + (quota?.scope ?? "unknown") + " used=" + (quota?.used ?? "?") + " limit=" + (quota?.limit ?? "?"));
      return new Response(
        JSON.stringify({ error: "plan_limit_reached", scope: quota?.scope ?? null, used: quota?.used ?? null, limit: quota?.limit ?? null }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Anti-loop (per user) + platform fuse — BEFORE the paid model call, after the
    // plan quota. check_rate_limit increments per call, so refusals stop here.
    const { data: userRateOk } = await supabase.rpc("check_rate_limit", { _key: "smartar:user:" + user.id, _max_requests: 100, _window_seconds: 3600 });
    if (userRateOk === false) {
      console.log("smart-ar: rate limit hit guard=user user=" + user.id + " limit=100/1h");
      return new Response(JSON.stringify({ error: "rate_limited", scope: "user" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: globalRateOk } = await supabase.rpc("check_rate_limit", { _key: "smartar:global", _max_requests: 3000, _window_seconds: 86400 });
    if (globalRateOk === false) {
      console.log("smart-ar: rate limit hit guard=global user=" + user.id + " limit=3000/24h");
      return new Response(JSON.stringify({ error: "rate_limited", scope: "global" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const brief = typeof body.brief === 'string' ? body.brief.substring(0, 2000) : '';
    const track_count = body.track_count;
    const workspace_id = body.workspace_id;
    // "personal" (default) = the caller's catalog + shares. "marketplace" = all
    // tracks opted into Trakalog Access (is_marketplace_public = true).
    const mode = body.mode === "marketplace" ? "marketplace" : "personal";

    if (!brief || !workspace_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: brief, workspace_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidUUID(workspace_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid workspace_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Display columns are only fetched in marketplace mode, where we enrich the
    // AI result with safe public fields (never splits / credits / audio_url).
    const MARKETPLACE_COLS = "id, title, artist, genre, bpm, key, mood, gender, duration_sec, status, featuring, language, sonic_dna, tags, cover_url, audio_preview_url, track_type, workspace_id, workspaces(name)";
    const PERSONAL_COLS = "id, title, artist, genre, bpm, key, mood, gender, duration_sec, status, featuring, language, sonic_dna, tags";

    let dedupedTracks: any[] = [];

    if (mode === "marketplace") {
      const { data: pub, error: pubError } = await supabase
        .from("tracks")
        .select(MARKETPLACE_COLS)
        .eq("is_marketplace_public", true)
        .eq("status", "available")
        .limit(500);
      if (pubError) {
        return new Response(JSON.stringify({ error: pubError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      dedupedTracks = pub || [];
    } else {
      // IDOR guard: personal mode reads this workspace's own catalog AND the
      // catalogs shared INTO it, so the caller must be a member of workspace_id
      // itself (their active workspace) — otherwise a non-member could enumerate
      // another workspace's catalog and its inbound third-party shares. This does
      // NOT break shared-catalog Smart A&R: shares reach the user through THEIR
      // own workspace (the share target), which they are a member of.
      try {
        await assertWorkspaceMember(supabase, user.id, workspace_id, "viewer");
      } catch (accessErr) {
        if (accessErr instanceof HttpError && accessErr.status === 403) {
          return new Response(JSON.stringify({ error: "forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw accessErr;
      }

      const { data: tracks, error: tracksError } = await supabase
        .from("tracks")
        .select(PERSONAL_COLS)
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
            .select(PERSONAL_COLS)
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
            .select(PERSONAL_COLS)
            .eq("workspace_id", wsId);
          if (wsTracks) {
            allTracks.push(...wsTracks);
          }
        }
      }

      // Deduplicate by track id
      const seenIds = new Set<string>();
      dedupedTracks = allTracks.filter(t => {
        if (seenIds.has(t.id)) return false;
        seenIds.add(t.id);
        return true;
      });
    }

    if (dedupedTracks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No tracks found in workspace" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isLargeCatalog = dedupedTracks.length > 40;

    // Sanitize a single tag value for safe inclusion in the LLM prompt.
    // Strips control chars / newlines / backticks (prompt-injection mitigation) and caps length.
    const sanitizeTag = (value: unknown): string | null => {
      if (typeof value !== "string") return null;
      const cleaned = value
        .replace(/[\r\n\t`]+/g, " ")
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .trim()
        .slice(0, 50);
      return cleaned.length > 0 ? cleaned : null;
    };

    const sanitizeTagList = (arr: unknown): string[] => {
      if (!Array.isArray(arr)) return [];
      const out: string[] = [];
      for (const v of arr) {
        const s = sanitizeTag(v);
        if (s) out.push(s);
      }
      return out;
    };

    // Build the tags subsection for one track. Empty categories are omitted to reduce prompt noise.
    // Total tags per track are capped at 30 to bound prompt length.
    const formatTagLines = (tags: unknown): string => {
      if (!tags || typeof tags !== "object") return "";
      const t = tags as Record<string, unknown>;
      const instruments = sanitizeTagList(t.instruments);
      const themes = sanitizeTagList(t.lyric_themes);
      const moodFeel = sanitizeTagList(t.mood_feel);
      const tempoDescriptor = sanitizeTag(t.tempo_descriptor);
      const syncTags = sanitizeTagList(t.sync_tags);
      const customTags = sanitizeTagList(t.custom);

      // Cap total tags per track to 30 across all categories (preserve category order).
      const MAX_TAGS_PER_TRACK = 30;
      let budget = MAX_TAGS_PER_TRACK;
      const take = (arr: string[]): string[] => {
        if (budget <= 0) return [];
        const slice = arr.slice(0, budget);
        budget -= slice.length;
        return slice;
      };
      const instrumentsT = take(instruments);
      const themesT = take(themes);
      const moodFeelT = take(moodFeel);
      let tempoDescriptorT: string | null = null;
      if (tempoDescriptor && budget > 0) {
        tempoDescriptorT = tempoDescriptor;
        budget -= 1;
      }
      const syncTagsT = take(syncTags);
      const customTagsT = take(customTags);

      const parts: string[] = [];
      if (instrumentsT.length > 0) parts.push(" | instruments: " + instrumentsT.join(", "));
      if (themesT.length > 0) parts.push(" | themes: " + themesT.join(", "));
      if (moodFeelT.length > 0) parts.push(" | mood_feel: " + moodFeelT.join(", "));
      if (tempoDescriptorT) parts.push(" | tempo_descriptor: " + tempoDescriptorT);
      if (syncTagsT.length > 0) parts.push(" | sync_tags: " + syncTagsT.join(", "));
      if (customTagsT.length > 0) parts.push(" | custom_tags: " + customTagsT.join(", "));
      return parts.join("");
    };

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
            (Array.isArray(t.genre) ? (t.genre.length > 0 ? t.genre.join(", ") : "N/A") : (t.genre || "N/A")) +
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
          line += formatTagLines(t.tags);
          return line;
        }
      )
      .join("\n");

    const selectionInstruction =
      track_count === "all"
        ? "Select ALL tracks that match the brief, ranked by relevance."
        : track_count === 1
          ? "Select the SINGLE best track for the brief — return exactly one track, the strongest match."
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
              "- Each track's \"reason\" must be 1 short sentence explaining why THIS track fits THIS brief. Focus on: BPM, key, genre proximity, mood/vibe, vocal vs instrumental, duration, structure, AND any matching user-provided tags (instruments, themes, mood_feel, tempo_descriptor, sync_tags, custom_tags).\n" +
              "- If the brief mentions a specific usage (ad, film, sync, playlist, trailer), adapt your vocabulary accordingly.\n\n" +
              "HOW TO USE THE INTERNAL DATA (for matching only, never expose in output):\n" +
              "- val (valence): low = dark/melancholic, high = happy/uplifting\n" +
              "- aro (arousal): low = calm/chill, high = intense/energetic\n" +
              "- bright: low = warm/dark tone, high = bright/airy tone\n" +
              "- warm: high = rich/full sound, low = thin/cold sound\n" +
              "- sync: true = clean intro suitable for sync placements\n" +
              "- type: song/instrumental/sample/acapella\n\n" +
              "HOW TO USE THE USER-PROVIDED TAGS (these ARE meant to be exposed in your reason text):\n" +
              "- Tags are structured classifications hand-picked by the catalog owner. They are highly intentional and should be weighted strongly in your matching.\n" +
              "- instruments: sonic palette (e.g. synth, 808, acoustic guitar). Match against instrumentation cues in the brief.\n" +
              "- themes: lyrical subject matter (e.g. love, freedom, struggle). Match against narrative or emotional cues in the brief.\n" +
              "- mood_feel: subjective mood descriptors (e.g. confident, uplifting, melancholic). Use ALONGSIDE valence/arousal — they complement the numeric mood data.\n" +
              "- tempo_descriptor: human-friendly tempo label (e.g. slow, mid, fast, driving). Use ALONGSIDE the numeric BPM — they complement each other.\n" +
              "- sync_tags: explicit sync-use classifications (e.g. trailer, workout, commercial, montage, end credits). These are PARTICULARLY VALUABLE for sync briefs (ads, films, series, sports, trailers) — strongly prioritize tracks whose sync_tags directly match the brief's intended usage.\n" +
              "- custom_tags: free-form user tags. Treat as additional signal.\n" +
              "- Tracks WITH tags that match the brief should rank above otherwise-equivalent tracks WITHOUT matching tags.\n" +
              "- Tracks without tags are still valid candidates — fall back to sonic_dna and classic metadata for those.\n" +
              "- In your \"reason\" text, cite the specific tags that drove the match (e.g. \"sync_tags include trailer; instruments feature synth which fits the brief\").\n\n" +
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
      console.error("smart-ar: Groq API fetch failed (" + (groqFetchError instanceof Error ? groqFetchError.name : "unknown") + ")");
      return new Response(
        JSON.stringify({ error: "Groq API fetch failed: " + (groqFetchError instanceof Error ? groqFetchError.message : String(groqFetchError)) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("smart-ar: Groq API non-OK (status=" + groqResponse.status + ")");
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

    // In marketplace mode the caller has no local copy of these tracks, so we
    // merge the AI ranking with SAFE public display fields (no splits/credits/
    // original audio). The preview path is already exposed by search_marketplace_tracks.
    if (mode === "marketplace" && Array.isArray(result.tracks)) {
      const byId = new Map(dedupedTracks.map((t: any) => [t.id, t]));
      result.tracks = result.tracks
        .map((rt: any) => {
          const t = byId.get(rt.id);
          if (!t) return null;
          return {
            id: t.id,
            score: rt.score,
            reason: rt.reason,
            title: t.title,
            artist: t.artist,
            cover_url: t.cover_url,
            genre: t.genre,
            mood: t.mood,
            bpm: t.bpm,
            key: t.key,
            duration_sec: t.duration_sec,
            track_type: t.track_type,
            audio_preview_url: t.audio_preview_url,
            workspace_id: t.workspace_id,
            workspace_name: t.workspaces?.name ?? null,
          };
        })
        .filter(Boolean);
    }

    // Successful query → count it against the user's monthly/lifetime quota.
    // Best-effort: a counter failure must not deny the user their result.
    try {
      const { error: incrErr } = await supabase.rpc("increment_smart_ar_usage", { _user_id: user.id });
      if (incrErr) console.error("smart-ar: usage increment failed: " + incrErr.message);
    } catch (incrErr) {
      console.error("smart-ar: usage increment threw: " + (incrErr instanceof Error ? incrErr.message : "unknown"));
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
