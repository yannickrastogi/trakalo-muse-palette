-- 1. Persist the resolved leaker IP + its source on each trace.
alter table public.leak_traces
  add column if not exists leaker_ip text,
  add column if not exists ip_source text;

-- 2. Secure delete: workspace-admin only, anti-spoofing via assert_caller.
do $drop$
declare r record;
begin
  for r in select oid::regprocedure as sig from pg_proc
           where proname = 'delete_leak_trace' and pronamespace = 'public'::regnamespace
  loop
    execute 'DROP FUNCTION IF EXISTS ' || r.sig::text || ' CASCADE';
  end loop;
end $drop$;

create or replace function public.delete_leak_trace(_trace_id uuid, _user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $func$
declare
  _wid uuid;
  _deleted integer;
begin
  perform public.assert_caller(_user_id);

  select workspace_id into _wid from public.leak_traces where id = _trace_id;
  if _wid is null then
    raise exception 'Leak trace not found or access denied';
  end if;

  perform public.require_workspace_access_level(_user_id, _wid, 'admin');

  delete from public.leak_traces where id = _trace_id;
  get diagnostics _deleted = row_count;
  if _deleted = 0 then
    raise exception 'Leak trace not found or access denied';
  end if;

  return true;
end;
$func$;

-- 3. Lock down execution: authenticated only.
revoke all on function public.delete_leak_trace(uuid, uuid) from public, anon;
grant execute on function public.delete_leak_trace(uuid, uuid) to authenticated;;
