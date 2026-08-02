-- LOT 6C #19 — share an entire playlist between workspaces (as a unit).
-- catalog_shares gains a playlist_id: a share is now track (track_id), playlist (playlist_id), or full-catalog (both null).

-- 1) Schema
ALTER TABLE public.catalog_shares
  ADD COLUMN IF NOT EXISTS playlist_id uuid REFERENCES public.playlists(id) ON DELETE CASCADE;

-- 2) Keep the existing catalog-shares listing to track/full-catalog only (playlist shares handled separately).
DROP FUNCTION IF EXISTS public.get_workspace_catalog_shares(uuid);
CREATE FUNCTION public.get_workspace_catalog_shares(_workspace_id uuid)
RETURNS TABLE(
  id uuid, track_id uuid, source_workspace_id uuid, target_workspace_id uuid,
  access_level text, status text, created_at timestamptz, source_workspace_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT cs.id, cs.track_id, cs.source_workspace_id, cs.target_workspace_id,
         cs.access_level, cs.status, cs.created_at, sw.name
  FROM public.catalog_shares cs
  LEFT JOIN public.workspaces sw ON sw.id = cs.source_workspace_id
  WHERE cs.playlist_id IS NULL
    AND (cs.source_workspace_id = _workspace_id OR cs.target_workspace_id = _workspace_id);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_workspace_catalog_shares(uuid) TO anon, authenticated, service_role;

-- 3) Create a playlist share (admin on source, anti-impersonation, dedup).
CREATE OR REPLACE FUNCTION public.share_playlist_with_workspace(
  _user_id uuid, _playlist_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE
  v_existing uuid;
  v_new_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _source_workspace_id, 'admin');

  IF _source_workspace_id = _target_workspace_id THEN
    RAISE EXCEPTION 'Cannot share a playlist with the same workspace';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = _playlist_id AND p.workspace_id = _source_workspace_id) THEN
    RAISE EXCEPTION 'Playlist % is not in the source workspace', _playlist_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = _target_workspace_id) THEN
    RAISE EXCEPTION 'Target workspace % not found', _target_workspace_id;
  END IF;

  -- dedup: reuse an existing active share
  SELECT id INTO v_existing FROM public.catalog_shares
  WHERE playlist_id = _playlist_id AND target_workspace_id = _target_workspace_id AND status = 'active'
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.catalog_shares (playlist_id, track_id, source_workspace_id, target_workspace_id, shared_by, access_level, status)
  VALUES (_playlist_id, NULL, _source_workspace_id, _target_workspace_id, _user_id, COALESCE(_access_level, 'viewer'), 'active')
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.share_playlist_with_workspace(uuid,uuid,uuid,uuid,text) TO authenticated, service_role;

-- 4) List playlist shares for a workspace (both directions), with names + track count.
CREATE OR REPLACE FUNCTION public.get_shared_workspace_playlists(_workspace_id uuid)
RETURNS TABLE(
  share_id uuid, playlist_id uuid, playlist_name text,
  source_workspace_id uuid, source_workspace_name text,
  target_workspace_id uuid, target_workspace_name text,
  access_level text, status text, created_at timestamptz,
  direction text, track_count integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT cs.id, cs.playlist_id, p.name,
         cs.source_workspace_id, sw.name,
         cs.target_workspace_id, tw.name,
         cs.access_level, cs.status, cs.created_at,
         CASE WHEN cs.source_workspace_id = _workspace_id THEN 'outgoing' ELSE 'incoming' END,
         (SELECT count(*)::integer FROM public.playlist_tracks pt WHERE pt.playlist_id = cs.playlist_id)
  FROM public.catalog_shares cs
  JOIN public.playlists p ON p.id = cs.playlist_id
  LEFT JOIN public.workspaces sw ON sw.id = cs.source_workspace_id
  LEFT JOIN public.workspaces tw ON tw.id = cs.target_workspace_id
  WHERE cs.playlist_id IS NOT NULL
    AND cs.status = 'active'
    AND (cs.source_workspace_id = _workspace_id OR cs.target_workspace_id = _workspace_id);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_shared_workspace_playlists(uuid) TO authenticated, service_role;

-- 5) Read the tracks of a shared-in playlist (gated: caller is member of target AND playlist is actively shared with target).
CREATE OR REPLACE FUNCTION public.get_shared_playlist_tracks(_playlist_id uuid, _target_workspace_id uuid)
RETURNS SETOF public.tracks
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), _target_workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_shares cs
    WHERE cs.playlist_id = _playlist_id AND cs.target_workspace_id = _target_workspace_id AND cs.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Playlist % is not shared with workspace %', _playlist_id, _target_workspace_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT t.* FROM public.tracks t
  JOIN public.playlist_tracks pt ON pt.track_id = t.id
  WHERE pt.playlist_id = _playlist_id
  ORDER BY pt.position ASC;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_shared_playlist_tracks(uuid,uuid) TO authenticated, service_role;;
