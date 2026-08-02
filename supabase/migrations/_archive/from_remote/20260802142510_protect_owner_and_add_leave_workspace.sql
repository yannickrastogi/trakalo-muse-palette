-- 1. remove_workspace_member : interdire de retirer le propriétaire du workspace.
--    Sans ce garde-fou, un admin invité pouvait exclure le propriétaire de son propre
--    workspace, le faisant disparaître de son switcher (qui lit workspace_members).
CREATE OR REPLACE FUNCTION public.remove_workspace_member(
  _user_id uuid, _member_user_id uuid, _workspace_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');

  IF EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = _member_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot remove the workspace owner';
  END IF;

  DELETE FROM public.workspace_members
  WHERE user_id = _member_user_id AND workspace_id = _workspace_id;

  BEGIN
    DELETE FROM public.user_roles
    WHERE user_id = _member_user_id AND workspace_id = _workspace_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
END;
$func$;

-- 2. leave_workspace : tout membre invité peut partir de lui-même, quel que soit son niveau.
--    Quitter est un droit, pas un privilège : aucun access_level requis.
CREATE OR REPLACE FUNCTION public.leave_workspace(
  _user_id uuid, _workspace_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'The owner cannot leave their own workspace';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND is_personal = true
  ) THEN
    RAISE EXCEPTION 'Cannot leave a personal workspace';
  END IF;

  DELETE FROM public.workspace_members
  WHERE user_id = _user_id AND workspace_id = _workspace_id;

  BEGIN
    DELETE FROM public.user_roles
    WHERE user_id = _user_id AND workspace_id = _workspace_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
END;
$func$;

REVOKE ALL ON FUNCTION public.leave_workspace(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_workspace(uuid, uuid) TO authenticated, service_role;;
