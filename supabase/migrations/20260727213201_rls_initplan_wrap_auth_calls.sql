do $fix$
declare
  r        record;
  v_qual   text;
  v_check  text;
  v_sql    text;
  v_count  int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        qual       like '%auth.uid()%' or with_check like '%auth.uid()%'
        or qual    like '%auth.role()%' or with_check like '%auth.role()%'
      )
  loop
    v_qual  := r.qual;
    v_check := r.with_check;

    -- On protege ce qui est deja enveloppe, on enveloppe le reste, on restaure.
    if v_qual is not null then
      v_qual := replace(v_qual, '( SELECT auth.uid() AS uid)',   '@@UIDOK@@');
      v_qual := replace(v_qual, '( SELECT auth.role() AS role)', '@@ROLEOK@@');
      v_qual := replace(v_qual, 'auth.uid()',  '(select auth.uid())');
      v_qual := replace(v_qual, 'auth.role()', '(select auth.role())');
      v_qual := replace(v_qual, '@@UIDOK@@',  '( SELECT auth.uid() AS uid)');
      v_qual := replace(v_qual, '@@ROLEOK@@', '( SELECT auth.role() AS role)');
    end if;

    if v_check is not null then
      v_check := replace(v_check, '( SELECT auth.uid() AS uid)',   '@@UIDOK@@');
      v_check := replace(v_check, '( SELECT auth.role() AS role)', '@@ROLEOK@@');
      v_check := replace(v_check, 'auth.uid()',  '(select auth.uid())');
      v_check := replace(v_check, 'auth.role()', '(select auth.role())');
      v_check := replace(v_check, '@@UIDOK@@',  '( SELECT auth.uid() AS uid)');
      v_check := replace(v_check, '@@ROLEOK@@', '( SELECT auth.role() AS role)');
    end if;

    -- Rien a faire si la substitution n'a rien change
    if v_qual is not distinct from r.qual
       and v_check is not distinct from r.with_check then
      continue;
    end if;

    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if v_qual is not null then
      v_sql := v_sql || format(' using (%s)', v_qual);
    end if;
    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;

    execute v_sql;
    v_count := v_count + 1;
  end loop;

  raise notice 'Policies RLS optimisees : %', v_count;
end
$fix$;;
