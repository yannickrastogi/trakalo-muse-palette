# COWORK — FULL TRAKALOG AUDIT

> **Read-only mode** — no fixes, no DB writes, no pushes. Actionable audit.
> Started: 2026-06-05 · Branch `main` @ `aff9c1e` · Test workspace `38007e8a-…` (Banx & Ranx Test)
> Baseline: COWOK_REPORT.md (BUG-01/02/03 already diagnosed — not re-diagnosed)

---

## 🚨 CRITICAL SECURITY

### 🔴 CRIT-01 — `shared_links` readable by ANY anon/authed (cross-workspace leak + password_hash)
**RLS Policies** on `public.shared_links`:
- `anon_read_shared_links` → role **`anon`**, `USING (status = 'active')`
- `Authenticated users can view active shared links` → role **`authenticated`**, `USING (status = 'active')`

No workspace/ownership restriction. The publishable key (`anon`) is **embedded in the JS frontend** → anyone can do `SELECT * FROM shared_links WHERE status='active'` and **dump ALL active shared links on the platform**, all workspaces/clients combined.

Exposed columns: `link_slug` (→ open any shared link directly), **`password_hash`** (bcrypt → offline crackable + reveals which links are password-protected), `track_id`, `playlist_id`, `workspace_id`, `message`, `allow_download`, `expires_at`, `watermarking_enabled`, `gate_screen_enabled`.

**Impact:** breach of the shared links confidentiality model (pre-release catalog = core Trakalog value). Enumeration of all slugs → access to all unprotected shared content; exposure of hashes for offline brute-force of password-protected links; cross-client metadata leak.

**Existing mitigation (limits blast radius):** the `tracks/stems/documents/watermarked` buckets are **private** and have **no SELECT policy `anon`** → raw audio is NOT mass-downloadable via the storage API (served via Edge Functions + signed URLs). So the leak is **metadata + access enumeration**, not direct audio dump. Still **P0** given the pre-release nature.

**Recommended fix:** remove the anon/authenticated policies "read all active". Serve the public page via a **RPC SECURITY DEFINER `get_shared_link_by_slug(_slug)`** which (a) filters on the exact slug, (b) NEVER returns `password_hash`, (c) delegates password verification to the already-existing Edge Function `verify-link-password`. Also restrict `authenticated` to workspace members.

### 🟠 CRIT-02 — `signature_requests`: UPDATE anon not scoped by token (risk of forged signatures)
Policy `signature_requests_anon_update_signing` → role `anon`, `USING ((token IS NOT NULL) AND (status='pending'))`, `WITH CHECK (token IS NOT NULL AND status IN ('signed','pending'))`. The `token IS NOT NULL` is true for **all** rows → an anon (public key) can PATCH any `signature_request` in `pending` **without knowing the token** (just target the row by id via REST) → **sign agreements on behalf of others**. To verify in production (not tested), but the policy doesn't tie the provided token to the row. **Fix:** verify token equality via a RPC SECURITY DEFINER, or `USING (token = current_setting(...))`.

### 🟠 CRIT-03 — `track_comments`: UPDATE/DELETE anon cross-link
Policy `track_comments_anon_update` → role `anon`, `USING (shared_link_id IN (SELECT id FROM shared_links WHERE status='active'))`. Not scoped to the actually consulted link nor to the author → an anon on link X can edit/soft-delete comments from **any active link Y**. (The INSERT is correctly scoped via EXISTS, only UPDATE/DELETE is too broad.) **Fix:** scope to the `shared_link_id` of the current token + author.

---

## Executive Summary

Severity legend: 🔴 P0 (blocking beta) · 🟠 P1 (important) · 🟡 P2 (minor) · ⚪ Nice-to-have

> ⚠️ **PARTIAL AUDIT.** Axes covered this session: **3 (DB/RLS), 4 (storage/security), 6 (code), 8 (specs)** + CRITICAL section. **Not covered: Axes 1 (UI/UX), 2 (flows), 5 (perf), 7 (console/network)** — the Chrome extension remained disconnected throughout the session despite several attempts. Next restart point: reconnect Chrome → login → Banx & Ranx Test workspace → run Axes 1/2/5/7.

### Overall health score: **6 / 10**
Solid backend engineering (RLS enabled everywhere, storage scoped by membership, signed URLs, decent Edge Function hygiene, legacy RLS `user_roles` **resolved**, complete onboarding). **BUT**: a **critical RLS leak** (`shared_links` readable by anon, `password_hash` exposed) that breaks the core value (pre-release confidentiality), 2 overly-broad anon-write policies (signature forgery, comment tampering), and several **blocking beta features not started** (Billing #1, DDEX/PRO, ISRC generation). Should not launch in public beta before fixing CRIT-01/02 + Billing.

### Top 5 P0 (to resolve before public beta)
1. 🔴 **CRIT-01** — `shared_links` readable by any anon (public key) → enumeration of all shared links + exposure of `password_hash`. Cross-workspace leak of the pre-release catalog.
2. 🔴 **CRIT-02** — `signature_requests`: UPDATE anon not tied to token → risk of **signature forgery** on split agreements.
3. 🔴 **Billing not started** (TRAKALOG_BILLING.md) — declared #1 beta blocker, zero Stripe code (tables `subscriptions`/`credit_purchases` exist but unused).
4. 🔴 **BUG-02 login loop** (baseline COWOK_REPORT.md) — invitees cannot log in (whitelist on auth email ≠ invitee email).
5. 🔴 **`tracks` policy cross-workspace** — any authenticated user can read metadata of any track with an active link, outside membership.

### Top 10 P1
1. 🟠 CRIT-03 — `track_comments` UPDATE/DELETE anon cross-link (tampering).
2. 🟠 `update_track` RPC generic without column whitelist (BUG-03 pattern — persistence fragility).
3. 🟠 `LandingPage.tsx:104` — write `waitlist` via the **native client auth** on public page (violates the pattern).
4. 🟠 Giant files: `TrackDetail.tsx` (4200), `UploadTrackModal.tsx` (3890) → React-#310/stale-closure risk.
5. 🟠 18 files using raw `localStorage` instead of `safeLocalStorage`.
6. 🟠 Admin Dashboard partial (4/9 pages) — missing KPIs/impersonation/digest.
7. 🟠 ISRC = manual field only (generation/validation/bulk absent).
8. 🟠 DDEX/PRO Exports + Track Versioning not started (ISRC→DDEX chain entirely empty).
9. 🟡 `covers` bucket public → pre-release cover art exposed to anon.
10. 🟡 Legacy `user_roles` + billing tables without code → clean/reconcile; sensitive Edge Functions (`trace-leak`, `verify-link-password`) without `console.error`.

### Inventory (partial session)
- **Pages audited via browser: 0** (Chrome down) — Axes 1/2/5/7 to do.
- **Tables audited: 31** (RLS) + **7 buckets** storage + **20 Edge Functions** + **9 specs**.
- **Issues found: ~25** — including **3 CRITICAL security**, ~6 P0, ~10 P1, rest P2/⚪.
- **Security issues: 5+** (CRIT-01/02/03, tracks cross-ws, covers public). **Perf: not measured** (browser).

---

## 1. UI/UX consistency
🚫 **NOT COVERED this session** — Chrome extension disconnected (several retries failed). To resume: reconnect Chrome, manual login, switch Banx & Ranx Test, then run the 28 pages listed (empty/loading/error states, responsive 375px, brand consistency, modals, sidebar permissions) with screenshots.

## 2. User flows
🚫 **NOT COVERED this session** (Chrome down). Flows A→I to reproduce in sandbox (Quick/Bulk upload + "Skip Review" button recent, shared link + gate screen, pitch cancel-before-send, playlist reorder, splits/signatures, Smart A&R matching, workspace switch, branding→shared link). NB: the Skip Review bug and the individual review workflow are to validate first (recent commit `aff9c1e`).

## 3. Backend / DB / RLS
_(Axis 3 — Supabase SELECT, read-only)_

### 3.1 RLS — global state ✅ good
- **All 31 `public` tables have RLS enabled.** No table exposed without RLS.
- 5 tables have RLS **without any policy** = deny-all to clients (`audit_logs`, `beta_passes`, `rate_limits`, `watermark_payloads`, `whitelisted_emails`). ⚪ Secured as long as access is via RPC SECURITY DEFINER only (confirm no front-end code reads them directly → would return empty).

### 3.2 ✅ "Legacy user_roles" debt — **RESOLVED** for critical tables
The memory flagged a legacy RLS `user_roles` (11 roles) vs `workspace_members.access_level` inconsistency. **Verified: no policy from the 14 critical tables (tracks, playlists, pitches, shared_links, contacts, stems, approvals, …) references `user_roles`.** All writes go through `workspace_members` / `has_workspace_access_level(...,'editor'|'pitcher'|'admin')`.
- 🟡 The `user_roles` table **still exists** (5 clean policies) but seems **orphaned** → cleanup candidate (confirm no code reads it).

### 3.3 Risky broad anon policies
See 🚨 CRITICAL above: CRIT-01 (`shared_links` read-all), CRIT-02 (`signature_requests` anon update), CRIT-03 (`track_comments` anon update cross-link).
- 🟠 `tracks` policy `Authenticated users can view tracks via shared links`: `USING (id IN (SELECT track_id FROM shared_links WHERE active))` → **any authenticated user can read any track with an active link, without being a workspace member** (cross-workspace catalog leak: metadata + `audio_url`). Audio remains gated by private storage, but metadata leaks.

### 3.4 RPCs SECURITY DEFINER
- 🟠 **`update_track(_user_id, _track_id, _updates jsonb)` = generic without column whitelist** (cf. BUG-03, COWOK_REPORT.md). Builds an `UPDATE … SET %I` for each key of the jsonb → a key not matching a column causes rollback of the entire UPDATE. Fragile robustness: any front-end payload evolution could silently break persistence. **Recommendation:** whitelist authorized columns in the RPC (ignore unknown keys instead of throwing).
- Pattern `_user_id` explicit: globally respected (cf. RPCS.md). To audit exhaustively: RPCs without workspace membership check (not completed this session — see "not covered").

### 3.5 Billing tables present without code
🟡 The **`subscriptions` and `credit_purchases` tables exist** (RLS + 1 policy each) while Axis 8 confirms **zero Stripe code**. Schema ahead of code (billing groundwork) — to reconcile with TRAKALOG_BILLING.md.

## 4. Security
_(Axis 4)_

### 4.1 Storage buckets — ✅ generally healthy
| Bucket | Public | Policies |
|---|---|---|
| `avatars` | 🌐 public | anon read (OK, non-sensitive) |
| `branding` | 🌐 public | anon read (OK, logos) |
| `covers` | 🌐 public | 🟡 anon read **all** covers (pre-release cover art exposed — minor, often shared) |
| `tracks` | 🔒 private | SELECT = `authenticated` + `is_workspace_member` ✅ ; write = editor+ ✅ |
| `stems` | 🔒 private | same ✅ |
| `documents` | 🔒 private | same ✅ |
| `watermarked` | 🔒 private | (to confirm — no policy listed for this bucket → deny-all clients, served via Edge Function) |

✅ **No `anon` policy on tracks/stems/documents** → raw audio is not directly downloadable by anon (good defense in depth). Storage writes correctly scoped `editor`/`uploader` via `has_workspace_access_level`.

### 4.2 Signed URLs / getPublicUrl — to finish (browser/code)
- ✅ **Verified (grep): all `getPublicUrl` are on public buckets** (`covers`, `avatars`, `branding`). No `getPublicUrl` on `tracks/stems/documents/watermarked`.
- ✅ **Audio = `createSignedUrl`**: `TrackDetail.tsx:322` (tracks, **300s** = 5 min ✅), `crossfadePlayer.ts:155` (tracks, 3600s), `Stems.tsx:162/207` (stems, 3600s). The signed-URL pattern is in place. 🟡 Note: 3600s (1h) on crossfade/stems vs 300s announced — longer duration, to confirm if intended.
- Confirm at runtime that shared links serve signed URLs (Network tab) → **not covered** (browser).

### 4.3 Watermarking — not verified (browser)
"Protected" badge, `get-watermarked-audio` call on shared links, absence of silent non-watermarked fallback → **requires runtime test** on a shared link. **Not covered this session** (Chrome unstable).

### 4.4 Auth flows — partially covered (cf. COWOK_REPORT.md BUG-02)
The login loop (BUG-02) remains documented in the previous report (whitelist on auth email ≠ invitee email, double loop mechanism). Runtime tests (session persistence, logout cleanup, ProtectedRoute redirect) → **not covered this session** (browser).

### 4.5 Input validation / XSS
Trakalog pattern: `htmlEscape()` at Edge Functions level (confirmed present in several functions), React natively escapes at frontend. ⚪ No `dangerouslySetInnerHTML` audited this session → **to check**: `grep dangerouslySetInnerHTML src/`.

## 5. Performance
🚫 **NOT COVERED this session** (Chrome down — DevTools required). To measure: TTI Dashboard/Tracks/TrackDetail, JS chunk sizes at login, lazy-load candidates (`pdfjs-dist`, `pdf-lib`, `lamejs`, `jspdf`, `jszip`), N+1 queries on Tracks/TrackDetail (Network tab), memory leak after repeated navigation.
> 🟡 Static indicator (Axis 6): `TrackDetail.tsx` (4200 lines) and `UploadTrackModal.tsx` (3890) are strong rendering/memory issue candidates — to confirm via profiling.

## 6. Code consistency
_(Axis 6 — repo read)_

### 6.1 Direct DB writes from frontend (anti-pattern RPC SECURITY DEFINER)
🟠 **P1 — 6 direct writes found** (should go through RPC):
- 🔴 `src/pages/LandingPage.tsx:104` — `insert` into `waitlist` via the **native client auth** (`@/integrations/supabase/client`), not an anonClient REST. Public page touching native client = violates public pages rule. **To fix.**
- 🟠 `src/pages/StudioSession.tsx:104` — insert `studio_submissions` (isolated anonClient, acceptable infra but not RPC).
- 🟠 `src/pages/SignAgreement.tsx:169` — update `signature_requests` (anonClient, sensitive signature table).
- 🟠 `src/pages/SharedStemAccess.tsx:881/905/923` — insert + 2 update on `track_comments` (anonClient).

These anon writes depend 100% on airtight RLS on these tables → to correlate with Axis 3 (RLS).

### 6.2 Raw localStorage vs safeLocalStorage
🟠 **P1 — 19 files** use raw `localStorage` despite the `src/lib/safeStorage.ts` wrapper. Worst: `DashboardContent.tsx` (13), `lib/theme.ts` (10), `SharedLinkPage.tsx` (6). ⚪ `integrations/supabase/client.ts` (5) = **legitimate** (session-backup layer). The other 18 should migrate to `safeLocalStorage` (private-mode/SSR safety).

### 6.3 TypeScript escape hatches
🟡 **P2** — `as any` = **46**, `: any` = **38**, `@ts-ignore` = **0** ✅, `@ts-expect-error` = **0** ✅, `eslint-disable` = 7. Concentration: `TrackContext.tsx` (19 — worst), `WorkspaceSwitcher.tsx` (10).

### 6.4 Giant files (refactor candidates)
🔴/🟠 **P1** — React-#310 / stale-closure risk (your own anti-patterns):
1. `pages/TrackDetail.tsx` — **4200 lines** 🔴
2. `components/UploadTrackModal.tsx` — **3890** 🔴 (swollen by Skip Review)
3. `pages/SharedLinkPage.tsx` — 2160 · 4. `DashboardContent.tsx` — 1308 · 5. `WorkspaceSettings.tsx` — 1252 · 6. `lib/pdf-generators.ts` — 1181 · 7. `SharedStemAccess.tsx` — 1173 · 8. `SettingsPage.tsx` — 1133 · 9. `Contacts.tsx` — 1052. (`types.ts` 1026 = generated, ignore.)

### 6.5 Dead code
⚪ No real dead code. Only non-imported = stock shadcn/ui primitives (to keep).

### 6.6 Edge Functions — hygiene
⚪ **Rather healthy** — 20 functions, **all have CORS + rate limiting** (`create-invitation` = throttling inline custom L65, not the RPC but functional). `verify-link-password` rate-limited (5 req/300s/IP).
- 🟡 `console.error` (server logging) absent in: `create-invitation`, `get-audio-url`, `send-invitation-email`, `send-pitch-email`, `trace-leak`, `verify-link-password`. **`trace-leak` and `verify-link-password` are sensitive** → verify that failures are server-logged and not leaked to the client.
- 🟡 `isValidUUID` absent from `hash-link-password`, `log-link-access`, `send-waitlist-invite`, `verify-link-password` (slug/IP/email keys → possibly N/A, but confirm input validation).

## 7. Console / Network errors
🚫 **NOT COVERED this session** (Chrome down). To do: DevTools Console + Network during navigation of all pages (Axis 1), list errors/warnings (page, message, severity) + 4xx/5xx/timeouts.

## 8. Specs vs implementation
_(Axis 8 — docs/)_

| Spec | Status | Evidence / Gap |
|---|---|---|
| **ONBOARDING.md** | ✅ Implemented | 4 layers present: `Onboarding.tsx`, `onboarding/GuidedTour.tsx`, `OnboardingChecklist.tsx`, `OnboardingContext.tsx`, `Guide.tsx`. Checklist = 6 steps. Functionally complete. |
| **TRAKALOG_ADMIN_DASHBOARD.md** | 🟡 Partial (4/9 pages) | `admin/AdminDashboard.tsx` + RPC `is_platform_admin`. Tabs: Overview/Waitlist/Contacts/Users. **Missing**: KPIs MRR/churn, impersonation, email digest, audit-log/billing/storage. Revenue KPIs blocked by Billing. |
| **ISRC_GENERATION.md** | 🟡 Partial (manual field) | ISRC = simple free text input (`TrackDetail.tsx:1484`), `isrc` column exists. **Missing**: 1-click generation, registrant code, sequential counter, ISO 3901 format validation, bulk. |
| **TRAKALOG_BILLING.md** | ❌ Not started | **Zero Stripe code** in `src/`, no billing edge function, no plan/subscription table. ⚠️ Yet this is the **#1 beta blocker** declared. |
| **DDEX_PRO_EXPORTS.md** | ❌ Not started | No BMI/ASCAP/SOCAN/SoundExchange/MLC nor DDEX XML exports. Depends on ISRC (not done) + ISWC per track (field absent). |
| **TRACK_VERSIONING.md** | ❌ Not started | `track_versions` table **absent from SQL migrations** (only in prose docs/architecture). No versioning UI. 1 track = 1 audio. |
| **ARTIST_SEEKER.md** | ❌ Not started (Phase 4, expected) | No code. Correctly deferred. Depends on Smart Brief Matching. |
| **BRIEF_SEEKER.md** | ❌ Not started (Phase 4, expected) | No auto scan. NB: `smart-ar` edge function exists (Manual Smart A&R = MVP precursor). Correctly deferred. |
| **TRAKALOG_MAESTRO.md** | ⚠️ **Doc not found** | No file `docs/TRAKALOG_MAESTRO.md`, no `maestro` ref in repo. Renamed or never created → the mission lists it anyway. |

**Critical dependencies:** Billing (not done) gates Admin Dashboard revenue KPIs. ISRC → DDEX chain entirely not started. Track Versioning referenced in architecture but without DB migration.

---

## Annexes

### SQL queries executed (read-only, no writes)
1. Tables list + `relrowsecurity` + policy count (`pg_class`/`pg_policies`).
2. Policies of the 14 critical tables + flags refs `user_roles` / `workspace_members`.
3. `qual`/`with_check` detailed on suspect policies (`shared_links`, `signature_requests`, `track_comments`, `tracks` anon/authenticated).
4. Columns of `shared_links` (`information_schema.columns`).
5. `storage.buckets` (public flag) + `storage.objects` policies.
6. (Previous sessions, baseline) schema `tracks`, def `update_track`, `is_email_whitelisted`, invitations/whitelist.

### Terminal commands (read-only)
- `git status/log/pull` (setup), `grep` : direct DB writes, `localStorage`, `as any`, `getPublicUrl`+bucket, `dangerouslySetInnerHTML`, line counts.

### Screenshots
- None (Browser axes not covered — Chrome disconnected).

### Method
- 2 read-only sub-agents (Axis 6 code, Axis 8 specs), Supabase MCP (SELECT only), repo read. No DB writes, no fixes, no pushes.

---
## ⏭️ To resume the audit (next session)
1. Reconnect the Chrome extension (cause of the axis blocks).
2. Manual login + switch "Banx & Ranx Test".
3. Run Axes 1, 2, 5, 7 (UI/UX, flows, perf, console) — all backend (3/4/6/8) is already done here.
4. Complete Axis 3.4: exhaustive audit of RPCs SECURITY DEFINER without membership check.
