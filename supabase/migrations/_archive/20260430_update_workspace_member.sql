-- ============================================================
-- TRAKALOG — update_workspace_member RPC
-- Lets a workspace member edit their own professional_title,
-- and lets workspace admins edit any member's title and/or
-- access_level.
--
-- Permission rules:
--   • access_level → admin only, never on the workspace owner
--   • professional_title → admin OR self
--
-- Run in Supabase SQL Editor (PostgreSQL 15+).
--
-- NOTE — Supabase SQL Editor has a known bug with nested $$
-- blocks. The function body uses $func$ as the delimiter.
-- ============================================================

-- ─── 1. Drop existing overloads (avoid duplicates) ─────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE proname = 'update_workspace_member'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig::text || ' CASCADE';
  END LOOP;
END $$;

-- ─── 2. Create the RPC ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_workspace_member(
  _user_id uuid,
  _workspace_id uuid,
  _member_id uuid,
  _professional_title text DEFAULT NULL,
  _access_level text DEFAULT NULL
)
RETURNS void AS $func$
DECLARE
  is_admin boolean := false;
  is_self boolean := false;
  is_owner_target boolean := false;
  target_user_id uuid;
  workspace_owner_id uuid;
  old_title text;
  old_access_level text;
BEGIN
  -- Resolve the target row + capture old values
  SELECT user_id, professional_title, access_level
    INTO target_user_id, old_title, old_access_level
  FROM public.workspace_members
  WHERE id = _member_id AND workspace_id = _workspace_id;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Member % not found in workspace %', _member_id, _workspace_id;
  END IF;

  -- Resolve workspace owner
  SELECT owner_id INTO workspace_owner_id
  FROM public.workspaces
  WHERE id = _workspace_id;

  is_owner_target := (target_user_id = workspace_owner_id);
  is_self := (target_user_id = _user_id);

  -- Caller must be a workspace member
  SELECT (access_level = 'admin') INTO is_admin
  FROM public.workspace_members
  WHERE workspace_id = _workspace_id AND user_id = _user_id;

  IF is_admin IS NULL THEN
    RAISE EXCEPTION 'Not a member of workspace %', _workspace_id;
  END IF;

  -- access_level updates → admin only, never on the owner
  IF _access_level IS NOT NULL THEN
    IF NOT is_admin THEN
      RAISE EXCEPTION 'Only admins can change access level';
    END IF;
    IF is_owner_target THEN
      RAISE EXCEPTION 'Owner access level cannot be changed';
    END IF;
    IF _access_level NOT IN ('viewer', 'pitcher', 'editor', 'admin') THEN
      RAISE EXCEPTION 'Invalid access level: %', _access_level;
    END IF;

    UPDATE public.workspace_members
    SET access_level = _access_level
    WHERE id = _member_id;
  END IF;

  -- professional_title updates → admin OR self
  IF _professional_title IS NOT NULL THEN
    IF NOT is_admin AND NOT is_self THEN
      RAISE EXCEPTION 'You can only edit your own title or you must be admin';
    END IF;

    UPDATE public.workspace_members
    SET professional_title = NULLIF(btrim(_professional_title), '')
    WHERE id = _member_id;
  END IF;

  -- Audit log (best-effort, never fail the update)
  BEGIN
    INSERT INTO public.audit_logs (user_id, workspace_id, action, resource_type, resource_id, metadata)
    VALUES (
      _user_id,
      _workspace_id,
      'workspace_member.updated',
      'workspace_member',
      _member_id,
      jsonb_build_object(
        'target_user_id', target_user_id,
        'old_access_level', old_access_level,
        'new_access_level', _access_level,
        'old_title', old_title,
        'new_title', _professional_title,
        'updated_by', _user_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Audit log table shape may differ; do not block the actual update.
    NULL;
  END;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_workspace_member(uuid, uuid, uuid, text, text) TO authenticated;

-- ─── 3. Verification ───────────────────────────────────────
--   SELECT proname, pg_get_function_arguments(oid)
--   FROM pg_proc
--   WHERE proname = 'update_workspace_member' AND pronamespace = 'public'::regnamespace;
