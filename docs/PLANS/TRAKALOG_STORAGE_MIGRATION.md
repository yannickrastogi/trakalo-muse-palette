# TRAKALOG — Storage Migration: Supabase → Cloudflare R2

> **Created:** May 17, 2026
> **Last Updated:** September 2, 2026 (translated to English; §0 added)
> **Goal:** Move all audio files (tracks, stems, watermarked) from Supabase Storage to
> Cloudflare R2, cutting costs by roughly 85-90% and enabling free unlimited egress.
> **Status:** ⚠️ **Superseded in part — the code shipped, but not as designed here.** See §0.
> **Estimated effort (original):** 5-7 days
> **Risk:** Medium — it touches the heart of the audio system.

---

## 0. What actually shipped (verified September 2, 2026)

The migration was implemented, but with a **materially better design than this document
proposes**. Read this section before following anything below, because several concrete details
here are now wrong.

### It is a provider abstraction, not an R2 helper

This document specifies an R2-only module at `_shared/r2.ts`, which was never created. What exists is
**`supabase/functions/_shared/storage.ts`** — a provider *abstraction* with two
implementations, selected at runtime:

```
// _shared/storage.ts
// Default: STORAGE_PROVIDER=supabase (zero regression).
// To switch to R2: supabase secrets set STORAGE_PROVIDER=r2 + redeploy.
```

That is a real improvement over the plan: the fallback is a supported provider rather than
ad-hoc error handling, and the switch is a secret rather than a deploy.

### Five logical buckets, not three

The plan migrates three buckets and leaves covers and documents on Supabase Storage. The
implementation defines **five logical buckets** and routes all of them through the abstraction:

```typescript
export type BucketName = "tracks" | "stems" | "watermarked" | "covers" | "documents";
```

Logical names map to physical buckets through `` `R2_BUCKET_${bucket.toUpperCase()}` ``.

### There is no `r2://` path prefix

§4.2 below proposes storing `r2://bucket/key` in `tracks.audio_url`. **That convention was not
adopted.** Paths are stored as plain relative keys — `<workspace_id>/<uuid>.<ext>` — and the
bucket is resolved from the logical name at call time. The provider, not the stored string,
decides where the object lives.

This matters for §8.4 and §12: the verification queries below test for an `r2://` prefix that
does not and will not exist. They cannot be used as written.

### Environment variables differ

| This document | Reality |
|---|---|
| `R2_ACCOUNT_ID` | **Does not exist.** The endpoint is given directly |
| `R2_PUBLIC_URL` / custom domain | **Does not exist.** Every read is a signed URL |
| `R2_ENDPOINT` | ✅ used, and requests are **path-style** |
| `R2_BUCKET_TRACKS` / `_STEMS` / `_WATERMARKED` | ✅ used, plus `_COVERS` and `_DOCUMENTS` |
| — | `STORAGE_PROVIDER` (`supabase` \| `r2`), which this plan does not anticipate |

### Other corrections

- The column is **`stems.file_url`**, not `stems.url` — the queries in §8.4 and the checklist in
  §12 name the wrong column.
- The dev server runs on port **8080**, not 5173, so the CORS origins in §3.4 are wrong.
- Previews are `_preview.mp3` **siblings** of the original inside the `tracks` bucket, not a
  `previews/` subfolder.
- The `get-upload-url` Edge Function exists and allows four buckets — `tracks`, `stems`,
  `covers`, `documents` — never `watermarked`, which only the watermark service writes.

### What remains genuinely open

Whether the **bulk data migration** (§8) has been run to completion is not determinable from
the repository. `scripts/test-r2-parity.ts` and `scripts/test-r2-standalone.ts` exist for
verification. Confirm the actual state in the Cloudflare and Supabase dashboards before acting
on §8 or the §12 cleanup checklist.

---

## 1. Why this migration

### The problem

Supabase Storage is built for transactional files (avatars, attachments), not multi-terabyte
music catalogs. At Trakalog's scale — WAV audio plus stems plus previews plus per-visitor
watermarked copies — costs become prohibitive quickly.

| Metric | Supabase Storage | Cloudflare R2 |
|---|---|---|
| Storage | ~$0.021/GB ($21/TB) | $0.015/GB ($15/TB) |
| Egress | $0.09/GB beyond 250 GB | **$0 — unlimited** |
| Free tier | Included in the Pro plan ($25/month) | 10 GB storage + 1M class A + 10M class B ops |
| Class A ops (upload, list) | Included | $4.50 / 1M |
| Class B ops (download, head) | Included | $0.36 / 1M |
| S3 compatibility | Partial | ✅ Complete |
| Built-in CDN | No | ✅ Cloudflare network (300+ PoPs) |

### The gain at 1,000 paying users

- 600 Starter × 20 GB + 350 Pro × 80 GB + 50 Business × 300 GB = **~55 TB stored**
- Supabase: ~$1,150/month storage plus several hundred dollars a month of egress
- R2: **~$825/month storage + $0 egress**
- **Saving: $400-700/month minimum, scaling linearly**

### Why R2 and not B2

- **Simplicity:** one provider, one SDK, one bill
- **Cloudflare is already in use** for DNS
- **Native free egress**, with no Bandwidth Alliance configuration
- **Full S3 compatibility:** migrating to B2 later would be trivial — change endpoint and
  credentials
- **Native custom domain:** files can be served from `audio.trakalog.com` with automatic HTTPS

---

## 2. Target architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER / LISTENER                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│             CLOUDFLARE CDN (300+ edges worldwide)           │
│             audio.trakalog.com (custom domain)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (signed URL or access key)
┌─────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE R2 BUCKETS                     │
│                                                             │
│   ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│   │ trakalog-      │  │ trakalog-      │  │ trakalog-    │ │
│   │ tracks         │  │ stems          │  │ watermarked  │ │
│   │ (original)     │  │ (stem audio)   │  │ (WM cache)   │ │
│   └────────────────┘  └────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ (signed PUT URLs)
                              │
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS                        │
│                                                             │
│  - get-audio-url        (signed R2 URL for playback)        │
│  - get-upload-url       (signed R2 URL for upload)          │
│  - get-watermarked-audio (R2 cache + Railway watermark)     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  SUPABASE POSTGRES (unchanged)              │
│      tracks.audio_url, stems.file_url, watermark_payloads   │
└─────────────────────────────────────────────────────────────┘
```

> **As built:** the custom-domain layer was not implemented. Every read is a 300-second signed
> URL against `R2_ENDPOINT`, path-style. Covers and documents also route through the
> abstraction rather than staying on Supabase Storage.

### What stays on Supabase Storage *(per the original plan)*

- Cover art (low volume, ~50 KB per image, frequent access but small egress)
- PDF documents (paperwork, signed PDFs — moderate use)
- User avatars (negligible volume)

### What migrates to R2

- Original audio (WAV, FLAC, MP3, AIFF) — bucket `trakalog-tracks`
- Audio previews (compressed 128 kbps MP3) — bucket `trakalog-tracks`
- Stems (multiple files per track) — bucket `trakalog-stems`
- Watermarked audio (per-visitor cache) — bucket `trakalog-watermarked`

---

## 3. Cloudflare R2 setup (Phase 0)

### 3.1 Enable R2

1. Cloudflare dashboard → R2 → "Purchase R2"
2. Enable it (card required; the free tier is generous up to 10 GB)
3. Settings → R2 → Manage R2 API Tokens → "Create API Token"
4. Permissions: **Object Read & Write**
5. Specify bucket: apply to all buckets, or create one token per bucket for granularity
6. TTL: forever, or 90-day rotation as preferred
7. **Record** the Access Key ID, Secret Access Key and Endpoint URL

### 3.2 Create the buckets

```
trakalog-tracks       (original audio + previews)
trakalog-stems        (multi-file stems)
trakalog-watermarked  (watermarked audio cache)
```

For each: Region **Automatic**; Public Access **Disabled** (signed URLs only); CORS configured
per §3.4.

> **As built:** five buckets, adding `trakalog-covers` and `trakalog-documents`.

### 3.3 Custom domain (optional)

1. Bucket `trakalog-tracks` → Settings → Custom Domains → "Connect Domain"
2. Enter `audio.trakalog.com`
3. Cloudflare creates the CNAME and SSL certificate automatically
4. Allow ~5 minutes to propagate

This custom domain only affects how branded the URLs look. Signed URLs work through the
standard R2 domain regardless.

> **As built:** not implemented. There is no `R2_PUBLIC_URL` and no custom domain in the code
> path.

### 3.4 Configure CORS

To allow direct uploads from the Trakalog browser client:

```json
[
  {
    "AllowedOrigins": [
      "https://app.trakalog.com",
      "https://trakalog.com",
      "http://localhost:8080"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

> Corrected from the original, which listed `http://localhost:5173`. The Vite dev server runs
> on **8080** (`vite.config.ts`).

### 3.5 Add the Supabase secrets

In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```
STORAGE_PROVIDER=r2
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access key from 3.1>
R2_SECRET_ACCESS_KEY=<secret from 3.1>
R2_BUCKET_TRACKS=trakalog-tracks
R2_BUCKET_STEMS=trakalog-stems
R2_BUCKET_WATERMARKED=trakalog-watermarked
R2_BUCKET_COVERS=trakalog-covers
R2_BUCKET_DOCUMENTS=trakalog-documents
```

> Corrected from the original, which listed `R2_ACCOUNT_ID` and `R2_PUBLIC_URL` — neither is
> read by any code — and omitted `STORAGE_PROVIDER`, which is what actually selects the backend.
> **Without `STORAGE_PROVIDER=r2`, the Edge Functions silently use Supabase Storage.**

---

## 4. Shared storage helper

### 4.1 The helper module

> **Editorial note (September 2, 2026).** This section originally carried ~150 lines of a
> proposed `_shared/r2.ts`, implementing AWS Signature V4 by hand. That code has been
> **superseded by `supabase/functions/_shared/storage.ts`**, which ships a provider interface
> with both Supabase and R2 implementations. The superseded listing has been removed rather
> than translated, because reproducing a dead implementation in a living document invites
> someone to build it. Read the real module instead.

The shipped interface, in outline:

```typescript
export type BucketName = "tracks" | "stems" | "watermarked" | "covers" | "documents";

export interface SignedUploadDescriptor {
  method: "PUT";
  url: string;
  headers: Record<string, string>;
}

export interface StorageProvider {
  readonly name: "supabase" | "r2";
  createSignedUrl(bucket: BucketName, key: string, expiresInSec?: number): Promise<string>;
  createSignedUploadUrl(bucket: BucketName, key: string, contentType: string): Promise<SignedUploadDescriptor>;
  exists(bucket: BucketName, key: string): Promise<boolean>;
}

export function getStorageProvider(): StorageProvider;  // reads STORAGE_PROVIDER
```

Key properties, all verified:

- Signed URLs default to **300 seconds**, "to match Trakalog's DRM posture"
- The R2 provider signs with the Web Crypto API — no npm dependency in the Deno runtime
- Requests are **path-style** against `R2_ENDPOINT`, not virtual-host
- A missing `R2_BUCKET_*` variable throws immediately rather than failing silently

### 4.2 Path convention in the database

> ⚠️ **This section describes a convention that was NOT adopted.** It is kept as a record of the
> decision that was considered and rejected.

The original proposal was to prefix paths with the backend:

```
Before (Supabase Storage):
tracks.audio_url = "tracks/workspace_xxx/track_yyy.wav"

After (R2):
tracks.audio_url = "r2://trakalog-tracks/workspace_xxx/track_yyy.wav"
```

with the `r2://` prefix letting code detect which backend holds a file during progressive
migration.

**What shipped instead:** plain relative keys, `<workspace_id>/<uuid>.<ext>`, with the backend
resolved by `STORAGE_PROVIDER` at call time. This is cleaner — the stored path says *where in
the bucket*, never *which vendor* — but it means there is no per-row marker of migration state,
which is why §8.4's verification queries do not work.

---

## 5. Edge Function changes

The three functions this document proposed are all live:

| Function | Status | Notes |
|---|---|---|
| `get-audio-url` | ✅ shipped | Serves both the anonymous shared-link flow (with a `slug`) and the authenticated flow. Refuses `quality: "original"` unless the link allows downloads. Checks the preview object actually exists before serving it, falling back to the original. Rate limit 60/min per IP. |
| `get-upload-url` | ✅ shipped | Signs a direct `PUT`. Allows `tracks`, `stems`, `covers`, `documents` — never `watermarked`. Default 600s, max 3600s. Verifies workspace membership against the key's **first path segment**. Rate limit 60/min. |
| `get-watermarked-audio` | ✅ shipped | Cache key `SHA-256("{link_id}_{visitor_email}_{storage_path}") + "-v2"`; 300s signed URLs; rate limit 60/min. |

> The original ~300 lines of proposed implementation for these three functions have been removed
> rather than translated, for the same reason as §4.1: they are superseded, and the shipped
> versions differ in ways that matter (the provider abstraction, the membership check on the key
> prefix, the preview-existence fallback). Read the real functions.

---

## 6. Frontend changes

### 6.1 Upload flow

`UploadTrackModal.tsx` requests a descriptor and `PUT`s the bytes directly:

```typescript
const descriptor = await getStorageUploadUrl(bucket, path, contentType);
const xhr = new XMLHttpRequest();
xhr.open(descriptor.method, descriptor.uploadUrl);
for (const [name, value] of Object.entries(descriptor.headers)) {
  xhr.setRequestHeader(name, value);
}
xhr.upload.addEventListener("progress", (e) => {
  if (e.lengthComputable && e.total > 0) onProgress((e.loaded / e.total) * 100);
});
```

The helpers live in `src/lib/audio.ts`: `getStorageSignedUrl`, `getStorageUploadUrl`,
`getAudioPlaybackUrl`, `getWatermarkedAudioUrl`. They carry an LRU cache of 50 entries with a
4-minute TTL — one minute inside the 5-minute signed-URL lifetime, so a caller never receives a
URL that expires mid-fetch.

### 6.2 Audio playback

No component changes were needed. Players receive a URL and do not care which backend produced
it.

### 6.3 Upload progress

`XMLHttpRequest` rather than `fetch`, because `fetch` still has no upload progress event.

---

## 7. Database RPCs — no change required

The existing RPCs (`insert_track`, `update_track`, `insert_track_document`, …) already accept a
text path. **No SQL change was necessary**, and that held true in the shipped version.

---

## 8. Migrating existing files

### 8.1 Strategy: progressive background migration

1. **Phase A:** new uploads go straight to R2 (code cutover)
2. **Phase B:** a background script copies existing files Supabase → R2 and updates the
   database
3. **Phase C:** after verification, delete the Supabase Storage files

### 8.2 Migration script

```typescript
// scripts/migrate-storage-to-r2.ts
// Run once after the code cutover.

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// For each track: download from Supabase Storage, PUT to R2, update the row.
// The script must be idempotent — skip anything already present in R2.
```

> The full listing has been condensed. Note that the original relied on the `r2://` prefix for
> idempotency, which does not exist in the shipped schema; idempotency must instead come from a
> `HEAD` against R2 before copying.

### 8.3 Running it

```bash
npm install @aws-sdk/client-s3 @supabase/supabase-js
export R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
export R2_BUCKET_TRACKS=trakalog-tracks
export R2_BUCKET_STEMS=trakalog-stems
export SUPABASE_URL=https://xhmeitivkclbeziqavxw.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

npx tsx scripts/migrate-storage-to-r2.ts
```

### 8.4 Post-migration verification

> ⚠️ **These queries do not work as written.** They test for an `r2://` prefix that the shipped
> schema never stores (§0). There is no per-row marker of which backend holds a file — the
> provider is global, set by `STORAGE_PROVIDER`. Verify instead by listing objects in R2 and
> comparing against `tracks.audio_url` / `stems.file_url`, which is what
> `scripts/test-r2-parity.ts` exists to do.

```sql
-- Original, non-functional:
SELECT COUNT(*) FROM tracks WHERE audio_url NOT LIKE 'r2://%';
SELECT COUNT(*) FROM stems  WHERE file_url NOT LIKE 'r2://%';
```

Only once everything verifies, and playback is confirmed for both old and new tracks, delete
the Supabase Storage files.

⚠️ **Do not delete Supabase Storage until a week of end-to-end verification has passed.**

---

## 9. Implementation phases

### Phase 1 — Setup (1 day)
Enable R2, create the buckets, generate the API token, configure CORS, optionally set up the
custom domain, add the Supabase secrets, test an upload/download manually with curl.

### Phase 2 — Helper code (1-2 days)
Build the shared storage module, test it locally, deploy.

### Phase 3 — Edge Functions (2-3 days)
Create `get-upload-url`; modify `get-audio-url` and `get-watermarked-audio`; end-to-end tests.

### Phase 4 — Frontend (2-3 days)
Update `UploadTrackModal.tsx` (signed-URL upload + XHR progress) and `StemsTab.tsx`; verify
every audio player still works; test all supported formats, mobile and every browser.

### Phase 5 — Cutover (1 day)
Merge, deploy the Edge Functions and the frontend, test against a production track, monitor logs
for 24 hours.

### Phase 6 — Data migration (1 day + background)
Run the migration script, monitor progress, verify end-to-end on 10 random old tracks, then a
week of verification before cleaning up Supabase Storage.

### Phase 7 — Future optimisations (optional)
Multipart upload for large files, R2 lifecycle policies (auto-archiving watermarked objects
older than 30 days), R2 event notifications.

---

## 10. Pricing recalculated after migration

> ⚠️ **Superseded prices.** The $14 / $29 / $59 figures below come from the abandoned
> workspace-based pricing. Current pricing is in
> [`TRAKALOG_BILLING.md`](../FEATURES/TRAKALOG_BILLING.md) v5.0: Starter $10, Pro $25,
> Business $45 monthly, with storage caps of 1.5 GB / 40 GB / 400 GB / 1 TB. This section has
> not been recalculated — read the ratios, not the amounts.

| Plan (old pricing) | Storage cost | Egress | Gross storage margin |
|---|---|---|---|
| Free (3 tracks ≈ 150 MB) | $0.002/user/month | $0 | ~99.99% |
| Starter ($14/month, 100 tracks ≈ 5 GB) | $0.075/user/month | $0 | 99.5% |
| Pro ($29/month, 1000 tracks ≈ 50 GB) | $0.75/user/month | $0 | 97% |
| Business ($59/month, ~300 GB average) | $4.50/user/month | $0 | 92% |

### Strategic possibility

With these margins, more generous quotas could be advertised:

- Starter: 500 GB instead of 100 tracks (cost $7.50/user, 46% margin — workable but tight)
- **Better:** keep Starter at 100 tracks, justified by features rather than storage, but
  **advertise "500 GB included"** so it reads clearly. Users will rarely exceed 50 GB.
- Pro: advertise "2 TB" instead of 1,000 tracks → $30/user worst case, still positive
- Business: advertise "10 TB" → covers 95% of cases, even for labels

> The v5.0 caps that shipped (1.5 GB / 40 GB / 400 GB / 1 TB) are considerably more conservative
> than this section proposes. The Business cap was explicitly cut from 2 TB to 1 TB in August
> 2026 on margin grounds — see [`TRAKALOG_BILLING.md`](../FEATURES/TRAKALOG_BILLING.md) §2.

---

## 11. Risks and mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Signature V4 bug in the storage helper | Medium | High | Unit tests before deploying; Supabase Storage fallback on error |
| Migration interrupted mid-run | Medium | Medium | Idempotent script, SQL monitoring |
| A listener loads a track during migration | Low | Low | `get-audio-url` resolves the backend automatically |
| CORS misconfigured | High initially | Medium | Test with curl before wiring the frontend |
| Custom domain SSL not propagated | Low | Low | Fall back to the standard R2 domain |
| R2 quota exceeded on a free account | Medium | Low | R2 does not cut service; it bills the overage |
| Accidental Supabase Storage deletion | Medium | Very high | **A week of verification before cleanup. Back up before deleting.** |
| Watermarking cache hit rate dropping | Low | Medium | Monitor `get-watermarked-audio` Edge Function logs |

---

## 12. Post-migration checklist

- [ ] All frontend uploads go to R2
- [ ] All frontend downloads read from R2 via signed URL
- [ ] Watermarking cache on R2 works
- [ ] Stems upload and read from R2
- [ ] ~~100% of tracks have an `r2://` prefix~~ — **not applicable**, see §0. Verify with
      `scripts/test-r2-parity.ts` instead
- [ ] ~~100% of stems have an `r2://` prefix~~ — **not applicable**; the column is
      `stems.file_url`
- [ ] Playback tested on 10 migrated old tracks (random sample)
- [ ] Playback tested on 5 new tracks uploaded post-cutover
- [ ] Watermarking tested through a shared link
- [ ] Trakalog Pack ZIP tested (multi-file download)
- [ ] Tested on iOS and Android
- [ ] Tested on Firefox, Chrome and Safari
- [ ] Edge Function logs checked for recurring errors
- [ ] Estimated Cloudflare bill compared against the previous Supabase bill
- [ ] Supabase Storage cleanup: tracks (after 7 days of verification)
- [ ] Supabase Storage cleanup: stems (after 7 days)
- [ ] Supabase Storage cleanup: watermarked (after 7 days)
- [ ] Documentation updated: `TRAKALOG_ARCHITECTURE.md` technical stack section

---

## 13. Dependencies

### Blocked on

- **No technical dependency** — it can run in parallel with other features
- **Recommendation:** do it after Stripe/Billing, to avoid mixing priorities

### Impacts

- **Genesis Protocol:** Origin Prints will hash files on R2. No issue — the hashes are identical
  wherever the file lives.
- **Track Versioning:** multiple versions mean more storage, making R2 more valuable still.
- **Brief Seeker / Artist Seeker:** no direct impact.
- **Admin Dashboard:** add a "storage used per workspace" widget. Note this is now easier than
  the plan assumed — `tracks`, `track_versions`, `stems` and `track_documents` each carry
  `file_size_bytes`, and `compute_user_storage_bytes` already aggregates them, so the widget can
  read Postgres rather than querying the R2 API.

### Does not touch

- Auth, RLS, `SECURITY DEFINER` RPCs
- Smart A&R, Sonic DNA (they keep reading files through signed URLs)
- The Railway watermarking service (it reads audio by URL, whatever the backend)
- Stripe / billing

---

## 14. Technical notes

### Signed URL lifetimes

- **GET (read):** 300s — enough to start and finish playback
- **PUT (upload):** 3600s — enough for a large WAV
- **DELETE:** 300s — rare, server-side only

*As built:* `get-upload-url` defaults to **600s**, clamped to a 3600s maximum. Reads are 300s
throughout.

### HTTP caching at Cloudflare

Signed URLs are **not cached** by Cloudflare — each URL is unique because of its signature. That
is deliberate: every listen produces a fresh signed URL, so access is auditable and expiry is
short.

If caching is later wanted for public previews, a custom domain with a dedicated public path
would be cached by Cloudflare automatically.

### Multipart upload (>5 MB)

R2 supports multipart uploads through the S3 SDK. For files over 5 MB, parallel chunked upload
is much faster. Worth implementing in Phase 7 to improve the experience for large WAVs.

### Object lifecycle

R2 supports lifecycle rules. Worth considering:

- Delete objects in `trakalog-watermarked` after 30 days without access — an unaccessed cache
  entry is dead weight
- Keep `trakalog-tracks` and `trakalog-stems` forever; that is the user's catalog

### S3 compatibility

R2 implements AWS Signature V4, so any S3 SDK works: `@aws-sdk/client-s3` (Node, used by the
migration script), `boto3` (Python), `aws-sdk` (Go, Rust and others).

The shipped `_shared/storage.ts` signs in pure JavaScript through the Web Crypto API, with no
dependency, to keep the Edge Function bundle small.

---

*This document is living, and will be updated during and after the migration.*
