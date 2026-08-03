-- BUG 2 : add_track_version exposait 10 paramètres SANS valeur par défaut. PostgREST exige
-- alors que le client les fournisse TOUS, sinon PGRST202 « no matches found in schema cache ».
-- Le client n'en envoyait qu'un sous-ensemble -> l'appel a toujours échoué en 404.
-- Correctif : seuls _user_id, _track_id et _workspace_id restent obligatoires ; tout le
-- reste devient optionnel (DEFAULT NULL). Aucun changement de nom ni de type d'argument,
-- donc aucun appelant existant n'est cassé.
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
  _notes text DEFAULT NULL
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
                              duration_sec, notes, created_by)
  VALUES (_track_id, v_next, v_name, _audio_url,
          _audio_preview_url, _waveform_data, _sonic_dna,
          _duration_sec, _notes, _user_id)
  RETURNING id INTO v_id;

  UPDATE tracks SET version_count = COALESCE(version_count, 0) + 1 WHERE id = _track_id;

  RETURN v_id;
END;
$func$;;
