-- Garde unique : refuse l'acces aux donnees d'un lien protege sans session verifiee.
-- Le jeton arrive par l'en-tete HTTP x-shared-link-session (PostgREST l'expose via
-- request.headers). service_role passe outre : les Edge Functions sont de confiance.

create or replace function public.assert_shared_link_access(_link_id uuid)
returns void
language plpgsql security definer set search_path = public
as $func$
declare
  v_token text;
begin
  if _link_id is null then
    return;
  end if;

  -- Appel serveur de confiance
  if auth.role() = 'service_role' then
    return;
  end if;

  -- Lien sans mot de passe : rien a verifier
  if not public.shared_link_is_secured(_link_id) then
    return;
  end if;

  begin
    v_token := current_setting('request.headers', true)::json ->> 'x-shared-link-session';
  exception when others then
    v_token := null;
  end;

  if not public.verify_shared_link_session(_link_id, v_token) then
    raise exception 'password required for this link'
      using errcode = 'insufficient_privilege';
  end if;
end
$func$;

create or replace function public.assert_shared_link_access_by_slug(_slug text)
returns void
language plpgsql security definer set search_path = public
as $func$
declare v_id uuid;
begin
  select sl.id into v_id from shared_links sl where sl.link_slug = _slug limit 1;
  perform public.assert_shared_link_access(v_id);
end
$func$;

revoke execute on function public.assert_shared_link_access(uuid)      from public, anon, authenticated;
revoke execute on function public.assert_shared_link_access_by_slug(text) from public, anon, authenticated;
grant  execute on function public.assert_shared_link_access(uuid)      to service_role;
grant  execute on function public.assert_shared_link_access_by_slug(text) to service_role;

-- Insertion chirurgicale du garde dans les 3 fonctions, sans toucher a leur
-- signature ni a leur corps : on recupere la definition exacte et on insere
-- l'appel juste apres le premier BEGIN.
do $patch$
declare
  r        record;
  v_def    text;
  v_guard  text;
  v_new    text;
begin
  for r in
    select p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_tracks_for_shared_link',
                        'get_track_for_shared_link',
                        'get_playlist_tracks_for_shared_link')
  loop
    v_def := pg_get_functiondef(r.oid);

    -- deja patchee ?
    if position('assert_shared_link_access' in v_def) > 0 then
      continue;
    end if;

    if r.args like '%uuid%' then
      v_guard := '  PERFORM public.assert_shared_link_access(_link_id);';
    else
      v_guard := '  PERFORM public.assert_shared_link_access_by_slug(_slug);';
    end if;

    -- insere apres le premier BEGIN en debut de ligne
    v_new := regexp_replace(v_def, '(\mBEGIN\M)', 'BEGIN' || chr(10) || v_guard, 'i');

    if v_new = v_def then
      raise notice 'Impossible de patcher % (BEGIN introuvable)', r.proname;
    else
      execute v_new;
      raise notice 'Patchee : %', r.proname;
    end if;
  end loop;
end
$patch$;;
