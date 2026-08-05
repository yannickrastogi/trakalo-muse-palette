-- BUG CRITIQUE : toutes les tracks affichaient « 2 versions » alors qu'elles n'en ont qu'une.
-- Cause : tracks.version_count vaut déjà 1 à la création de la track, puis add_track_version
-- l'INCRÉMENTE lors de la création de V1 -> 2 pour une seule ligne réelle.
-- Correctif de fond : version_count n'est plus incrémenté à l'aveugle, il est DÉRIVÉ du
-- nombre réel de lignes dans track_versions, maintenu par trigger. Un compteur qui se
-- désynchronise de sa source est un bug qui revient ; on supprime la possibilité même.

CREATE OR REPLACE FUNCTION public.sync_track_version_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE v_track uuid;
BEGIN
  v_track := COALESCE(NEW.track_id, OLD.track_id);
  UPDATE tracks t
  SET version_count = (SELECT count(*) FROM track_versions v WHERE v.track_id = v_track)
  WHERE t.id = v_track;
  RETURN COALESCE(NEW, OLD);
END;
$func$;

DROP TRIGGER IF EXISTS trg_sync_track_version_count ON track_versions;
CREATE TRIGGER trg_sync_track_version_count
AFTER INSERT OR DELETE ON track_versions
FOR EACH ROW EXECUTE FUNCTION public.sync_track_version_count();

-- add_track_version ne doit plus incrémenter : le trigger s'en charge.
CREATE OR REPLACE FUNCTION public.add_track_version(
  _user_id uuid, _track_id uuid, _workspace_id uuid,
  _version_name text DEFAULT NULL, _audio_url text DEFAULT NULL,
  _audio_preview_url text DEFAULT NULL, _waveform_data jsonb DEFAULT NULL,
  _sonic_dna jsonb DEFAULT NULL, _duration_sec numeric DEFAULT NULL,
  _notes text DEFAULT NULL, _file_size_bytes bigint DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE v_id uuid; v_next int; v_name text;
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
  IF v_name IS NULL THEN v_name := 'V' || v_next; END IF;

  INSERT INTO track_versions (track_id, version_number, version_name, audio_url,
                              audio_preview_url, waveform_data, sonic_dna,
                              duration_sec, notes, created_by, file_size_bytes)
  VALUES (_track_id, v_next, v_name, _audio_url,
          _audio_preview_url, _waveform_data, _sonic_dna,
          _duration_sec, _notes, _user_id,
          GREATEST(COALESCE(_file_size_bytes, 0), 0))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$func$;

-- Resynchronisation de l'existant : 15 tracks avaient un compteur faux.
UPDATE tracks t
SET version_count = (SELECT count(*) FROM track_versions v WHERE v.track_id = t.id)
WHERE t.version_count IS DISTINCT FROM (SELECT count(*) FROM track_versions v WHERE v.track_id = t.id);;
