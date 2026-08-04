-- FAILLE : list_waitlist_signups et get_waitlist_signups_30d verifient
-- is_platform_admin(_user_id) ou _user_id est un PARAMETRE fourni par l'appelant,
-- jamais compare a auth.uid(). N'importe quel utilisateur authentifie pouvait
-- passer l'UUID d'un admin plateforme et lire toute la liste d'attente
-- (adresses email des prospects).
-- Correctif : assert_caller(_user_id) AVANT le controle de role, exactement le
-- pattern deja utilise par le reste du code.

do $patch$
declare
  r     record;
  v_def text;
  v_new text;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('list_waitlist_signups','get_waitlist_signups_30d')
  loop
    v_def := pg_get_functiondef(r.oid);

    if position('assert_caller' in v_def) > 0 then
      continue;
    end if;

    -- insere l'appel juste avant le controle de role
    v_new := replace(
      v_def,
      'IF NOT public.is_platform_admin(_user_id) THEN',
      'PERFORM public.assert_caller(_user_id);' || chr(10) ||
      '  IF NOT public.is_platform_admin(_user_id) THEN'
    );

    if v_new = v_def then
      raise notice 'NON PATCHEE : %', r.proname;
    else
      execute v_new;
      raise notice 'patchee : %', r.proname;
    end if;
  end loop;
end
$patch$;;
