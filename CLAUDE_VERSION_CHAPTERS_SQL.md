# Versioning chapters — SQL à exécuter dans Supabase SQL Editor

> **À COPIER TEL QUEL** dans Supabase → SQL Editor.
> Le frontend `TrackDetail.tsx` + `VersionSelector.tsx` dépend de cette mise à jour pour que :
> - les chapters édités sur la version active soient mirrorés dans `tracks.chapters`
> - le passage "Set as Active" d'une version V2 copie ses chapters vers `tracks.chapters`

```sql
-- 1) Drop explicite (CREATE OR REPLACE avec signature différente créerait des doublons)
DROP FUNCTION IF EXISTS public.set_track_version_active(uuid, uuid, uuid, uuid);

-- 2) Recréer avec sync chapters
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

## Sanity check après exécution

```sql
-- Vérifier que la fonction prend bien les chapters en compte
SELECT pg_get_functiondef('public.set_track_version_active(uuid, uuid, uuid, uuid)'::regprocedure);

-- Sur un track avec V1 active + chapters, basculer sur V2 :
-- 1) avant : SELECT chapters FROM tracks WHERE id = '<track_uuid>';
-- 2) SELECT set_track_version_active('<user_uuid>', '<track_uuid>', '<workspace_uuid>', '<v2_id>');
-- 3) après : SELECT chapters FROM tracks WHERE id = '<track_uuid>';  -- doit refléter V2
```

## Notes

- `COALESCE(tv.chapters, t.chapters)` : si la version cible n'a pas encore de chapters (NULL), on garde ceux du track parent — évite d'effacer accidentellement le travail existant lors d'une bascule rapide post-upload.
- Si `track_versions.chapters` est un `[]` explicite (utilisateur a vidé les sections), il écrase bien — `COALESCE` ne court-circuite qu'en cas de NULL.
- Cette fonction doit rester `SECURITY DEFINER` et n'utiliser que des paramètres `_user_id` explicites (jamais `auth.uid()`).
