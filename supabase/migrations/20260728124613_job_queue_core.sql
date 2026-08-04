-- ============================================================
-- File d'attente de jobs asynchrones
-- ============================================================

do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('pending','processing','done','failed','cancelled');
  end if;
end
$enum$;

create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  job_type      text        not null,
  status        job_status  not null default 'pending',
  priority      int         not null default 100,

  workspace_id  uuid        references public.workspaces(id) on delete cascade,
  created_by    uuid,

  -- Cle d'idempotence : empeche de creer deux fois le meme job
  dedupe_key    text unique,

  payload       jsonb       not null default '{}'::jsonb,
  result        jsonb,
  error         text,

  attempts      int         not null default 0,
  max_attempts  int         not null default 3,

  locked_by     text,
  locked_at     timestamptz,
  run_after     timestamptz not null default now(),

  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

comment on table public.jobs is
  'File d''attente asynchrone. Le worker Railway reclame les jobs via claim_jobs().';

-- Index de la requete de claim : status + run_after + priorite
create index if not exists idx_jobs_claim
  on public.jobs (status, run_after, priority, created_at)
  where status in ('pending','processing');

create index if not exists idx_jobs_workspace  on public.jobs (workspace_id, created_at desc);
create index if not exists idx_jobs_type       on public.jobs (job_type, status);

alter table public.jobs enable row level security;

-- Lecture : les membres du workspace voient leurs jobs (pour l'UI de progression).
-- Aucune ecriture cliente : tout passe par les RPC.
create policy jobs_select_members on public.jobs
  for select to authenticated
  using (
    workspace_id is not null
    and public.is_workspace_member((select auth.uid()), workspace_id)
  );

revoke all on table public.jobs from public, anon, authenticated;
grant select on table public.jobs to authenticated;
grant all    on table public.jobs to service_role;;
