-- ============================================================
-- ÉTAPE A — lecture des tracks avec splits sanitisés selon l'access_level
-- Purement additif : aucune fonction/policy existante n'est modifiée.
-- Full splits: owner / admin / editor. Sanitisé: pitcher / viewer.
-- ============================================================

-- Helper : retire share, ipi, pro, email, publisher de chaque split
CREATE OR REPLACE FUNCTION public.sanitize_splits(_splits jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $func$
  SELECT CASE
    WHEN _splits IS NULL OR jsonb_typeof(_splits) <> 'array' THEN _splits
    ELSE coalesce(
      (SELECT jsonb_agg(
                jsonb_strip_nulls(jsonb_build_object(
                  'id',         elem->'id',
                  'name',       elem->'name',
                  'stage_name', elem->'stage_name',
                  'role',       elem->'role',
                  'locked',     elem->'locked'
                ))
              )
       FROM jsonb_array_elements(_splits) AS elem),
      '[]'::jsonb)
  END;
$func$;

-- Lecture du catalogue : même shape que SELECT * sur tracks
CREATE OR REPLACE FUNCTION public.get_workspace_tracks(_workspace_id uuid, _user_id uuid)
RETURNS SETOF public.tracks
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE v_level text; v_is_owner boolean; v_full boolean;
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT public.is_workspace_member(_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT (w.owner_id = _user_id) INTO v_is_owner
  FROM public.workspaces w WHERE w.id = _workspace_id;

  SELECT m.access_level INTO v_level
  FROM public.workspace_members m
  WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id;

  v_full := coalesce(v_is_owner, false) OR coalesce(v_level,'viewer') IN ('admin','editor');

  IF v_full THEN
    RETURN QUERY
      SELECT * FROM public.tracks
      WHERE workspace_id = _workspace_id
      ORDER BY created_at DESC;
  ELSE
    RETURN QUERY
      SELECT (jsonb_populate_record(
                t,
                jsonb_build_object('splits', public.sanitize_splits(t.splits))
              )).*
      FROM public.tracks t
      WHERE t.workspace_id = _workspace_id
      ORDER BY t.created_at DESC;
  END IF;
END;
$func$;

REVOKE ALL ON FUNCTION public.get_workspace_tracks(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_tracks(uuid,uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';;
