
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  user_slug text;
  user_name text;
begin
  user_name := split_part(new.email, '@', 1);
  user_slug := lower(regexp_replace(user_name, '[^a-z0-9]', '-', 'gi')) || '-' || substr(new.id::text, 1, 8);

  insert into public.workspaces (id, name, slug, owner_id, plan, settings)
  values (
    gen_random_uuid(),
    user_name || '''s Workspace',
    user_slug,
    new.id,
    'free',
    '{"defaultLanguage":"en","allowPublicLinks":true,"requireApproval":false,"maxMembers":5,"storageQuotaMB":2048}'::jsonb
  )
  returning id into ws_id;

  insert into public.workspace_members (user_id, workspace_id)
  values (new.id, ws_id);

  insert into public.user_roles (user_id, workspace_id, role)
  values (new.id, ws_id, 'admin');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
