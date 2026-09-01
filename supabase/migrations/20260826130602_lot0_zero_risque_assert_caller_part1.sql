-- LOT 0 (1/3) : assert_caller sur RPC mutantes — audit 24 août 2026
CREATE OR REPLACE FUNCTION public.add_contact_manual(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text DEFAULT NULL::text, _email text DEFAULT NULL::text, _role text DEFAULT NULL::text, _company text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _pro text[] DEFAULT NULL::text[], _ipi text DEFAULT NULL::text, _publisher text DEFAULT NULL::text, _city text DEFAULT NULL::text, _country text DEFAULT NULL::text, _stage_name text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  RETURN public.add_contact_manual_legacy_v0(
    _user_id, _workspace_id, _first_name, _last_name, _email, _role,
    _company, _phone, _pro, _ipi, _publisher, _city, _country, _stage_name);
END;
$func$;

CREATE OR REPLACE FUNCTION public.add_playlist_tracks(_user_id uuid, _playlist_id uuid, _track_ids uuid[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_workspace_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id INTO v_workspace_id FROM public.playlists WHERE id = _playlist_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Playlist % not found', _playlist_id; END IF;
  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'pitcher');
  PERFORM public.add_playlist_tracks_legacy_v0(_user_id, _playlist_id, _track_ids);
END;
$func$;

CREATE OR REPLACE FUNCTION public.create_playlist(_user_id uuid, _workspace_id uuid, _name text, _description text DEFAULT NULL::text, _cover_url text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  RETURN public.create_playlist_legacy_v0(_user_id, _workspace_id, _name, _description, _cover_url);
END;
$func$;

CREATE OR REPLACE FUNCTION public.delete_playlist(_user_id uuid, _playlist_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_workspace_id uuid; v_created_by uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id, created_by INTO v_workspace_id, v_created_by FROM public.playlists WHERE id = _playlist_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Playlist % not found', _playlist_id; END IF;
  IF NOT (public.has_workspace_access_level(_user_id, v_workspace_id, 'admin') OR v_created_by = _user_id) THEN
    RAISE EXCEPTION 'Insufficient access level for delete_playlist: admin required, or be the creator' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM public.delete_playlist_legacy_v0(_user_id, _playlist_id);
END;
$func$;

CREATE OR REPLACE FUNCTION public.delete_stem(_user_id uuid, _stem_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_workspace_id uuid; v_uploaded_by uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id, uploaded_by INTO v_workspace_id, v_uploaded_by FROM public.stems WHERE id = _stem_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Stem % not found', _stem_id; END IF;
  IF NOT (public.has_workspace_access_level(_user_id, v_workspace_id, 'editor') OR v_uploaded_by = _user_id) THEN
    RAISE EXCEPTION 'Insufficient access level for delete_stem: editor required, or be the uploader' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM public.delete_stem_legacy_v0(_user_id, _stem_id);
END;
$func$;

CREATE OR REPLACE FUNCTION public.delete_track_document(_user_id uuid, _doc_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_workspace_id uuid; v_uploaded_by uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id, uploaded_by INTO v_workspace_id, v_uploaded_by FROM public.track_documents WHERE id = _doc_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Document % not found', _doc_id; END IF;
  IF NOT (public.has_workspace_access_level(_user_id, v_workspace_id, 'admin') OR v_uploaded_by = _user_id) THEN
    RAISE EXCEPTION 'Insufficient access level for delete_track_document: admin required, or be the uploader' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM public.delete_track_document_legacy_v0(_user_id, _doc_id);
END;
$func$;

CREATE OR REPLACE FUNCTION public.insert_approval(_user_id uuid, _workspace_id uuid, _track_id uuid, _send_type text, _team_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_workspace_member(_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'Not a member of workspace %', _workspace_id USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN public.insert_approval_legacy_v0(_user_id, _workspace_id, _track_id, _send_type, _team_id);
END;
$func$;

CREATE OR REPLACE FUNCTION public.insert_catalog_share(_user_id uuid, _track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _source_workspace_id, 'admin');
  RETURN public.insert_catalog_share_legacy_v0(_user_id, _track_id, _source_workspace_id, _target_workspace_id, _access_level);
END;
$func$;

CREATE OR REPLACE FUNCTION public.insert_track_document(_user_id uuid, _track_id uuid, _name text, _file_path text, _file_size bigint DEFAULT NULL::bigint, _doc_type text DEFAULT NULL::text, _file_name text DEFAULT NULL::text, _mime_type text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_workspace_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id INTO v_workspace_id FROM public.tracks WHERE id = _track_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Track % not found', _track_id; END IF;
  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'editor');
  RETURN public.insert_track_document_legacy_v0(_user_id, _track_id, _name, _file_path, _file_size, _doc_type, _file_name, _mime_type);
END;
$func$;

CREATE OR REPLACE FUNCTION public.remove_track_from_trakalog(_track_id uuid, _user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_target_workspace_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id INTO v_target_workspace_id FROM public.tracks WHERE id = _track_id;
  IF v_target_workspace_id IS NULL THEN RAISE EXCEPTION 'Track % not found', _track_id; END IF;
  PERFORM public.require_workspace_access_level(_user_id, v_target_workspace_id, 'pitcher');
  PERFORM public.remove_track_from_trakalog_legacy_v0(_track_id, _user_id);
END;
$func$;

CREATE OR REPLACE FUNCTION public.replace_playlist_tracks(_user_id uuid, _playlist_id uuid, _track_ids uuid[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_workspace_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id INTO v_workspace_id FROM public.playlists WHERE id = _playlist_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Playlist % not found', _playlist_id; END IF;
  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'pitcher');
  PERFORM public.replace_playlist_tracks_legacy_v0(_user_id, _playlist_id, _track_ids);
END;
$func$;

CREATE OR REPLACE FUNCTION public.revoke_catalog_share(_user_id uuid, _share_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_source_ws uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT source_workspace_id INTO v_source_ws FROM public.catalog_shares WHERE id = _share_id;
  IF v_source_ws IS NULL THEN RAISE EXCEPTION 'Catalog share % not found', _share_id; END IF;
  PERFORM public.require_workspace_access_level(_user_id, v_source_ws, 'admin');
  PERFORM public.revoke_catalog_share_legacy_v0(_user_id, _share_id);
END;
$func$;
