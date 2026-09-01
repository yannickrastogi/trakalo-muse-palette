# Dropping the permissive anon SELECT policy on `tracks` (QR studio)

> Execute **after**:
> 1. frontend deployment (StudioSession now uses the RPC `get_track_by_qr_token`)
> 2. RPC creation (`supabase/migrations/20260627_get_track_by_qr_token.sql`)
>
> ⚠️ Block to copy into **Supabase SQL Editor** — do not auto-execute.

---

## ⚠️ Important — the policy is not versioned in the repo

The name `anon_read_track_by_qr` is an **assumption**. The actual policy that
allowed anon to read `tracks.eq(qr_token)` does not exist under this name in the
repo (cf. `docs/_archive/rls-phases/RLS_AUDIT_2026-05-10.md` — several anon policies are not
versioned). **List the actual policies BEFORE dropping.**

### 1. List anon SELECT policies on `tracks`

```sql
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tracks'
  AND 'anon' = ANY (roles)
ORDER BY policyname;
```

### 2. Drop ONLY the permissive QR policy

```sql
-- Hypothetical name (no-op if absent):
DROP POLICY IF EXISTS "anon_read_track_by_qr" ON public.tracks;

-- If step 1 reveals a different name (e.g. "Anyone can read tracks",
-- "anon_read_tracks", "tracks_anon_select"...), drop it explicitly:
-- DROP POLICY IF EXISTS "<actual_name_found>" ON public.tracks;
```

### 3. DO NOT drop the legitimate shared link policy

> 🚫 **Keep** `anon_read_tracks_via_shared_link`
> (`supabase/migrations/20260315_shared_link_anon_rls.sql`) — it is
> required by SharedLinkPage and remains correctly scoped via `shared_links`.
> Removing it would break public sharing pages.

### 4. Verification

```sql
-- After drop, anon should no longer have a broad SELECT on tracks.
-- Only "anon_read_tracks_via_shared_link" should remain (scoped).
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tracks' AND 'anon' = ANY (roles);
```

The QR studio flow continues to work via the SECURITY DEFINER RPC
`get_track_by_qr_token` (5 exposed fields, scoped to the token), without needing
an anon SELECT policy on the table.