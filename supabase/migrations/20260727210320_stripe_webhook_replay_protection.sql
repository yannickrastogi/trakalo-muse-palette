create table if not exists public.stripe_webhook_events (
  event_id     text primary key,
  event_type   text,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

comment on table public.stripe_webhook_events is
  'Idempotence des webhooks Stripe : un event_id ne peut etre traite qu''une seule fois.';

create index if not exists idx_stripe_webhook_events_received_at
  on public.stripe_webhook_events (received_at desc);

alter table public.stripe_webhook_events enable row level security;

revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;

-- Revendique un event. true = premiere fois (a traiter), false = doublon (a ignorer).
create or replace function public.stripe_claim_webhook_event(
  _event_id text,
  _event_type text default null
) returns boolean
language plpgsql security definer set search_path = public
as $func$
declare v_n int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(_event_id, '') = '' then
    raise exception 'event_id is required' using errcode = 'check_violation';
  end if;

  insert into stripe_webhook_events (event_id, event_type)
  values (left(_event_id, 255), left(coalesce(_event_type, ''), 100))
  on conflict (event_id) do nothing;

  get diagnostics v_n = row_count;
  return v_n = 1;
end
$func$;

-- Marque un event comme traite avec succes.
create or replace function public.stripe_mark_webhook_processed(
  _event_id text
) returns void
language plpgsql security definer set search_path = public
as $func$
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  update stripe_webhook_events
     set processed_at = now()
   where event_id = _event_id;
end
$func$;

revoke execute on function public.stripe_claim_webhook_event(text, text)  from public, anon, authenticated;
revoke execute on function public.stripe_mark_webhook_processed(text)     from public, anon, authenticated;
grant  execute on function public.stripe_claim_webhook_event(text, text)  to service_role;
grant  execute on function public.stripe_mark_webhook_processed(text)     to service_role;;
