-- BUG BLOQUANT : handle_new_user insere dans workspaces sans alimenter `slug`,
-- devenu NOT NULL sans valeur par defaut. Toute inscription echouait avec
-- "Database error saving new user". Convention observee : nom slugifie + suffixe
-- court de 8 caracteres hex pour l'unicite.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $func$
DECLARE
  workspace_id uuid;
  user_name    text;
  base_slug    text;
  final_slug   text;
BEGIN
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (NEW.id, user_name, NEW.email, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    email      = EXCLUDED.email,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);

  -- Slugification : minuscules, accents retires, non-alphanumeriques -> tiret
  base_slug := lower(unaccent_safe(user_name || '''s Workspace'));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := btrim(base_slug, '-');
  base_slug := left(nullif(base_slug, ''), 40);
  base_slug := COALESCE(base_slug, 'workspace');

  -- Suffixe d'unicite, avec quelques tentatives en cas de collision
  FOR i IN 1..5 LOOP
    final_slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.slug = final_slug);
  END LOOP;

  INSERT INTO public.workspaces (name, slug, owner_id, is_personal)
  VALUES (user_name || '''s Workspace', final_slug, NEW.id, true)
  RETURNING id INTO workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, access_level, status)
  VALUES (workspace_id, NEW.id, 'admin', 'admin', 'active');

  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  RETURN NEW;
END;
$func$;

-- Helper : retire les accents sans dependre de l'extension unaccent.
create or replace function public.unaccent_safe(_t text)
returns text
language sql immutable set search_path = public
as $func$
  select translate(
    coalesce(_t, ''),
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'
  );
$func$;;
