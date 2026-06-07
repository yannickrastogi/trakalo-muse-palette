# DIAGNOSTIC_PLAYLIST_FINAL — Playlist share "No track data available" (post-fix SQL)

**Date** : 2026-06-07 · **Slug** : `5ug9slpkgdsw` (CTRL BRAINSTORM, password-protected) · **Main** : `f6a5b3f` · **Mode** : diagnostic only, zéro changement

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
(répété 3× par chargement)
```
Aucune autre erreur JS. Aucun TypeError. Le front avale les réponses vides sans logger.

## 3. Fetch manuel depuis le browser (même clé anon, mêmes headers que le front)

```
POST /rest/v1/rpc/get_playlist_tracks_for_shared_link {_slug:"5ug9slpkgdsw"}
→ STATUS: 200, DATA: 14 rows ✅  (1er élément : {id:"37623f86-...", title:"MWA", position:0})

GET /rest/v1/playlist_tracks?...      → 200 mais 0 rows (anon)
GET /rest/v1/playlists?... (object+json) → 406 / 0 rows (anon)
GET /rest/v1/shared_links?link_slug=eq... → 200 mais 0 rows (anon)
```

**Le fix SQL fonctionne parfaitement.** La RPC retourne 14 tracks depuis le browser. Le problème est 100 % front.

## 4. Cause racine : **CAS A** (RPC jamais appelée) + composante D (render bloqué par playlistData null)

Deux verrous dans `src/pages/SharedLinkPage.tsx`, même origine :

**Verrou 1 — gating de la RPC (l.399-416)** : le front fait d'abord `GET /rest/v1/playlist_tracks` en direct REST, et n'appelle la RPC **que si** ce pré-check retourne des rows (`if (ptRows && ptRows.length > 0)`). Or la policy anon `anon_read_playlist_tracks_via_shared_link` contient un sous-SELECT sur `shared_links`… dont la policy anon (`anon_read_shared_links`) a été **supprimée par la Migration 1 (CRIT-01)**. Vérifié via `pg_policies` : `shared_links` n'a plus aucune policy SELECT pour `anon`. Le sous-SELECT retourne donc 0 rows pour anon → `playlist_tracks` retourne `[]` → la RPC (qui marche !) n'est jamais appelée → `playlistTracks = []`.

**Verrou 2 — render (l.1261)** : `if (isPlaylist && playlistData)` — `playlistData` vient du `GET /rest/v1/playlists` qui échoue en 406 pour anon (même mécanisme RLS). `playlistData = null` → le render playlist est sauté → le code tombe dans le render single-track (l.1673 `trackData ? ... :`) → `trackData` null → fallback l.2012 `t("sharedLink.fallback.noTrackData")` = "Aucune donnée de morceau disponible".

Le même mécanisme explique le branding 406 (`workspaces`, aucune policy anon). Les track shares marchent car leur branche appelle `get_track_for_shared_link` **directement, sans pré-check REST** (l.420).

## 5. Fichier à modifier

`src/pages/SharedLinkPage.tsx`, bloc playlist **l.389-416** (front uniquement, aucun SQL requis).

## 6. Fix recommandé (diff)

Principe : aligner la branche playlist sur la branche track — appeler la RPC directement, sans pré-checks REST anon-cassés, et donner un fallback à `playlistData`.

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
-        // Fetch playlist tracks via playlist_tracks join
-        var ptRes = await fetch(REST_URL + "/playlist_tracks?select=track_id,position&playlist_id=eq." + encodeURIComponent(link.playlist_id) + "&order=position.asc", { headers: SB_HEADERS });
-        var ptRows = ptRes.ok ? await ptRes.json() : null;
-
-        if (ptRows && ptRows.length > 0) {
-          // P0-04: SECURITY DEFINER RPC scoped to this exact shared link's slug.
-          // Replaces a direct SELECT on tracks that allowed cross-workspace reads.
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
+        // P0-04 follow-up: appeler la RPC directement. Les pré-checks REST
+        // (playlists / playlist_tracks) retournent 0 rows pour anon car leurs
+        // policies dépendent d'un sous-SELECT sur shared_links, invisible pour
+        // anon depuis CRIT-01. La RPC SECURITY DEFINER est scoped au slug.
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
+        // Métadonnées playlist : best-effort (échoue en anon → 406),
+        // fallback sur link_name + cover du 1er track pour débloquer le render.
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

**Option plus propre à terme (SQL, V2)** : RPC `get_playlist_for_shared_link(_slug)` SECURITY DEFINER retournant `id, name, description, cover_url` — supprime le best-effort 406 et donne la vraie description/cover de la playlist aux visiteurs anon. Idem pour le branding (`get_workspace_branding_for_shared_link(_slug)` réglerait les 3 erreurs console).

## 7. Hypothèses écartées

- B (RPC retourne 0 row en browser) : non — 14 rows, vérifié.
- C (mauvais parsing de rows reçues) : non — la RPC n'est pas appelée du tout.
- E (cache CDN/Vercel) : non — le bundle déployé appelle bien les bons endpoints.
- F (gate password ne déclenche pas de fetch) : vrai mais by design — le fetch a lieu au chargement ; le gate ne re-fetch rien. Pas la cause.
