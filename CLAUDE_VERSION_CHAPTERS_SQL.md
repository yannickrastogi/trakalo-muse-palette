# Versioning chapters — SQL to execute in Supabase SQL Editor

> **COPY AS IS** into Supabase → SQL Editor.
> The frontend `TrackDetail.tsx` + `VersionSelector.tsx` depends on this update so that:
> - edited chapters on the active version are mirrored in `tracks.chapters`
> - the "Set as Active" passage of a V2 version copies its chapters to `tracks.chapters`

```sql
-- 1) Explicit drop (CREATE OR REPLACE with different signature would create duplicates)
DROP FUNCTION IF EXISTS public.set_track_version_active(uuid, uuid, uuid, uuid);

-- 2) Recreate with chapter sync
CREATE OR REPLACE FUNCTION public.set_track_version_active(
  _user_id uuid,
  _track_id uuid,
  _workspace_id uuid,
  _version_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Workspace permission check
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND access_level IN ('editor', 'admin')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tracks WHERE id = _track_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'track_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM track_versions WHERE id = _version_id AND track_id = _track_id
  ) THEN
    RAISE EXCEPTION 'version_not_found';
  END IF;

  -- Atomic swap: clear all then mark the target version active
  UPDATE track_versions SET is_active = false WHERE track_id = _track_id;
  UPDATE track_versions SET is_active = true  WHERE id = _version_id AND track_id = _track_id;

  -- Sync the active version's authoring data back to the track parent so
  -- catalog views, shared links, watermarked exports, and the global player
  -- all keep matching the active version.
  UPDATE tracks t SET
    audio_url         = tv.audio_url,
    audio_preview_url = tv.audio_preview_url,
    waveform_data     = tv.waveform_data,
    sonic_dna         = tv.sonic_dna,
    duration_sec      = tv.duration_sec,
    chapters          = COALESCE(tv.chapters, t.chapters)
  FROM track_versions tv
  WHERE tv.id = _version_id AND t.id = _track_id;
END;
$func$;
```

## Sanity check after execution

```sql
-- Verify the function properly accounts for chapters
SELECT pg_get_functiondef('public.set_track_version_active(uuid, uuid, uuid, uuid)'::regprocedure);

-- On a track with active V1 + chapters, switch to V2:
-- 1) before: SELECT chapters FROM tracks WHERE id = '<track_uuid>';
-- 2) SELECT set_track_version_active('<user_uuid>', '<track_uuid>', '<workspace_uuid>', '<v2_id>');
-- 3) after: SELECT chapters FROM tracks WHERE id = '<track_uuid>';  -- must reflect V2
```

## Notes

- `COALESCE(tv.chapters, t.chapters)` : if the target version has no chapters yet (NULL), we keep those from the parent track — avoids accidentally erasing existing work during a quick post-upload switch.
- If `track_versions.chapters` is an explicit `[]` (user cleared sections), it overwrites correctly — `COALESCE` only short-circuits on NULL.
- This function must remain `SECURITY DEFINER` and use only explicit `_user_id` parameters (never `auth.uid()`).