-- ═══════════════════════════════════════════════════════
-- TRAKALOG — Foundation: ENUMs, tables, helpers, RLS
-- ═══════════════════════════════════════════════════════

-- 1. ENUM: app_role
create type public.app_role as enum (
  'admin','manager','a_r','assistant','producer',
  'songwriter','musician','mix_engineer','mastering_engineer',
  'publisher','viewer'
);

-- 2. Table: workspaces
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  owner_id    uuid references auth.users(id) on delete cascade not null,
  plan        text not null default 'free' check (plan in ('free','pro','enterprise')),
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.workspaces enable row level security;

-- 3. Table: workspace_members
create table public.workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  joined_at     timestamptz not null default now(),
  unique (workspace_id, user_id)
);
alter table public.workspace_members enable row level security;

-- 4. Table: user_roles
create table public.user_roles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  workspace_id  uuid references public.workspaces(id) on delete cascade not null,
  role          app_role not null,
  unique (user_id, workspace_id, role)
);
alter table public.user_roles enable row level security;

-- 5. Indexes
create index idx_workspace_members_ws on public.workspace_members(workspace_id);
create index idx_workspace_members_user on public.workspace_members(user_id);
create index idx_user_roles_ws on public.user_roles(workspace_id);
create index idx_user_roles_user on public.user_roles(user_id);

-- 6. updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger update_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════
-- 7. SECURITY DEFINER helper functions
-- ═══════════════════════════════════════════════════════

create or replace function public.is_workspace_member(_user_id uuid, _workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = _user_id and workspace_id = _workspace_id
  );
$$;

create or replace function public.has_workspace_role(
  _user_id uuid, _workspace_id uuid, _role app_role
)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and workspace_id = _workspace_id
      and role = _role
  );
$$;

create or replace function public.has_any_workspace_role(
  _user_id uuid, _workspace_id uuid, _roles app_role[]
)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and workspace_id = _workspace_id
      and role = any(_roles)
  );
$$;

-- ═══════════════════════════════════════════════════════
-- 8. RLS Policies: workspaces
-- ═══════════════════════════════════════════════════════

create policy "Members can view their workspace"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(auth.uid(), id));

create policy "Authenticated users can create workspaces"
  on public.workspaces for insert to authenticated
  with check (owner_id = auth.uid());

create policy "Admins can update workspace"
  on public.workspaces for update to authenticated
  using (public.has_workspace_role(auth.uid(), id, 'admin'))
  with check (public.has_workspace_role(auth.uid(), id, 'admin'));

create policy "Owner can delete workspace"
  on public.workspaces for delete to authenticated
  using (owner_id = auth.uid());

-- ═══════════════════════════════════════════════════════
-- 9. RLS Policies: workspace_members
-- ═══════════════════════════════════════════════════════

create policy "Members can view team"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Admins can invite members"
  on public.workspace_members for insert to authenticated
  with check (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Admins can update members"
  on public.workspace_members for update to authenticated
  using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Admins can remove members"
  on public.workspace_members for delete to authenticated
  using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Members can leave workspace"
  on public.workspace_members for delete to authenticated
  using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════
-- 10. RLS Policies: user_roles
-- ═══════════════════════════════════════════════════════

create policy "Users can view own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

create policy "Admins can view workspace roles"
  on public.user_roles for select to authenticated
  using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Admins can insert roles"
  on public.user_roles for insert to authenticated
  with check (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Admins can update roles"
  on public.user_roles for update to authenticated
  using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Admins can delete roles"
  on public.user_roles for delete to authenticated
  using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
