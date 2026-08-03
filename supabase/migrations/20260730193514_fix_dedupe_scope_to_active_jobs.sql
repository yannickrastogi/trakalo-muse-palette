-- La dedupe_key ne doit bloquer que les jobs EN COURS.
-- Un job termine ou echoue ne doit jamais interdire de refaire le travail.

alter table public.jobs drop constraint if exists jobs_dedupe_key_key;

create unique index if not exists idx_jobs_dedupe_active
  on public.jobs (dedupe_key)
  where dedupe_key is not null and status in ('pending','processing');

create or replace function public.enqueue_job(
  _job_type     text,
  _payload      jsonb   default '{}'::jsonb,
  _workspace_id uuid    default null,
  _created_by   uuid    default null,
  _dedupe_key   text    default null,
  _priority     int     default 100,
  _max_attempts int     default 3
) returns uuid
language plpgsql security definer set search_path = public
as $func$
declare
  v_id  uuid;
  v_key text := nullif(left(coalesce(_dedupe_key, ''), 200), '');
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(_job_type, '') = '' then
    raise exception 'job_type is required' using errcode = 'check_violation';
  end if;

  -- Un job identique deja EN COURS : on renvoie celui-la, inutile de doubler le travail.
  if v_key is not null then
    select id into v_id
    from jobs
    where dedupe_key = v_key
      and status in ('pending','processing')
    limit 1;

    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into jobs (job_type, payload, workspace_id, created_by,
                    dedupe_key, priority, max_attempts)
  values (left(_job_type, 60), coalesce(_payload, '{}'::jsonb), _workspace_id, _created_by,
          v_key,
          greatest(1, least(1000, coalesce(_priority, 100))),
          greatest(1, least(10,   coalesce(_max_attempts, 3))))
  on conflict (dedupe_key) where (dedupe_key is not null and status in ('pending','processing'))
    do nothing
  returning id into v_id;

  -- Course entre deux appels simultanes : on recupere le gagnant.
  if v_id is null and v_key is not null then
    select id into v_id
    from jobs
    where dedupe_key = v_key
      and status in ('pending','processing')
    limit 1;
  end if;

  return v_id;
end
$func$;

revoke execute on function public.enqueue_job(text,jsonb,uuid,uuid,text,int,int) from public, anon, authenticated;
grant  execute on function public.enqueue_job(text,jsonb,uuid,uuid,text,int,int) to service_role;

-- Le job d'hier pointe vers un fichier ecrit dans Supabase alors que l'EF lit dans R2.
delete from public.jobs where id = '30e6e723-16e6-47b2-a04c-73e5f67fa5d3';;
