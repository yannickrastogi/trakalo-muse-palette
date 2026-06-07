# CLAUDE — Playlist share + workspace branding fix (P0 follow-up)

> Session opened 2026-06-08 · CTO workflow
> Baseline : `f6a5b3f` (main after CRIT-01..P1-08 deployment)
> Feature branch : `claude/fix-playlist-branding-shares-20260607-1832`
> Rollback tag : `pre-playlist-branding-fix-20260607-183207`
> Diagnostic source : `DIAGNOSTIC_PLAYLIST_FINAL.md`

---

## TL;DR

Two anon visitors regressions surfaced after CRIT-01 stripped the broad anon SELECT policies. Both share the same root cause: pages depended on REST table reads (`/playlists`, `/playlist_tracks`, `/workspaces`) whose anon policies join through `shared_links`, and the `shared_links` anon SELECT policy no longer exists.

| Symptom | Fix |
|---|---|
| Playlist shares (`/share/{slug}`) display "No track data available" | Front: remove the `playlist_tracks` pre-check that gated the SECURITY DEFINER RPC; call the RPC directly and synthesize `playlistData` from the shared link's own `link_name` + the first track's cover. |
| Workspace branding (hero / logo / brand color / socials) invisible on every shared link | One new SECURITY DEFINER RPC `get_workspace_branding_for_shared_link(_slug)` + replace the direct `GET /rest/v1/workspaces` with the RPC call. |

No SQL is required for the playlist tracks fix itself (the RPC `get_playlist_tracks_for_shared_link` already exists and works — it was simply never called). One new RPC needs to be added for the branding fix.

---

## Rollback procedure

```bash
cd ~/Desktop/DEV/trakalog-app
git fetch --tags
git reset --hard pre-playlist-branding-fix-20260607-183207
git push --force-with-lease origin claude/fix-playlist-branding-shares-20260607-1832
```

The tag points to commit `f6a5b3f` (state immediately before the playlist branch + branding fixes). Any rollback restores the repo to that exact state.

---

## Files modified

| File | Lines changed | Purpose |
|---|---|---|
| `src/pages/SharedLinkPage.tsx` | ~389-416 (playlist branch) + ~544-560 (branding effect) | Call RPCs directly, drop broken anon REST pre-checks, synthesize playlist metadata. |

`SharedStemAccess.tsx`, `SignAgreement.tsx`, `StudioSession.tsx`, `AcceptInvitation.tsx`: **no branding workspace fetches** — grep confirmed. No changes needed there. (`SignAgreement` does call `.from("workspaces").select("owner_id")` for an email notification side-effect; that's not branding and is out of scope for this fix.)

---

## SQL migration to execute (Yannick runs this)

> Run in the Supabase SQL Editor on the production project (`xhmeitivkclbeziqavxw`). Idempotent.

```sql
CREATE OR REPLACE FUNCTION public.get_workspace_branding_for_shared_link(_slug text)
RETURNS TABLE (
  name text,
  hero_image_url text,
  hero_position numeric,
  hero_focal_point text,
  logo_url text,
  brand_color text,
  social_instagram text,
  social_tiktok text,
  social_youtube text,
  social_facebook text,
  social_x text,
  social_website text,
  bio text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  RETURN QUERY
  SELECT
    w.name,
    w.hero_image_url,
    w.hero_position,
    w.hero_focal_point,
    w.logo_url,
    w.brand_color,
    w.social_instagram,
    w.social_tiktok,
    w.social_youtube,
    w.social_facebook,
    w.social_x,
    w.social_website,
    w.bio
  FROM public.workspaces w
  JOIN public.shared_links sl ON sl.workspace_id = w.id
  WHERE sl.link_slug = _slug
    AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_workspace_branding_for_shared_link(text) TO anon, authenticated;
```

**Why a new RPC instead of restoring the anon SELECT policy on `workspaces`?**
Restoring a broad anon read on `workspaces` would also expose private workspace metadata (member counts, internal settings, etc.) to anyone with the publishable key. The RPC is the same security model used for the other CRIT-01 follow-ups: it returns only the branding columns, joined through `shared_links`, so a row only comes out when an active shared link actually exists for that slug.

**Type note:** `hero_position` is typed as `numeric` to match `shared_links` and avoid a cast mismatch. The `WorkspaceBranding` interface on the front declares it `number | null`, which is compatible with `numeric` over PostgREST. Adjust to `integer` if the column is actually `integer` in production (no behavioural change either way).

---

## Edge Functions to deploy

**None.** This fix is pure front + one DB RPC.

---

## Runtime test checklist (post-deploy)

### Playlist share — the bug we're fixing
- [ ] `https://app.trakalog.com/share/5ug9slpkgdsw` (CTRL BRAINSTORM, password `ctrl`):
  - [ ] Password gate renders.
  - [ ] After password submit, **14 tracks visible** in the playlist view.
  - [ ] Playlist title is "CTRL BRAINSTORM" (or whatever `link_name` was set) — falls back to that string rather than the old "No track data available".
  - [ ] First track's cover renders as the playlist cover when the playlists table's own cover isn't accessible.
  - [ ] Workspace branding (hero, logo, brand color, social icons) renders.

### Track share — non-regression
- [ ] `https://app.trakalog.com/share/e4ak2kdwtdjd` (or any active single-track share):
  - [ ] Track plays, metadata visible, waveform renders.
  - [ ] Workspace branding renders.
  - [ ] Console shows no new errors (especially no "Failed to fetch workspace branding").

### Stem share — non-regression
- [ ] `https://app.trakalog.com/shared/{linkId}` (any active stems share):
  - [ ] Stems list visible.
  - [ ] No branding regression (SharedStemAccess doesn't render branding today; this fix doesn't change that).

### Sign agreement — non-regression
- [ ] `https://app.trakalog.com/sign/{token}` (any active signature request):
  - [ ] Page loads, signature canvas works, submit succeeds.
  - [ ] Notification email side-effect still functions (or fails silently as before — out of scope).

### Console
- [ ] On all shared link pages: **no** "Failed to fetch workspace branding" error.
- [ ] On playlist share: **no** "Failed to fetch playlist tracks for shared link" error.

---

## Commits on this branch

```
39f1079  fix: playlist shares + workspace branding for anon visitors (P0)
```

4 files changed, +408 / -33 lines (the 408 includes the three report/diagnostic markdown files that were untracked before).
