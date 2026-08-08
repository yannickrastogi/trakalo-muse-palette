# SQL migration — Artist Aliases

> **Copy-paste into Supabase SQL Editor (never auto-execute from Claude).**

```sql
-- ─── Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.artist_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  alias_name text NOT NULL,
  contact_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (workspace_id, lower(alias_name))
);

CREATE INDEX IF NOT EXISTS idx_artist_aliases_workspace ON public.artist_aliases(workspace_id);

-- ─── RLS ──────────────────────────────────────────────────
ALTER TABLE public.artist_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read aliases in their workspaces" ON public.artist_aliases;
CREATE POLICY "members read aliases in their workspaces"
  ON public.artist_aliases FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- WRITE paths go exclusively via SECURITY DEFINER RPCs.

-- ─── Upsert RPC ──────────────────────────────────────────
DROP FUNCTION IF EXISTS public.upsert_artist_alias(uuid, uuid, uuid, text, uuid[]);

CREATE OR REPLACE FUNCTION public.upsert_artist_alias(
  _user_id uuid,
  _workspace_id uuid,
  _alias_id uuid,          -- NULL = create new
  _alias_name text,
  _contact_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_id uuid;
  v_trimmed text;
BEGIN
  v_trimmed := btrim(coalesce(_alias_name, ''));
  IF v_trimmed = '' THEN
    RAISE EXCEPTION 'Alias name cannot be empty';
  END IF;

  IF NOT public.has_workspace_access_level(_user_id, _workspace_id, 'pitcher') THEN
    RAISE EXCEPTION 'Insufficient access level for artist aliases (pitcher+ required)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Reject contact ids not in this workspace
  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(_contact_ids, '{}'::uuid[])) AS cid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.contacts WHERE id = cid AND workspace_id = _workspace_id
    )
  ) THEN
    RAISE EXCEPTION 'One or more contact_ids do not belong to this workspace'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF _alias_id IS NULL THEN
    INSERT INTO public.artist_aliases (workspace_id, alias_name, contact_ids, created_by)
    VALUES (_workspace_id, v_trimmed, coalesce(_contact_ids, '{}'::uuid[]), _user_id)
    ON CONFLICT (workspace_id, lower(alias_name))
    DO UPDATE SET contact_ids = EXCLUDED.contact_ids, updated_at = now()
    RETURNING id INTO v_id;
  ELSE
    -- Verify the alias belongs to this workspace before updating
    IF NOT EXISTS (
      SELECT 1 FROM public.artist_aliases
      WHERE id = _alias_id AND workspace_id = _workspace_id
    ) THEN
      RAISE EXCEPTION 'Alias not found in workspace' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    UPDATE public.artist_aliases
    SET alias_name = v_trimmed, contact_ids = coalesce(_contact_ids, '{}'::uuid[]), updated_at = now()
    WHERE id = _alias_id
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.upsert_artist_alias(uuid, uuid, uuid, text, uuid[]) TO authenticated;

-- ─── Delete RPC ──────────────────────────────────────────
DROP FUNCTION IF EXISTS public.delete_artist_alias(uuid, uuid);

CREATE OR REPLACE FUNCTION public.delete_artist_alias(
  _user_id uuid,
  _alias_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.artist_aliases WHERE id = _alias_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Alias not found';
  END IF;
  IF NOT public.has_workspace_access_level(_user_id, v_workspace_id, 'pitcher') THEN
    RAISE EXCEPTION 'Insufficient access level' USING ERRCODE = 'insufficient_privilege';
  END IF;
  DELETE FROM public.artist_aliases WHERE id = _alias_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.delete_artist_alias(uuid, uuid) TO authenticated;
```

## Rollback

```sql
DROP FUNCTION IF EXISTS public.delete_artist_alias(uuid, uuid);
DROP FUNCTION IF EXISTS public.upsert_artist_alias(uuid, uuid, uuid, text, uuid[]);
DROP TABLE IF EXISTS public.artist_aliases;
```