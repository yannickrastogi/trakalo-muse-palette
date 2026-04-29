-- ============================================================
-- TRAKALOG — Multi-genre migration
-- Migrates tracks.genre from text → text[] (array of genres).
-- Existing values are wrapped: 'Pop' → ARRAY['Pop'].
-- Drops + recreates insert_track / update_track so they accept
-- text[] for the genre column.
--
-- Run in Supabase SQL Editor (PostgreSQL 15+).
--
-- NOTE — Supabase SQL Editor has a known bug with nested $$ blocks.
-- Function bodies use $func$ as the delimiter to avoid conflicts.
--
-- NOTE — playlists table has no `genre` column at the time of
-- this migration. Playlist genres are kept client-side. If you
-- ever add `playlists.genre`, repeat the same ALTER TABLE pattern.
-- ============================================================

-- ─── 1. Migrate the column type ─────────────────────────────

ALTER TABLE public.tracks ALTER COLUMN genre DROP DEFAULT;

ALTER TABLE public.tracks
  ALTER COLUMN genre TYPE text[]
  USING CASE
    WHEN genre IS NOT NULL AND btrim(genre) <> '' THEN ARRAY[genre]
    ELSE NULL
  END;

-- Optional: GIN index for any genre-array filtering down the line.
CREATE INDEX IF NOT EXISTS idx_tracks_genre_gin ON public.tracks USING GIN (genre);

-- ─── 2. Drop existing insert_track / update_track overloads ─

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE proname IN ('insert_track', 'update_track')
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig::text || ' CASCADE';
  END LOOP;
END $$;

-- ─── 3. Recreate insert_track with _genre as text[] ─────────
-- Parameter order matches the call site in TrackContext.tsx → addTrack().

CREATE OR REPLACE FUNCTION public.insert_track(
  _user_id uuid,
  _workspace_id uuid,
  _title text,
  _artist text,
  _featuring text DEFAULT NULL,
  _type text DEFAULT 'song',
  _status text DEFAULT 'available',
  _bpm numeric DEFAULT NULL,
  _key text DEFAULT NULL,
  _duration_sec numeric DEFAULT NULL,
  _genre text[] DEFAULT NULL,
  _mood text[] DEFAULT '{}'::text[],
  _language text DEFAULT NULL,
  _gender text DEFAULT NULL,
  _labels text[] DEFAULT '{}'::text[],
  _publishers text[] DEFAULT '{}'::text[],
  _audio_url text DEFAULT NULL,
  _audio_preview_url text DEFAULT NULL,
  _cover_art_url text DEFAULT NULL,
  _lyrics text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _splits jsonb DEFAULT '[]'::jsonb,
  _isrc text DEFAULT NULL,
  _waveform_data jsonb DEFAULT NULL,
  _released_at timestamptz DEFAULT NULL
)
RETURNS uuid AS $func$
DECLARE
  new_track_id uuid;
BEGIN
  -- Permission check
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'Not a member of workspace %', _workspace_id;
  END IF;

  INSERT INTO public.tracks (
    workspace_id, uploaded_by, title, artist, featuring,
    track_type, status, bpm, key, duration_sec,
    genre, mood, language, gender,
    labels, publishers,
    audio_url, audio_preview_url, cover_url,
    lyrics, notes, splits, isrc, waveform_data, released_at
  ) VALUES (
    _workspace_id, _user_id, _title, _artist, _featuring,
    COALESCE(_type::public.track_type, 'song'),
    COALESCE(_status::public.track_status, 'available'),
    _bpm, _key, _duration_sec,
    NULLIF(_genre, '{}'::text[]),
    COALESCE(_mood, '{}'::text[]),
    _language,
    NULLIF(_gender, '')::public.track_gender,
    COALESCE(_labels, '{}'::text[]),
    COALESCE(_publishers, '{}'::text[]),
    _audio_url, _audio_preview_url, _cover_art_url,
    _lyrics, _notes, COALESCE(_splits, '[]'::jsonb), _isrc, _waveform_data, _released_at
  )
  RETURNING id INTO new_track_id;

  RETURN new_track_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 4. Recreate update_track ───────────────────────────────
-- Accepts jsonb _updates with dynamic key/value pairs. The genre
-- key gets special handling: jsonb array → text[].

CREATE OR REPLACE FUNCTION public.update_track(
  _user_id uuid,
  _track_id uuid,
  _updates jsonb
)
RETURNS void AS $func$
DECLARE
  workspace_uuid uuid;
  k text;
  v jsonb;
  set_clauses text := '';
  genre_array text[];
BEGIN
  -- Lookup workspace + permission
  SELECT workspace_id INTO workspace_uuid FROM public.tracks WHERE id = _track_id;
  IF workspace_uuid IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = workspace_uuid
  ) THEN
    RAISE EXCEPTION 'Not a member of workspace %', workspace_uuid;
  END IF;

  -- Build dynamic UPDATE from jsonb keys
  FOR k, v IN SELECT * FROM jsonb_each(_updates) LOOP
    IF k = 'genre' THEN
      IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
        set_clauses := set_clauses || format(', %I = NULL', k);
      ELSIF jsonb_typeof(v) = 'array' THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(v)) INTO genre_array;
        set_clauses := set_clauses || format(', %I = %L::text[]', k, genre_array);
      ELSIF jsonb_typeof(v) = 'string' THEN
        -- legacy single-string genre: wrap in array
        set_clauses := set_clauses || format(', %I = ARRAY[%L]::text[]', k, v #>> '{}');
      ELSE
        set_clauses := set_clauses || format(', %I = NULL', k);
      END IF;
    ELSIF jsonb_typeof(v) = 'null' THEN
      set_clauses := set_clauses || format(', %I = NULL', k);
    ELSIF jsonb_typeof(v) IN ('object', 'array') THEN
      set_clauses := set_clauses || format(', %I = %L::jsonb', k, v::text);
    ELSIF jsonb_typeof(v) = 'boolean' THEN
      set_clauses := set_clauses || format(', %I = %L::boolean', k, (v #>> '{}'));
    ELSIF jsonb_typeof(v) = 'number' THEN
      set_clauses := set_clauses || format(', %I = %L', k, (v #>> '{}'));
    ELSE
      set_clauses := set_clauses || format(', %I = %L', k, (v #>> '{}'));
    END IF;
  END LOOP;

  IF length(set_clauses) > 0 THEN
    set_clauses := substring(set_clauses from 3);  -- strip leading ', '
    EXECUTE format('UPDATE public.tracks SET %s, updated_at = now() WHERE id = %L', set_clauses, _track_id);
  END IF;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. Verification ───────────────────────────────────────
-- Run after the migration to confirm everything is wired up:
--
--   SELECT id, title, genre FROM public.tracks LIMIT 5;
--   SELECT pg_typeof(genre) FROM public.tracks LIMIT 1;  -- should be 'text[]'
--   SELECT proname, pg_get_function_arguments(oid)
--   FROM pg_proc
--   WHERE proname IN ('insert_track','update_track')
--     AND pronamespace = 'public'::regnamespace;
