# CLAUDE.md — Trakalog (source of truth)

> Last updated: June 30, 2026. This file is read at the start of every Claude Code session.
> Update it after every major session.

---

## Who I am

Ishan Aditya, co-founder + CTO of **Trakalog**. I work **in English**. You are my AI CTO.

**Communication:** direct, concise, step-by-step. No fluff, get to the point. Explain the "why" only when it matters. For important decisions: options + your clear recommendation.

---

## The project

**Trakalog** = premium pre-release music catalog management SaaS for producers, artists, labels, A&R, music supervisors, and sync professionals.

**Positioning:** "the nervous system of the intelligent catalog." Dropbox stores and shares (= Dropbox for music); Trakalog **protects, analyzes, connects, and makes the catalog work**. Differentiators: invisible watermarking + leak tracing, splits/signatures, Sonic DNA, Smart A&R, enterprise-grade security, all-in-one.

---

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion → **Vercel** (app.trakalog.com)
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Storage:** Cloudflare R2 (free egress, $0.015/GB/month)
- **Railway microservices:** `services/watermark` (audiowmark) + `sonic-dna-service` (Essentia/librosa)
- **AI:** Groq (Whisper + Llama 3.3 70B), Claude (Haiku/Sonnet — Maestro coming)
- **Email:** Resend (noreply@trakalog.com)
- **Billing:** Stripe (test mode)

---

## Infrastructure (real values)

| Item | Value |
|---|---|
| Supabase project ID | `xhmeitivkclbeziqavxw` |
| GitHub repo | `github.com/yannickrastogi/trakalo-muse-palette` |
| Local path | `~/Desktop/DEV/trakalog-app/` |
| R2 account ID | `98dfdbe6c0f7841eb91593b8af3eea71` |
| R2 buckets | `trakalog-tracks`, `trakalog-covers`, `trakalog-stems`, `trakalog-watermarked`, `trakalog-documents` |
| Railway watermark | `services/watermark/` (Ubuntu 24.04 + audiowmark 0.6.5 + ffmpeg + Express) |
| Railway sonic-dna | `sonic-dna-service/` (Python + Essentia/librosa) |
| Frontend env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |

Railway auto-redeploys on GitHub push. Railway CLI not installed locally → confirm builds in the dashboard.

---

## ⚙️ Mandatory workflow (follow every time)

### 1. Cowork audit FIRST
Diagnose + validate SQL in Cowork conversation **before** any Claude Code prompt. Claude Code sometimes generates subtly wrong SQL/logic — always validate upstream.

### 2. Claude Code prompt structure (strict order)
1. **Explorer agent (Haiku)** — diagnose/map files, change nothing
2. **Fix steps**
3. **Reviewer agent (Sonnet)** — check for regressions
4. **`/security-review` — IN THE FOREGROUND, NEVER in background / sub-task** (background security agents never return → recurring block)
5. `git add . && git commit -m '...' && git push`
6. `supabase functions deploy <name>` if an Edge Function was modified

### 3. Format
- **1 prompt = 1 single copyable block** (never split)
- Every prompt includes the **3 rules**:
  1. Don't touch code that already works
  2. Secure code (no XSS/eval, RPC SECURITY DEFINER for DB writes)
  3. Everything must still work after the changes
- **Commit + push always included** in the sequence (never forget)

### 4. Execution labels (no exception)
- `Terminal` — direct Mac terminal
- `Cowork` — Cowork conversation
- `Claude Code` — Claude Code CLI

---

## SQL conventions

- **Never `$$`** → always `$func$ ... $func$`; for DROP: `$drop$ ... $drop$`
- **`apply_migration` (via Supabase MCP) preferred** over copying SQL into the terminal (truncation/corruption risk — confirmed multiple times)
- Drop functions via **`pg_proc` loop** before recreating (PostgreSQL identifies overloads by param types, not names → a rename or new param order creates a duplicate)
- **Never auto-execute SQL in prod without validation.** Single copyable block for manual execution in Supabase SQL Editor, one block at a time on error
- Guard functions present in DB: `assert_caller(_user_id uuid)` (anti-impersonation) and `require_workspace_access_level(_user_id, _workspace_id, _min_level text)`
- Enums: **explicit cast** in RPCs (`_status::track_status`, `'active'::link_status`)

---

## SQL migrations — absolute rule

The repo mirrors production. A baseline was laid on August 2, 2026
(`supabase/migrations/20260626144305_baseline_prod.sql`) after total drift:
65 migrations applied in prod with no corresponding file in the repo.
This drift caused 3 blocking bugs (broken signup, /invite page crash,
rating impossible to save).

RULE: any database change produces a versioned migration file
in `supabase/migrations/`, no exception.

- Mandatory filename: `<14-digit timestamp>_description.sql`
  (e.g. `20260802143000_add_deletion_scheduled_at.sql`).
  An 8-digit prefix or absent = file ignored by CLI. 14 of the 20 old
  files were in that case and never applied anything.
- When SQL is applied via Supabase MCP (`apply_migration`), the SAME SQL must be
  dropped into `supabase/migrations/` in the same batch. Applying without versioning
  recreates the debt.
- `supabase/migrations/_archive/` contains the history: the 20 old files and the
  65 migrations extracted from production. It's documentation, never to be replayed
  and never to be modified.
- Never edit the baseline. Any schema evolution goes through a new migration.

### Automatic drift detection (CI)

A CI guard (`.github/workflows/schema-drift.yml`) runs on every push to `main`
(and manually via `workflow_dispatch`). It compares versions present in production
(`supabase_migrations.schema_migrations`) to files in `supabase/migrations/`. Any
version applied in prod without a local file = drift: CI then extracts the missing SQL
from production (read-only, only `SELECT`s) and **automatically opens a
PR** `chore(db): N migration(s) missing)`. These migrations are already applied in prod —
merging the PR only versions them, **no SQL is executed**. The workflow never pushes
to `main` (always a PR) and updates the existing PR instead of creating a second one.

Local verification: `npm run db:check` (requires `PGPASSWORD` = DB password;
absent → clean SKIP, never an error).

---

## Critical learnings

### Watermarking (CORRECTED — the old learning was wrong)
- **audiowmark strength 10+ survives MP3/Opus/AAC compression from 128 kbps** (proven empirically on Ubuntu 24.04 = Railway's OS). Strength 12 gives margin for re-compression of a leaked file.
- **Watermarked delivery copies are served in MP3 128k** (~10-15× lighter than WAV). The **WAV master stays intact** in `trakalog-tracks`; only copies from the `trakalog-watermarked` bucket are compressed.
- Railway's `/decode` parses audiowmark 0.6.5 output: the 2nd token is a **timestamp** (`0:00`) or `all`, **not** an integer. Regex: `/^pattern\s+\S+\s+([0-9a-f]{32})\s+([\d.]+)/i`. Detection threshold: score ≥ 1.0 (real watermark ~1.5, noise ~0.2).
- Derivations: cache filename = `SHA-256(link_id_email_storage_path)`; audiowmark payload = `SHA-256("lid_{link_id}_v_{email}").substring(0,32)` = `watermark_payloads.hash_hex`.

### Auth / session
- **NEVER write to the native Supabase key** — let Supabase manage its persistence (`persistSession: true`)
- `autoRefreshToken: false` at module level, started manually only if session is valid
- Public pages (SharedLink, Studio, Sign, AcceptInvitation…): **zero GoTrueClient**, direct REST fetch, import from `constants.ts`
- `ensureSession()` (refreshSession → getSession → localStorage backup) **before** reading `user.id`. `auth.uid()` can return NULL on unstable sessions.

### RLS / security
- Any insert/update on RLS-protected tables → **RPC SECURITY DEFINER** with explicit `_user_id`
- Rate limiting on all Edge Functions
- Sensitive deletions (audit, leak traces) → **admin-only** RPC via `require_workspace_access_level(..., 'admin')`

### Scope discipline
- **Touch ONLY what is strictly necessary.** Never refactor, clean up, or simplify what isn't asked. Never change working code.

---

## Data shape gotchas (cause of real bugs)

- **`tracks.genre` = `text[]`** (array, not string!). Collect genres: flatten all arrays → dedupe → sort. Filter: `Array.includes`, not `===`.
- `contacts.pro` = `text[]`; `contacts.stage_name` exists
- Splits: JSONB `roles[]` (+ retrocompat `role` string), `pros[]` (+ retrocompat)
- Track enums: `track_status` (available/on_hold/released), `track_type`, `track_gender`, `document_status` (draft/pending/signed)
- `insert_track`: metadata (written_by, etc.) saved via follow-up `update_track`, not direct params

---

## Key Edge Functions

| Function | Role |
|---|---|
| `get-watermarked-audio` | encodes the watermarked MP3 128k copy (player + download), cached per visitor |
| `get-audio-url` | non-watermarked preview/playback (tracks bucket) |
| `trace-leak` | decodes the watermark, resolves the leaker's IP, inserts into `leak_traces` |
| `analyze-sonic-dna` | audio analysis on upload |
| `smart-ar` | catalog ↔ brief matching (Groq) |
| `transcribe-lyrics` | Whisper |
| `send-*` | emails (pitch, invitation, signatures…) via Resend |

Edge Functions = manual redeploy after push: `supabase functions deploy <name>`.

---

## Known follow-ups

- **Watermark rule = share_type, never delivery format** (verified August 2, 2026, INTENDED behavior). `track` and `playlist` links always go through `get-watermarked-audio` — including "Download all", which delivers individual files, not a ZIP. Only `pack` produces a ZIP, with clean audio: this is intentional, it serves to deliver final masters. TO DO: warning badge when creating a `pack` link, `README.txt` in the ZIP, and fix onboarding step 16 whose copy wrongly promises that **all** links are watermarked.
- **Billing v5.0** (August 2-5, 2026) — `docs/TRAKALOG_BILLING.md` to resync:
  - Free 1 seat / 1 workspace · Starter 1/1 · Pro 2 seats / 4 workspaces · Business 5 seats / 10 workspaces.
  - ⚠️ Viewers are NO LONGER free: EVERY member consumes a seat regardless of level, owner included. The free channel is the **shared link** (recipient without account, unlimited, never counted).
  - Pro and Business add-ons: $10/seat/month, $5/workspace/month. Hard cap at 15 total workspaces; beyond that → sales contact.
  - Storage: Free 2 GB · Starter 40 GB · Pro 400 GB · Business 1 TB.
  - Internal `founder` plan: unlimited, off Stripe, manually assigned, never exposed for purchase.
  - TO DO: Stripe products `trakalog_seat_addon` ($10) and workspace add-on ($5) to create, webhook to wire on `subscriptions.purchased_seats` / `purchased_workspaces` (columns already in DB), purchase UI to build (none exists).
- **Storage tracking**: operational since August 5, 2026. `tracks` / `track_versions` / `stems` / `track_documents` carry their size; `insert_track` and `add_track_version` accept `_file_size_bytes`; RPC `compute_user_storage_bytes` + `recompute_all_storage_usage`; Edge Function `backfill-storage-sizes` (service_role only) for R2 files. TO DO: BEFORE INSERT quota trigger, and quota display in the UI.

---

## Reference docs (repo)

`docs/TRAKALOG_BILLING.md`, `TRAKALOG_MAESTRO.md`, `TRAKALOG_DROP.md`, `TRACK_VERSIONING.md`, `ISRC_GENERATION.md`, `DDEX_PRO_EXPORTS.md`, `TRAKALOG_ADMIN_DASHBOARD.md`, `ARTIST_SEEKER.md`, `BRIEF_SEEKER.md`, `ONBOARDING.md`, `TRAKALOG_AI_AGENTS_VISION.md`, `TRAKALOG_ARCHITECTURE.md`.

---

## Claude Code setup

CLAUDE.md (this file) + skills (supabase-rpc, edge-function, react-component, shared-link, security, UI UX Pro Max) + hooks (auto typecheck, dangerous command blocker) + 2 subagents (explorer/Haiku, reviewer/Sonnet).
