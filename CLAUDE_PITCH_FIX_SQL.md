# CLAUDE — Pitch Fix SQL

> **À exécuter manuellement dans Supabase SQL Editor** (un seul bloc copyable).
> Crée la RPC `update_pitch_share_link` qui relie un pitch à son shared link + contact.
> Les colonnes `pitches.share_link_id` (uuid) et `pitches.contact_id` (uuid) existent déjà.

```sql
-- DROP explicite d'abord (évite les doublons si la signature change)
DROP FUNCTION IF EXISTS public.update_pitch_share_link(uuid, uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.update_pitch_share_link(
  _user_id uuid,
  _pitch_id uuid,
  _workspace_id uuid,
  _share_link_id uuid DEFAULT NULL,
  _contact_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  -- Même gate que create_pitch / create_shared_link : niveau 'pitcher' minimum (pas juste membre)
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  -- Empêcher de pointer un pitch vers un lien d'un autre workspace (même si l'UUID est connu)
  IF _share_link_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM shared_links
    WHERE id = _share_link_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'Invalid share link';
  END IF;

  -- Idem pour le contact
  IF _contact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM contacts
    WHERE id = _contact_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'Invalid contact';
  END IF;

  UPDATE pitches
  SET share_link_id = COALESCE(_share_link_id, share_link_id),
      contact_id     = COALESCE(_contact_id, contact_id),
      updated_at     = now()
  WHERE id = _pitch_id
    AND workspace_id = _workspace_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.update_pitch_share_link(uuid, uuid, uuid, uuid, uuid)
  TO anon, authenticated, service_role;
```

## Notes
- `COALESCE(...)` : on ne réécrit pas une valeur existante avec NULL si l'un des deux (lien / contact) est absent.
- `_share_link_id` provient du `json` retourné par `create_shared_link` (champ `id`).
- `_contact_id` provient du `uuid` retourné par `upsert_contact`.
- Appelée depuis `src/contexts/PitchContext.tsx` → `addPitch`, après `create_pitch` + `create_shared_link` + `upsert_contact`.
