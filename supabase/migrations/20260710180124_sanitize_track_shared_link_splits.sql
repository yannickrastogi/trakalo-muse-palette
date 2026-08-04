-- PRE-LAUNCH PRIVACY FIX: get_track_for_shared_link leaked full splits (share %, IPI, PRO,
-- email, publisher) to anonymous visitors on track share links.
-- Fix: sanitize splits to name/stage_name/role/roles only, and expose a pre-computed
-- total_shares so the pack download no longer needs the per-collaborator share breakdown.
DROP FUNCTION IF EXISTS public.get_track_for_shared_link(text);

CREATE FUNCTION public.get_track_for_shared_link(_slug text)
RETURNS TABLE(
  id uuid, title text, artist text, featuring text, bpm smallint, key text,
  genre text[], mood text[], cover_url text, duration_sec integer, audio_url text,
  waveform_data jsonb, sonic_dna jsonb, credits jsonb, lyrics text, lyrics_segments jsonb,
  splits jsonb, isrc text, album text, labels text[], publishers text[],
  language text, gender text, released_at timestamp with time zone, copyright text,
  explicit boolean, chapters jsonb, video_url text, video_visible_on_share boolean,
  total_shares numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  RETURN QUERY
  SELECT t.id, t.title, t.artist, t.featuring,
    t.bpm, t.key, t.genre, t.mood,
    t.cover_url, t.duration_sec, t.audio_url,
    t.waveform_data, t.sonic_dna, t.credits,
    t.lyrics, t.lyrics_segments,
    -- SANITIZED splits: names/roles only, no share %, IPI, PRO, email, publisher
    CASE WHEN jsonb_typeof(t.splits) = 'array' THEN (
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'name',       s->>'name',
        'stage_name', s->>'stage_name',
        'role',       s->>'role',
        'roles',      s->'roles'
      )))
      FROM jsonb_array_elements(t.splits) s
    ) ELSE NULL END AS splits,
    t.isrc, t.album, t.labels, t.publishers,
    t.language, t.gender::text,
    t.released_at, t.copyright, t.explicit,
    t.chapters,
    t.video_url, t.video_visible_on_share,
    -- pre-computed total (single aggregate, not the per-person breakdown)
    CASE WHEN jsonb_typeof(t.splits) = 'array' THEN (
      SELECT COALESCE(sum((s->>'share')::numeric), 0)
      FROM jsonb_array_elements(t.splits) s
      WHERE (s->>'share') ~ '^[0-9]+(\.[0-9]+)?$'
    ) ELSE 0 END AS total_shares
  FROM public.tracks t
  JOIN public.shared_links sl ON sl.track_id = t.id
  WHERE sl.link_slug = _slug AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_track_for_shared_link(text) TO anon, authenticated, service_role;;
