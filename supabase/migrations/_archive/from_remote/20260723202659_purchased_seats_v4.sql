-- Sièges additionnels achetés via Stripe ($10/siège/mois)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS purchased_seats integer NOT NULL DEFAULT 0;

-- get_workspace_seats : total = seats_included (plan) + purchased_seats (add-on)
CREATE OR REPLACE FUNCTION public.get_workspace_seats(_workspace_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE v_owner uuid; v_plan text; v_included int; v_purchased int;
        v_total int; v_used int; v_viewers int; v_pending int;
BEGIN
  SELECT owner_id INTO v_owner FROM public.workspaces WHERE id = _workspace_id;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('error','workspace_not_found'); END IF;

  SELECT s.plan, pl.seats_included, s.purchased_seats
    INTO v_plan, v_included, v_purchased
  FROM public.subscriptions s
  JOIN public.plan_limits pl ON pl.plan = s.plan
  WHERE s.user_id = v_owner;

  v_plan      := coalesce(v_plan,'free');
  v_included  := coalesce(v_included,1);
  v_purchased := coalesce(v_purchased,0);
  v_total     := v_included + v_purchased;

  SELECT count(*) FILTER (WHERE access_level <> 'viewer'),
         count(*) FILTER (WHERE access_level = 'viewer')
    INTO v_used, v_viewers
  FROM public.workspace_members WHERE workspace_id = _workspace_id;

  SELECT count(*) INTO v_pending
  FROM public.invitations
  WHERE workspace_id = _workspace_id AND status='pending'
    AND access_level <> 'viewer' AND expires_at > now();

  RETURN jsonb_build_object(
    'plan', v_plan,
    'seats_included', v_total,          -- total effectif (front inchangé)
    'seats_from_plan', v_included,
    'seats_purchased', v_purchased,
    'seats_used', coalesce(v_used,0),
    'seats_pending', coalesce(v_pending,0),
    'seats_available', greatest(v_total - coalesce(v_used,0) - coalesce(v_pending,0), 0),
    'viewers', coalesce(v_viewers,0),
    'can_invite_active', (coalesce(v_used,0) + coalesce(v_pending,0)) < v_total
  );
END;
$func$;

NOTIFY pgrst, 'reload schema';;
