-- Fix: tighten link_downloads INSERT policy to validate link exists
drop policy "Anyone can log a download" on public.link_downloads;

create policy "Anyone can log a download for valid links"
  on public.link_downloads for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.shared_links sl
      where sl.id = link_id
        and sl.status = 'active'
    )
  );
