# TRAKALOG — Supabase RLS Policy Reference

> Ce document décrit les politiques Row Level Security (RLS) à appliquer sur chaque table Supabase.
> Toutes les règles reposent sur l'appartenance au workspace via `workspace_members` et le rôle via `user_roles`.

---

## Prérequis : tables système

### 1. `workspace_members` — Lien utilisateur ↔ workspace

```sql
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique (workspace_id, user_id)
);
alter table public.workspace_members enable row level security;
```

### 2. `user_roles` — Rôles par workspace

```sql
create type public.app_role as enum (
  'admin','manager','a_r','assistant','producer',
  'songwriter','musician','mix_engineer','mastering_engineer',
  'publisher','viewer'
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, workspace_id, role)
);
alter table public.user_roles enable row level security;
```

### 3. Fonctions helper (SECURITY DEFINER)

```sql
-- Vérifie si l'utilisateur est membre du workspace
create or replace function public.is_workspace_member(_user_id uuid, _workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = _user_id and workspace_id = _workspace_id
  );
$$;

-- Vérifie si l'utilisateur a un rôle spécifique dans le workspace
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

-- Vérifie si l'utilisateur a un rôle parmi une liste
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
```

### Constantes de rôles utilisées ci-dessous

| Alias           | Rôles inclus                                                        |
| --------------- | ------------------------------------------------------------------- |
| `WRITE_ROLES`   | `admin, manager, a_r, assistant, publisher`                         |
| `CREATOR_ROLES` | `admin, manager, a_r, assistant, producer, songwriter, musician, mix_engineer, mastering_engineer, publisher` |
| `ALL_ROLES`     | tous les rôles (= membre du workspace)                              |
| `ADMIN_ONLY`    | `admin`                                                             |

---

## Table : `workspaces`

```sql
alter table public.workspaces enable row level security;

-- SELECT : tout membre peut voir son workspace
create policy "Members can view their workspace"
on public.workspaces for select to authenticated
using (public.is_workspace_member(auth.uid(), id));

-- INSERT : tout utilisateur authentifié peut créer un workspace
create policy "Authenticated users can create workspaces"
on public.workspaces for insert to authenticated
with check (owner_id = auth.uid());

-- UPDATE : admin uniquement
create policy "Admins can update workspace"
on public.workspaces for update to authenticated
using (public.has_workspace_role(auth.uid(), id, 'admin'))
with check (public.has_workspace_role(auth.uid(), id, 'admin'));

-- DELETE : owner uniquement (vérifié via owner_id)
create policy "Owner can delete workspace"
on public.workspaces for delete to authenticated
using (owner_id = auth.uid());
```

---

## Table : `tracks`

> Chaque track a un `workspace_id` et un `uploaded_by` (user_id du créateur).

```sql
alter table public.tracks enable row level security;

-- SELECT : tout membre du workspace
create policy "Members can view tracks"
on public.tracks for select to authenticated
using (public.is_workspace_member(auth.uid(), workspace_id));

-- INSERT : CREATOR_ROLES
create policy "Creators can upload tracks"
on public.tracks for insert to authenticated
with check (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    array['admin','manager','a_r','assistant','producer','songwriter',
          'musician','mix_engineer','mastering_engineer','publisher']::app_role[])
  and uploaded_by = auth.uid()
);

-- UPDATE : admin/manager/a_r/assistant/publisher → toutes les tracks
--          producer/songwriter/etc. → uniquement leurs propres tracks
create policy "Write roles can edit all tracks"
on public.tracks for update to authenticated
using (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    array['admin','manager','a_r','assistant','publisher']::app_role[])
);

create policy "Creators can edit own tracks"
on public.tracks for update to authenticated
using (
  uploaded_by = auth.uid()
  and public.is_workspace_member(auth.uid(), workspace_id)
);

-- DELETE : admin uniquement
create policy "Admins can delete tracks"
on public.tracks for delete to authenticated
using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
```

---

## Table : `playlists`

> `workspace_id`, `created_by` (user_id).

```sql
alter table public.playlists enable row level security;

-- SELECT : tout membre
create policy "Members can view playlists"
on public.playlists for select to authenticated
using (public.is_workspace_member(auth.uid(), workspace_id));

-- INSERT : WRITE_ROLES
create policy "Write roles can create playlists"
on public.playlists for insert to authenticated
with check (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    array['admin','manager','a_r','assistant','publisher']::app_role[])
  and created_by = auth.uid()
);

-- UPDATE : WRITE_ROLES
create policy "Write roles can edit playlists"
on public.playlists for update to authenticated
using (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    array['admin','manager','a_r','assistant','publisher']::app_role[])
);

-- DELETE : admin uniquement
create policy "Admins can delete playlists"
on public.playlists for delete to authenticated
using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
```

---

## Table : `contacts`

```sql
alter table public.contacts enable row level security;

-- SELECT : tout membre
create policy "Members can view contacts"
on public.contacts for select to authenticated
using (public.is_workspace_member(auth.uid(), workspace_id));

-- INSERT : WRITE_ROLES
create policy "Write roles can create contacts"
on public.contacts for insert to authenticated
with check (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    array['admin','manager','a_r','assistant','publisher']::app_role[])
);

-- UPDATE : WRITE_ROLES
create policy "Write roles can edit contacts"
on public.contacts for update to authenticated
using (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    array['admin','manager','a_r','assistant','publisher']::app_role[])
);

-- DELETE : admin uniquement
create policy "Admins can delete contacts"
on public.contacts for delete to authenticated
using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
```

---

## Table : `pitches`

```sql
alter table public.pitches enable row level security;

-- SELECT : tout membre
create policy "Members can view pitches"
on public.pitches for select to authenticated
using (public.is_workspace_member(auth.uid(), workspace_id));

-- INSERT : WRITE_ROLES
create policy "Write roles can create pitches"
on public.pitches for insert to authenticated
with check (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    array['admin','manager','a_r','assistant','publisher']::app_role[])
  and sent_by = auth.uid()
);

-- UPDATE : WRITE_ROLES
create policy "Write roles can update pitches"
on public.pitches for update to authenticated
using (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    array['admin','manager','a_r','assistant','publisher']::app_role[])
);

-- DELETE : admin uniquement
create policy "Admins can delete pitches"
on public.pitches for delete to authenticated
using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
```

---

## Table : `stems`

> `workspace_id`, `track_id` (FK → tracks), `uploaded_by`.

```sql
alter table public.stems enable row level security;

-- SELECT : tout membre
create policy "Members can view stems"
on public.stems for select to authenticated
using (public.is_workspace_member(auth.uid(), workspace_id));

-- INSERT : CREATOR_ROLES (ceux qui peuvent upload)
create policy "Creators can upload stems"
on public.stems for insert to authenticated
with check (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    array['admin','manager','a_r','assistant','producer','songwriter',
          'musician','mix_engineer','mastering_engineer','publisher']::app_role[])
  and uploaded_by = auth.uid()
);

-- UPDATE : WRITE_ROLES + propriétaire du stem
create policy "Write roles can edit stems"
on public.stems for update to authenticated
using (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    array['admin','manager','a_r','assistant','publisher']::app_role[])
);

create policy "Creators can edit own stems"
on public.stems for update to authenticated
using (
  uploaded_by = auth.uid()
  and public.is_workspace_member(auth.uid(), workspace_id)
);

-- DELETE : admin uniquement
create policy "Admins can delete stems"
on public.stems for delete to authenticated
using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
```

---

## Table : `shared_links`

```sql
alter table public.shared_links enable row level security;

-- SELECT : tout membre
create policy "Members can view shared links"
on public.shared_links for select to authenticated
using (public.is_workspace_member(auth.uid(), workspace_id));

-- INSERT : WRITE_ROLES
create policy "Write roles can create shared links"
on public.shared_links for insert to authenticated
with check (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    array['admin','manager','a_r','assistant','publisher']::app_role[])
  and created_by = auth.uid()
);

-- UPDATE : WRITE_ROLES
create policy "Write roles can update shared links"
on public.shared_links for update to authenticated
using (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    array['admin','manager','a_r','assistant','publisher']::app_role[])
);

-- DELETE : admin + créateur du lien
create policy "Admins can delete shared links"
on public.shared_links for delete to authenticated
using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Creators can delete own shared links"
on public.shared_links for delete to authenticated
using (
  created_by = auth.uid()
  and public.is_workspace_member(auth.uid(), workspace_id)
);
```

---

## Table : `team_members` (workspace_members)

```sql
-- SELECT : tout membre du même workspace
create policy "Members can view team"
on public.workspace_members for select to authenticated
using (public.is_workspace_member(auth.uid(), workspace_id));

-- INSERT : admin uniquement peut inviter
create policy "Admins can invite members"
on public.workspace_members for insert to authenticated
with check (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- UPDATE : admin uniquement (ex : changer le statut)
create policy "Admins can update members"
on public.workspace_members for update to authenticated
using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- DELETE : admin peut retirer, un membre peut se retirer lui-même
create policy "Admins can remove members"
on public.workspace_members for delete to authenticated
using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Members can leave workspace"
on public.workspace_members for delete to authenticated
using (user_id = auth.uid());
```

---

## Table : `user_roles`

```sql
-- SELECT : un utilisateur peut voir ses propres rôles
create policy "Users can view own roles"
on public.user_roles for select to authenticated
using (user_id = auth.uid());

-- Admins peuvent voir les rôles du workspace
create policy "Admins can view workspace roles"
on public.user_roles for select to authenticated
using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- INSERT / UPDATE / DELETE : admin uniquement
create policy "Admins can manage roles"
on public.user_roles for all to authenticated
using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'))
with check (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
```

---

## Résumé des permissions par rôle

| Action                  | Admin | Manager/A&R/Assistant/Publisher | Producer/Songwriter/Musician/Engineers | Viewer |
| ----------------------- | :---: | :-----------------------------: | :------------------------------------: | :----: |
| SELECT (toutes tables)  |  ✅   |               ✅                |                   ✅                   |   ✅   |
| INSERT tracks/stems     |  ✅   |               ✅                |            ✅ (own only)               |   ❌   |
| INSERT playlists/pitches|  ✅   |               ✅                |                   ❌                   |   ❌   |
| UPDATE all tracks       |  ✅   |               ✅                |                   ❌                   |   ❌   |
| UPDATE own tracks       |  ✅   |               ✅                |                   ✅                   |   ❌   |
| DELETE                  |  ✅   |               ❌                |                   ❌                   |   ❌   |
| Manage team / roles     |  ✅   |               ❌                |                   ❌                   |   ❌   |
| Workspace settings      |  ✅   |               ❌                |                   ❌                   |   ❌   |

---

## Notes d'implémentation

1. **SECURITY DEFINER** sur les fonctions helper évite les boucles RLS récursives.
2. Toujours utiliser `auth.uid()` — jamais de vérification côté client (localStorage).
3. Les `viewer` ont un accès **lecture seule** sur toutes les tables du workspace.
4. Le `owner_id` du workspace est le seul à pouvoir **supprimer** le workspace.
5. Lors de la migration Supabase, activer RLS **avant** d'insérer des données.
