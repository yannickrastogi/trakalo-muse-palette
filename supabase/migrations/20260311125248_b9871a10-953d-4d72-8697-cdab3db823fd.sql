-- ═══════════════════════════════════════════════════════
-- TRAKALOG — Tables: shared_links, link_downloads, stems, pitches, notifications, approvals
-- ═══════════════════════════════════════════════════════

-- 1. ENUMs
create type public.pitch_status as enum ('draft', 'sent', 'opened', 'declined', 'accepted');
create type public.stem_type as enum ('kick', 'snare', 'bass', 'guitar', 'vocal', 'synth', 'drums', 'background_vocal', 'fx', 'other');
create type public.share_type as enum ('stems', 'track', 'playlist', 'pack');
create type public.link_status as enum ('active', 'expired', 'disabled');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.notification_type as enum (
  'pitch_opened', 'pitch_accepted', 'pitch_declined',
  'track_uploaded', 'track_status_changed',
  'link_opened', 'link_downloaded',
  'approval_requested', 'approval_resolved',
  'member_invited', 'member_joined',
  'comment_added'
);

-- ═══════════════════════════════════════════════════════
-- 2. Table: shared_links (created before pitches due to FK)
-- ═══════════════════════════════════════════════════════
create table public.shared_links (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid references public.workspaces(id) on delete cascade not null,
  created_by        uuid references auth.users(id) on delete set null,
  share_type        share_type not null,
  track_id          uuid references public.tracks(id) on delete cascade,
  playlist_id       uuid references public.playlists(id) on delete cascade,
  link_name         text not null,
  link_slug         text not null unique,
  link_type         text not null default 'public' check (link_type in ('public','secured')),
  password_hash     text,
  message           text,
  allow_download    boolean not null default false,
  download_quality  text check (download_quality in ('hi-res','low-res')),
  expires_at        timestamptz,
  status            link_status not null default 'active',
  pack_items        jsonb default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.shared_links enable row level security;

create index idx_sl_workspace on public.shared_links(workspace_id);
create index idx_sl_slug on public.shared_links(link_slug);
create index idx_sl_track on public.shared_links(track_id);
create index idx_sl_playlist on public.shared_links(playlist_id);
create index idx_sl_status on public.shared_links(workspace_id, status);

create trigger update_shared_links_updated_at
  before update on public.shared_links
  for each row execute function public.update_updated_at_column();

-- RLS: shared_links
create policy "Members can view shared links"
  on public.shared_links for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Write roles can create shared links"
  on public.shared_links for insert to authenticated
  with check (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
    and created_by = auth.uid()
  );

create policy "Write roles can update shared links"
  on public.shared_links for update to authenticated
  using (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Admins can delete shared links"
  on public.shared_links for delete to authenticated
  using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Creators can delete own shared links"
  on public.shared_links for delete to authenticated
  using (
    created_by = auth.uid()
    and public.is_workspace_member(auth.uid(), workspace_id)
  );

-- ═══════════════════════════════════════════════════════
-- 3. Table: link_downloads
-- ═══════════════════════════════════════════════════════
create table public.link_downloads (
  id                uuid primary key default gen_random_uuid(),
  link_id           uuid references public.shared_links(id) on delete cascade not null,
  downloader_name   text,
  downloader_email  text,
  organization      text,
  role              text,
  track_name        text,
  stems_downloaded  text[] default '{}',
  ip_address        inet,
  user_agent        text,
  downloaded_at     timestamptz not null default now()
);
alter table public.link_downloads enable row level security;

create index idx_ld_link on public.link_downloads(link_id);
create index idx_ld_date on public.link_downloads(downloaded_at desc);

-- RLS: link_downloads (readable by workspace members via join on shared_links)
create policy "Members can view link downloads"
  on public.link_downloads for select to authenticated
  using (
    exists (
      select 1 from public.shared_links sl
      where sl.id = link_id
        and public.is_workspace_member(auth.uid(), sl.workspace_id)
    )
  );

-- Public insert for anonymous downloaders
create policy "Anyone can log a download"
  on public.link_downloads for insert to anon, authenticated
  with check (true);

-- ═══════════════════════════════════════════════════════
-- 4. Table: stems
-- ═══════════════════════════════════════════════════════
create table public.stems (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  track_id        uuid references public.tracks(id) on delete cascade not null,
  uploaded_by     uuid references auth.users(id) on delete set null,
  file_name       text not null,
  stem_type       stem_type not null default 'other',
  file_url        text not null,
  file_size_bytes bigint check (file_size_bytes > 0),
  duration_sec    integer,
  sample_rate     integer,
  bit_depth       smallint,
  created_at      timestamptz not null default now()
);
alter table public.stems enable row level security;

create index idx_stems_workspace on public.stems(workspace_id);
create index idx_stems_track on public.stems(track_id);
create index idx_stems_type on public.stems(track_id, stem_type);

-- RLS: stems
create policy "Members can view stems"
  on public.stems for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Creators can upload stems"
  on public.stems for insert to authenticated
  with check (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','producer','songwriter',
            'musician','mix_engineer','mastering_engineer','publisher']::app_role[])
    and uploaded_by = auth.uid()
  );

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

create policy "Admins can delete stems"
  on public.stems for delete to authenticated
  using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ═══════════════════════════════════════════════════════
-- 5. Table: approvals (before notifications due to FK)
-- ═══════════════════════════════════════════════════════
create table public.approvals (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  track_id        uuid references public.tracks(id) on delete cascade not null,
  requested_by    uuid references auth.users(id) on delete set null,
  reviewed_by     uuid references auth.users(id) on delete set null,
  status          approval_status not null default 'pending',
  requested_at    timestamptz not null default now(),
  reviewed_at     timestamptz,
  review_note     text,
  changes         jsonb not null default '{}'::jsonb
);
alter table public.approvals enable row level security;

create index idx_approvals_workspace on public.approvals(workspace_id);
create index idx_approvals_track on public.approvals(track_id);
create index idx_approvals_status on public.approvals(workspace_id, status);
create index idx_approvals_requested on public.approvals(requested_by);

-- RLS: approvals
create policy "Members can view approvals"
  on public.approvals for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Members can request approvals"
  on public.approvals for insert to authenticated
  with check (
    public.is_workspace_member(auth.uid(), workspace_id)
    and requested_by = auth.uid()
  );

create policy "Admins can update approvals"
  on public.approvals for update to authenticated
  using (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager']::app_role[])
  );

create policy "Admins can delete approvals"
  on public.approvals for delete to authenticated
  using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ═══════════════════════════════════════════════════════
-- 6. Table: pitches
-- ═══════════════════════════════════════════════════════
create table public.pitches (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  sent_by         uuid references auth.users(id) on delete set null,
  contact_id      uuid references public.contacts(id) on delete set null,
  recipient_name  text not null,
  recipient_email text,
  recipient_company text,
  subject         text not null,
  message         text,
  track_ids       uuid[] not null default '{}',
  status          pitch_status not null default 'draft',
  sent_at         timestamptz,
  opened_at       timestamptz,
  responded_at    timestamptz,
  response_note   text,
  share_link_id   uuid references public.shared_links(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.pitches enable row level security;

create index idx_pitches_workspace on public.pitches(workspace_id);
create index idx_pitches_status on public.pitches(workspace_id, status);
create index idx_pitches_sent_by on public.pitches(sent_by);
create index idx_pitches_contact on public.pitches(contact_id);
create index idx_pitches_sent_at on public.pitches(workspace_id, sent_at desc);

create trigger update_pitches_updated_at
  before update on public.pitches
  for each row execute function public.update_updated_at_column();

-- RLS: pitches
create policy "Members can view pitches"
  on public.pitches for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Write roles can create pitches"
  on public.pitches for insert to authenticated
  with check (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
    and sent_by = auth.uid()
  );

create policy "Write roles can update pitches"
  on public.pitches for update to authenticated
  using (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Admins can delete pitches"
  on public.pitches for delete to authenticated
  using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ═══════════════════════════════════════════════════════
-- 7. Table: notifications
-- ═══════════════════════════════════════════════════════
create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade not null,
  type            notification_type not null,
  title           text not null,
  message         text,
  is_read         boolean not null default false,
  track_id        uuid references public.tracks(id) on delete set null,
  pitch_id        uuid references public.pitches(id) on delete set null,
  link_id         uuid references public.shared_links(id) on delete set null,
  approval_id     uuid references public.approvals(id) on delete set null,
  created_at      timestamptz not null default now()
);
alter table public.notifications enable row level security;

create index idx_notif_user on public.notifications(user_id, is_read);
create index idx_notif_workspace on public.notifications(workspace_id);
create index idx_notif_created on public.notifications(user_id, created_at desc);

-- RLS: notifications (user can only see their own)
create policy "Users can view own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "System can create notifications"
  on public.notifications for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Users can mark own notifications read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own notifications"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());
