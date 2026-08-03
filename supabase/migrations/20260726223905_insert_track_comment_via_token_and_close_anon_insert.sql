-- Token-gated anonymous comment INSERT, mirroring the existing
-- update_track_comment_via_token / delete_track_comment_via_token pattern.
--
-- Before: SharedStemAccess did a direct anon INSERT into track_comments, gated
-- only by the track_comments_anon_insert RLS policy. That policy's WITH CHECK
-- validates the link via an EXISTS on shared_links, but anon has no SELECT
-- policy on shared_links, so the subquery is always empty -> the insert was in
-- fact silently rejected (broken flow), and the policy is a latent hole: if an
-- anon SELECT policy on shared_links were ever added, inserts would become
-- possible with only the internal shared_link_id UUID, WITHOUT proving
-- possession of the link slug (the real secret used by edit/delete).
--
-- After: the only anon INSERT path is this SECURITY DEFINER RPC (or the
-- add-track-comment Edge Function, which uses the service role). Both require
-- the link slug and validate: (a) link exists, is active, not expired; (b) the
-- commented track belongs to THIS link (directly or via its playlist).

-- Drop any pre-existing overloads before recreate (PostgreSQL keys functions by
-- arg types; guards against signature drift).
do $drop$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'insert_track_comment_via_token'
  loop
    execute 'drop function ' || r.sig;
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
)
returns public.track_comments
language plpgsql
security definer
set search_path to 'public'
as $func$
declare
  v_link    shared_links%rowtype;
  v_row     track_comments%rowtype;
  v_name    text;
  v_email   text;
  v_content text;
  v_ts      numeric;
begin
  -- Bound + normalize inputs (defense in depth; the client/EF also cap these).
  v_content := left(btrim(coalesce(_content, '')), 2000);
  if v_content = '' then
    raise exception 'content is required' using errcode = 'check_violation';
  end if;

  v_name := left(btrim(coalesce(_author_name, '')), 200);
  if v_name = '' then
    v_name := 'Anonymous';
  end if;

  v_email := nullif(left(btrim(coalesce(_author_email, '')), 254), '');

  v_ts := case
            when _timestamp_sec is not null and _timestamp_sec >= 0
              then round(_timestamp_sec, 2)
            else 0
          end;

  -- (a) link exists, active, NOT expired  AND  (b) track belongs to THIS link.
  -- status alone is insufficient: expiry is not auto-flipped onto status, so we
  -- must check expires_at explicitly.
  select sl.* into v_link
  from shared_links sl
  where sl.link_slug = _shared_link_token
    and sl.status = 'active'::link_status
    and (sl.expires_at is null or sl.expires_at > now())
    and (
      sl.track_id = _track_id
      or exists (
        select 1 from playlist_tracks pt
        where pt.playlist_id = sl.playlist_id
          and pt.track_id = _track_id
      )
    )
  limit 1;

  if v_link.id is null then
    raise exception 'Invalid or expired share link for this track'
      using errcode = 'insufficient_privilege';
  end if;

  insert into track_comments
    (track_id, shared_link_id, author_name, author_email, author_type, timestamp_sec, content)
  values
    (_track_id, v_link.id, v_name, v_email, 'recipient', v_ts, v_content)
  returning * into v_row;

  return v_row;
end
$func$;

-- Lock down EXECUTE, then mirror the grants of the sibling *_via_token RPCs.
revoke all on function public.insert_track_comment_via_token(uuid, text, text, text, text, numeric) from public;
grant execute on function public.insert_track_comment_via_token(uuid, text, text, text, text, numeric)
  to anon, authenticated, service_role;

-- Remove the dead/latent anon INSERT policy: all anon inserts now flow through
-- the token-validated RPC or the service-role Edge Function. Authenticated
-- member inserts (track_comments_insert_members) are untouched.
drop policy if exists track_comments_anon_insert on public.track_comments;;
