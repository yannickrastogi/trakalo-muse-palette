# COWOK_PLAYLIST_FIX_REPORT — Playlist share "No track data available"

**Date:** 2026-06-07 · **Supabase project:** `xhmeitivkclbeziqavxw` · **Tested slug:** `5ug9slpkgdsw` (Banx & Ranx Test workspace)

---

## 1. Case identified: **CASE C** — hidden type mismatch still present

## 2. Root cause

The type fix applied via SQL Editor corrected `bpm`, `duration_sec` and `genre` in `get_playlist_tracks_for_shared_link`, but declared **`"position" integer`** while `playlist_tracks.position` is **`smallint` (int2)**. PL/pgSQL validates `RETURN QUERY` types at execution time → each call fails with `42804` → PostgREST 400 → the frontend displays "No track data available".

## 3. Evidence

**Direct SQL:**
```
SELECT * FROM get_playlist_tracks_for_shared_link('5ug9slpkgdsw');
→ ERROR 42804: Returned type smallint does not match expected type integer in column 15 (pt.position)
```

**From the browser (public page, anon key, same headers as the frontend):**

| Call | Status | Body |
|---|---|---|
| `POST /rpc/get_shared_link_by_slug` `{_slug:"5ug9slpkgdsw"}` | **200** | playlist row OK (share_type=playlist, playlist_id not null, has_password=true) |
| `GET /rest/v1/playlist_tracks?...` | **200** | rows OK (RLS anon `anon_read_playlist_tracks_via_shared_link` present) |
| `POST /rpc/get_playlist_tracks_for_shared_link` `{_slug:"5ug9slpkgdsw"}` | **400** | `{"code":"42804","details":"Returned type smallint does not match expected type integer in column 15."}` |

**Frontend (SharedLinkPage.tsx, l.389-416):** flow is correct — detects `share_type === "playlist"`, fetches `playlist_tracks` (200, non-empty) then calls the RPC; `tracksRes.ok` is false → `playlistTracks` remains `[]` → "No track data available". No parsing bug. **No code changes required** (so no feature branch or tsc needed).

**Validation of the corrected body:** the SELECT with `pt.position::integer` returns **14 tracks** (MWA, Gucci 2026 v2, SWOOP, ...) in the right order.

## 4. SQL fix (to execute in Supabase SQL Editor)

`CREATE OR REPLACE` is sufficient (the return type doesn't change — we cast in the SELECT). No DROP → existing GRANTs are preserved (re-declared anyway for safety).

```sql
-- Fix 42804: playlist_tracks.position is smallint, the RPC declares integer.
-- Keep the signature (integer) and cast in the SELECT.
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

## 5. Tests performed

| Test | Result |
|---|---|
| `get_shared_link_by_slug('5ug9slpkgdsw')` | ✅ 1 row, share_type=playlist |
| Corrected body (cast `::integer`) in direct SELECT | ✅ 14 tracks, order OK |
| Non-regression `get_track_for_shared_link('e4ak2kdwtdjd')` | ✅ 1 row (SOS- NCT v2) |
| `get_shared_link_by_id(...)` (stems route `/shared/:linkId`) | ✅ executes without error (types fix already applied) |
| Share stems end-to-end | ⚠️ not testable — no active `stems`/`pack` link in the test workspace |

**To re-run after SQL execution:**
1. `SELECT * FROM get_playlist_tracks_for_shared_link('5ug9slpkgdsw');` → should return 14 rows
2. Reload `app.trakalog.com/share/5ug9slpkgdsw` (+ password) → tracks visible

## 6. Residual risks / observations (unfixed, out of scope)

1. **Branding broken for anonymous visitors:** `GET /rest/v1/workspaces?...&id=eq.{workspace_id}` → **406** on shared pages (no SELECT policy for anon on `workspaces`). The hero/logo/brand color don't display for non-logged-in fans/pros. Fix via an RPC `get_workspace_branding_for_shared_link(_slug)` or a scoped anon policy.
2. The RPC SQL for shared links only lives in `CLAUK_FIX_REPORT.md` — still no file committed in `supabase/migrations/`. Recommended: commit this fix + previous ones as a migration.
3. Recurring pattern: 3 incidents of 42804 on these RPCs. Recommended: add a smoke test post-migration (`SELECT * FROM <rpc>('<active slug>')` for each public RPC).
4. The tested playlist link is password-protected → the final visual validation (tracks displayed) remains to be done by Yannick after the fix.
