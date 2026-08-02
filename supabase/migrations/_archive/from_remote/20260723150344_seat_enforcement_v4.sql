-- ============================================================
-- ÉTAPE 6 — Sièges (modèle Figma)
-- viewer = gratuit/illimité ; pitcher/editor/admin = 1 siège actif
-- Limite = seats_included du plan du OWNER du workspace.
-- ============================================================

-- Helper : état des sièges d'un workspace
CREATE OR REPLACE FUNCTION public.get_workspace_seats(_workspace_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE v_owner uuid; v_plan text; v_included int; v_used int; v_viewers int; v_pending int;
BEGIN
  SELECT owner_id INTO v_owner FROM public.workspaces WHERE id = _workspace_id;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('error','workspace_not_found'); END IF;

  SELECT s.plan, pl.seats_included INTO v_plan, v_included
  FROM public.subscriptions s
  JOIN public.plan_limits pl ON pl.plan = s.plan
  WHERE s.user_id = v_owner;

  v_plan := coalesce(v_plan, 'free');
  v_included := coalesce(v_included, 1);

  SELECT count(*) FILTER (WHERE access_level <> 'viewer'),
         count(*) FILTER (WHERE access_level = 'viewer')
    INTO v_used, v_viewers
  FROM public.workspace_members WHERE workspace_id = _workspace_id;

  SELECT count(*) INTO v_pending
  FROM public.invitations
  WHERE workspace_id = _workspace_id AND status = 'pending'
    AND access_level <> 'viewer' AND expires_at > now();

  RETURN jsonb_build_object(
    'plan', v_plan,
    'seats_included', v_included,
    'seats_used', coalesce(v_used,0),
    'seats_pending', coalesce(v_pending,0),
    'seats_available', greatest(v_included - coalesce(v_used,0) - coalesce(v_pending,0), 0),
    'viewers', coalesce(v_viewers,0),
    'can_invite_active', (coalesce(v_used,0) + coalesce(v_pending,0)) < v_included
  );
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_workspace_seats(uuid) TO authenticated, service_role;

-- Enforcement 1 : à l'ajout d'un membre actif
CREATE OR REPLACE FUNCTION public.enforce_seat_limit_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE v jsonb;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.access_level = 'viewer' THEN RETURN NEW; END IF;               -- viewers illimités
  IF TG_OP = 'UPDATE' AND OLD.access_level <> 'viewer' THEN RETURN NEW; END IF; -- déjà un siège

  v := public.get_workspace_seats(NEW.workspace_id);
  IF (v->>'seats_used')::int >= (v->>'seats_included')::int THEN
    RAISE EXCEPTION 'plan_limit_reached: seats (%/%).',
      v->>'seats_used', v->>'seats_included' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS enforce_seat_limit_member ON public.workspace_members;
CREATE TRIGGER enforce_seat_limit_member
  BEFORE INSERT OR UPDATE OF access_level ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit_member();

-- Enforcement 2 : à la création d'une invitation active
CREATE OR REPLACE FUNCTION public.enforce_seat_limit_invitation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE v jsonb;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.access_level = 'viewer' THEN RETURN NEW; END IF;

  v := public.get_workspace_seats(NEW.workspace_id);
  IF (v->>'can_invite_active')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'plan_limit_reached: seats (%/% used, % pending).',
      v->>'seats_used', v->>'seats_included', v->>'seats_pending'
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS enforce_seat_limit_invitation ON public.invitations;
CREATE TRIGGER enforce_seat_limit_invitation
  BEFORE INSERT ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit_invitation();;
