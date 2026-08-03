-- Palier interne "founder" : accès illimité et permanent, hors Stripe.
-- Fondateurs + comptes offerts attribués manuellement (influenceurs, partenaires).
-- Convention -1 = illimité, déjà utilisée dans plan_limits.
ALTER TABLE plan_limits  DROP CONSTRAINT IF EXISTS plan_limits_plan_check;
ALTER TABLE plan_limits  ADD  CONSTRAINT plan_limits_plan_check
  CHECK (plan = ANY (ARRAY['free','starter','pro','business','founder']));

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD  CONSTRAINT subscriptions_plan_check
  CHECK (plan = ANY (ARRAY['free','starter','pro','business','founder']));

INSERT INTO plan_limits (
  plan, tracks_max, storage_bytes_max, playlists_max, shared_links_max, contacts_max,
  pitches_per_month, smart_ar_per_month, smart_ar_lifetime, workspaces_max,
  seats_included, seats_addon_allowed, seat_addon_price_cents, viewers_unlimited,
  can_buy_credits, price_monthly_cents, price_yearly_cents, features
) VALUES (
  'founder', -1, 9223372036854775807, -1, -1, -1,
  -1, -1, NULL, -1,
  -1, false, NULL, false,
  true, 0, 0,
  '{"radio":true,"stems":true,"approvals":true,"qr_studio":true,"sonic_dna":true,
    "leak_tracing":true,"watermarking":true,"contact_export":true,"catalog_sharing":true,
    "custom_branding":true,"trakalog_access":true,"priority_support":true,
    "splits_signatures":true,"lyrics_transcription":true}'::jsonb
)
ON CONFLICT (plan) DO UPDATE SET
  tracks_max = EXCLUDED.tracks_max,
  storage_bytes_max = EXCLUDED.storage_bytes_max,
  workspaces_max = EXCLUDED.workspaces_max,
  seats_included = EXCLUDED.seats_included,
  features = EXCLUDED.features,
  updated_at = now();

-- Les sièges doivent comprendre -1 = illimité (déjà le cas pour tracks et workspaces).
CREATE OR REPLACE FUNCTION public.enforce_seat_limit_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $func$
DECLARE v jsonb; v_total int;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;

  v := public.get_workspace_seats(NEW.workspace_id);
  v_total := (v->>'seats_included')::int;
  IF v_total < 0 THEN RETURN NEW; END IF;
  IF (v->>'seats_used')::int >= v_total THEN
    RAISE EXCEPTION 'plan_limit_reached: seats (%/%).',
      v->>'seats_used', v_total USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$func$;

CREATE OR REPLACE FUNCTION public.get_workspace_seats(_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
declare
  v_owner uuid; v_plan text; v_included int; v_purchased int;
  v_total int; v_used int; v_viewers int; v_pending int; v_unlimited boolean;
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
  v_unlimited := (v_included < 0);
  v_total     := case when v_unlimited then -1 else v_included + v_purchased end;

  select count(*),
         count(*) filter (where access_level = 'viewer')
    into v_used, v_viewers
  from public.workspace_members where workspace_id = _workspace_id;

  select count(*) into v_pending
  from public.invitations
  where workspace_id = _workspace_id and status='pending' and expires_at > now();

  return jsonb_build_object(
    'plan', v_plan,
    'seats_included', v_total,
    'seats_unlimited', v_unlimited,
    'seats_from_plan', v_included,
    'seats_purchased', v_purchased,
    'seats_used', coalesce(v_used,0),
    'seats_pending', coalesce(v_pending,0),
    'seats_available', case when v_unlimited then -1
                       else greatest(v_total - coalesce(v_used,0) - coalesce(v_pending,0), 0) end,
    'viewers', coalesce(v_viewers,0),
    'can_invite_active', v_unlimited
      or (coalesce(v_used,0) + coalesce(v_pending,0)) < v_total
  );
end
$func$;;
