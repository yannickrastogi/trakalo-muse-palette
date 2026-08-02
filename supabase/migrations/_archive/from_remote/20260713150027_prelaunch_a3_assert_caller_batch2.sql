CREATE OR REPLACE FUNCTION public.insert_stem(_user_id uuid, _track_id uuid, _name text, _file_url text, _file_size bigint, _stem_type text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
DECLARE
  v_workspace_id uuid;
  v_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);

  SELECT workspace_id INTO v_workspace_id
  FROM public.tracks WHERE id = _track_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'pitcher');

  INSERT INTO public.stems
    (workspace_id, track_id, uploaded_by, file_name, stem_type, file_url, file_size_bytes)
  VALUES
    (v_workspace_id, _track_id, _user_id, _name, _stem_type::stem_type, _file_url, _file_size)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$func$;

CREATE OR REPLACE FUNCTION public.mark_waitlist_invited(_user_id uuid, _email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_platform_admin(_user_id) THEN
    RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.waitlist
  SET invited_at = now(), invitation_sent_by = _user_id
  WHERE lower(email) = lower(_email);
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_pitch_share_link(_user_id uuid, _pitch_id uuid, _workspace_id uuid, _share_link_id uuid DEFAULT NULL::uuid, _contact_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);

  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  IF _share_link_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM shared_links
    WHERE id = _share_link_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'Invalid share link';
  END IF;

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
$func$;;
