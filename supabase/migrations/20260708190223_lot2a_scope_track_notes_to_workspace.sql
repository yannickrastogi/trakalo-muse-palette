-- LOT 2A — Privacy: scope internal track notes to the workspace where they were written.
-- Root cause: track_comments had no workspace_id; add_track_comment_legacy_v0 also inserted
-- into renamed/nonexistent columns (user_id/timecode/visitor_name/visitor_email) => in-app
-- note add was broken AND notes leaked across workspaces on catalog-shared tracks.

-- 1) Workspace scoping column (nullable, FK)
ALTER TABLE public.track_comments
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 2) Backfill existing rows
UPDATE public.track_comments tc
SET workspace_id = sl.workspace_id
FROM public.shared_links sl
WHERE tc.shared_link_id = sl.id AND tc.workspace_id IS NULL;

UPDATE public.track_comments tc
SET workspace_id = t.workspace_id
FROM public.tracks t
WHERE tc.shared_link_id IS NULL AND tc.track_id = t.id AND tc.workspace_id IS NULL;

-- 3) Index for scoped reads
CREATE INDEX IF NOT EXISTS idx_track_comments_track_ws
  ON public.track_comments (track_id, workspace_id);

-- 4) Drop existing (broken) overloads
DO $drop$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('add_track_comment','get_track_comments')
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig::text; END LOOP;
END
$drop$;

-- 5) add_track_comment — real columns, scoped to viewing workspace, membership + catalog-share access
CREATE OR REPLACE FUNCTION public.add_track_comment(
  _track_id      uuid,
  _author_name   text,
  _author_email  text,
  _author_type   text,
  _timestamp_sec numeric,
  _content       text,
  _workspace_id  uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE
  v_uid    uuid := auth.uid();
  v_home   uuid;
  v_target uuid;
  v_new_id uuid;
BEGIN
  SELECT workspace_id INTO v_home FROM public.tracks WHERE id = _track_id;
  IF v_home IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  v_target := COALESCE(_workspace_id, v_home);

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT public.is_workspace_member(v_uid, v_target) THEN
    RAISE EXCEPTION 'Not a member of workspace %', v_target USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- the viewing workspace must actually have access to this track (home OR an active catalog share)
  IF v_target <> v_home
     AND NOT EXISTS (
       SELECT 1 FROM public.catalog_shares cs
       WHERE cs.target_workspace_id = v_target
         AND cs.status = 'active'
         AND (cs.track_id = _track_id
              OR (cs.track_id IS NULL AND cs.source_workspace_id = v_home))
     ) THEN
    RAISE EXCEPTION 'Workspace % has no access to track %', v_target, _track_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.track_comments
    (track_id, shared_link_id, author_name, author_email, author_type, timestamp_sec, content, workspace_id)
  VALUES
    (_track_id, NULL, _author_name, _author_email, COALESCE(_author_type, 'owner'),
     COALESCE(_timestamp_sec, 0), _content, v_target)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$func$;

-- 6) get_track_comments — internal notes scoped to workspace; shared-link comments preserved.
-- Non-breaking during rollout: when _workspace_id IS NULL, behaves like before (returns all).
CREATE OR REPLACE FUNCTION public.get_track_comments(
  _track_id     uuid,
  _workspace_id uuid DEFAULT NULL
) RETURNS SETOF public.track_comments
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  RETURN QUERY
  SELECT * FROM public.track_comments tc
  WHERE tc.track_id = _track_id
    AND (
      -- internal notes: scoped to the requesting workspace (or all if none supplied)
      (tc.shared_link_id IS NULL AND (_workspace_id IS NULL OR tc.workspace_id = _workspace_id))
      -- shared-link comments: visible to the workspace that owns the link (or all if none supplied)
      OR (tc.shared_link_id IS NOT NULL AND (
            _workspace_id IS NULL
            OR EXISTS (SELECT 1 FROM public.shared_links sl
                       WHERE sl.id = tc.shared_link_id AND sl.workspace_id = _workspace_id)
          ))
    )
  ORDER BY tc.created_at DESC;
END;
$func$;

-- 7) Grants (least privilege)
GRANT EXECUTE ON FUNCTION public.add_track_comment(uuid,text,text,text,numeric,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_track_comments(uuid,uuid) TO authenticated, service_role;;
