-- BUG : add_track_version ne renseignait jamais version_number, qui prenait donc toujours
-- sa valeur par défaut (1). Les 292 lignes existantes sont toutes en version_number = 1.
-- Correctif : calculer le prochain numéro par track, et générer un nom par défaut (V2, V3…)
-- quand l'utilisateur n'en fournit pas.
-- Un verrou consultatif par track évite deux numéros identiques en cas d'upload simultané.
CREATE OR REPLACE FUNCTION public.add_track_version(
  _user_id uuid, _track_id uuid, _workspace_id uuid, _version_name text,
  _audio_url text, _audio_preview_url text, _waveform_data jsonb,
  _sonic_dna jsonb, _duration_sec numeric, _notes text
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

  -- Sérialise les ajouts concurrents sur la même track.
  PERFORM pg_advisory_xact_lock(hashtextextended(_track_id::text, 0));

  SELECT coalesce(max(version_number), 0) + 1 INTO v_next
  FROM track_versions WHERE track_id = _track_id;

  v_name := nullif(btrim(coalesce(_version_name,'')), '');
  IF v_name IS NULL THEN
    v_name := 'V' || v_next;
  END IF;

  INSERT INTO track_versions (track_id, version_number, version_name, audio_url,
                              audio_preview_url, waveform_data, sonic_dna,
                              duration_sec, notes, created_by)
  VALUES (_track_id, v_next, v_name, _audio_url,
          _audio_preview_url, _waveform_data, _sonic_dna,
          _duration_sec, _notes, _user_id)
  RETURNING id INTO v_id;

  UPDATE tracks SET version_count = COALESCE(version_count, 0) + 1 WHERE id = _track_id;

  RETURN v_id;
END;
$func$;;
