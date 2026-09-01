# R2 Migration — Phase 2 Report

> **Branch** : `claude/r2-phase2-storage-abstraction-20260608-1752`
> **Rollback tag** : `pre-r2-phase2-20260608-175217`
> **Date** : 2026-06-08
> **Cutover** : ❌ NONE. `STORAGE_PROVIDER=supabase` remains the default. Zero runtime changes.

---

## TL;DR

✅ **Storage abstraction layer in place** : `supabase/functions/_shared/storage.ts` exposes a uniform `StorageProvider` interface with 2 implementations (Supabase Storage by default, Cloudflare R2 via feature flag).

✅ **4 Edge Functions adapted** to go through the abstraction instead of calling `supabase.storage.from(...)` directly. Original Supabase code preserved in inline comments for quick rollback.

✅ **R2 tests 30/30 pass** : upload + signed URL GET + download + exists + delete on 5 real R2 buckets (trakalog-tracks, trakalog-stems, trakalog-watermarked, trakalog-covers, trakalog-documents). Pure Deno AWS Signature V4 validated in real conditions.

✅ **Zero regression expected** in prod as long as `STORAGE_PROVIDER=supabase` (default).

✅ **No secrets committed** : R2 credentials only in `.env.local` (gitignored). Code reads everything from `Deno.env.get(...)`.

---

## 1. Wrapper architecture

### Public interface

`supabase/functions/_shared/storage.ts` exposes:

```typescript
export type BucketName = "tracks" | "stems" | "watermarked" | "covers" | "documents";

export interface StorageProvider {
  createSignedUrl(bucket: BucketName, key: string, expiresInSec?: number): Promise<string>;
  upload(bucket: BucketName, key: string, body: Uint8Array | ArrayBuffer | Blob, contentType?: string): Promise<void>;
  download(bucket: BucketName, key: string): Promise<Uint8Array>;
  delete(bucket: BucketName, key: string): Promise<void>;
  exists(bucket: BucketName, key: string): Promise<boolean>;
  readonly name: "supabase" | "r2";
}

export function getStorageProvider(): StorageProvider;
```

### Factory

`getStorageProvider()` reads `STORAGE_PROVIDER` (`Deno.env.get`):
- `"supabase"` (default) → `SupabaseStorageProvider`
- `"r2"` → `R2StorageProvider`

### `SupabaseStorageProvider`

Minimal wrapper around `@supabase/supabase-js@2` client created with `SERVICE_ROLE_KEY`. All existing arguments preserved (`upsert: false` on upload, default expiry 300s, etc.). Throws standard `Error` with messages prefixed `[storage:supabase]`.

### `R2StorageProvider`

Pure Deno implementation:
- AWS Signature V4 via Web Crypto API only (HMAC-SHA256, SHA-256, importKey, sign)
- Path-style addressing: `/{bucket}/{key}` (R2-compatible)
- Strict RFC 3986 encoding (encodeURIComponent + post-processing of 5 characters `[!'()*]`)
- Per-segment path encoding (preserves `/` between segments, encodes `/` *within* a segment → blocks path traversal at HTTP level)
- `UNSIGNED-PAYLOAD` for PUT (avoids hashing the body upfront on large WAVs)
- Region `auto`, service `s3`, OpenTimestamps aggregator not used here
- Logical-to-physical bucket mapping via env vars `R2_BUCKET_{TRACKS,STEMS,WATERMARKED,COVERS,DOCUMENTS}`

Throws standard `Error` with messages prefixed `[storage:r2]`.

### Required runtime env vars

| Variable | Example | Role |
|---|---|---|
| `STORAGE_PROVIDER` | `r2` or `supabase` | Factory toggle. Default `supabase`. |
| `R2_ENDPOINT` | `https://98dfdbe6c0f7841eb91593b8af3eea71.r2.cloudflarestorage.com` | R2 S3-compatible endpoint |
| `R2_ACCESS_KEY_ID` | (32 hex chars) | R2 access key |
| `R2_SECRET_ACCESS_KEY` | (64 hex chars) | R2 secret key |
| `R2_BUCKET_TRACKS` | `trakalog-tracks` | Logical→physical mapping |
| `R2_BUCKET_STEMS` | `trakalog-stems` | id. |
| `R2_BUCKET_WATERMARKED` | `trakalog-watermarked` | id. |
| `R2_BUCKET_COVERS` | `trakalog-covers` | id. |
| `R2_BUCKET_DOCUMENTS` | `trakalog-documents` | id. |

`R2_ACCOUNT_ID` is **not** used directly by the code (the endpoint already contains it). But we still push it into Supabase secrets for traceability.

---

## 2. Modified Edge Functions

Original Supabase code preserved in inline comments (prefix `// Legacy Supabase-direct call (kept ...)`) to allow line-by-line rollback without `git revert`.

| File | Diff | Adapted storage calls |
|---|---|---|
| `supabase/functions/get-audio-url/index.ts` | +13 / -9 | 1× `createSignedUrl("tracks", path, 300)` |
| `supabase/functions/get-watermarked-audio/index.ts` | +46 / -28 | 1× `exists("watermarked", path)` + 1× `createSignedUrl("watermarked", path, 300)` cache hit + 1× `createSignedUrl("tracks", path, 60)` + 1× `upload("watermarked", path, buf, "audio/wav")` + 1× `createSignedUrl("watermarked", path, 300)` |
| `supabase/functions/analyze-sonic-dna/index.ts` | +12 / -8 | 1× `createSignedUrl("tracks", path, 600)` |
| `supabase/functions/transcribe-lyrics/index.ts` | +15 / -7 | 1× `createSignedUrl("tracks", path, 3600)` in helper `fetchViaSignedUrl` |

**Frontend (`src/`) : 0 modifications.** Decision Option A from the brief — frontend uploads (StemsTab, UploadTrackModal) remain on Supabase for Phase 2. Switch in Phase 3 when we create the Edge Function `get-upload-url` that returns a signed PUT URL R2.

**Appendix file** : `deno.lock` created by the first `deno check`. No secrets. Safe to commit.

---

## 3. Test scripts

### `scripts/test-r2-standalone.ts` (executed ✅)

Pure R2 test (no need for SUPABASE_SERVICE_ROLE_KEY) — validates V4 signing against 5 real R2 buckets.

```bash
deno run -A --env-file=.env.local scripts/test-r2-standalone.ts
```

**Result** : 30/30 tests pass (6 tests × 5 buckets: exists-pre / upload / exists-post / signed URL GET / download / delete + exists-false).

### `scripts/test-r2-parity.ts` (ready, not executed locally)

Supabase ↔ R2 parity test — requires `SUPABASE_SERVICE_ROLE_KEY` (prod secret). Yannick can run if needed:

```bash
export SUPABASE_URL=https://xhmeitivkclbeziqavxw.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<prod secret>
deno run -A --env-file=.env.local scripts/test-r2-parity.ts
```

Byte-by-byte comparison upload/download via both providers for the same key.

---

## 4. ⚠️ Commands to execute by Yannick (Supabase secrets)

**TO DO before being able to switch to R2 in Phase 4.** For Phase 2, **no mandatory action** — the default `supabase` works without these secrets.

If you want to prepare R2 now (recommended — hidden secrets, trivial switch in Phase 4):

```bash
# 1. Load credentials from .env.local without showing them in history
set -a; source .env.local; set +a

# 2. Push R2 secrets to Supabase (project ref: xhmeitivkclbeziqavxw)
supabase secrets set \
  R2_ACCOUNT_ID="$R2_ACCOUNT_ID" \
  R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  R2_ENDPOINT="$R2_ENDPOINT" \
  R2_BUCKET_TRACKS="$R2_BUCKET_TRACKS" \
  R2_BUCKET_STEMS="$R2_BUCKET_STEMS" \
  R2_BUCKET_WATERMARKED="$R2_BUCKET_WATERMARKED" \
  R2_BUCKET_COVERS="$R2_BUCKET_COVERS" \
  R2_BUCKET_DOCUMENTS="$R2_BUCKET_DOCUMENTS" \
  --project-ref xhmeitivkclbeziqavxw

# 3. Verify (doesn't show values, just names)
supabase secrets list --project-ref xhmeitivkclbeziqavxw | grep R2_

# 4. (Optional, for explicitness) Force STORAGE_PROVIDER=supabase as default
supabase secrets set STORAGE_PROVIDER=supabase --project-ref xhmeitivkclbeziqavxw
```

**Note** : `unset` afterwards to purge your shell variables:
```bash
unset R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ENDPOINT \
      R2_BUCKET_TRACKS R2_BUCKET_STEMS R2_BUCKET_WATERMARKED \
      R2_BUCKET_COVERS R2_BUCKET_DOCUMENTS
```

---

## 5. Phase 2 deployment procedure (recommended)

1. **Merge branch to main** (PR review) → CI build expected clean (already verified locally)
2. **Redeploy the 4 modified Edge Functions**:
   ```bash
   supabase functions deploy get-audio-url --project-ref xhmeitivkclbeziqavxw
   supabase functions deploy get-watermarked-audio --project-ref xhmeitivkclbeziqavxw
   supabase functions deploy analyze-sonic-dna --project-ref xhmeitivkclbeziqavxw
   supabase functions deploy transcribe-lyrics --project-ref xhmeitivkclbeziqavxw
   ```
3. **Prod smoke test** (cf. section 6) — behavior should be identical to before.
4. (Optional but recommended) **Push R2 secrets** (cf. section 4) → prepares Phase 4 without breaking anything.

---

## 6. Post-deploy smoke test procedure

### Test 1 — Audio playback (logged-in user player)

```bash
curl -X POST 'https://xhmeitivkclbeziqavxw.supabase.co/functions/v1/get-audio-url' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $SUPABASE_PUBLISHABLE_KEY" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -d '{"track_id":"<UUID-OF-A-REAL-TRACK>","quality":"preview"}'
```

Expected : `{ "url": "https://xhmeitivkclbeziqavxw.supabase.co/storage/v1/object/sign/tracks/..." }`. URL valid for 300s.

### Test 2 — Watermarking (shared link)

Open an existing shared link (e.g. `https://app.trakalog.com/share/<slug>`), enter a visitor email, play a track → audio should stream normally. Verify in the Network tab that a `/functions/v1/get-watermarked-audio` call returns 200 with a valid signed URL.

### Test 3 — Sonic DNA (upload + analysis)

Upload a new track from the UI → Sonic DNA analysis should complete normally (BPM + key filled automatically in the track card).

### Test 4 — Lyrics transcription

On an existing track, click "Auto-transcribe lyrics" → lyrics should appear with the `[auto-transcribed]` marker.

**Success criteria** : 4/4 tests identical to pre-Phase-2 behavior.

---

## 7. Switch procedure to R2 (Phase 4 — not now)

When the Phase 3 data migration is complete (rclone Supabase → R2 + DB paths updated if necessary):

```bash
# 1. Verify all R2 secrets are in place
supabase secrets list --project-ref xhmeitivkclbeziqavxw | grep R2_

# 2. Switch (instant)
supabase secrets set STORAGE_PROVIDER=r2 --project-ref xhmeitivkclbeziqavxw

# 3. Redeploy the 4 Edge Functions to read the new value
supabase functions deploy get-audio-url --project-ref xhmeitivkclbeziqavxw
supabase functions deploy get-watermarked-audio --project-ref xhmeitivkclbeziqavxw
supabase functions deploy analyze-sonic-dna --project-ref xhmeitivkclbeziqavxw
supabase functions deploy transcribe-lyrics --project-ref xhmeitivkclbeziqavxw

# 4. Smoke test (cf section 6) on 1 recent track and 1 historical track
# 5. Monitor Edge Functions logs 30 min
```

---

## 8. Rollback procedure

### Rollback Phase 4 → Phase 2 (R2 broken, back to Supabase)

```bash
supabase secrets set STORAGE_PROVIDER=supabase --project-ref xhmeitivkclbeziqavxw
supabase functions deploy get-audio-url --project-ref xhmeitivkclbeziqavxw
supabase functions deploy get-watermarked-audio --project-ref xhmeitivkclbeziqavxw
supabase functions deploy analyze-sonic-dna --project-ref xhmeitivkclbeziqavxw
supabase functions deploy transcribe-lyrics --project-ref xhmeitivkclbeziqavxw
```

Immediate effect — the next invocation of the Edge Functions will read `STORAGE_PROVIDER=supabase` and use `SupabaseStorageProvider`.

### Rollback Phase 2 → main (abstraction that breaks)

```bash
git checkout main
git reset --hard pre-r2-phase2-20260608-175217   # tag placed at start of mission
# Redeploy the 4 Edge Functions
```

Or via UI: revert the merge commit on GitHub.

---

## 9. Residual risks & tech debt for Phase 3/4

(From Sonnet review)

1. **`get-watermarked-audio` line 48** : the Supabase URL strip (`/object/sign/tracks/...`) doesn't recognize the R2 format. If in Phase 4 the frontend passes a different format (e.g. `r2://trakalog-tracks/...`), this check will pass silently. **To address in Phase 3** before cutover: either keep the relative format (bare path) in DB and everything goes through the abstraction (recommended), or extend the strip to match `r2://` as well.

2. **`transcribe-lyrics` line 232** : the outer catch exposes `err.message` to the client. Pre-existing bug, out of scope of this PR — fix independently.

3. **`SupabaseStorageProvider.exists()`** : no native HEAD, simulated via `createSignedUrl`. False negative possible if signing fails while the file exists. Behavior identical to before. `R2StorageProvider.exists()` does a real HEAD — so Phase 4 fixes this automatically.

4. **`getR2Config()` re-evaluated on each call** : micro-overhead negligible. No urgency.

5. **Frontend uploads (StemsTab)** : remain on Supabase Storage in Phase 2. Phase 3 must create `get-upload-url` Edge Function that returns signed PUT URL R2, then adapt StemsTab.

---

## 10. Commit checklist

- [x] `deno check` clean on 5 Deno files (storage.ts + 4 EFs)
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` clean
- [x] R2 standalone tests: 30/30 pass
- [x] Reviewer agent: 0 blocker
- [x] Secret scan in diff: 0 leak
- [x] `.env.local` gitignored confirmed
- [x] No frontend modified (zero risk on client side)

---

**Phase 2 delivered.** Ready to merge to main. Phase 3 = Supabase → R2 data migration. Phase 4 = switch `STORAGE_PROVIDER=r2`.