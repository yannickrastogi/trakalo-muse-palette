-- CRITIQUE : les RPC de facturation, concues pour etre appelees uniquement par le
-- webhook Stripe en service_role, etaient executables par anon et authenticated,
-- sans aucune verification interne. N'importe qui disposant de la cle publique
-- (visible dans le bundle front) pouvait s'attribuer un plan ou des credits.
-- Aucun appel client n'existe (verifie dans le repo) : la revocation est sans risque.

do $revoke$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'stripe_apply_subscription',
        'stripe_grant_credits',
        'stripe_set_purchased_seats',
        'stripe_downgrade_to_free',
        'stripe_set_customer',
        'stripe_reset_billing_usage',
        'reset_monthly_usage_if_due',
        'sync_pitch_usage',
        'set_track_comment_workspace'
      )
  loop
    execute format('revoke all on function %s from public',        r.sig);
    execute format('revoke all on function %s from anon',          r.sig);
    execute format('revoke all on function %s from authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end
$revoke$;;
