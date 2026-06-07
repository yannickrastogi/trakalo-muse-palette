-- P1-06 v2 — Fix update_track : whitelist corrigée + cast text[] généralisé
-- Bug 1 (CRITIQUE) : labels/publishers/mood (colonnes text[]) étaient castés ::jsonb
--   par le builder dynamique → erreur 42804 → TOUT l'UPDATE échouait → title/artist/etc.
--   ne persistaient jamais via EditTrackModal (le 2e appel {bpm,key,sonic_dna} passait,
--   d'où "BPM marche mais pas title/artist"). Même crash sur l'upload extended metadata.
-- Bug 2 : whitelist contenait 'type' et 'voice' (colonnes inexistantes — les vraies
--   colonnes sont track_type et gender) → track_type silencieusement droppé.
-- Bug 3 : lyrics_segments et iswc (colonnes réelles) absents de la whitelist →
--   karaoke segments silencieusement perdus à chaque édition de lyrics.
-- Bug 4 (robustesse) : released_at = '' → cast timestamptz invalide → garde NULL.
-- Appliqué en prod le 2026-06-07 via Supabase MCP (mission Cowork track-detail fix).

CREATE OR REPLACE FUNCTION public.update_track(_user_id uuid, _track_id uuid, _updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  workspace_uuid uuid;
  uploader_uuid uuid;
  k text;
  v jsonb;
  set_clauses text := '';
  text_arr text[];
  v_allowed_columns text[] := ARRAY[
    'title', 'artist', 'featuring', 'track_type', 'status',
    'bpm', 'key', 'genre', 'mood',
    'language', 'gender',
    'notes', 'lyrics', 'lyrics_segments',
    'audio_url', 'audio_preview_url', 'cover_url',
    'duration_sec', 'waveform_data', 'sonic_dna', 'chapters',
    'album', 'upc', 'isrc', 'iswc',
    'released_at', 'copyright', 'explicit',
    'labels', 'publishers',
    'credits', 'tags', 'splits',
    'qr_token'
  ];
  v_text_array_columns text[] := ARRAY['genre', 'mood', 'labels', 'publishers'];
BEGIN
  SELECT workspace_id, uploaded_by INTO workspace_uuid, uploader_uuid
  FROM public.tracks WHERE id = _track_id;

  IF workspace_uuid IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  IF NOT (
    public.has_workspace_access_level(_user_id, workspace_uuid, 'editor')
    OR (
      public.has_workspace_access_level(_user_id, workspace_uuid, 'pitcher')
      AND uploader_uuid = _user_id
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient access level for update_track: editor required to edit any track, or pitcher to edit own track'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR k, v IN SELECT * FROM jsonb_each(_updates) LOOP
    IF NOT (k = ANY(v_allowed_columns)) THEN
      CONTINUE;
    END IF;

    IF k = ANY(v_text_array_columns) THEN
      IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
        set_clauses := set_clauses || format(', %I = NULL', k);
      ELSIF jsonb_typeof(v) = 'array' THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(v)) INTO text_arr;
        set_clauses := set_clauses || format(', %I = %L::text[]', k, text_arr);
      ELSIF jsonb_typeof(v) = 'string' THEN
        set_clauses := set_clauses || format(', %I = ARRAY[%L]::text[]', k, v #>> '{}');
      ELSE
        set_clauses := set_clauses || format(', %I = NULL', k);
      END IF;
    ELSIF k = 'released_at' AND (jsonb_typeof(v) = 'null' OR (v #>> '{}') = '') THEN
      set_clauses := set_clauses || format(', %I = NULL', k);
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
    set_clauses := substring(set_clauses from 3);
    EXECUTE format('UPDATE public.tracks SET %s, updated_at = now() WHERE id = %L',
                   set_clauses, _track_id);
  END IF;
END;
$function$;
