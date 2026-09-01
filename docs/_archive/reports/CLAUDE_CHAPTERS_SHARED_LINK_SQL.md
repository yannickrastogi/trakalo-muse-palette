# SQL migration — Add `chapters` to shared-link RPCs

> **Copy-paste into Supabase SQL Editor (never auto-execute from Claude).**
> Single block, idempotent. The `DROP FUNCTION` calls are mandatory since we're changing the `RETURNS TABLE` signature.

```sql
-- 1. Single-track shared link RPC
DROP FUNCTION IF EXISTS public.get_track_for_shared_link(text);

CREATE OR REPLACE FUNCTION public.get_track_for_shared_link(_slug text)
RETURNS TABLE(
  id uuid, title text, artist text, featuring text,
  bpm smallint, key text, genre text[], mood text[],
  cover_url text, duration_sec integer, audio_url text,
  waveform_data jsonb, sonic_dna jsonb, credits jsonb,
  lyrics text, lyrics_segments jsonb,
  splits jsonb, isrc text, album text, labels text[], publishers text[],
  language text, gender text,
  released_at timestamp with time zone, copyright text, explicit boolean,
  chapters jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  RETURN QUERY
  SELECT t.id, t.title, t.artist, t.featuring,
    t.bpm, t.key, t.genre, t.mood,
    t.cover_url, t.duration_sec, t.audio_url,
    t.waveform_data, t.sonic_dna, t.credits,
    t.lyrics, t.lyrics_segments,
    t.splits, t.isrc, t.album, t.labels, t.publishers,
    t.language, t.gender::text,
    t.released_at, t.copyright, t.explicit,
    t.chapters
  FROM public.tracks t
  JOIN public.shared_links sl ON sl.track_id = t.id
  WHERE sl.link_slug = _slug AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_track_for_shared_link(text) TO anon, authenticated;

-- 2. Playlist shared link RPC
DROP FUNCTION IF EXISTS public.get_playlist_tracks_for_shared_link(text);

CREATE OR REPLACE FUNCTION public.get_playlist_tracks_for_shared_link(_slug text)
RETURNS TABLE(
  id uuid, title text, artist text, featuring text,
  bpm smallint, key text, genre text[], mood text[],
  cover_url text, duration_sec integer, audio_url text,
  waveform_data jsonb, lyrics text, lyrics_segments jsonb,
  "position" integer,
  chapters jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  RETURN QUERY
  SELECT t.id, t.title, t.artist, t.featuring,
    t.bpm, t.key, t.genre, t.mood,
    t.cover_url, t.duration_sec, t.audio_url,
    t.waveform_data, t.lyrics, t.lyrics_segments,
    pt.position::integer,
    t.chapters
  FROM public.tracks t
  JOIN public.playlist_tracks pt ON pt.track_id = t.id
  JOIN public.shared_links sl ON sl.playlist_id = pt.playlist_id
  WHERE sl.link_slug = _slug AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now())
  ORDER BY pt.position ASC;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_playlist_tracks_for_shared_link(text) TO anon, authenticated;
```

## Smoke test post-migration

```sql
-- Verify the updated signature
SELECT pg_get_function_result(oid)
FROM pg_proc
WHERE proname IN ('get_track_for_shared_link', 'get_playlist_tracks_for_shared_link');
-- Should contain 'chapters jsonb' in both.

-- Functional test: if you have a track with chapters defined, grab its slug
SELECT chapters FROM public.get_track_for_shared_link('<slug>') LIMIT 1;
```

## Expected UI behavior

- If `tracks.chapters` is NULL → the EF returns NULL → no pills displayed (frontend short-circuits).
- If `tracks.chapters = '[]'::jsonb` → same (empty array).
- If chapters contains items → horizontally scrollable pills displayed below the waveform, clickable → seek to `startPercent`.