# Fix — `production_stage` ne persistait pas via `update_track`

**Cause** : la whitelist du RPC `update_track` (migration `20260607_update_track_whitelist_v2.sql`) omet la colonne `production_stage`. Le RPC `CONTINUE` silencieusement la clé non-whitelistée, l'UI rafraîchit en local, mais la valeur n'est jamais écrite en DB → à refresh, la valeur précédente revient.

**Fix** : ajouter `'production_stage'` à `v_allowed_columns`. La colonne est de type `text` (check `IN ('work_in_progress', 'finished')` côté DDL) — pas besoin de cast spécial, elle passe par la branche string générique du builder.

## SQL à exécuter dans Supabase SQL Editor

```sql
-- Trakalog — Ajout de production_stage à la whitelist update_track
-- Bug: production_stage était droppé par le builder dynamique (whitelist incomplète)
-- depuis la migration 20260607_update_track_whitelist_v2.sql. Toute UI qui set
-- productionStage rafraîchissait en optimiste mais ne persistait jamais en DB.
-- Le reste du corps de la fonction est identique à la v2 — seule la whitelist change.

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

## Vérification

```sql
-- Confirme que production_stage est bien dans la whitelist
SELECT prosrc FROM pg_proc WHERE proname = 'update_track';
-- → la string `'production_stage'` doit apparaître dans v_allowed_columns.
```

Côté frontend, le mapping est déjà correct :
- `TrackContext.tsx:840` envoie `payload.production_stage = updates.productionStage`
- `TrackDetail.tsx:667` appelle `updateTrack(track.id, { productionStage: ... })`

Une fois ce SQL exécuté, les changements de WIP/Finished persisteront après refresh.
