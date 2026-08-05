# Trakalog — Frontend Data-Fetching Audit

**Architecture note · August 5, 2026 · Status: FINDINGS (audited against `main`)**

Scope: every network call the React app makes to Supabase (PostgREST, RPC, Edge Functions).
Goal: identify requests that are avoidable — redundant, oversized, or serving features that
are switched off — and rank fixes by payoff.

Method: static analysis of all 207 source files (195 Supabase call sites across 15 contexts),
cross-checked against production row sizes measured directly in Postgres.

**Production baseline at time of audit:** 197 tracks across 8 workspaces, largest workspace
65 tracks, average `tracks` row 5 775 bytes.

---

## 0. The headline finding

**`@tanstack/react-query` v5 is installed, the `QueryClientProvider` is mounted twice in
`App.tsx`, and there is not a single `useQuery` or `useMutation` in the codebase.**

Every one of the 195 call sites is hand-rolled `useEffect` + `useState` + `useCallback`.
That means no request deduplication, no cache, no stale-while-revalidate, no retry policy,
no background refetch — all of which we are already paying for in bundle size.

To be fair to the existing code: the manual implementation is unusually disciplined. Context
values are memoised, `user` is stabilised on `[userId, userUpdatedAt]` so hourly
`TOKEN_REFRESHED` events don't cascade, `fetchTracks` uses a monotonic sequence guard against
out-of-order writes, and signed audio URLs are cached in a ref with TTL. The earlier
optimisation pass (115 → 24 boot requests) clearly happened and held.

So this is **not** a report about a leaky app. There are no runaway effect loops. It is a
report about a fetching architecture that works at 197 tracks and will not work at 5 000.

---

## 1. Findings, ranked

### F1 — The catalog fetch ships ~72% dead weight 🔴

`get_workspace_tracks` returns every column of every track in the workspace, with **no
pagination anywhere in the app**. Measured against production:

| Column | Avg bytes/row | Needed to render a catalog list? |
|---|---|---|
| `waveform_data` | 2 283 | No — only on TrackDetail |
| `sonic_dna` | 1 388 | No — internal, only feeds Smart A&R server-side |
| `lyrics` | 485 | No — only on TrackDetail |
| everything else | 1 619 | Yes |
| **full row** | **5 775** | |

Three columns nobody looks at in a list view account for **4 156 bytes of every 5 775**.

Projected payload on every app load:

| Catalog | Current | With a list projection |
|---|---|---|
| 65 tracks (largest today) | 375 KB | 105 KB |
| 1 000 tracks (Pro limit) | 5.8 MB | 1.6 MB |
| 5 000 tracks (Business limit) | **29 MB** | 8 MB |

29 MB of JSON parsed on the main thread before the catalog paints. On mobile this is not slow,
it is broken. Note this is the same shape of problem as the Groq 128k context wall documented
in `GROQ_USAGE_AND_COSTS.md`: a plan sells 5 000 tracks and two independent subsystems assume
the number is small.

**Fix:** a `get_workspace_tracks_list` RPC returning the list projection, with the heavy
columns fetched on demand in TrackDetail. Pagination or virtualised windowing after that.

---

### F2 — `WorkspaceSwitcher` downloads the entire catalog to render a number 🔴

Mounted in the sidebar, so it runs on every page. To display a track count badge per
workspace it:

1. `select id, workspace_id from tracks where workspace_id in (...)` — **every track ID the
   user can reach, across all their workspaces**
2. `select ... from catalog_shares where target_workspace_id in (...)`
3. then **one `get_shared_workspace_tracks` RPC per shared source workspace** (fan-out)
4. then another `catalog_shares` query for the cascade

…and calls `.length` on the result.

This is an aggregate being computed on the client from transferred rows. A user in 4
workspaces with 1 000 tracks each transfers ~4 000 rows on every page load to render four
two-digit numbers.

**Fix:** one `get_workspace_track_counts(_user_id)` RPC returning `(workspace_id, count)`,
computed in SQL. Four network calls and thousands of rows collapse to one call and N rows.

---

### F3 — Two contexts fetch data for features that are switched off 🟠

`src/config/features.ts` has had `PITCH_ENABLED: false` and `APPROVALS_ENABLED: false` since
August 1. The UI respects the flags everywhere — sidebar, dashboard, tour, checklist.

`PitchContext` and `ApprovalContext` do not check the flags. Both are mounted globally in
`App.tsx` and both fetch on mount and on every workspace switch:

- `PitchContext` → `select … from pitches`
- `ApprovalContext` → `select … from approvals`

Two queries per boot, per workspace switch, whose results can never be displayed.

**Fix:** early-return in the fetch callbacks when the flag is false. Two lines. This is the
cheapest item on the list and should ship first.

---

### F4 — 14 global providers, all eager, regardless of route 🟠

`App.tsx` nests 14 context providers around the whole tree. Twelve of them fire a fetch as
soon as a workspace resolves. Landing on `/catalog` therefore also loads contacts, contact
aliases, pitches, approvals, shared links, team members, playlists and shared playlists —
none of which that route renders.

Total boot fan-out is roughly 16–20 round trips, and the same set replays on every workspace
switch.

**Fix:** two options, in increasing order of effort.
- *Cheap:* gate each context's fetch on first consumption (a `useEffect` in the consuming
  page, or a `shouldFetch` flag) rather than on mount.
- *Correct:* move to `useQuery` with route-level `enabled` and a `staleTime`. Contexts keep
  their public API; only the internals change. This is what React Query is already installed
  for.

---

### F5 — No cache survives a page reload 🟠

Every context holds state in `useState`. A refresh, a tab restore, or a cold navigation
refetches all 16–20 requests from scratch and shows spinners for data that has not changed.

`localStorage` is already used across 17 files (session backup, onboarding, admin mode,
analytics), so there is no architectural objection — the pattern is established.

**Fix:** React Query's `persistQueryClient` with a localStorage persister and a short
`staleTime`. Catalog paints instantly from cache, revalidates in the background.

---

### F6 — Playlists refetch whenever tracks change 🟡

```
useEffect(() => { fetchPlaylists(); }, [fetchPlaylists, tracks, activeWorkspace]);
// and: fetchPlaylists = useCallback(…, [activeWorkspace, user, tracks]);
```

`tracks` is a new array reference after every `fetchTracks`, so any track mutation — upload,
edit, rating, delete — triggers a full playlist refetch.

`tracks` is used inside the fetch for exactly one thing: `tracks.find(tr => tr.uuid === uuid)`
to resolve titles onto `playlist_tracks` rows.

**Fix:** drop `tracks` from both dependency arrays, fetch raw `playlist_tracks`, and resolve
titles in a `useMemo` at render. The join is client-side anyway; it doesn't need to be inside
the network effect.

---

### F7 — Sequential writes in loops (N+1 on mutation) 🟡

Confirmed call sites where a Supabase RPC is awaited inside a `for` loop:

| File | RPC | Loop over |
|---|---|---|
| `UploadTrackModal.tsx:1206, 2057` | `upsert_contact` | collaborators per track |
| `UploadTrackModal.tsx:1192, 2040` | `insert_catalog_share` | shares per track |
| `EditTrackModal.tsx:290` | `upsert_contact` | collaborators |
| `TrackDetail.tsx:3251` | `upsert_contact` | collaborators |
| `StemsTab.tsx:189` | `insert_stem` | pending files |
| `TrackContext.tsx:1227, 1232, 1298` | `delete_stem` / `insert_stem` | stems |
| `ShareToWorkspaceModal.tsx:182` | `revoke_catalog_share` | shares |
| `WorkspaceSettings.tsx:516` | `update_workspace_branding` | fields |

Each is one round trip per item, serialized. A bulk upload with 8 collaborators across
20 tracks is 160 sequential requests.

**Fix:** batch RPCs taking an array parameter (`upsert_contacts(_contacts jsonb)`), or at
minimum `Promise.all` where ordering is irrelevant. Note the first fix is also more correct —
a batch RPC is one transaction, so a mid-loop failure can't leave half the contacts written.

---

### F8 — Two requests per track for comments 🟡

`TrackReviewContext.loadCommentsForTrack` does a `select` on `tracks.waveform_data` (legacy
comment storage) followed by a `get_track_comments` RPC, merging the two.

The lazy-loading guard (`loadedTracksRef`) is correct and the call is TrackDetail-scoped, so
this is not a boot cost. But it is 2× the necessary traffic on every track opened, and it
exists only because comments live in two places.

**Fix:** migrate the legacy `waveform_data.comments` payloads into the comments table, then
drop the first query. This retires schema debt rather than working around it.

---

### F9 — Catalog-share cascade fan-out 🟡

`fetchTracks` is well built — four parallel requests (tracks RPC, stems, ratings, catalog
shares) rather than sequential. But for each *source* workspace sharing a catalog in, it then
issues `get_shared_workspace_tracks` **and** `get_workspace_catalog_shares`, serially per
source.

Negligible at today's 8 workspaces. Linear in the number of sharing partners, and catalog
sharing is a feature we actively sell.

**Fix:** a single RPC resolving the full share graph server-side in one round trip.

---

## 2. What is already right — do not regress it

Worth stating explicitly, because a refactor could easily undo these:

- **Context memoisation.** Every provider value is `useMemo`'d; `user` is stabilised on
  `[userId, userUpdatedAt]` specifically so hourly token refreshes don't cascade. This is the
  reason there are no effect loops in a 15-context app.
- **`fetchSeqRef` in `TrackContext`.** A monotonic guard ensuring only the latest fetch writes
  state, so a slow share cascade from a previous workspace can't clobber a newer load.
- **`signedUrlCache` in `AudioPlayerContext`.** In-memory TTL cache for signed audio URLs;
  the commented-out `createSignedUrls` batch shows a per-workspace signing pass was already
  removed deliberately.
- **`get_workspace_tracks` as a SECURITY DEFINER RPC.** It exists because RLS cannot filter a
  single column, and splits must be sanitised server-side for pitcher/viewer roles. Any list
  projection (F1) must preserve that sanitisation — this is a security control, not a
  convenience.

---

## 3. Recommended order

| # | Item | Effort | Payoff |
|---|---|---|---|
| 1 | F3 — flag-gate Pitch/Approvals fetches | 10 min | 2 wasted queries per boot |
| 2 | F2 — `get_workspace_track_counts` RPC | 2 h | Removes the largest avoidable transfer |
| 3 | F1 — list projection for catalog | 4 h | 72% payload cut; unblocks large catalogs |
| 4 | F6 — decouple playlists from `tracks` | 1 h | Removes cascading refetches |
| 5 | F4 + F5 — migrate contexts to `useQuery` + persistence | 2–3 days | Structural; fixes fan-out and reload cost together |
| 6 | F7 — batch write RPCs | 1 day | Upload/edit latency, plus transactional correctness |
| 7 | F9 — single-RPC share graph | 4 h | Scales catalog sharing |
| 8 | F8 — migrate legacy comments | 4 h | Retires schema debt |

Items 1–4 are independent, low-risk, and deliver most of the measurable win. Item 5 is the
real architectural change and should be scoped as its own project — ideally on the `dev`
branch once the staging environment from `docs/PLANS/TRAKALOG_DEV_STAGING_SETUP.md` exists.

---

## 4. Suggested measurement before starting

None of the above should be taken on trust. Before touching code, capture a baseline: load
the app against the largest test workspace with the Network tab open, filtered to XHR, and
record request count, total transferred bytes, and time to first catalog paint. Repeat after
items 1–4.

Without that, we will not be able to tell which fix mattered.

---

## 5. Reference

| Item | Value |
|---|---|
| Contexts | `src/contexts/` — 15 files, 14 mounted globally in `App.tsx` |
| Feature flags | `src/config/features.ts` |
| Heaviest call sites | `pages/TrackDetail.tsx` (21), `contexts/TrackContext.tsx` (20), `pages/WorkspaceSettings.tsx` (18), `components/UploadTrackModal.tsx` (17) |
| Related | `docs/ARCHITECTURE/GROQ_USAGE_AND_COSTS.md`, `docs/PLANS/TRAKALOG_DEV_STAGING_SETUP.md` |
