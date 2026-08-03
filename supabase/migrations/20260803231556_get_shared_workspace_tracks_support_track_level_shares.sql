-- BUG : la fonction exigeait un partage de CATALOGUE ENTIER (track_id IS NULL) et levait
-- une exception sinon -> HTTP 403 en console à chaque appel.
-- Or sur 33 partages actifs, 32 sont au niveau d'une TRACK individuelle (flux « Save to
-- Trakalog »). L'appel était donc légitime mais systématiquement refusé.
-- Correctif : renvoyer ce qui est réellement partagé — le catalogue entier s'il existe un
-- partage global, sinon les tracks partagées individuellement. Ne lever une exception que
-- si RIEN n'est partagé entre les deux workspaces.
-- Le contrôle d'accès sur le workspace cible reste identique.
CREATE OR REPLACE FUNCTION public.get_shared_workspace_tracks(
  _source_workspace_id uuid,
  _target_workspace_id uuid
)
RETURNS SETOF tracks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_catalogue_entier boolean;
  v_a_des_tracks boolean;
BEGIN
  -- L'appelant doit être membre du workspace cible (celui qui reçoit les tracks)
  IF NOT public.is_workspace_member(auth.uid(), _target_workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM catalog_shares
    WHERE source_workspace_id = _source_workspace_id
      AND target_workspace_id = _target_workspace_id
      AND status = 'active'
      AND track_id IS NULL
  ) INTO v_catalogue_entier;

  IF v_catalogue_entier THEN
    RETURN QUERY SELECT * FROM tracks WHERE workspace_id = _source_workspace_id;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM catalog_shares
    WHERE source_workspace_id = _source_workspace_id
      AND target_workspace_id = _target_workspace_id
      AND status = 'active'
      AND track_id IS NOT NULL
  ) INTO v_a_des_tracks;

  IF NOT v_a_des_tracks THEN
    RAISE EXCEPTION 'no_active_catalog_share' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Partages au niveau track : on ne renvoie QUE les tracks explicitement partagées.
  RETURN QUERY
  SELECT t.* FROM tracks t
  WHERE t.workspace_id = _source_workspace_id
    AND EXISTS (
      SELECT 1 FROM catalog_shares cs
      WHERE cs.source_workspace_id = _source_workspace_id
        AND cs.target_workspace_id = _target_workspace_id
        AND cs.status = 'active'
        AND cs.track_id = t.id
    );
END;
$func$;;
