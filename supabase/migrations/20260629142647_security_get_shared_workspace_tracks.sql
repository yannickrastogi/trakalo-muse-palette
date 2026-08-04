
DROP FUNCTION IF EXISTS public.get_shared_workspace_tracks(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_shared_workspace_tracks(_source_workspace_id uuid, _target_workspace_id uuid)
RETURNS SETOF tracks
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  -- L'appelant doit être membre du workspace cible (celui qui reçoit les tracks)
  IF NOT public.is_workspace_member(auth.uid(), _target_workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Vérifier qu'un catalog_share actif existe entre les deux workspaces
  IF NOT EXISTS (
    SELECT 1 FROM catalog_shares
    WHERE source_workspace_id = _source_workspace_id
      AND target_workspace_id = _target_workspace_id
      AND status = 'active'
      AND track_id IS NULL
  ) THEN
    RAISE EXCEPTION 'no_active_catalog_share' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY SELECT * FROM tracks WHERE workspace_id = _source_workspace_id;
END;
$function$;
;
