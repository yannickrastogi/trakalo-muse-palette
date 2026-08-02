-- RPC to create a workspace with member + role in a single transaction
-- This bypasses the chicken-and-egg RLS problem where workspace_members
-- insert requires admin role, but the user isn't a member yet.

create or replace function public.create_workspace_with_member(
  _name text,
  _description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  ws_slug text;
begin
  ws_slug := lower(regexp_replace(_name, '[^a-z0-9]', '-', 'gi')) || '-' || substr(gen_random_uuid()::text, 1, 8);

  insert into public.workspaces (id, name, slug, owner_id, plan, settings)
  values (
    gen_random_uuid(),
    _name,
    ws_slug,
    auth.uid(),
    'free',
    '{"defaultLanguage":"en","allowPublicLinks":true,"requireApproval":false,"maxMembers":5,"storageQuotaMB":2048}'::jsonb
  )
  returning id into ws_id;

  insert into public.workspace_members (user_id, workspace_id)
  values (auth.uid(), ws_id);

  insert into public.user_roles (user_id, workspace_id, role)
  values (auth.uid(), ws_id, 'admin');

  return ws_id;
end;
$$;
