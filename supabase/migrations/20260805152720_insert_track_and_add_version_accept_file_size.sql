-- Suivi du stockage : les RPC d'insertion n'acceptaient aucun paramètre de taille, si bien
-- que tracks.file_size_bytes et track_versions.file_size_bytes restaient à 0 à chaque upload.
-- On ajoute _file_size_bytes EN DERNIER paramètre, avec DEFAULT NULL : aucun appel existant
-- (positionnel ou nommé) n'est cassé.
-- Garde-fou : une valeur nulle, négative ou absente est normalisée à 0 plutôt que stockée
-- telle quelle — la taille vient du client, elle ne doit jamais corrompre le compteur.

CREATE OR REPLACE FUNCTION public.insert_track(
  _user_id uuid, _workspace_id uuid, _title text,
  _artist text DEFAULT NULL::text, _featuring text DEFAULT NULL::text,
  _type text DEFAULT NULL::text, _status text DEFAULT NULL::text,
  _bpm numeric DEFAULT NULL::numeric, _key text DEFAULT NULL::text,
  _duration_sec numeric DEFAULT NULL::numeric,
  _genre text[] DEFAULT NULL::text[], _mood text[] DEFAULT '{}'::text[],
  _language text DEFAULT NULL::text, _gender text DEFAULT NULL::text,
  _labels text[] DEFAULT '{}'::text[], _publishers text[] DEFAULT '{}'::text[],
  _audio_url text DEFAULT NULL::text, _audio_preview_url text DEFAULT NULL::text,
  _cover_art_url text DEFAULT NULL::text, _lyrics text DEFAULT NULL::text,
  _notes text DEFAULT NULL::text, _splits jsonb DEFAULT '[]'::jsonb,
  _isrc text DEFAULT NULL::text, _waveform_data jsonb DEFAULT NULL::jsonb,
  _released_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _file_size_bytes bigint DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE new_track_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  INSERT INTO public.tracks (
    workspace_id, uploaded_by, title, artist, featuring,
    track_type, status, bpm, key, duration_sec,
    genre, mood, language, gender, labels, publishers,
    audio_url, audio_preview_url, cover_url,
    lyrics, notes, splits, isrc, waveform_data, released_at,
    file_size_bytes
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
    _lyrics, _notes,
    COALESCE(_splits, '[]'::jsonb),
    _isrc, _waveform_data, _released_at,
    GREATEST(COALESCE(_file_size_bytes, 0), 0)
  ) RETURNING id INTO new_track_id;
  RETURN new_track_id;
END;
$func$;

CREATE OR REPLACE FUNCTION public.add_track_version(
  _user_id uuid,
  _track_id uuid,
  _workspace_id uuid,
  _version_name text DEFAULT NULL,
  _audio_url text DEFAULT NULL,
  _audio_preview_url text DEFAULT NULL,
  _waveform_data jsonb DEFAULT NULL,
  _sonic_dna jsonb DEFAULT NULL,
  _duration_sec numeric DEFAULT NULL,
  _notes text DEFAULT NULL,
  _file_size_bytes bigint DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_id uuid;
  v_next int;
  v_name text;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  IF NOT EXISTS (SELECT 1 FROM tracks WHERE id = _track_id AND workspace_id = _workspace_id) THEN
    RAISE EXCEPTION 'Track not found in this workspace';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_track_id::text, 0));

  SELECT coalesce(max(version_number), 0) + 1 INTO v_next
  FROM track_versions WHERE track_id = _track_id;

  v_name := nullif(btrim(coalesce(_version_name,'')), '');
  IF v_name IS NULL THEN
    v_name := 'V' || v_next;
  END IF;

  INSERT INTO track_versions (track_id, version_number, version_name, audio_url,
                              audio_preview_url, waveform_data, sonic_dna,
                              duration_sec, notes, created_by, file_size_bytes)
  VALUES (_track_id, v_next, v_name, _audio_url,
          _audio_preview_url, _waveform_data, _sonic_dna,
          _duration_sec, _notes, _user_id,
          GREATEST(COALESCE(_file_size_bytes, 0), 0))
  RETURNING id INTO v_id;

  UPDATE tracks SET version_count = COALESCE(version_count, 0) + 1 WHERE id = _track_id;

  RETURN v_id;
END;
$func$;;
