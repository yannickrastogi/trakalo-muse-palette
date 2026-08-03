-- ============================================================
-- RPC de la file d'attente (service_role uniquement)
-- ============================================================

-- 1) Deposer un job. Idempotent via dedupe_key.
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
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(_job_type, '') = '' then
    raise exception 'job_type is required' using errcode = 'check_violation';
  end if;

  insert into jobs (job_type, payload, workspace_id, created_by,
                    dedupe_key, priority, max_attempts)
  values (left(_job_type, 60), coalesce(_payload, '{}'::jsonb), _workspace_id, _created_by,
          nullif(left(coalesce(_dedupe_key, ''), 200), ''),
          greatest(1, least(1000, coalesce(_priority, 100))),
          greatest(1, least(10,   coalesce(_max_attempts, 3))))
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  -- Job deja present : on renvoie l'existant plutot que de dupliquer le travail.
  if v_id is null and _dedupe_key is not null then
    select id into v_id from jobs where dedupe_key = _dedupe_key;
  end if;

  return v_id;
end
$func$;

-- 2) Reclamer des jobs. SKIP LOCKED = plusieurs workers sans collision.
create or replace function public.claim_jobs(
  _worker_id  text,
  _job_types  text[] default null,
  _limit      int    default 1
) returns setof jobs
language plpgsql security definer set search_path = public
as $func$
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  return query
  with picked as (
    select j.id
    from jobs j
    where j.status = 'pending'
      and j.run_after <= now()
      and (_job_types is null or j.job_type = any(_job_types))
    order by j.priority asc, j.created_at asc
    limit greatest(1, least(20, coalesce(_limit, 1)))
    for update skip locked
  )
  update jobs u
     set status     = 'processing',
         locked_by  = left(coalesce(_worker_id, 'unknown'), 100),
         locked_at  = now(),
         started_at = coalesce(u.started_at, now()),
         attempts   = u.attempts + 1
   where u.id in (select id from picked)
  returning u.*;
end
$func$;

-- 3) Succes.
create or replace function public.complete_job(
  _job_id uuid,
  _result jsonb default null
) returns void
language plpgsql security definer set search_path = public
as $func$
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  update jobs
     set status = 'done', result = _result,
         error = null, finished_at = now(), locked_by = null, locked_at = null
   where id = _job_id;
end
$func$;

-- 4) Echec. Retente avec backoff exponentiel tant qu'il reste des tentatives.
create or replace function public.fail_job(
  _job_id uuid,
  _error  text,
  _retry  boolean default true
) returns void
language plpgsql security definer set search_path = public
as $func$
declare v_job jobs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  select * into v_job from jobs where id = _job_id;
  if v_job.id is null then
    return;
  end if;

  if _retry and v_job.attempts < v_job.max_attempts then
    update jobs
       set status    = 'pending',
           error     = left(coalesce(_error, ''), 2000),
           locked_by = null,
           locked_at = null,
           -- backoff : 1 min, 4 min, 9 min...
           run_after = now() + (power(v_job.attempts, 2) * interval '1 minute')
     where id = _job_id;
  else
    update jobs
       set status = 'failed',
           error  = left(coalesce(_error, ''), 2000),
           finished_at = now(), locked_by = null, locked_at = null
     where id = _job_id;
  end if;
end
$func$;

-- 5) Filet de securite : un worker qui meurt laisse un job bloque en 'processing'.
create or replace function public.requeue_stale_jobs(
  _older_than_minutes int default 15
) returns int
language plpgsql security definer set search_path = public
as $func$
declare v_n int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  update jobs
     set status    = case when attempts >= max_attempts then 'failed'::job_status
                          else 'pending'::job_status end,
         error     = coalesce(error, 'worker timeout / lost'),
         locked_by = null,
         locked_at = null,
         run_after = now()
   where status = 'processing'
     and locked_at < now() - make_interval(mins => greatest(1, _older_than_minutes));

  get diagnostics v_n = row_count;
  return v_n;
end
$func$;

revoke execute on function public.enqueue_job(text,jsonb,uuid,uuid,text,int,int) from public, anon, authenticated;
revoke execute on function public.claim_jobs(text,text[],int)                     from public, anon, authenticated;
revoke execute on function public.complete_job(uuid,jsonb)                        from public, anon, authenticated;
revoke execute on function public.fail_job(uuid,text,boolean)                     from public, anon, authenticated;
revoke execute on function public.requeue_stale_jobs(int)                         from public, anon, authenticated;

grant execute on function public.enqueue_job(text,jsonb,uuid,uuid,text,int,int) to service_role;
grant execute on function public.claim_jobs(text,text[],int)                     to service_role;
grant execute on function public.complete_job(uuid,jsonb)                        to service_role;
grant execute on function public.fail_job(uuid,text,boolean)                     to service_role;
grant execute on function public.requeue_stale_jobs(int)                         to service_role;;
