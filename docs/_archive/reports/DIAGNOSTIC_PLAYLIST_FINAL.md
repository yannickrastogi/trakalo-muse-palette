# DIAGNOSTIC_PLAYLIST_FINAL — Playlist share "No track data available" (post-fix SQL)

**Date:** 2026-06-07 · **Slug:** `5ug9slpkgdsw` (CTRL BRAINSTORM, password-protected) · **Main:** `f6a5b3f` · **Mode:** diagnostic only, no changes

---

## 1. Network — calls capturés (page publique, clé anon)

**Au chargement de la page** (le fetch des données se fait AVANT le password gate — le gate ne fait que masquer l'affichage) :

| # | Call | Status | Réponse (extrait) |
|---|---|---|---|
| 1 | `POST /rest/v1/rpc/get_shared_link_by_slug` `{_slug}` | 200 | `[{"id":"e566ac7f-...","share_type":"playlist","playlist_id":"289e749e-...","status":"active","has_password":true,"link_name":"CT…"}]` |
| 2 | `GET /rest/v1/playlists?select=id,name,description,cover_url&id=eq.289e749e-...` (Accept: object+json) | **406** | `{"code":"PGRST116","details":"The result contains 0 rows","message":"Cannot coerce the result to a single JSON object"}` |
| 3 | `GET /rest/v1/playlist_tracks?select=track_id,position&playlist_id=eq.289e749e-...&order=position.asc` | 200 | **`[]` — 0 rows** |
| 4 | `POST /rest/v1/rpc/get_playlist_tracks_for_shared_link` | **JAMAIS APPELÉ** | — (gating front, voir §4) |
| 5 | `GET /rest/v1/workspaces?select=name,hero_image_url,...&id=eq.38007e8a-...` (branding) | 406 | 0 rows (problème connu, hors scope) |
| 6 | `POST /functions/v1/log-link-access`, `log-link-event` | 200 | — |

**Après soumission du password `ctrl`** : uniquement `POST /functions/v1/verify-link-password` → 200 `{valid:true}`. **Aucun re-fetch des données** — l'affichage bascule sur des states déjà vides.

## 2. Console (verbatim)

```
[ERROR] Failed to fetch workspace branding: Error
    at https://app.trakalog.com/assets/SharedLinkPage-6dGYS_rr.js:1:10302
(repeated 3× per load)
```
No other JS errors. No TypeError. The front swallows empty responses without logging.

## 3. Manual fetch from the browser (same anon key, same headers as the front)

```
POST /rest/v1/rpc/get_playlist_tracks_for_shared_link {_slug:"5ug9slpkgdsw"}
→ STATUS: 200, DATA: 14 rows ✅  (1st element: {id:"37623f86-...", title:"MWA", position:0})

GET /rest/v1/playlist_tracks?...      → 200 but 0 rows (anon)
GET /rest/v1/playlists?... (object+json) → 406 / 0 rows (anon)
GET /rest/v1/shared_links?link_slug=eq... → 200 but 0 rows (anon)
```

**The SQL fix works perfectly.** The RPC returns 14 tracks from the browser. The problem is 100 % front.

## 4. Root cause: **CASE A** (RPC never called) + component D (render blocked by playlistData null)

Two locks in `src/pages/SharedLinkPage.tsx`, same origin:

**Lock 1 — RPC gating (l.399-416)**: the front first does `GET /rest/v1/playlist_tracks` via direct REST, and only calls the RPC **if** this pre-check returns rows (`if (ptRows && ptRows.length > 0)`). But the anon policy `anon_read_playlist_tracks_via_shared_link` contains a sub-SELECT on `shared_links`… whose anon policy (`anon_read_shared_links`) was **removed by Migration 1 (CRIT-01)**. Verified via `pg_policies`: `shared_links` no longer has any SELECT policy for `anon`. The sub-SELECT therefore returns 0 rows for anon → `playlist_tracks` returns `[]` → the RPC (which works!) is never called → `playlistTracks = []`.

**Lock 2 — render (l.1261)**: `if (isPlaylist && playlistData)` — `playlistData` comes from the `GET /rest/v1/playlists` which fails 406 for anon (same RLS mechanism). `playlistData = null` → the playlist render is skipped → the code falls into the single-track render (l.1673 `trackData ? ... :`) → `trackData` null → fallback l.2012 `t("sharedLink.fallback.noTrackData")` = "No track data available".

The same mechanism explains the branding 406 (workspaces, no anon policy). Track shares work because their branch calls `get_track_for_shared_link` **directly, without REST pre-checks** (l.420).

## 5. File to modify

`src/pages/SharedLinkPage.tsx`, bloc playlist **l.389-416** (front uniquement, aucun SQL requis).

## 6. Recommended fix (diff)

Principle: align the playlist branch with the track branch — call the RPC directly, without broken anon REST pre-checks, and provide a fallback to `playlistData`.

```diff
       if (link.share_type === "playlist" && link.playlist_id) {
-        // Fetch playlist metadata
-        var plRes = await fetch(REST_URL + "/playlists?select=id,name,description,cover_url&id=eq." + encodeURIComponent(link.playlist_id), { headers: { ...SB_HEADERS, "Accept": "application/vnd.pgrst.object+json" } });
-        var pl = plRes.ok ? await plRes.json() : null;
-
-        if (pl) {
-          setPlaylistData(pl as unknown as PlaylistData);
-        }
-
- Fetch playlist tracks via playlist_tracks join
-        var ptRes = await fetch(REST_URL + "/playlist_tracks?select=track_id,position&playlist_id=eq." + encodeURIComponent(link.playlist_id) + "&order=position.asc", { headers: SB_HEADERS });
-        var ptRows = ptRes.ok ? await ptRes.json() : null;
-
-        if (ptRows && ptRows.length > 0) {
-        // P0-04: SECURITY DEFINER RPC scoped to this exact shared link's slug.
-        // Replaces a direct SELECT on tracks that allowed cross-workspace reads.
-          var tracksRes = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_playlist_tracks_for_shared_link", {
-            method: "POST",
-            headers: { ...SB_HEADERS, "Content-Type": "application/json" },
-            body: JSON.stringify({ _slug: slug }),
-          });
-          var tracks = tracksRes.ok ? await tracksRes.json() : null;
-
-          if (Array.isArray(tracks) && tracks.length > 0) {
-            // RPC already returns rows ordered by playlist position
-            setPlaylistTracks(tracks as unknown as TrackData[]);
-          }
-        }
+        // P0-04 follow-up: call the RPC directly. The REST pre-checks
+        // (playlists / playlist_tracks) return 0 rows for anon because their
+        // policies depend on a sub-SELECT on shared_links, invisible to
+        // anon since CRIT-01. The SECURITY DEFINER RPC is scoped to the slug.
+        var tracksRes = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_playlist_tracks_for_shared_link", {
+          method: "POST",
+          headers: { ...SB_HEADERS, "Content-Type": "application/json" },
+          body: JSON.stringify({ _slug: slug }),
+        });
+        var tracks = tracksRes.ok ? await tracksRes.json() : null;
+        if (!tracksRes.ok) {
+          console.error("Failed to fetch playlist tracks for shared link:", tracksRes.status);
+        }
+        if (Array.isArray(tracks) && tracks.length > 0) {
+          // RPC already returns rows ordered by playlist position
+          setPlaylistTracks(tracks as unknown as TrackData[]);
+        }
+
+        // Playlist metadata: best-effort (fails for anon → 406),
+        // fallback to link_name + cover from the 1st track to unblock render.
+        var plRes = await fetch(REST_URL + "/playlists?select=id,name,description,cover_url&id=eq." + encodeURIComponent(link.playlist_id), { headers: { ...SB_HEADERS, "Accept": "application/vnd.pgrst.object+json" } });
+        var pl = plRes.ok ? await plRes.json() : null;
+        setPlaylistData((pl as unknown as PlaylistData) || {
+          id: link.playlist_id,
+          name: link.link_name,
+          description: null,
+          cover_url: (Array.isArray(tracks) && tracks.length > 0 && tracks[0].cover_url) || null,
+        });
       } else if (link.track_id) {
```

**Option cleaner for the future (SQL, V2):** RPC `get_playlist_for_shared_link(_slug)` SECURITY DEFINER returning `id, name, description, cover_url` — eliminates the 406 best-effort and provides the actual description/cover of the playlist to anon visitors. Same for branding (`get_workspace_branding_for_shared_link(_slug)` would resolve the 3 console errors).

## 7. Hypotheses ruled out

- (B) RPC returns 0 rows in browser: no — 14 rows, verified.
- (C) bad parsing of received rows: no — the RPC is never called.
- (E) CDN/Vercel cache: no — the deployed bundle calls the correct endpoints.
- (F) password gate does not trigger a fetch: true but by design — the fetch occurs on load; the gate re-fetches nothing. Not the cause.
