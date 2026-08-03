-- LOT 6A #18 — expose credits on playlist shared links, with SANITIZED splits
-- (only name/stage_name/role/roles; never share %, pro, ipi, email, publisher).
DROP FUNCTION IF EXISTS public.get_playlist_tracks_for_shared_link(text);

CREATE FUNCTION public.get_playlist_tracks_for_shared_link(_slug text)
RETURNS TABLE(
  id uuid, title text, artist text, featuring text, bpm smallint, key text,
  genre text[], mood text[], cover_url text, duration_sec integer, audio_url text,
  waveform_data jsonb, lyrics text, lyrics_segments jsonb, "position" integer,
  chapters jsonb, video_url text, video_visible_on_share boolean,
  credits jsonb, splits jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  RETURN QUERY
  SELECT t.id, t.title, t.artist, t.featuring,
    t.bpm, t.key, t.genre, t.mood,
    t.cover_url, t.duration_sec, t.audio_url,
    t.waveform_data, t.lyrics, t.lyrics_segments,
    pt.position::integer,
    t.chapters,
    t.video_url, t.video_visible_on_share,
    t.credits,
    -- sanitized splits: strip everything except name / stage_name / role / roles
    CASE WHEN jsonb_typeof(t.splits) = 'array' THEN (
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'name',       s->>'name',
        'stage_name', s->>'stage_name',
        'role',       s->>'role',
        'roles',      s->'roles'
      )))
      FROM jsonb_array_elements(t.splits) s
    ) ELSE NULL END AS splits
  FROM public.tracks t
  JOIN public.playlist_tracks pt ON pt.track_id = t.id
  JOIN public.shared_links sl ON sl.playlist_id = pt.playlist_id
  WHERE sl.link_slug = _slug AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now())
  ORDER BY pt.position ASC;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_playlist_tracks_for_shared_link(text) TO anon, authenticated, service_role;;
