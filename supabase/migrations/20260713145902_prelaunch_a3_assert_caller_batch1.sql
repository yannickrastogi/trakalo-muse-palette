-- A3 batch 1 : assert_caller(_user_id) + search_path=public sur 4 RPC
-- (service_role bypass déjà en place ; corps métier inchangé)

CREATE OR REPLACE FUNCTION public.delete_track_comment(_comment_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  DELETE FROM track_comments tc
  WHERE tc.id = _comment_id
    AND EXISTS (
      SELECT 1 FROM tracks t
      WHERE t.id = tc.track_id
        AND public.has_workspace_access_level(_user_id, t.workspace_id, 'editor')
    );
END;
$func$;

CREATE OR REPLACE FUNCTION public.edit_track_comment(_comment_id uuid, _user_id uuid, _new_content text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  UPDATE track_comments tc
  SET content = _new_content, updated_at = now(), is_edited = true
  WHERE tc.id = _comment_id
    AND EXISTS (
      SELECT 1 FROM tracks t
      WHERE t.id = tc.track_id
        AND public.has_workspace_access_level(_user_id, t.workspace_id, 'editor')
    );
END;
$func$;

CREATE OR REPLACE FUNCTION public.mark_workspace_personal(_user_id uuid, _workspace_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not the owner of this workspace';
  END IF;

  UPDATE workspaces SET is_personal = true WHERE id = _workspace_id;
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_workspace_member(_user_id uuid, _workspace_id uuid, _member_id uuid, _professional_title text DEFAULT NULL::text, _access_level text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
DECLARE
  is_admin boolean := false;
  is_self boolean := false;
  is_owner_target boolean := false;
  target_user_id uuid;
  workspace_owner_id uuid;
  old_title text;
  old_access_level text;
BEGIN
  PERFORM public.assert_caller(_user_id);

  SELECT user_id, professional_title, access_level
    INTO target_user_id, old_title, old_access_level
  FROM public.workspace_members
  WHERE id = _member_id AND workspace_id = _workspace_id;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Member % not found in workspace %', _member_id, _workspace_id;
  END IF;

  SELECT owner_id INTO workspace_owner_id
  FROM public.workspaces
  WHERE id = _workspace_id;

  is_owner_target := (target_user_id = workspace_owner_id);
  is_self := (target_user_id = _user_id);

  SELECT (access_level = 'admin') INTO is_admin
  FROM public.workspace_members
  WHERE workspace_id = _workspace_id AND user_id = _user_id;

  IF is_admin IS NULL THEN
    RAISE EXCEPTION 'Not a member of workspace %', _workspace_id;
  END IF;

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

  IF _professional_title IS NOT NULL THEN
    IF NOT is_admin AND NOT is_self THEN
      RAISE EXCEPTION 'You can only edit your own title or you must be admin';
    END IF;

    UPDATE public.workspace_members
    SET professional_title = NULLIF(btrim(_professional_title), '')
    WHERE id = _member_id;
  END IF;

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
    NULL;
  END;
END;
$func$;;
