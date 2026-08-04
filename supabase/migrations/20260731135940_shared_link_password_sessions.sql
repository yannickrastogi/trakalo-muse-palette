-- ============================================================
-- Preuve serveur de verification du mot de passe d'un lien partage.
-- Aujourd'hui verify-link-password renvoie {valid:true} et le front met un flag
-- React : le mot de passe n'est donc qu'un voile visuel, les donnees sont deja
-- chargees. Ce mecanisme fournit une preuve verifiable cote serveur.
-- ETAPE ADDITIVE : rien ne l'exige encore, aucun impact sur l'existant.
-- ============================================================

create table if not exists public.shared_link_sessions (
  id          uuid primary key default gen_random_uuid(),
  link_id     uuid not null references public.shared_links(id) on delete cascade,
  token_hash  text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

comment on table public.shared_link_sessions is
  'Sessions emises apres verification reussie du mot de passe d''un lien protege. Seul le hash du jeton est stocke.';

create unique index if not exists idx_sls_token_hash on public.shared_link_sessions (token_hash);
create index if not exists idx_sls_link           on public.shared_link_sessions (link_id, expires_at desc);

alter table public.shared_link_sessions enable row level security;
revoke all on table public.shared_link_sessions from public, anon, authenticated;
grant  all on table public.shared_link_sessions to service_role;

-- Emet une session apres verification reussie. Appelee par l'Edge Function
-- verify-link-password, jamais par le client.
create or replace function public.create_shared_link_session(
  _link_id uuid,
  _ttl_hours int default 12
) returns text
language plpgsql security definer set search_path = public
as $func$
declare
  v_token text;
  v_ok    boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  -- Le lien doit exister, etre actif et non expire.
  select true into v_ok
  from shared_links sl
  where sl.id = _link_id
    and sl.status = 'active'::link_status
    and (sl.expires_at is null or sl.expires_at > now())
  limit 1;

  if not coalesce(v_ok, false) then
    raise exception 'invalid link' using errcode = 'insufficient_privilege';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into shared_link_sessions (link_id, token_hash, expires_at)
  values (_link_id,
          encode(sha256(v_token::bytea), 'hex'),
          now() + make_interval(hours => greatest(1, least(72, coalesce(_ttl_hours, 12)))));

  -- Menage opportuniste des sessions expirees de ce lien.
  delete from shared_link_sessions
  where link_id = _link_id and expires_at < now() - interval '1 day';

  return v_token;
end
$func$;

-- Verifie une session. Destinee a etre appelee DEPUIS d'autres fonctions
-- SECURITY DEFINER (qui s'executent avec les droits du proprietaire),
-- jamais directement par un client.
create or replace function public.verify_shared_link_session(
  _link_id uuid,
  _token   text
) returns boolean
language sql security definer set search_path = public
stable
as $func$
  select exists (
    select 1 from shared_link_sessions s
    where s.link_id = _link_id
      and s.expires_at > now()
      and s.token_hash = encode(sha256(coalesce(_token, '')::bytea), 'hex')
      and coalesce(_token, '') <> ''
  );
$func$;

-- Indique si un lien exige un mot de passe. Sans danger : le front l'apprend
-- deja via has_password.
create or replace function public.shared_link_is_secured(
  _link_id uuid
) returns boolean
language sql security definer set search_path = public
stable
as $func$
  select coalesce((select sl.password_hash is not null
                   from shared_links sl where sl.id = _link_id), false);
$func$;

revoke execute on function public.create_shared_link_session(uuid,int) from public, anon, authenticated;
revoke execute on function public.verify_shared_link_session(uuid,text) from public, anon, authenticated;
revoke execute on function public.shared_link_is_secured(uuid)          from public, anon, authenticated;

grant execute on function public.create_shared_link_session(uuid,int)   to service_role;
grant execute on function public.verify_shared_link_session(uuid,text)  to service_role;
grant execute on function public.shared_link_is_secured(uuid)           to service_role;;
