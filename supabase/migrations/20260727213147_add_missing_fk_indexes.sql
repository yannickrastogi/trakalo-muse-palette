create index if not exists idx_artist_aliases_created_by
  on public.artist_aliases (created_by);

create index if not exists idx_beta_passes_granted_by
  on public.beta_passes (granted_by);

create index if not exists idx_beta_passes_redeemed_by
  on public.beta_passes (redeemed_by);

create index if not exists idx_catalog_shares_shared_by
  on public.catalog_shares (shared_by);

create index if not exists idx_invitations_invited_by
  on public.invitations (invited_by);

create index if not exists idx_subscriptions_beta_pass_id
  on public.subscriptions (beta_pass_id);

create index if not exists idx_waitlist_invitation_sent_by
  on public.waitlist (invitation_sent_by);;
