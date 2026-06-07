# COWORK_PLAYLIST_FIX_REPORT — Playlist share "No track data available"

**Date** : 2026-06-07 · **Projet Supabase** : `xhmeitivkclbeziqavxw` · **Slug testé** : `5ug9slpkgdsw` (workspace Banx & Ranx Test)

---

## 1. Cas identifié : **CAS C** — type mismatch caché restant

## 2. Cause racine

Le fix de types appliqué via SQL Editor a corrigé `bpm`, `duration_sec` et `genre` dans `get_playlist_tracks_for_shared_link`, mais a déclaré **`"position" integer`** alors que `playlist_tracks.position` est **`smallint` (int2)**. PL/pgSQL valide les types de `RETURN QUERY` à l'exécution → chaque appel plante en `42804` → PostgREST 400 → le front affiche "No track data available".

## 3. Preuves

**SQL direct :**
```
SELECT * FROM get_playlist_tracks_for_shared_link('5ug9slpkgdsw');
→ ERROR 42804: Returned type smallint does not match expected type integer in column 15 (pt.position)
```

**Depuis le browser (page publique, clé anon, mêmes headers que le front) :**

| Call | Status | Body |
|---|---|---|
| `POST /rpc/get_shared_link_by_slug` `{_slug:"5ug9slpkgdsw"}` | **200** | row playlist OK (share_type=playlist, playlist_id non null, has_password=true) |
| `GET /rest/v1/playlist_tracks?...` | **200** | rows OK (RLS anon `anon_read_playlist_tracks_via_shared_link` présente) |
| `POST /rpc/get_playlist_tracks_for_shared_link` `{_slug:"5ug9slpkgdsw"}` | **400** | `{"code":"42804","details":"Returned type smallint does not match expected type integer in column 15."}` |

**Frontend (SharedLinkPage.tsx, l.389-416)** : flow correct — détecte `share_type === "playlist"`, fetch `playlist_tracks` (200, non vide) puis appelle la RPC ; `tracksRes.ok` est false → `playlistTracks` reste `[]` → "No track data available". Parsing sans bug. **Aucun changement de code requis** (donc pas de branche feature ni de tsc).

**Validation read-only du corps corrigé** : le SELECT avec `pt.position::integer` retourne **14 tracks** (MWA, Gucci 2026 v2, SWOOP, …) dans le bon ordre.

## 4. SQL fix (à exécuter dans Supabase SQL Editor)

`CREATE OR REPLACE` suffit (le type de retour ne change pas — on caste dans le SELECT). Pas de DROP → les GRANT existants sont préservés (re-déclarés quand même par sécurité).

```sql
-- Fix 42804: playlist_tracks.position est smallint, la RPC déclare integer.
-- On garde la signature (integer) et on caste dans le SELECT.
CREATE OR REPLACE FUNCTION public.get_playlist_tracks_for_shared_link(_slug text)
RETURNS TABLE (
  id uuid, title text, artist text, featuring text,
  bpm smallint, key text, genre text[], mood text[],
  cover_url text, duration_sec integer, audio_url text,
  waveform_data jsonb, lyrics text, lyrics_segments jsonb,
  "position" integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  RETURN QUERY
  SELECT t.id, t.title, t.artist, t.featuring,
    t.bpm, t.key, t.genre, t.mood,
    t.cover_url, t.duration_sec, t.audio_url,
    t.waveform_data, t.lyrics, t.lyrics_segments,
    pt.position::integer
  FROM public.tracks t
  JOIN public.playlist_tracks pt ON pt.track_id = t.id
  JOIN public.shared_links sl ON sl.playlist_id = pt.playlist_id
  WHERE sl.link_slug = _slug AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now())
  ORDER BY pt.position ASC;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_playlist_tracks_for_shared_link(text) TO anon, authenticated;
```

## 5. Tests effectués

| Test | Résultat |
|---|---|
| `get_shared_link_by_slug('5ug9slpkgdsw')` | ✅ 1 row, share_type=playlist |
| Corps corrigé (cast `::integer`) en SELECT direct | ✅ 14 tracks, ordre OK |
| Non-régression `get_track_for_shared_link('e4ak2kdwtdjd')` | ✅ 1 row (SOS- NCT v2) |
| `get_shared_link_by_id(...)` (route stems `/shared/:linkId`) | ✅ exécute sans erreur (fix types déjà appliqué) |
| Share stems end-to-end | ⚠️ non testable — aucun lien `stems`/`pack` actif dans le workspace test |

**À refaire après exécution du SQL** :
1. `SELECT * FROM get_playlist_tracks_for_shared_link('5ug9slpkgdsw');` → doit retourner 14 rows
2. Reload `app.trakalog.com/share/5ug9slpkgdsw` (+ mot de passe) → tracks visibles

## 6. Risques résiduels / observations (non fixées, hors scope)

1. **Branding cassé pour les visiteurs anon** : `GET /rest/v1/workspaces?...&id=eq.{workspace_id}` → **406** sur les pages partagées (aucune policy SELECT anon sur `workspaces`). Le hero/logo/brand color ne s'affichent pas pour les fans/pros non connectés. À traiter via une RPC `get_workspace_branding_for_shared_link(_slug)` ou une policy anon scopée.
2. Le SQL des RPCs partagées ne vit que dans `CLAUDE_FIX_REPORT.md` — toujours pas de fichier committé dans `supabase/migrations/`. Recommandé : committer ce fix + les précédents en migration.
3. Pattern récurrent : 3 incidents 42804 sur ces RPCs. Recommandé : ajouter un smoke test post-migration (`SELECT * FROM <rpc>('<slug actif>')` pour chaque RPC publique).
4. Lien playlist testé protégé par mot de passe → la validation visuelle finale (tracks affichées) reste à faire par Yannick après le fix.
