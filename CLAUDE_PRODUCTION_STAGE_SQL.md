# SQL migration — Add `production_stage` to tracks

> **À copier-coller dans Supabase SQL Editor (jamais auto-exécuté côté Claude).**
> Deux blocs : colonne + whitelist du RPC `update_track`. Idempotent.

## 1. Colonne sur `tracks`

```sql
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS production_stage text
  DEFAULT 'work_in_progress'
  CHECK (production_stage IN ('work_in_progress', 'finished'));

-- Index optionnel si on filtre souvent (≤2 valeurs, gain marginal — laisser de côté pour l'instant).
```

## 2. Mettre à jour le RPC `update_track` (whitelist)

Le RPC actuel utilise une whitelist de colonnes autorisées (cf. `pg_get_functiondef`). Sans ce patch, `production_stage` est silencieusement ignoré.

```sql
-- DROP-and-recreate (la signature est identique, mais on remplace v_allowed_columns).
DROP FUNCTION IF EXISTS public.update_track(uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.update_track(_user_id uuid, _track_id uuid, _updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
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
    'qr_token',
    'production_stage'
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
$func$;
```

## 3. Smoke test

```sql
-- Vérifier que la colonne existe et que le default fonctionne
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name='tracks' AND column_name='production_stage';

-- Vérifier que le RPC accepte production_stage
-- (Remplacer les uuids par les tiens en local)
-- SELECT public.update_track('<user_uuid>', '<track_uuid>', '{"production_stage":"finished"}'::jsonb);

-- Vérifier la valeur écrite
-- SELECT id, production_stage FROM public.tracks WHERE id = '<track_uuid>';
```

## 4. Rollback

```sql
-- Désactiver la colonne (les valeurs restent)
ALTER TABLE public.tracks ALTER COLUMN production_stage DROP DEFAULT;
-- Retirer la colonne (destructif — efface les valeurs)
-- ALTER TABLE public.tracks DROP COLUMN production_stage;
```
