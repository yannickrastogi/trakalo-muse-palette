-- Second bug du meme trigger : il insere `role` et `status` dans
-- workspace_members, colonnes disparues lors de la migration vers access_level.
-- La table n'a plus que : workspace_id, user_id, joined_at, access_level,
-- professional_title.

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

  base_slug := lower(public.unaccent_safe(user_name || '''s Workspace'));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := btrim(base_slug, '-');
  base_slug := left(nullif(base_slug, ''), 40);
  base_slug := COALESCE(base_slug, 'workspace');

  FOR i IN 1..5 LOOP
    final_slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.slug = final_slug);
  END LOOP;

  INSERT INTO public.workspaces (name, slug, owner_id, is_personal)
  VALUES (user_name || '''s Workspace', final_slug, NEW.id, true)
  RETURNING id INTO workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, access_level)
  VALUES (workspace_id, NEW.id, 'admin');

  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  RETURN NEW;
END;
$func$;;
