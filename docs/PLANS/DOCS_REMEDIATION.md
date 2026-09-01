# Docs audit & remediation plan — `ishan/translated-docs` → `main`

> **Purpose:** this document is both the audit report and the work plan. It is written to drive
> multiple future Claude Code sessions. Each chunk in §5 is sized for one session and ends with
> a commit on `ishan/translated-docs`. Work them in order; tick them off as you go.
>
> **Status:** chunks 0 and 1 complete. Next up: **chunk 2** (`DEVELOPMENT/` corrections).
> **Audited:** September 1–2, 2026, against commit `fbc70f0`.

---

## 1. Context

`ishan/translated-docs` adds ~21,900 lines across 60 markdown files in `docs/`: seven numbered
architecture documents, ten ADRs, five new feature deep-dives, development and operations
guides, and `INDEX.md` hubs — plus a reorganization of the pre-existing docs into topic
subdirectories.

The structure is genuinely good and worth keeping. But a fact-check against the schema and
source found three classes of defect that must be fixed before merge, because CLAUDE.md points
every future session at these files as the source of truth:

1. **Fabricated technical detail.** The narrative is broadly right; the specifics frequently
   are not. `03-DATA_ARCHITECTURE.md` documents 10 tables that do not exist and gets column
   names wrong in essentially every table it covers. `04-COMPONENT_ARCHITECTURE.md` builds its
   two most detailed walkthroughs on files that do not exist.
2. **Incomplete translation.** 12 live docs are still in French on a branch named
   `translated-docs`.
3. **Broken links, stale indexes, inflated status labels.** 27 dead relative links; index pages
   listing a third of what is actually present; seven docs self-labelled `Draft` but advertised
   as `🟢 Stable`.

There is also a small set of corrections that belong in **`CLAUDE.md` itself** — it is stale on
watermarking, storage quotas, and frontend env vars.

**Decisions taken (Sept 2, 2026):** fix everything before merging, in session-sized chunks each
committed to the branch. Translate the 12 active French docs; leave `docs/_archive/rls-phases/`
in French as frozen history.

---

## 2. How to use this document

- Work chunks **in order** — chunk 0 and 1 unblock everything else.
- Each chunk states: scope, files, the specific edits, and acceptance criteria.
- **Commit at the end of every chunk** with the suggested message. Do not batch chunks.
- Re-run the §3 toolkit at the end of each chunk; it is the regression suite for this work.
- When a chunk needs a judgement call the audit could not settle, it is flagged
  **⚠️ DECISION** — surface it rather than guessing.
- Ground truth, in priority order: `supabase/migrations/20260626144305_baseline_prod.sql`
  (+ later migrations) → `src/` and `supabase/functions/` source → `package.json` / configs.
  **Never trust a doc over the code.** `supabase/migrations/_archive/` is history and must
  never be treated as live schema.

---

## 3. Verification toolkit

Re-runnable checks. Run all four at the end of each chunk. Run from the repo root.

**Broken relative links** (should reach 0 after chunk 1):
```bash
python3 -c "
import os,re
docs=[os.path.join(dp,f) for dp,_,fn in os.walk('docs') for f in fn if f.endswith('.md')]
L=re.compile(r'\[([^\]]*)\]\(([^)\s]+)\)');n=0
for d in sorted(docs):
    t=re.sub(r'\`\`\`.*?\`\`\`','',open(d).read(),flags=re.S)
    t=re.sub(r'\`[^\`\n]*\`','',t)   # strip inline code too
    for m in L.finditer(t):
        g=m.group(2)
        if g.startswith(('http','mailto','#')):continue
        p=g.split('#')[0].replace('%20',' ')
        if p and not os.path.exists(os.path.normpath(os.path.join(os.path.dirname(d),p))):
            print(d,'->',g);n+=1
print('BROKEN:',n)"
```

**Nonexistent code paths cited** (should reach 0 for live docs; `_archive` and `PLANS` may keep
historical references — see chunk 1):
```bash
python3 -c "
import os,re
docs=[os.path.join(dp,f) for dp,_,fn in os.walk('docs') for f in fn if f.endswith('.md')]
P=re.compile(r'\`(/?(?:src|supabase|services|scripts|sonic-dna-service)/[A-Za-z0-9_./\-]+\.(?:ts|tsx|js|sql|py|sh|json|md))\`');n=0
for d in sorted(docs):
    for m in P.finditer(open(d).read()):
        if not os.path.exists(m.group(1).lstrip('/')):print(d,'->',m.group(1));n+=1
print('MISSING PATHS:',n)"
```

**Residual French** (should list only `docs/_archive/` after chunk 8):
```bash
python3 -c "
import os,re
F=re.compile(r'\b(le|la|les|des|une|pour|est|sont|dans|nous|vous|cette|qui|que|plus|tous|aucun|doit|peut|utilisateur|fichier|sécurité|gestion|chaque|entre|sans|aux|du)\b',re.I)
for dp,_,fn in os.walk('docs'):
    for f in sorted(fn):
        if not f.endswith('.md'):continue
        p=os.path.join(dp,f);t=re.sub(r'\`\`\`.*?\`\`\`','',open(p).read(),flags=re.S)
        w=re.findall(r\"[A-Za-zÀ-ÿ']+\",t)
        if w and len(F.findall(' '.join(w)))/len(w)*100>3:print(f'{len(F.findall(chr(32).join(w)))/len(w)*100:5.1f}%  {p}')"
```

**Orphans + status mismatches:**
```bash
grep -rn '^> \*\*Status:\*\*' docs --include='*.md'    # compare against the INDEX.md tables
```

---

## 4. Findings report

Severity: **S1** actively misleads a developer or a future Claude session · **S2** wrong but
self-evidently so · **S3** cosmetic/structural.

### 4.1 — S1 · `GETTING_STARTED.md` silently points a new dev at production

`src/` contains **zero** occurrences of `import.meta.env`.
`src/integrations/supabase/constants.ts` is two lines, both hardcoded string literals
(`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`). So a developer who follows the guide, writes
`VITE_SUPABASE_URL=http://localhost:54321` into `.env.local`, and starts the app is running
**against production Supabase** with no indication.

Compounding it, in the same file:

| Doc claim | Reality |
|---|---|
| `npm run db:start` (L27, 42, 154, 284, 308, 322, 371, 521, 583) | Does not exist |
| `npm run db:stop` (L285, 330, 366, 369), `db:reset` (L286, 370) | Do not exist |
| `cp .env.local.example .env.local` (L179) | No such file |
| App at `http://localhost:5173` (L34, 217, 223, 386, 394) | `vite.config.ts:9` → **8080** |
| `cd trakalog-muse-palette` (L21, 109, 113, 306) | Repo is `trakalo-muse-palette` (no `g`) — the `cd` fails |
| Node ≥24.16.0, npm ≥11.13.0 (L54, 64, 96) | No `engines` field, no `.nvmrc` — unenforced |
| "Supabase CLI installed as a dev dependency" (L24, 125, 449, 498) | `supabase` is in neither `dependencies` nor `devDependencies` |
| `NEXT_PUBLIC_R2_PUBLIC_URL`, `NEXT_PUBLIC_PITCH_ENABLED` (L194, 414, 417) | Read by nothing; `NEXT_PUBLIC_*` is a Next.js prefix in a Vite app |
| `supabase/snippets/` holds SQL snippets (L251) | Directory is empty |

Real scripts: `dev`, `build`, `build:dev`, `lint`, `preview`, `test`, `test:watch`, `db:check`.

### 4.2 — S1 · `03-DATA_ARCHITECTURE.md` is substantially fabricated

- **10 documented tables do not exist.** Verified — `grep -c "CREATE TABLE public.<t> "` on the
  baseline returns 0 for each:

  | Doc table | Reality |
  |---|---|
  | `splits` | `tracks.splits` is a **jsonb column** |
  | `signatures` | `signature_requests` (different schema: `token`, `split_share`, `signed_externally`) |
  | `documents` | `track_documents` |
  | `shared_links_access` | `shared_link_sessions` + `link_events` + `link_downloads` |
  | `track_tags` | `tracks.tags` jsonb |
  | `contact_aliases` | `artist_aliases` |
  | `usage_tracking`, `storage_usage` | counter columns on `subscriptions` |
  | `whitelist` | `whitelisted_emails` (`id`, `email`, `created_at` — no `reason`) |
  | `pitch_tracks` | `pitches.track_ids uuid[]` |

- **16 real tables omitted:** `beta_passes`, `credit_purchases`, `invitations`, `jobs`,
  `leak_traces`, `link_downloads`, `link_events`, `marketplace_requests`,
  `shared_link_sessions`, `site_visits`, `stripe_prices`, `stripe_webhook_events`,
  `track_ratings`, `waitlist`, `watermark_payloads`, `artist_aliases`.

- **Column names wrong in nearly every documented table.** `plan_limits` is the extreme case —
  the doc's eight names (`plan_name`, `max_tracks`, `max_seats`…) have **zero** overlap with the
  real sixteen (`plan`, `tracks_max`, `seats_included`…). Others: `tracks` documented with
  `created_by`/`file_path`/`is_deleted`/`deleted_at` (none exist; real: `uploaded_by`,
  `audio_url`, and **no soft-delete column at all**, which invalidates the soft-delete pattern
  taught at L1200-1212); `workspaces.created_by` → `owner_id`, `hero_position` is `integer`
  not `text`; `profiles` documented with `first_name`/`last_name`/`bio`/`phone` (real:
  `full_name`, `email`, `avatar_url`, `onboarding_complete`); `subscriptions.plan_id` →
  `plan`, `customer_id` → `stripe_customer_id`.

- **The entire RLS section (L893-1085) is built on two nonexistent functions.** Verified:
  `current_workspace_id()` appears nowhere in the repo; `is_workspace_admin()` exists **only**
  in `supabase/migrations/_archive/rls_audit_fixes.sql`, which CLAUDE.md says must never be
  replayed. The real helpers are `has_workspace_role`, `has_any_workspace_role`,
  `has_workspace_access_level`, `require_workspace_access_level`, `is_workspace_member`,
  `is_platform_admin`.

- L448 cites RPC `get_track_with_relations` — does not exist.
- L1095 shows virtual-host R2 URLs; `_shared/storage.ts` uses **path-style** against `R2_ENDPOINT`.

### 4.3 — S1 · `04-COMPONENT_ARCHITECTURE.md` documents files that do not exist

- **`src/components/TrackCard.tsx` does not exist** (verified) — yet it is the subject of the
  doc's most detailed component walkthrough (L727-791) *and* its entire testing example
  (L1356-1403).
- **All six hooks in §8 are fictional:** `useSupabase.ts`, `useAudio.ts`, `useDebounce.ts`,
  `useMediaQuery.ts`, `useLocalStorage.ts`, `useOnClickOutside.ts`. §8.2 documents the internals
  of two of them. Real `src/hooks/`: `use-global-shortcuts.ts`, `use-mobile.tsx`,
  `use-onboarding-status.ts`, `use-saved-contacts.ts`, `use-toast.ts`,
  `useContactSuggestions.ts`, `useResolveArtistNames.ts`, `useTrackCompleteness.ts`,
  `useWorkspaceSeats.ts`.
- Also fictional: `TrackGrid.tsx`, `TrackList.tsx`, `PlaylistCard.tsx`,
  `PlaylistTrackItem.tsx`, `ContactCard.tsx`, `ErrorFallback.tsx`, `@/components/ui/image.tsx`
  (a Next.js `<Image>` snippet in a Vite SPA). `components/crossfadePlayer.ts` is really
  `src/lib/crossfadePlayer.ts`; `components/SharedPlaylistView.tsx` is a *page*.
- `main.tsx` (L82-96) shown with `React.StrictMode` + `MotionConfig`; real file uses
  `<ErrorBoundary>` and a `vite:preloadError` handler. `MotionConfig` is in `App.tsx:231`.
- `lib/adminMode.ts` (L334-339) described as an email allowlist; it is **hostname-based**
  (`admin.trakalog.com`) with a `?admin=1` dev override.
- `tailwind.config.ts` (L1097-1121) misquoted: doc shows hardcoded hex and `Inter` first; real
  config uses `hsl(var(--…))` variables and `["Sora","Inter","system-ui","sans-serif"]`.
- Test organization (L1338-1350) describes five `src/test/` subdirectories; the directory holds
  exactly `example.test.ts` and `setup.ts`.
- Pages list (L456-484) presented as complete but omits `Onboarding`, `LandingPage`, `NotFound`,
  `PrivacyPolicy`, `TermsOfService`, `SharedStemAccess`, `SharedPlaylistView`. Components tree
  omits `src/components/visual/`.
- Route list omits `/onboarding`, `/tracks/:id`, `/playlist/shared/:playlistId`; L302 shows
  `/approvals` as unconditional when `App.tsx:205` feature-flags it.

### 4.4 — S1 · `FEATURES/SHARING_SYSTEM.md` — every cited path is wrong

| Doc | Reality |
|---|---|
| `src/components/sharing/ShareModal.tsx` | `src/components/ShareModal.tsx` (no `sharing/` dir) |
| `src/pages/SharePage.tsx` | `src/pages/SharedLinkPage.tsx` |
| `src/pages/SharedLinkManagement.tsx` | `src/pages/SharedLinks.tsx` |
| `src/hooks/useSharedLink.ts` | none — state is `src/contexts/SharedLinksContext.tsx` |
| `src/components/sharing/ShareButton.tsx`, `src/components/audio/ShareAudioPlayer.tsx` | do not exist |
| EF `create-shared-link`, `validate-shared-link` | do not exist — creation is RPC `create_shared_link` (`SharedLinksContext.tsx:211`) |
| `POST /record-access` | EFs are `log-link-access`, `log-link-event` |

- **`shared_links_access` does not exist** (L78, 169, 338-359, 526, 567-569) — all 15 columns
  and the three analytics metrics built on it are fabricated.
- `shared_links` columns: `title`→`link_name`, `password`→`password_hash`,
  `download_enabled`→`allow_download` (**default false**, doc says true),
  `save_to_trakalog_enabled`→`allow_save`, `watermark_enabled`→`watermarking_enabled`.
  `max_accesses`, `access_count`, `branding_override`, `notification_email`, `is_active` **do
  not exist**; `status` is the `link_status` enum. Doc omits `link_type`, `message`,
  `pack_items`, `gate_screen_enabled`.
- `download_quality` is CHECK-constrained to `'hi-res'|'low-res'` — not low/medium/high.
- `watermark_payloads`: PK is `hash_hex` (not `id`/`hash`); no `track_id`. Breaks the SQL at
  L545/L548.
- **L459 "bcrypt cost 12" is wrong** — `hash-link-password/index.ts:5-18` is PBKDF2-SHA256,
  100,000 iterations, 16-byte salt, stored `saltHex:hashHex`. *(Verified.)*
- L471 "crypto-random UUID v4" — actually a 12-char base36 string from `crypto.getRandomValues`
  (`SharedLinksContext.tsx:83-92`).
- L542 `audiowmark decode` — the subcommand is `get`.
- L422-426 env vars and L432-435 feature flags: none exist. L441-444 RLS policy names: none exist.

### 4.5 — S1 · `FEATURES/TRACK_MANAGEMENT.md`

- Nonexistent paths: `src/pages/UploadTrack.tsx`, EF `process-track`, EF `upload-track`
  (real: `get-upload-url`), `src/components/audio/{UploadZone,AudioPlayer}.tsx`,
  `src/hooks/useTrackUpload.ts`.
- **`track_status` enum is `available` / `on_hold` / `released`** *(verified,
  `baseline_prod.sql:183`)* — not `draft/ready/processing/error`. The L142 sequence diagram and
  L381 error path are therefore fictional.
- `tracks` columns, 8 of 16 wrong: `created_by`→`uploaded_by`, `artists text[]`→`artist text` +
  `featuring`, `duration`→`duration_sec`, `file_path`→`audio_url`,
  `preview_path`→`audio_preview_url`, `cover_path`→`cover_url`, `bpm integer`→`smallint`;
  `json_metadata` does not exist (real: separate `sonic_dna`, `tags`, `credits`,
  `waveform_data` columns); `is_deleted` does not exist.
- L259/L342 `R2_BUCKET_PREVIEWS` / bucket `trakalog-previews` — not a logical bucket.
  `_shared/storage.ts:21-26` defines exactly five: `tracks`, `stems`, `watermarked`, `covers`,
  `documents`. Previews live under `trakalog-tracks/previews/`.
- **L339 `STORAGE_PROVIDER` default is `supabase`, not `r2`** *(verified,
  `_shared/storage.ts:4`)*.
- L303 lists `splits` as a one-to-many table, contradicting `SPLITS_AND_SIGNATURES.md:179`
  which correctly calls it a jsonb column.

### 4.6 — S1 · `CLAUDE.md` is itself stale on three points

| CLAUDE.md says | Ground truth |
|---|---|
| audiowmark **strength 12**, delivery in **MP3 128k** | `services/watermark/index.js:31-32` → `WM_STRENGTH="10"`, `MP3_BITRATE="320k"`. `get-watermarked-audio/index.ts:93` says `-v2` keys exist to invalidate "the old 128k/strength-12 pipeline" |
| Storage: **Free 2 GB** … **Business 1 TB** | Free is **1.5 GB** (`20260805143255…sql:3`); Business 1 TB ✓ (`20260805203027_business_storage_cap_1tb.sql:7`) |
| "Frontend env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`" | Hardcoded in `constants.ts`; nothing reads env |

This is the highest-value-per-line fix in the whole audit — CLAUDE.md is loaded at the start of
every session.

### 4.7 — S1 · ADR-0002 invents the entire billing model

`ADR-0002-SEAT-BASED-BILLING.md`, status "Accepted":

- L182-186 "Initial plans (as of August 2026): Starter 3 seats/2 workspaces, **Professional**
  10/10, Business 50/50, Enterprise 200+/200+". Every number invented. Real
  (`20260802172027_plan_limits_reduce_seats_pro_business.sql`): Pro = 2 seats/4 workspaces,
  Business = 5 seats/10 workspaces, hard cap 15. There is **no "Professional" tier** — plans are
  `free · starter · pro · business · enterprise · founder`.
- L164-170 invents `ALTER TABLE plans ADD COLUMN seats_included/seats_max`. **There is no
  `plans` table.** Real: `public.plan_limits` (`baseline_prod.sql:6144`) with `seats_included`,
  `workspaces_max`, `seats_addon_allowed`, `seat_addon_price_cents`, `viewers_unlimited`;
  purchases on `subscriptions.purchased_seats`.
- L137 "Sharing catalogs with external collaborators counts against seats" — contradicts the
  billing doc's core rule that shared links never consume a seat.
- Never mentions the real `founder` plan (`20260802172732_add_founder_plan_unlimited_v2.sql`).

### 4.8 — S2 · Targeted errors in otherwise-sound docs

**`02-SYSTEM_ARCHITECTURE.md`** — `src/hooks/useSupabase.ts` + `useAudio.ts` (L174),
`src/config/theme.ts` (L193, real: `src/lib/theme.ts`), `src/types/supabase.ts` (L195, real:
`src/integrations/supabase/types.ts`), `src/i18n/{en,fr}.json` (L199, real:
`src/i18n/locales/`); env block (L626-651) lists `NEXT_PUBLIC_*` and `R2_ACCOUNT_ID` (real:
`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) and omits `WATERMARK_API_URL/KEY`,
`SONIC_DNA_API_URL/KEY`, `STORAGE_PROVIDER`; RPC `get_track_with_relations` doesn't exist.

**`05-SERVICE_ARCHITECTURE.md`** — the most accurate of the seven (Edge Function names, RPCs,
storage abstraction, rate limits, model IDs, thresholds nearly all verify). Errors confined to:
all five pinned versions in the quoted `sonic-dna-service/requirements.txt` are wrong (real:
`flask==3.1.0`, `librosa==0.10.2`, `numpy==1.26.4`, `essentia==2.1b6.dev1110`,
`requests==2.32.3`, + `soundfile==0.12.1`); the watermark Dockerfile is shown as `node:20-slim`
+ `npm install -g audiowmark` when it is `ubuntu:24.04` building audiowmark from source on Node
22; `stripe_prices` DDL invents `id`/`created_at` (real PK `stripe_price_id`, has
`amount_cents`, CHECK allows only `starter|pro|business`); "Essentia.js" should be the
`essentia.standard` Python bindings; rate-limit labels at L1268 are swapped.

**`07-DEPLOYMENT_ARCHITECTURE.md`** — `vercel.json` rewrite shown unconditional when it is gated
on a ~25-entry social-crawler user-agent regex, and the SPA catch-all rewrite is omitted;
`api/epk/[slug].ts` → `api/epk/[workspaceSlug].ts`; L386 "engagement/analytics table" → RPC
`log_site_visit` writing **`site_visits`**; L549 `vite build --mode analyze` — no such mode;
L719-725 env-var claim (see 4.1). Security headers and CSP blocks verify exactly ✓.

**`FEATURES/WATERMARKING.md`** — strength 10, 320k, threshold 1.0, all four timeouts, cache key
and rate limit all verify ✓. Errors: `watermark_access_logs` table doesn't exist (L55); worker
payload is `source_url`/`payload_hex`/`output_bucket`/`output_path`/`format`/`output_provider`
only (L268); payload format is `SHA-256("lid_{link_id}_v_{email}")[0:32]`, not
`sl_[link_id]_[hash]` (L289, 307, 483); signed URLs always 300s (L291); `R2_PUBLIC_DOMAIN`
doesn't exist (L340); L433 "Groq API fetch failed" is copy-pasted from SMART_AR.md; L440 curl
example fails the `/^[0-9a-f]{32}$/i` payload check; **L177 says 128 kbps, contradicting its own
L233/390/500 (320 kbps)**.

**`FEATURES/SMART_AR.md`** — mostly accurate ✓. Errors: `SMART_AR_ENABLED` flag doesn't exist
(L231, 240, 309); plans "Professional/Enterprise" (L247) aren't real;
`subscriptions.smart_ar_queries_lifetime` doesn't exist (L254, 396 — the cap is
`plan_limits.smart_ar_lifetime`); L275 "Redis-based" rate limits are Postgres
`check_rate_limit` against `rate_limits`.

**`FEATURES/SPLITS_AND_SIGNATURES.md`** — `generateUnsignedAgreementPdf` doesn't exist (L270;
real: `generateSplitsPdf` in `src/lib/pdf-generators.ts:226`); RPC `create_signature_requests`
doesn't exist (L303, 521); `mark_/unmark_splits_signed_externally` take `(_user_id, _track_id)`
not `(_token)` (L305-306); `signature_requests` has no `updated_at` (L212); route is `/sign/:token`
not `/signature/[token]` (L522); `split-utils.ts` exports only `equalSplit` and
`extractArtistNameCandidates` (L220).

**`DEVELOPMENT/CODING_STANDARDS.md`** — versions (TS 5.8.3, React 18.3.x, Tailwind 3.4.17,
ESLint 9.32.0), the two quoted ESLint rules, the `@/*` alias, and the honest "Prettier not
currently configured" (L455) all verify ✓. Errors: `components/{audio,sharing,layout,common}/`
don't exist (`src/components/` is flat + `ui/`); `pages/App.tsx` and `pages/UploadTrack.tsx`;
`hooks/useTrackUpload.ts`, `hooks/useSharedLink.ts`; `types/index.ts`; `i18n/i18n.ts` (real
`i18n/index.ts`); L519-520 `.env.local.example` / `import.meta.env`; ui/ listing shows 17 of 40.

**`DEVELOPMENT/TESTING_STRATEGY.md`** — the most accurate doc in the set. `vitest.config.ts`
block matches byte-for-byte; correctly frames E2E, coverage, Playwright, Husky and test-CI as
not implemented ✓. Two errors: L420-481 presents a 60-line `src/test/setup.ts` with
localStorage/sessionStorage mocks — the real file is **15 lines** (jest-dom import + matchMedia
only), which matters because `client.ts` installs a custom localStorage-backed auth store;
L498/713/743 `npx vitest --ui` — `@vitest/ui` is not a dependency. The repo has exactly **one**
test (`src/test/example.test.ts`, a `expect(true).toBe(true)` placeholder), which the doc never
states.

### 4.9 — S2 · Broken links (27) and dead code paths (25)

**Wrong `../` depth (12).** ADRs sit at `docs/ARCHITECTURE/DECISIONS/`, so `../FEATURES/…`
resolves to `docs/ARCHITECTURE/FEATURES/…`:

| File | Link | Correct |
|---|---|---|
| `ADR-0006` | `../ARCHITECTURE/GROQ_USAGE_AND_COSTS.md` | `../GROQ_USAGE_AND_COSTS.md` |
| `ADR-0006` | `../FEATURES/SMART_AR.md` | `../../FEATURES/SMART_AR.md` |
| `ADR-0007` | `../FEATURES/WATERMARKING.md` | `../../FEATURES/WATERMARKING.md` |
| `ADR-0008` | `../FEATURES/{SHARING_SYSTEM,WATERMARKING}.md` | `../../FEATURES/…` |
| `OPERATIONS/COST_OPTIMIZATION.md` ×3 | `../GROQ_USAGE_AND_COSTS.md` | `../ARCHITECTURE/GROQ_USAGE_AND_COSTS.md` |

**Links to repo-root reports (5).** `ADR-0005` ×2 → `../CLAUDE_R2_PHASE2_REPORT.md`;
`ADR-0007` + `FEATURES/WATERMARKING.md:8` → `../CLAUDE_WATERMARK_MP3_REPORT.md`; `ADR-0007` →
`../services/watermark/README.md`. Files are at the **repo root** — correct depth is `../../../`
from ADRs, `../../` from `docs/FEATURES/`.

**Targets that don't exist anywhere (10).** `DEVELOPMENT/API_REFERENCE.md` (from `docs/INDEX.md`
×3, `DEVELOPMENT/INDEX.md` ×2), `OPERATIONS/PERFORMANCE.md` (×3),
`Running the App Locally.md` (from `docs/INDEX.md`, `GETTING_STARTED.md` ×3).

**Plus:** `docs/INDEX.md` links `[Documentation Plan](<.vibe path>)`
— a local scratch path outside the repo. `docs/_archive/rls-phases/RLS_PHASE1_GUIDE.md` has a
mangled link `['"](notifications)` — a SQL snippet that escaped its code fence.

**Anchors are all valid** — 0 broken. No work needed.

**25 nonexistent code paths cited** — enumerated per-doc in §4.2-4.8. The `docs/_archive/` and
`PLANS/original_documentation_plan.md` entries reference files deleted long ago and are
acceptable as history.

### 4.10 — S3 · Duplication, stale indexes, inflated status

- **Two divergent copies of the architecture doc.** `/TRAKALOG_ARCHITECTURE.md` (233 lines,
  repo root) vs `docs/TRAKALOG_ARCHITECTURE.md` (404 lines). The `docs/` copy is strictly newer
  — adds the GENESIS section, track versioning, watermarking, socials. Both French. Nothing
  links to the root copy except the two plan docs describing it as "(233 lines)".
- **`PLANS/DOCUMENTATION.md` (471 lines) ≈ `PLANS/original_documentation_plan.md` (473 lines)**
  — near-identical; the first is the second with statuses flipped to COMPLETE. Both are process
  scaffolding (the plan for writing the docs), not product documentation.
- **`FEATURES/INDEX.md` lists 5 of 13** feature docs. Missing: `ARTIST_SEEKER`, `BRIEF_SEEKER`,
  `DDEX_PRO_EXPORTS`, `ISRC_GENERATION`, `ONBOARDING`, `TRACK_VERSIONING`,
  `TRAKALOG_ADMIN_DASHBOARD`, `TRAKALOG_BILLING`.
- **`PLANS/INDEX.md` lists 3 of 8.** Missing: `TRAKALOG_DROP`, `TRAKALOG_GENESIS`,
  `TRAKALOG_SIGNAL`, `TRAKALOG_STORAGE_MIGRATION`.
- **`docs/INDEX.md` ADR table stops at ADR-0006** — 0007, 0008, 0009, 0010 exist and are unlisted.
- **Consequence: 8 docs unreachable** from any other doc —
  `FEATURES/{ARTIST_SEEKER,BRIEF_SEEKER,ONBOARDING,TRAKALOG_ADMIN_DASHBOARD}.md`,
  `PLANS/{TRAKALOG_DROP,TRAKALOG_GENESIS,TRAKALOG_SIGNAL,TRAKALOG_STORAGE_MIGRATION}.md`.
- **Status inflation:** `CODING_STANDARDS`, `TESTING_STRATEGY`, and
  `FEATURES/{TRACK_MANAGEMENT,SMART_AR,SPLITS_AND_SIGNATURES,SHARING_SYSTEM,WATERMARKING}` are
  each self-labelled `> **Status:** Draft` but listed as **🟢 Stable** in the index tables.
- **Index boilerplate:** each `*/INDEX.md` lists the same set three times (Navigation Guide,
  table, Quick Reference) plus Support/Metadata blocks — 79 lines to index 5 files.

### 4.11 — S3 · Cross-document contradictions

| Fact | A | B | Truth |
|---|---|---|---|
| Production host | `app.trakalog.com` (02, 05) | `trakalog.app` (07) | only `admin.trakalog.com` in code; Resend sends from `noreply@trakalog.com` |
| PostgreSQL version | 17.6 (03:24) | 15 (07:187) | not pinned in repo |
| Supabase project ref | `xhmeitivkclbeziqavxw` (07:767, `constants.ts`, CSP) | `mdokdfljnruitfnnmkif` (07:768, `supabase/config.toml`) | needs reconciling |
| Billing version | `TRAKALOG_BILLING.md` header "v4.1" | CLAUDE.md "Billing v5.0" | seat rules in the doc already match v5.0; only the label is stale |
| Storage: Business | 2 TB (`TRAKALOG_BILLING.md:43`) | 1 TB (CLAUDE.md) | **1 TB** — `20260805203027_business_storage_cap_1tb.sql` |
| Storage: Free | 1.5 GB (`TRAKALOG_BILLING.md:43`) | 2 GB (CLAUDE.md) | **1.5 GB** — `20260805143255…sql:3` |
| Old pricing | `TRAKALOG_BILLING.md:4` declares `$14/$29/$59` **obsolete** | `PLANS/TRAKALOG_DROP.md:619-621`, `PLANS/TRAKALOG_STORAGE_MIGRATION.md:998-1008` still quote it | doc is right; plans are stale |

Also: the `founder` plan is real (DB row + `src/i18n/locales/*.json` `founderNotice`) but
`TRAKALOG_BILLING.md` never mentions it. `docs/TRAKALOG_ARCHITECTURE.md` cites
`docs/TRAKALOG_AI_AGENTS_VISION.md`, which doesn't exist.

### 4.12 — S3 · Stale config the docs correctly reproduce

`07:320-336` faithfully quotes `vite.config.ts`'s `manualChunks` including
`"vendor-pdf": ["jspdf", "html2canvas"]` — but `html2canvas` is in neither `package.json` nor
any import. **The doc is right; the config is wrong.** Fix at the source.

---

## 5. Work chunks

Each chunk = one session, ending in a commit on `ishan/translated-docs`.

---

### ☑ Chunk 0 — Correct `CLAUDE.md` — **DONE** (`5ea13ff`)

**Why first:** every later session loads CLAUDE.md and will otherwise re-introduce these errors.

**Edits to `CLAUDE.md`:**
1. "Critical learnings › Watermarking" — replace strength 12 / MP3 128k with **strength 10 /
   MP3 320k CBR**, per `services/watermark/index.js:31-32`. Keep the `-v2` cache note and
   reframe 128k/strength-12 as the *superseded* pipeline. Keep the `/decode` regex and the two
   hash derivations — both verified correct.
2. Billing v5.0 storage line — **Free 2 GB → 1.5 GB**. Leave Starter 40 GB / Pro 400 GB /
   Business 1 TB (all correct).
3. Infrastructure table — replace the "Frontend env vars `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`" row with a note that Supabase config is **hardcoded** in
   `src/integrations/supabase/constants.ts` and that `src/` reads no env vars.
4. Reference-docs list: `docs/TRAKALOG_ARCHITECTURE.md` will move in chunk 1 — update after.

**Accept when:** the three facts match the cited source lines.
**Commit:** `docs: correct stale watermark, storage and env-var facts in CLAUDE.md`

---

### ☑ Chunk 1 — Links, indexes, duplicates, status labels — **DONE**

1. **Fix the 12 depth-wrong links** and the **5 root-report links** per the tables in §4.9.
2. **Dead targets:** `API_REFERENCE.md` and `PERFORMANCE.md` are marked "🟡 Planned" — convert
   those to **plain text**, not links (5 places). Remove the three
   `Running the App Locally.md` links from `GETTING_STARTED.md` and the one in `docs/INDEX.md`.
3. **`docs/INDEX.md`:** replace the `.vibe/plans/…` link with `PLANS/DOCUMENTATION.md`;
   extend the ADR table to **ADR-0007…ADR-0010**.
4. **`FEATURES/INDEX.md`:** add the 8 missing feature docs. **`PLANS/INDEX.md`:** add the 4
   missing plans. Verify with the orphan check — should reach 0 outside `_archive`.
5. **Status labels:** make the index tables agree with each file's own header. Recommended:
   leave the seven files as `Draft` and change the index entries to 🟡, since chunks 4-7 will
   promote them to Stable once verified.
6. **Delete `/TRAKALOG_ARCHITECTURE.md`** (repo root, 233-line stale fork). Keep
   `docs/TRAKALOG_ARCHITECTURE.md`. Update the two plan docs that describe it.
7. **⚠️ DECISION:** `PLANS/DOCUMENTATION.md` vs `PLANS/original_documentation_plan.md` are
   near-duplicates and both are process scaffolding. Recommend deleting
   `original_documentation_plan.md` and keeping `DOCUMENTATION.md` as the record. Confirm
   before deleting.
8. Fix the mangled `['"](notifications)` link in
   `docs/_archive/rls-phases/RLS_PHASE1_GUIDE.md` (re-fence the SQL).

**Accept when:** the broken-link checker prints `BROKEN: 0` and every doc outside `_archive` is
reachable from an index.
**Commit:** `docs: fix broken links, complete index pages, drop duplicate architecture doc`

---

### ☐ Chunk 2 — `DEVELOPMENT/` corrections

Rewrite against `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`,
`vitest.config.ts`, `src/test/setup.ts`.

**`GETTING_STARTED.md`** — every item in §4.1:
- Port **8080** everywhere (5 places).
- `cd trakalo-muse-palette` (4 places).
- Remove `npm run db:start/db:stop/db:reset`. **⚠️ DECISION:** either document
  `npx supabase start|stop|db reset` (recommended — matches reality, `supabase` isn't a
  dependency so `npx` fetches it), or add the three scripts to `package.json` and keep the docs.
  Only the first is a docs-only change.
- Rewrite Step 5 (L175-204) and L429-441 to state plainly that Supabase config is **hardcoded**
  in `src/integrations/supabase/constants.ts`, that `.env.local` is not read, and that pointing
  at local Supabase requires editing that file. Add an explicit warning that a default checkout
  talks to **production**.
- Drop `.env.local.example`, all `NEXT_PUBLIC_*`, and the `import.meta.env.DEV` example.
- Node/npm versions: either add `engines` + `.nvmrc` (code change) or soften to "developed on
  Node 24.x". Drop the "Supabase CLI is a dev dependency" claim and the "150 packages" figure.
- Note `supabase/snippets/` is empty; fix the `TrackCard.test.tsx` example.

**`CODING_STANDARDS.md`** — replace the invented `components/{audio,sharing,layout,common}/`
tree with the real flat `src/components/` + `ui/`; fix `pages/`, `hooks/`, `types/index.ts`,
`i18n/index.ts`; drop the `.env.local.example` / `import.meta.env` guidance (L519-520);
either complete the ui/ listing to 40 or label it a sample. **Leave L455 and the version table
alone — verified correct.**

**`TESTING_STRATEGY.md`** — replace the fictional 60-line `src/test/setup.ts` (L420-481) with
the real 15-line file, or clearly relabel the extra mocks as *recommended additions* (note why
it matters: `client.ts` installs a custom localStorage-backed auth store). Drop
`npx vitest --ui` or mark `@vitest/ui` as an ad-hoc install. State plainly that the repo
currently has one placeholder test. **Leave the aspirational framing of E2E/coverage/Playwright
/Husky — it is already honest.**

**Accept when:** every command in `GETTING_STARTED.md` runs successfully on a clean clone.
**Commit:** `docs: correct DEVELOPMENT guides against real scripts, ports and config`

---

### ☐ Chunk 3 — `ADR-0002` rewrite + ADR sweep

1. Rewrite `ADR-0002-SEAT-BASED-BILLING.md` against `plan_limits` / `subscriptions` and the
   v5.0 rules (§4.7): real tier names and limits, the real table and columns, the `founder`
   plan, and remove the "external collaborators consume seats" claim.
2. **Sweep ADR-0001 and ADR-0003…ADR-0010** for the same failure mode — each cited table,
   column, RPC, file path and version. ADR-0002 was found by inspection, so assume the others
   carry similar defects until checked. Record what you verify.
3. Fix the ADR-0009 reference to `docs/FEATURE_FLAGS.md` (doesn't exist) and align it with the
   real three flags in `src/config/features.ts`.

**Accept when:** every ADR's technical claims trace to a migration or source file.
**Commit:** `docs: rewrite ADR-0002 against real schema, verify remaining ADRs`

---

### ☐ Chunk 4 — `03-DATA_ARCHITECTURE.md`, part 1: table inventory & core tables

The largest job — split across chunks 4 and 5.

1. Build the **authoritative table list** from `baseline_prod.sql` plus later migrations
   (`grep "CREATE TABLE public\."`). Expect ~41. Replace the doc's inventory wholesale: remove
   the 10 fabricated tables, add the 16 missing ones.
2. Re-derive column definitions for the **core** tables directly from the baseline:
   `tracks`, `track_versions`, `stems`, `workspaces`, `workspace_members`, `profiles`,
   `subscriptions`, `plan_limits`.
3. Fix the enum documentation: `track_status` = `available|on_hold|released`; `link_status`;
   `document_status`.
4. Delete the soft-delete section (L1200-1212) and the `.eq('is_deleted', false)` pattern —
   `tracks` has no such column.

**Accept when:** every table and column in the rewritten sections appears in a migration.
**Commit:** `docs: rewrite 03-DATA_ARCHITECTURE table inventory and core tables`

---

### ☐ Chunk 5 — `03-DATA_ARCHITECTURE.md`, part 2: remaining tables & RLS

1. Re-derive the remaining tables: `shared_links`, `watermark_payloads`, `link_events`,
   `link_downloads`, `shared_link_sessions`, `catalog_shares`, `contacts`, `artist_aliases`,
   `track_comments`, `track_documents`, `signature_requests`, `playlists`, `playlist_tracks`,
   `pitches`, `studio_submissions`, `rate_limits`, `notification_preferences`, `jobs`,
   `leak_traces`, `site_visits`, `stripe_prices`, `stripe_webhook_events`, `invitations`,
   `whitelisted_emails`, `beta_passes`, `waitlist`, `track_ratings`, `credit_purchases`,
   `marketplace_requests`.
2. **Rewrite §5.3 (L893-1085) entirely.** Every policy example is built on
   `current_workspace_id()` / `is_workspace_admin()`, neither of which exists. Rebuild on the
   real helpers (`has_workspace_role`, `has_workspace_access_level`,
   `require_workspace_access_level`, `is_workspace_member`, `is_platform_admin`) using actual
   policies from the baseline.
3. Fix L448 (`get_track_with_relations`), L1095 (path-style R2 URLs), L24 (PG version — align
   with 07 or drop), L1235 (pitcher role is flag-disabled).

**Accept when:** every RLS example is copied from or verifiably consistent with a real policy.
**Commit:** `docs: rewrite 03-DATA_ARCHITECTURE remaining tables and RLS section`

---

### ☐ Chunk 6 — `04-COMPONENT_ARCHITECTURE.md` rewrite

1. Replace the `TrackCard.tsx` walkthrough (L727-791) and the test example (L1356-1403) with a
   component that exists — pick a real one from `src/components/`.
2. Delete §8's six fictional hooks and document the nine real ones in `src/hooks/`.
3. Fix the remaining path errors in §4.3: `TrackGrid`, `TrackList`, `PlaylistCard`,
   `PlaylistTrackItem`, `ContactCard`, `ErrorFallback`, `ui/image.tsx`, `crossfadePlayer.ts`,
   `SharedPlaylistView`, `src/i18n/locales/`.
4. Correct `main.tsx`, `lib/adminMode.ts` (hostname-based), `tailwind.config.ts` (CSS variables,
   Sora-first), and the L1176 "Font: Inter" claim.
5. Replace the test-organization section with the real `src/test/` contents.
6. Complete the pages list (+7), the components tree (`src/components/visual/`), and the route
   list (`/onboarding`, `/tracks/:id`, `/playlist/shared/:playlistId`); fix L302 `/approvals`.

**Accept when:** the missing-paths checker reports 0 for this file.
**Commit:** `docs: rewrite 04-COMPONENT_ARCHITECTURE against real component tree`

---

### ☐ Chunk 7 — `FEATURES/SHARING_SYSTEM.md` + `FEATURES/TRACK_MANAGEMENT.md` rewrite

Per §4.4 and §4.5. Both need real paths, real schema, and real flows.

- **SHARING_SYSTEM:** correct all 9 paths; delete every reference to `shared_links_access` and
  rebuild analytics on `shared_link_sessions`/`link_events`/`link_downloads`; correct
  `shared_links` columns and the `hi-res|low-res` constraint; fix `watermark_payloads`
  (`hash_hex` PK) and the two SQL snippets; **PBKDF2-SHA256 100k iterations, not bcrypt**;
  base36 slug, not UUIDv4; `audiowmark get`, not `decode`; remove the fabricated env vars,
  feature flags and RLS policy names; correct the rate limits.
- **TRACK_MANAGEMENT:** correct all 6 paths; rebuild the status flow on the real `track_status`
  enum; fix the 8 wrong `tracks` columns; remove `R2_BUCKET_PREVIEWS`/`trakalog-previews` and
  document the five real logical buckets; `STORAGE_PROVIDER` defaults to `supabase`; fix the
  `splits` table-vs-column contradiction with SPLITS_AND_SIGNATURES.

**Accept when:** missing-paths checker reports 0 for both files; every column traces to the
baseline.
**Commit:** `docs: rewrite SHARING_SYSTEM and TRACK_MANAGEMENT against real schema`

---

### ☐ Chunk 8 — Targeted fixes across 02, 05, 07, WATERMARKING, SMART_AR, SPLITS

All the S2 items in §4.8 — smaller, surgical edits across six files. Also from §4.11-4.12:

- Pick one production host and use it consistently (02, 05, 07).
- Reconcile the two Supabase project refs (`constants.ts` vs `supabase/config.toml`).
- Pin or drop the PostgreSQL version claim.
- `TRAKALOG_BILLING.md`: relabel to **v5.0**; **Business 2 TB → 1 TB**; document the `founder`
  plan.
- `PLANS/TRAKALOG_DROP.md` and `PLANS/TRAKALOG_STORAGE_MIGRATION.md`: annotate the
  `$14/$29/$59` figures as superseded.
- `docs/TRAKALOG_ARCHITECTURE.md`: drop the `TRAKALOG_AI_AGENTS_VISION.md` reference (or write
  the file); update CLAUDE.md's note accordingly.
- **Code fix:** remove the stale `html2canvas` entry from `vite.config.ts` `manualChunks`
  (§4.12) — the only source change in this plan. Verify `npm run build` still succeeds.

**Commit:** `docs: targeted accuracy fixes across architecture and feature docs`

---

### ☐ Chunk 9 — Translate FEATURES + ARCHITECTURE + DEVELOPMENT *(6 files)*

`FEATURES/TRAKALOG_BILLING.md`, `FEATURES/TRACK_VERSIONING.md`, `FEATURES/ISRC_GENERATION.md`,
`FEATURES/DDEX_PRO_EXPORTS.md`, `FEATURES/TRAKALOG_ADMIN_DASHBOARD.md`,
`FEATURES/BRIEF_SEEKER.md`.

Then `ARCHITECTURE/AUTH_PATTERNS.md` and `DEVELOPMENT/RPCS.md` — **RPCS.md is the priority**:
it is half-translated (English headings, French descriptions) and reads as neither.

Preserve code blocks, SQL, identifiers and column names verbatim. Translate prose only.

**Commit:** `docs: translate FEATURES, AUTH_PATTERNS and RPCS to English`

---

### ☐ Chunk 10 — Translate PLANS + root architecture *(5 files)*

`docs/TRAKALOG_ARCHITECTURE.md`, `PLANS/TRAKALOG_GENESIS.md`, `PLANS/TRAKALOG_SIGNAL.md`,
`PLANS/TRAKALOG_DROP.md`, `PLANS/TRAKALOG_STORAGE_MIGRATION.md`.

Leave `docs/_archive/rls-phases/*` in French — frozen history, per the decision taken.

**Accept when:** the French checker lists only `docs/_archive/` paths.
**Commit:** `docs: translate PLANS and root architecture doc to English`

---

### ☐ Chunk 11 — Final pass & merge prep

1. Run all four §3 checks — expect 0 broken links, 0 missing paths outside `_archive`/`PLANS`,
   French only in `_archive`, no orphans.
2. Promote `Status:` headers from `Draft` to `Stable` **only** for docs actually verified in
   chunks 2-8, and sync the index tables.
3. Refresh every `Last Updated` stamp and the `docs/INDEX.md` metadata block.
4. Trim the triplicated listings in the six `INDEX.md` files (§4.10) — one table each.
5. **⚠️ DECISION:** the ~28 `CLAUDE_*` / `COWORK_*` / `DIAGNOSTIC_*` reports at the repo root
   are pre-existing on `main` and untouched by this branch, but several docs now link into
   them. Consider moving them to `docs/_archive/reports/` — **out of scope for this branch**
   unless you want it; it would invalidate the chunk-1 link fixes, so decide before chunk 1.
6. Re-read `CLAUDE.md`'s reference list against the final tree.

**Commit:** `docs: final consistency pass before merge`

---

## 6. Open decisions

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| 1 | ~~Root `CLAUDE_*`/`COWORK_*` reports — move?~~ | **RESOLVED: moved** to `docs/_archive/reports/` (26 files) with a generated `INDEX.md` | done in chunk 1 |
| 2 | ~~Delete `PLANS/original_documentation_plan.md`?~~ | **RESOLVED: deleted** | done in chunk 1 |
| 3 | Add `db:start`/`db:stop`/`db:reset` to `package.json`, or document `npx supabase …`? | Document `npx supabase …` — docs-only | Chunk 2 |
| 4 | Add `engines` + `.nvmrc` to pin Node, or soften the docs? | Soften the docs; pin separately if you want enforcement | Chunk 2 |
| 5 | Canonical production host — `app.trakalog.com` or `trakalog.app`? | Unknown from the repo; you decide | Chunk 8 |
| 6 | Which Supabase project ref is current — `xhmeitivkclbeziqavxw` or `mdokdfljnruitfnnmkif`? | `constants.ts` + CSP + CLAUDE.md all say the former; `config.toml` looks stale | Chunk 8 |
| 7 | Write `TRAKALOG_MAESTRO.md` / `TRAKALOG_AI_AGENTS_VISION.md`, or drop the references? | Drop the references for now | Chunk 8 |
