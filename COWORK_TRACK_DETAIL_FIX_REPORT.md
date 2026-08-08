# COWOK_TRACK_DETAIL_FIX_REPORT — Track Details: title/artist do not persist

**Date:** 2026-06-07 · **Branch:** `cowork/fix-update-track-whitelist-20260607-2316` · **Tag:** `pre-update-track-fix-20260607-231603` · **Test track:** `f0c583a1` (SOS- NCT v2, Banx & Ranx Test workspace)

---

## 1. Pre-fix state — field by field

| Field (front → payload key) | In whitelist? | Real column? | Did it persist? | Why |
|---|---|---|---|---|
| title, artist, featuring, key, album, isrc, upc, copyright, notes, language | ✅ | ✅ | ❌ | Full UPDATE rollback (see bug 1) |
| bpm | ✅ | ✅ | ✅ | saved by 2nd call `{bpm,key,sonic_dna}` from EditTrackModal (payload without toxic key) |
| genre (text[]) | ✅ | ✅ | ❌* | text[] cast OK (special branch) but batch rollback |
| mood (text[]) | ✅ | ✅ | ❌ | **bug 1**: casted `::jsonb` on text[] column → 42804 |
| labels (text[]) | ✅ | ✅ | ❌ | **bug 1**: idem — labels is THE key that broke everything (always sent by EditTrackModal) |
| publishers (text[]) | ✅ | ✅ | ❌ | **bug 1**: idem |
| type (front sends `track_type`) | ❌ (`'type'` listed, column does not exist) | ✅ `track_type` | ❌ | **bug 2**: silently dropped by whitelist |
| voice (front maps → `gender`) | `'voice'` listed but column does not exist | ✅ `gender` | ❌* | gender whitelisted OK, but batch rollback |
| lyrics | ✅ | ✅ | ✅ (only one) | the `updateTrackLyrics` call has no toxic key |
| lyrics_segments | ❌ | ✅ | ❌ | **bug 3**: absent from whitelist → karaoke segments lost on every lyrics edit |
| iswc | ❌ | ✅ | ❌ | **bug 3**: absent from whitelist |
| status, explicit, released_at, credits, tags, splits, chapters, cover_url, audio*_url, waveform_data, sonic_dna, duration_sec, qr_token | ✅ | ✅ | ✅/❌* | OK alone; rollback if in same batch as labels/publishers/mood |

* = the key itself was correct, but any batch containing `labels`/`publishers`/`mood` (JSON arrays) failed as a whole.

## 2. Root cause

**Exact reproduction SQL** (payload identical to EditTrackModal → TrackContext.updateTrack):

```
ERROR 42804: column "labels" is of type text[] but expression is of type jsonb
QUERY: UPDATE public.tracks SET ... labels = '[]'::jsonb, publishers = '[]'::jsonb ...
```

The dynamic builder of `update_track` cast **all JSON arrays to `::jsonb`**; only `genre` had a text[] branch. But `mood`, `labels`, `publishers` are also `text[]` columns. EditTrackModal **always** sends `labels` and `publishers` → every save failed → rollback of ALL fields in the batch (title, artist…). The 2nd separate call `{bpm, key, sonic_dna}` succeeded → illusion that "only BPM works". The same crash affected upload (stage 4 extended metadata from UploadTrackModal: "Some metadata could not be saved").

Secondary bugs: whitelist with `'type'`/`'voice'` (non-existent columns — `track_type`/`gender` are the real ones) and without `lyrics_segments`/`iswc`; `released_at=''` not guarded.

## 3. SQL executed (traceability)

`CREATE OR REPLACE FUNCTION public.update_track(...)` — applied in prod via Supabase MCP on 2026-06-07. Changes:

1. `v_text_array_columns := ARRAY['genre','mood','labels','publishers']` — the text[] branch (previously only genre) generalized to 4 columns.
2. Whitelist: `'type'` → `'track_type'`, removed `'voice'`, added `'lyrics_segments'` and `'iswc'`.
3. Guard `released_at = '' → NULL`.
4. Everything else (access checks editor/pitcher, object/boolean/number casts, EXECUTE) unchanged.

Full SQL committed in **`supabase/migrations/20260607_update_track_whitelist_v2.sql`** (finally a migration file in the repo). Grants verified: ACL preserved by CREATE OR REPLACE (anon/authenticated/service_role X).

## 4. Code diff

**No front-end changes needed:** TrackContext already sends the correct keys (`track_type`, `gender`, `lyrics_segments`). The feature branch contains only the migration file + this report.

## 5. Post-fix state — tests performed (SQL, via the RPC itself)

| Test | Result |
|---|---|
| Exact EditTrackModal payload (21 keys, the one that failed) | ✅ success |
| title + artist modified → re-read | ✅ persist |
| mood `["dark","energetic"]`, labels `["Test Label"]`, publishers `["Pub A","Pub B"]` (text[]) | ✅ persist |
| genre `["pop","dance"]` (no regression on text[] branch) | ✅ persists |
| track_type `"song"` (previously silently dropped) | ✅ persists |
| lyrics_segments jsonb (previously dropped) | ✅ persists |
| iswc (previously dropped) | ✅ persists |
| Revert: track restored to original snapshot state | ✅ verified |

**Remaining to be validated by Yannick in the UI** (login required, not done by Cowork): quick pass through EditTrackModal → save → reload on a track, and a full upload with "Skip Review" (the extended metadata crash on upload is the same bug, so it should be resolved automatically).

## 6. Residual risks

1. **⚠️ Test data**: the initial snapshot of track SOS- NCT v2 did not include `lyrics`/`lyrics_segments`; my tests ended with these fields as NULL. If this track had lyrics before (unlikely — nearly empty test track), they are lost. Needs visual verification.
2. Previous failed saves are not recoverable — beta users will need to re-enter the lost edits.
3. `status`: EditTrackModal does not send `status` (separate path `updateTrackStatus` → OK tested by construction).
4. Recurring pattern (3rd RPC broken by type mismatch): the recommended post-migration smoke test from previous reports still applies.
5. The function keeps the dynamic SQL builder (EXECUTE format) — safe thanks to %I/%L + whitelist, but any new `tracks` column will need to be added to `v_allowed_columns` (and to `v_text_array_columns` if text[]).
