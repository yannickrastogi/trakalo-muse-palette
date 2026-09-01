-- LOT 0 (3/3) : search_path fige + FK workspaces en CASCADE — audit 24 aout 2026

DO $drop$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proconfig IS NULL
      AND (
        p.proname LIKE '%\_legacy\_v0'
        OR p.proname IN (
          'auto_create_alias_from_stage_name','check_rate_limit','cleanup_rate_limits',
          'delete_track_version','delete_workspace','get_contacts_engagement',
          'get_track_rating_stats','handle_user_updated','is_email_whitelisted',
          'search_marketplace_tracks','set_track_marketplace_public',
          'update_track_documents_updated_at'
        )
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, auth, extensions', r.sig);
    RAISE NOTICE 'search_path fige sur %', r.sig;
  END LOOP;
END
$drop$;

DO $drop$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname, con.conrelid::regclass::text AS child, a.attname AS col
    FROM pg_constraint con
    JOIN pg_namespace n ON n.oid = con.connamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND n.nspname = 'public'
      AND con.confrelid = 'public.workspaces'::regclass
      AND con.confdeltype <> 'c'
      AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.child, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.workspaces(id) ON DELETE CASCADE', r.child, r.conname, r.col);
    RAISE NOTICE 'FK % sur % (%) -> CASCADE', r.conname, r.child, r.col;
  END LOOP;
END
$drop$;

NOTIFY pgrst, 'reload schema';
