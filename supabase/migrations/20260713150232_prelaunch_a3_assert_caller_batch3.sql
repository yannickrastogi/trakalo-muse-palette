-- create_workspace_with_member : garde NULL-tolérant (préserve COALESCE(_user_id, auth.uid()))
CREATE OR REPLACE FUNCTION public.create_workspace_with_member(_name text, _description text DEFAULT NULL::text, _user_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
DECLARE
  new_workspace_id uuid;
  resolved_user_id uuid;
  workspace_slug text;
BEGIN
  IF _user_id IS NOT NULL THEN
    PERFORM public.assert_caller(_user_id);
  END IF;

  resolved_user_id := COALESCE(_user_id, auth.uid());

  IF resolved_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID available';
  END IF;

  workspace_slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g'));
  workspace_slug := trim(both '-' from workspace_slug);
  workspace_slug := workspace_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

  INSERT INTO workspaces (id, name, slug, owner_id)
  VALUES (gen_random_uuid(), _name, workspace_slug, resolved_user_id)
  RETURNING id INTO new_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, access_level, professional_title)
  VALUES (new_workspace_id, resolved_user_id, 'admin', 'Producer');

  RETURN new_workspace_id;
END;
$func$;

-- request_track_access : garde standard + search_path
CREATE OR REPLACE FUNCTION public.request_track_access(_user_id uuid, _workspace_id uuid, _track_id uuid, _message text DEFAULT NULL::text, _requester_name text DEFAULT NULL::text, _requester_company text DEFAULT NULL::text, _requester_email text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
DECLARE
  _request_id uuid;
  _owner_workspace_id uuid;
  _owner_user_id uuid;
  _track_title text;
BEGIN
  PERFORM public.assert_caller(_user_id);

  SELECT t.workspace_id, w.owner_id, t.title
  INTO _owner_workspace_id, _owner_user_id, _track_title
  FROM tracks t
  JOIN workspaces w ON w.id = t.workspace_id
  WHERE t.id = _track_id AND t.is_marketplace_public = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'track_not_found';
  END IF;

  INSERT INTO marketplace_requests (
    track_id, requester_user_id, requester_workspace_id,
    owner_workspace_id, message,
    requester_name, requester_company, requester_email
  ) VALUES (
    _track_id, _user_id, _workspace_id,
    _owner_workspace_id, _message,
    _requester_name, _requester_company, _requester_email
  )
  ON CONFLICT (track_id, requester_user_id) DO UPDATE
    SET message = EXCLUDED.message, created_at = now()
  RETURNING id INTO _request_id;

  PERFORM create_notification(
    _user_id, _owner_user_id, _owner_workspace_id,
    'access_requested',
    'New Access Request',
    COALESCE(_requester_name, 'Someone') || ' is interested in "' || _track_title || '"',
    _track_id
  );

  RETURN _request_id;
END;
$func$;;
