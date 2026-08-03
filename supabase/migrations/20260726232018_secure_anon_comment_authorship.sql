alter table public.track_comments
  add column if not exists author_secret_hash text;

do $drop$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('insert_track_comment_via_token',
                        'update_track_comment_via_token',
                        'delete_track_comment_via_token',
                        'get_track_comments')
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end
$drop$;

create function public.insert_track_comment_via_token(
  _track_id uuid,
  _shared_link_token text,
  _content text,
  _author_name text default null,
  _author_email text default null,
  _timestamp_sec numeric default 0
) returns jsonb
language plpgsql security definer set search_path = public
as $func$
declare
  v_link    shared_links%rowtype;
  v_row     track_comments%rowtype;
  v_name    text;
  v_email   text;
  v_content text;
  v_ts      numeric;
  v_secret  text;
begin
  v_content := left(btrim(coalesce(_content, '')), 2000);
  if v_content = '' then
    raise exception 'content is required' using errcode = 'check_violation';
  end if;

  v_name := left(btrim(coalesce(_author_name, '')), 200);
  if v_name = '' then v_name := 'Anonymous'; end if;

  v_email := nullif(left(btrim(coalesce(_author_email, '')), 254), '');

  v_ts := case when _timestamp_sec is not null and _timestamp_sec >= 0
               then round(_timestamp_sec, 2) else 0 end;

  select sl.* into v_link
  from shared_links sl
  where sl.link_slug = _shared_link_token
    and sl.status = 'active'::link_status
    and (sl.expires_at is null or sl.expires_at > now())
    and (sl.track_id = _track_id
         or exists (select 1 from playlist_tracks pt
                    where pt.playlist_id = sl.playlist_id
                      and pt.track_id = _track_id))
  limit 1;

  if v_link.id is null then
    raise exception 'Invalid or expired share link for this track'
      using errcode = 'insufficient_privilege';
  end if;

  v_secret := replace(gen_random_uuid()::text, '-', '')
           || replace(gen_random_uuid()::text, '-', '');

  insert into track_comments
    (track_id, shared_link_id, author_name, author_email, author_type,
     timestamp_sec, content, author_secret_hash)
  values
    (_track_id, v_link.id, v_name, v_email, 'recipient', v_ts, v_content,
     encode(sha256(v_secret::bytea), 'hex'))
  returning * into v_row;

  return jsonb_build_object(
    'id',             v_row.id,
    'track_id',       v_row.track_id,
    'shared_link_id', v_row.shared_link_id,
    'author_name',    v_row.author_name,
    'author_type',    v_row.author_type,
    'timestamp_sec',  v_row.timestamp_sec,
    'content',        v_row.content,
    'created_at',     v_row.created_at,
    'updated_at',     v_row.updated_at,
    'is_edited',      v_row.is_edited,
    'is_own',         true,
    'author_secret',  v_secret
  );
end
$func$;

create function public.update_track_comment_via_token(
  _comment_id uuid,
  _shared_link_token text,
  _new_content text,
  _author_secret text
) returns boolean
language plpgsql security definer set search_path = public
as $func$
declare
  v_content text;
  v_n       int;
begin
  v_content := left(btrim(coalesce(_new_content, '')), 2000);
  if v_content = '' then
    raise exception 'content is required' using errcode = 'check_violation';
  end if;
  if coalesce(_author_secret, '') = '' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  update track_comments tc
     set content = v_content, updated_at = now(), is_edited = true
   where tc.id = _comment_id
     and tc.author_secret_hash is not null
     and tc.author_secret_hash = encode(sha256(_author_secret::bytea), 'hex')
     and exists (
       select 1 from shared_links sl
       where sl.link_slug = _shared_link_token
         and sl.status = 'active'::link_status
         and (sl.expires_at is null or sl.expires_at > now())
         and tc.shared_link_id = sl.id
     );

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  return true;
end
$func$;

create function public.delete_track_comment_via_token(
  _comment_id uuid,
  _shared_link_token text,
  _author_secret text
) returns boolean
language plpgsql security definer set search_path = public
as $func$
declare v_n int;
begin
  if coalesce(_author_secret, '') = '' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  delete from track_comments tc
   where tc.id = _comment_id
     and tc.author_secret_hash is not null
     and tc.author_secret_hash = encode(sha256(_author_secret::bytea), 'hex')
     and exists (
       select 1 from shared_links sl
       where sl.link_slug = _shared_link_token
         and sl.status = 'active'::link_status
         and (sl.expires_at is null or sl.expires_at > now())
         and tc.shared_link_id = sl.id
     );

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  return true;
end
$func$;

create function public.get_track_comments(
  _track_id uuid,
  _workspace_id uuid default null
) returns setof track_comments
language plpgsql security definer set search_path = public
as $func$
declare
  v_uid uuid := auth.uid();
  v_row track_comments%rowtype;
begin
  if auth.role() <> 'service_role' then
    if v_uid is null
       or _workspace_id is null
       or not public.is_workspace_member(v_uid, _workspace_id) then
      return;
    end if;
  end if;

  for v_row in
    select tc.* from track_comments tc
    where tc.track_id = _track_id
      and (
        (tc.shared_link_id is null and (_workspace_id is null or tc.workspace_id = _workspace_id))
        or (tc.shared_link_id is not null and (
              _workspace_id is null
              or exists (select 1 from shared_links sl
                         where sl.id = tc.shared_link_id
                           and sl.workspace_id = _workspace_id)))
      )
    order by tc.created_at desc
  loop
    v_row.author_secret_hash := null;
    return next v_row;
  end loop;
end
$func$;

grant execute on function public.insert_track_comment_via_token(uuid,text,text,text,text,numeric) to anon, authenticated;
grant execute on function public.update_track_comment_via_token(uuid,text,text,text)              to anon, authenticated;
grant execute on function public.delete_track_comment_via_token(uuid,text,text)                   to anon, authenticated;
grant execute on function public.get_track_comments(uuid,uuid)                                    to authenticated, service_role;

revoke execute on function public.add_track_comment(uuid,text,text,text,numeric,text,uuid) from anon;;
