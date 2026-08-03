-- Révision du modèle de sièges (2 août 2026, décision Yannick).
-- AVANT : les viewers étaient gratuits et illimités (modèle "Figma").
-- APRÈS : TOUT membre d'un workspace consomme un siège, quel que soit son niveau
--         (viewer, editor, admin). Le propriétaire compte pour 1.
-- Raison : donner un accès permanent au catalogue est un usage du service, donc payant.
-- Le canal gratuit reste le LIEN PARTAGÉ : un A&R ou un superviseur reçoit une track ou
-- une playlist sans compte, sans être membre, et ne consomme aucun siège.

UPDATE plan_limits SET viewers_unlimited = false, updated_at = now();

-- 1. Comptage : tous les membres, toutes les invitations en attente.
CREATE OR REPLACE FUNCTION public.get_workspace_seats(_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
declare
  v_owner uuid; v_plan text; v_included int; v_purchased int;
  v_total int; v_used int; v_viewers int; v_pending int;
  v_uid uuid := auth.uid();
begin
  if auth.role() is distinct from 'service_role' then
    if v_uid is null or _workspace_id is null
       or not public.is_workspace_member(v_uid, _workspace_id) then
      return jsonb_build_object('error','not_authorized');
    end if;
  end if;

  select owner_id into v_owner from public.workspaces where id = _workspace_id;
  if v_owner is null then return jsonb_build_object('error','workspace_not_found'); end if;

  select s.plan, pl.seats_included, s.purchased_seats
    into v_plan, v_included, v_purchased
  from public.subscriptions s
  join public.plan_limits pl on pl.plan = s.plan
  where s.user_id = v_owner;

  v_plan      := coalesce(v_plan,'free');
  v_included  := coalesce(v_included,1);
  v_purchased := coalesce(v_purchased,0);
  v_total     := v_included + v_purchased;

  -- TOUT membre consomme un siège. v_viewers reste informatif pour l'UI.
  select count(*),
         count(*) filter (where access_level = 'viewer')
    into v_used, v_viewers
  from public.workspace_members where workspace_id = _workspace_id;

  select count(*) into v_pending
  from public.invitations
  where workspace_id = _workspace_id and status='pending'
    and expires_at > now();

  return jsonb_build_object(
    'plan', v_plan,
    'seats_included', v_total,
    'seats_from_plan', v_included,
    'seats_purchased', v_purchased,
    'seats_used', coalesce(v_used,0),
    'seats_pending', coalesce(v_pending,0),
    'seats_available', greatest(v_total - coalesce(v_used,0) - coalesce(v_pending,0), 0),
    'viewers', coalesce(v_viewers,0),
    'can_invite_active', (coalesce(v_used,0) + coalesce(v_pending,0)) < v_total
  );
end
$func$;

-- 2. Ajout d'un membre : plus d'exemption pour les viewers.
CREATE OR REPLACE FUNCTION public.enforce_seat_limit_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $func$
DECLARE v jsonb;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  -- Un membre existant qui change de niveau consomme déjà son siège : pas de recontrôle.
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;

  v := public.get_workspace_seats(NEW.workspace_id);
  IF (v->>'seats_used')::int >= (v->>'seats_included')::int THEN
    RAISE EXCEPTION 'plan_limit_reached: seats (%/%).',
      v->>'seats_used', v->>'seats_included' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$func$;

-- 3. Invitation : plus d'exemption pour les viewers.
CREATE OR REPLACE FUNCTION public.enforce_seat_limit_invitation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $func$
DECLARE v jsonb;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;

  v := public.get_workspace_seats(NEW.workspace_id);
  IF (v->>'can_invite_active')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'plan_limit_reached: seats (%/% used, % pending).',
      v->>'seats_used', v->>'seats_included', v->>'seats_pending'
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$func$;;
