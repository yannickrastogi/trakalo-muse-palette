# CLAUDE — Pitch Fix SQL

> **Execute manually in Supabase SQL Editor (single copyable block).**
> Creates the RPC `update_pitch_share_link` that links a pitch to its shared link + contact.
> The columns `pitches.share_link_id` (uuid) and `pitches.contact_id` (uuid) already exist.

```sql
-- Explicit DROP first (avoids duplicates if signature changes)
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
  -- Same gate as create_pitch / create_shared_link: 'pitcher' level minimum (not just member)
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  -- Prevent pointing a pitch to a link from another workspace (even if the UUID is known)
  IF _share_link_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM shared_links
    WHERE id = _share_link_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'Invalid share link';
  END IF;

  -- Same for the contact
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
- `COALESCE(...)` : we don't overwrite an existing value with NULL if either (link / contact) is absent.
- `_share_link_id` comes from the `json` returned by `create_shared_link` (field `id`).
- `_contact_id` comes from the `uuid` returned by `upsert_contact`.
- Called from `src/contexts/PitchContext.tsx` → `addPitch`, after `create_pitch` + `create_shared_link` + `upsert_contact`.