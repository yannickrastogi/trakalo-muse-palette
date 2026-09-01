# Fix — `production_stage` was not persisting via `update_track`

**Cause**: the whitelist of the `update_track` RPC (migration `20260607_update_track_whitelist_v2.sql`) omits the `production_stage` column. The RPC silently CONTINUES on the non-whitelisted key, the UI refreshes locally, but the value is never written to DB → on refresh, the previous value returns.

**Fix**: add `'production_stage'` to `v_allowed_columns`. The column is of type `text` (check `IN ('work_in_progress', 'finished')` at DDL level) — no special cast needed, it goes through the generic string branch of the builder.

## SQL to execute in Supabase SQL Editor

```sql
-- Trakalog — Adding production_stage to update_track whitelist
-- Bug: production_stage was dropped by the dynamic builder (incomplete whitelist)
-- since migration 20260607_update_track_whitelist_v2.sql. Any UI that sets
-- productionStage would refresh optimistically but never persist in DB.
-- The rest of the function body is identical to v2 — only the whitelist changes.

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

## Verification

```sql
-- Confirm that production_stage is in the whitelist
SELECT prosrc FROM pg_proc WHERE proname = 'update_track';
-- → the string 'production_stage' should appear in v_allowed_columns.
```

On the frontend, the mapping is already correct:
- `TrackContext.tsx:840` sends `payload.production_stage = updates.productionStage`
- `TrackDetail.tsx:667` calls `updateTrack(track.id, { productionStage: ... })`

Once this SQL is executed, WIP/Finished changes will persist after refresh.