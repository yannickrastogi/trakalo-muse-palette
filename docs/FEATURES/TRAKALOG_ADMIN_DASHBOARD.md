# TRAKALOG — Admin Dashboard (Feature Spec)

> **Created:** April 25, 2026
> **Last Updated:** September 2, 2026 (translated to English; §0 added)
> **Goal:** A complete administrator dashboard to manage, monitor and understand Trakalog usage
> at a scale of tens of thousands of users.
> **Status:** ⚠️ **Partially implemented** — see §0. The rest of this document remains the
> specification for the work still outstanding.
> **Priority:** Post-beta launch

---

## 0. What is actually built (verified September 2, 2026)

A working admin console exists, but it is **architecturally different from the spec below**.
Read this section before implementing anything from §2 onward.

### It is a separate app, not an `/admin` route

The spec describes a `/admin/*` route group inside the main app with an `AdminRoute` guard.
The implementation is **hostname-based** — `src/lib/adminMode.ts`:

```typescript
const ADMIN_HOST = "admin.trakalog.com";
export function isAdminMode(): boolean {
  if (window.location.hostname === ADMIN_HOST) return true;
  // dev override: ?admin=1 sets a localStorage flag, ?admin=0 clears it
}
```

`App.tsx` then swaps the *entire* application:

```typescript
return <MotionConfig reducedMotion="user">{isAdminMode() ? <AdminApp /> : <MainApp />}</MotionConfig>;
```

`AdminApp` has its own two-route router — `/` → `AdminLogin`, `/dashboard` → `AdminDashboard` —
and mounts none of the 14 user providers. This is stronger than the spec's lazy-loaded route
group: the admin code and the user app never coexist in one bundle graph.

### Admin identity is an email allowlist in a function body

The spec proposes `profiles.is_platform_admin boolean`. Reality is a function with a hardcoded
address:

```sql
CREATE FUNCTION public.is_platform_admin(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
AS $func$
DECLARE _email text;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _user_id;
  RETURN _email IS NOT NULL AND lower(_email) IN ('yannick.rastogi@gmail.com');
END;
$func$;
```

> ⚠️ **This is worth changing.** Adding or removing an administrator currently requires a
> database migration. Moving the allowlist to a table — or to the
> `profiles.is_platform_admin` column this spec proposes — would make it an operational action
> instead of a schema change. Flagged during the September 2026 data-architecture review.

### Built: 4 tabs

`src/pages/admin/AdminDashboard.tsx` renders a `Tabs` control over four components in
`src/components/admin/`:

| Tab | Component | Backing RPC |
|---|---|---|
| Overview | `OverviewTab.tsx` (+ `TrafficSection.tsx`) | `get_admin_overview`, `get_visit_stats` |
| Waitlist | `WaitlistTab.tsx` | `list_waitlist_signups`, `get_waitlist_signups_` |
| Contacts | `ContactsTab.tsx` | `list_all_contacts` |
| Users | `UsersTab.tsx` | `list_all_users` |

**The real RPC names are `get_admin_overview`, `list_all_users`, `list_all_contacts`,
`list_waitlist_signups`, `get_visit_stats` and `delete_leak_trace`** — not the `admin_*` names
proposed in §3. Traffic analytics read `site_visits`, populated by the public `log_site_visit`
RPC.

### Not built

Everything else in this document: workspaces browser, tracks browser, engagement/analytics,
billing/revenue, infrastructure health, audit-log viewer, admin notifications, impersonation,
`admin_metrics_cache`, `admin_notifications`, and the `compute-admin-metrics` cron.

---

## Vision

The Admin Dashboard is Trakalog's **command centre** for the founder and the ops team. It has
to answer three questions in under five seconds:

1. **How is the business doing?** (MRR, users, churn, growth)
2. **How is the product doing?** (uploads, pitches, engagement, features used)
3. **Is anything broken?** (errors, Edge Functions down, storage full)

Designed to scale from 10 to 100,000 users without refactoring.

---

## 1. Access & security

### Route

- `/admin` — protected, Trakalog admins only
- Not in the user sidebar — reached by direct URL or the profile menu, visible only to admins

> *As built:* a separate host, `admin.trakalog.com`, rather than a route. See §0.

### Authentication

- An `is_platform_admin boolean DEFAULT false` column on `profiles`, or in `auth.users`
  metadata
- Frontend middleware: if `!user.is_platform_admin` → redirect to `/dashboard`
- Double-check server-side: every admin RPC verifies `is_platform_admin` before executing

> *As built:* the check exists and is enforced RPC-side, but through a hardcoded email
> allowlist rather than a column. See §0.

### Impersonation ("view as user")

- A "View as user" button on each user record
- Creates a read-only session in the user's context
- A red "ADMIN VIEW — [User Name]" badge at the top of the screen
- An "Exit Admin View" button to return
- No destructive action possible while impersonating
- Logged to `audit_logs` as `admin.impersonate`

---

## 2. Page structure

### 2.1 — Overview (`/admin` home)

The main dashboard. Everything that matters at a glance.

#### Top KPI cards

| KPI | Calculation | Sub-text |
|---|---|---|
| Total Users | `COUNT(auth.users)` | +X this week / +X this month |
| Active Users (MAU) | Users with ≥1 action in the last 30 days | % of total |
| Active Users (WAU) | Same over 7 days | % of total |
| Active Users (DAU) | Same over 24h | % of total |
| Total Tracks | `COUNT(tracks)` | +X this week |
| Total Storage Used | `SUM(file sizes)` across all buckets | X GB / plan limit |
| MRR | `SUM(active plan prices)` | +X% vs previous month |
| ARR | MRR × 12 | Annual projection |
| Paying Users | `COUNT(subscriptions WHERE plan != 'free')` | free→paid conversion % |
| Churn Rate | Users who downgraded/cancelled this month ÷ total paying at month start | Trend ↑↓ |
| ARPU | MRR ÷ Paying Users | Trend ↑↓ |
| LTV | ARPU ÷ Churn Rate | Estimate |

> **Note:** the plan lives on `subscriptions` (user-based), not on `workspaces`. The legacy
> `workspaces.plan` column is not the source of truth — see
> [TRAKALOG_BILLING.md](TRAKALOG_BILLING.md) §1.

#### Charts

1. **User Growth** — line chart: cumulative signups by day/week/month (toggle), with separate
   lines for free and paid.
2. **MRR Growth** — line chart: MRR by month, broken down by plan (Starter/Pro/Business).
3. **Tracks Uploaded** — bar chart: tracks uploaded per day/week.
4. **Feature Usage** — horizontal bar chart: % of users using each feature (pitches, shared
   links, Smart A&R, splits, stems, playlists, radio, QR studio, branding).
5. **Plan Distribution** — donut chart: Free / Starter / Pro / Business.
6. **Top 10 Workspaces** — table: the 10 workspaces with the most tracks, showing name, plan,
   track count, last activity.

#### Alerts (top of page, dismissable)

- "X users signed up but never uploaded a track" (onboarding drop-off)
- "Edge Function X has an error rate > 5% in the last 24h"
- "Storage usage approaching plan limit for X workspaces"
- "X paying users haven't logged in for 30+ days" (churn risk)
- "X free trials expiring in 3 days"

---

### 2.2 — Users (`/admin/users`)

#### User list

Columns: avatar + full name · email · signup date · last login · active plan (coloured badge) ·
workspace count · total track count · pitches sent · status (Active / Inactive after 30 days /
Churned).

Features:

- **Search** by name or email
- **Filters:** plan (Free/Starter/Pro/Business), status (Active/Inactive/Churned), signup date
  range
- **Sort:** by signup date, last activity, track count, plan
- **Export:** CSV of the filtered list
- **Pagination:** 50 users per page, lazy-loaded

#### User detail page

**General**
- Avatar, name, email, signup date, last login
- Auth provider (email/Google)
- 2FA enabled yes/no
- Last login IP

**Workspaces**
- Every workspace with name, plan, track count, member count, branding thumbnail
- Click through to the workspace detail

**Recent activity** (timeline)
- The last 50 actions: track upload, pitch sent, shared link created, member invited, etc.,
  with timestamps and detail

**Engagement**
- 30-day activity chart (heatmap or bar chart)
- Sessions per week
- Most-used features

**Billing**
- Current plan, start date, next invoice
- Payment history via Stripe
- AI Credits: balance and usage history
- "View in Stripe" button → opens the Stripe Dashboard for that customer

**Admin actions**
- "View as user" (impersonation)
- "Send email" (opens a composer)
- "Upgrade/Downgrade plan" (admin override, logged to `audit_logs`)
- "Disable account" (soft delete, never a hard delete)
- "Reset password" (sends a reset email)

---

### 2.3 — Workspaces (`/admin/workspaces`)

#### Workspace list

Columns: logo thumbnail + name · owner (name + email) · plan · track count · member count ·
storage used · last activity · created at.

Features: search, filters (plan, track-count range, active/inactive), sort, CSV export.

#### Workspace detail

**Info** — name, slug, owner, plan, creation date; branding (hero image, logo, brand colour
preview); social links.

**Catalog** — total tracks; breakdown by status (Available / On Hold / Released); breakdown by
genre (pie chart); top 10 most-played tracks (plays via shared links); storage used (audio +
covers + stems + documents).

**Members** — list with name, email, access level, professional title, date added; pending
invitations.

**Activity** — pitches sent (count + last 10); shared links created (count + last 10 with play
stats); active catalog shares and their target workspaces.

**Contacts** — total count; top 10 most-engaged contacts (who listened most); CSV export.

---

### 2.4 — Tracks (`/admin/tracks`)

#### Global view

KPIs: total tracks on the platform · tracks uploaded today / this week / this month · average
size per track · breakdown by format (WAV/MP3/FLAC/AIFF) · breakdown by genre · % with Sonic
DNA complete · % with lyrics · % with splits defined · % with stems uploaded.

#### Track search

- Search by title, artist, ISRC
- Filters: genre, BPM range, key, status, has_lyrics, has_splits, has_stems
- Click a track → full detail (metadata, splits, Sonic DNA, engagement)

> **Note:** `tracks.genre` is a `text[]`. Any genre breakdown must unnest the array, and any
> genre filter must use array containment — not equality.

---

### 2.5 — Engagement & Analytics (`/admin/analytics`)

#### Shared links

- Total shared links created
- Total plays (all time)
- Plays per day (line chart)
- Top 10 most-played shared links
- Completion rate (average % listened)
- Gate-screen conversion: % of visitors who complete the form
- Downloads: total, by type (original, preview, pack)

> **Data sources:** plays and downloads come from `link_events` (`event_type` is CHECK-limited
> to `play` / `download` / `view`). Gate submissions come from `link_downloads` — note that
> table records *every gate submission*, not only downloads, so conversion is
> `link_downloads` ÷ `link_events WHERE event_type = 'view'`.

#### Pitches

- Total pitches sent
- Open rate (% opened by the recipient)
- Listen rate (% where the recipient played at least one track)
- Pitches per day/week (bar chart)
- Top 10 pitchers

#### Smart A&R

- Total queries
- Queries per day
- Estimated Groq cost
- Average response time
- % of queries returning results

#### Sonic DNA

- Total analyses completed
- Analyses per day
- Success rate (% without error)
- Average processing time
- Estimated Railway cost

---

### 2.6 — Billing & Revenue (`/admin/billing`)

#### Revenue dashboard

- **Current MRR** with per-plan breakdown
- **MRR growth** — monthly chart
- **New MRR** — revenue from new subscribers this month
- **Expansion MRR** — upgrades (Starter→Pro, Pro→Business)
- **Contraction MRR** — downgrades
- **Churned MRR** — cancellations
- **Net MRR** — New + Expansion − Contraction − Churned

#### Plan distribution

- Users per plan (table + donut chart)
- Conversion funnel: Free → Trial → Starter → Pro → Business
- Churn by plan

#### AI Credits

- Total credits purchased (incremental revenue)
- Credits purchased per month
- Top credit buyers
- Average credit usage per user

#### Stripe integration

- Direct link to the Stripe Dashboard
- Webhook status: recent events received, errors (the `stripe_webhook_events` table already
  exists)
- Recent invoices

---

### 2.7 — Infrastructure & Health (`/admin/health`)

#### Edge Function status

| Function | Status | Invocations/24h | Errors/24h | Error rate | Avg time | Rate limits hit |
|---|---|---|---|---|---|---|
| smart-ar | ✅ | 245 | 3 | 1.2% | 2.3s | 0 |
| analyze-sonic-dna | ⚠️ | 89 | 12 | 13.5% | 8.1s | 2 |
| … | … | … | … | … | … | … |

Source: Supabase Edge Function logs (API, or scraped from the dashboard).

#### Storage

- Total usage per bucket. **The five logical buckets are `tracks`, `stems`, `watermarked`,
  `covers`, `documents`** — there is no separate branding or avatars bucket.
- Growth per month
- Top 10 workspaces by storage

#### Database

- Row counts for the main tables
- Table growth per month
- Slowest queries, if `pg_stat_statements` is available

#### External services

- Railway (Sonic DNA + Watermark): status, uptime, monthly cost
- Groq: usage, estimated cost
- Resend: emails sent, delivery rate, bounces
- Vercel: recent deployments, build time

---

### 2.8 — Audit Logs (`/admin/audit`)

- Every event in `audit_logs`
- Filters: action type, user, resource, date range
- Logged actions: login, logout, `track.upload`, `track.delete`, `pitch.send`,
  `shared_link.create`, `member.invite`, `plan.upgrade`, `plan.downgrade`,
  `admin.impersonate`, etc.
- CSV export

---

### 2.9 — Admin notifications (`/admin/notifications`)

Push/email notifications to the admin when:

- **New signup** — "New user: [Name] ([email])" — daily digest
- **New paying user** — "🎉 [Name] upgraded to [Plan]!" — immediate
- **Churn** — "[Name] cancelled [Plan]" — immediate
- **Milestone** — "🎯 100 users reached!" / "🎯 $1K MRR reached!"
- **Critical error** — "⚠️ Edge Function [name] error rate > 10%"
- **Storage alert** — "⚠️ Workspace [name] approaching storage limit"

Channels: in-app (badge on the admin icon), daily configurable email digest, optional Slack
webhook (future).

---

## 3. Technical architecture

### Tables

```sql
-- Admin flag on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_platform_admin boolean DEFAULT false;

-- Aggregated metrics cache, so heavy KPIs are not recomputed on every page load
CREATE TABLE IF NOT EXISTS admin_metrics_cache (
  id text PRIMARY KEY,
  value jsonb NOT NULL,
  computed_at timestamptz DEFAULT now()
);

-- Admin notifications
CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- 'new_signup', 'new_paying', 'churn', 'milestone', 'error', 'storage_alert'
  title text NOT NULL,
  body text,
  metadata jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes for frequent admin queries
CREATE INDEX IF NOT EXISTS idx_tracks_created_at   ON tracks(created_at);
CREATE INDEX IF NOT EXISTS idx_tracks_workspace_id ON tracks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
```

> The spec's `idx_workspaces_plan` is omitted here: the plan lives on `subscriptions`, so that
> index would point at the legacy column.

### Admin RPCs (all `SECURITY DEFINER` + `is_platform_admin` check)

```sql
-- Metrics
admin_get_overview_stats(_admin_id uuid) → jsonb
admin_get_user_growth(_admin_id uuid, _period text) → jsonb
admin_get_revenue_stats(_admin_id uuid) → jsonb

-- Users
admin_list_users(_admin_id uuid, _page int, _per_page int, _search text, _plan text, _status text) → SETOF jsonb
admin_get_user_detail(_admin_id uuid, _target_user_id uuid) → jsonb
admin_get_user_activity(_admin_id uuid, _target_user_id uuid, _limit int) → SETOF jsonb

-- Workspaces
admin_list_workspaces(_admin_id uuid, _page int, _per_page int, _search text) → SETOF jsonb
admin_get_workspace_detail(_admin_id uuid, _workspace_id uuid) → jsonb

-- Tracks
admin_get_track_stats(_admin_id uuid) → jsonb
admin_search_tracks(_admin_id uuid, _query text, _filters jsonb) → SETOF jsonb

-- Engagement
admin_get_engagement_stats(_admin_id uuid, _period text) → jsonb
admin_get_top_shared_links(_admin_id uuid, _limit int) → SETOF jsonb

-- Actions
admin_disable_user(_admin_id uuid, _target_user_id uuid) → void
admin_override_plan(_admin_id uuid, _workspace_id uuid, _plan text) → void
```

> ⚠️ **These names are proposals and none of them exists.** The RPCs actually shipped are
> `get_admin_overview`, `list_all_users`, `list_all_contacts`, `list_waitlist_signups`,
> `get_visit_stats` and `delete_leak_trace`. Either extend those or rename deliberately —
> do not assume the `admin_*` names above are callable.

### Frontend

- Route group `/admin/*` in `App.tsx`
- An `AdminRoute` guard checking `is_platform_admin`
- Lazy-loaded — normal users never download the admin code
- Charts: recharts (already a dependency)
- Server-side pagination — never fetch 10K users into memory
- KPI auto-refresh every 5 minutes
- Local cache of heavy metrics (`admin_metrics_cache`)

> *As built:* a separate hostname and a separate root component rather than a route group.
> That already satisfies the isolation goal more strongly than lazy-loading would. See §0.

### Cron — aggregated metrics

An Edge Function `compute-admin-metrics` running hourly:

- Computes the heavy KPIs (MRR, churn, MAU, feature usage)
- Stores them in `admin_metrics_cache`
- The dashboard reads the cache instead of computing live
- Light metrics (user count, track count) stay live

---

## 4. Implementation phases

### Phase 1 — MVP (~2-3 sessions)
1. `is_platform_admin` column + route guard
2. Overview page with basic live KPIs (no cache)
3. Users list with search + filters
4. Basic user detail (info + workspaces + track count)
5. recharts for 2-3 charts (user growth, tracks uploaded)

> Largely done, by a different route. See §0.

### Phase 2 — Billing & analytics (~2 sessions)
6. Stripe Dashboard integration (MRR, plan distribution)
7. Engagement page (shared-link plays, pitch stats)
8. Workspaces page with detail
9. Admin notifications (new signup, new paying, churn)

### Phase 3 — Intelligence (~2 sessions)
10. Feature-usage analytics
11. Churn prediction (users inactive for X days)
12. Onboarding funnel (where users drop off)
13. Aggregated-metrics cron
14. CSV export on every list

### Phase 4 — Ops (~1-2 sessions)
15. Edge Function health dashboard
16. Storage monitoring
17. Audit log viewer
18. Impersonation
19. Admin actions (disable user, override plan)

---

## 5. Admin notifications in detail

### Automatic triggers

| Event | Notification | Channel |
|---|---|---|
| New signup | "[Name] just signed up" | Daily digest |
| First track uploaded | "[Name] uploaded their first track" | Daily digest |
| Plan upgrade | "🎉 [Name] upgraded to [Plan]! MRR +$X" | Immediate email |
| Downgrade/cancel | "⚠️ [Name] cancelled [Plan]. MRR −$X" | Immediate email |
| 7 days inactive (paying) | "[Name] ([Plan]) hasn't logged in for 7 days" | Daily digest |
| 30 days inactive (paying) | "🚨 [Name] ([Plan]) inactive for 30 days — churn risk" | Immediate email |
| Milestone | "🎯 [X] users reached!" | Immediate email |
| Edge Function error rate > 10% | "⚠️ [Function] error rate: [X]% in last hour" | Immediate email |
| Workspace storage > 80% | "Storage warning: [Workspace] at [X]% capacity" | Daily digest |

### Daily email digest (06:00)

```
📊 Trakalog Daily Report — April 25, 2026

USERS
  New signups: 12 (+3 vs yesterday)
  Active today: 45
  Total: 1,234

REVENUE
  MRR: $4,567 (+$87)
  New subscriptions: 3 (2× Pro, 1× Starter)
  Cancellations: 1 (Starter)

CONTENT
  Tracks uploaded: 67
  Pitches sent: 23
  Shared links created: 34

ALERTS
  ⚠️ 5 paying users inactive > 7 days
  ⚠️ Edge Function smart-ar: 3 errors in last 24h
```

---

## 6. Scalability

### 10-100 users (beta)
- Every query live (`COUNT`, `SELECT`)
- No cache needed
- Client-side recharts is enough

### 100-1,000 users
- Add `admin_metrics_cache` for heavy KPIs
- Server-side pagination on every list
- DB indexes on frequently filtered columns

### 1,000-10,000 users
- Hourly cron for metrics
- Materialized views for heavy aggregations (tracks by genre, plays per day)
- Cursor pagination instead of offset
- Consider a separate data warehouse (BigQuery, ClickHouse) for heavy analytics

### 10,000-100,000 users
- Data warehouse mandatory
- Event streaming (Kafka or equivalent) for real-time metrics
- Admin dashboard separated from the main frontend, on the `admin.trakalog.com` subdomain
  — **already the case**, see §0
- Rate limiting on the admin side too: even admins should not be able to launch 100 concurrent
  CSV exports

---

## 7. Recommended stack

| Component | Tool | Why |
|---|---|---|
| Charts | recharts (already installed) | Lightweight, React-native |
| Tables | @tanstack/react-table | Pagination, sorting, filtering, virtualisation |
| Date range picker | react-day-picker (already in shadcn) | Consistent with the design system |
| CSV export | csv-stringify, or hand-rolled | Lightweight |
| Email digest | Resend (already configured) | Same infrastructure |
| Cron | Supabase pg_cron or a scheduled Edge Function | No extra server |
| Impersonation | Custom JWT claim or session swap | Secure |

---

## Dependencies

- **Billing/Stripe** ✅ plumbing now exists (3 Edge Functions, `stripe_customer_id`,
  `stripe_webhook_events`) — revenue metrics are unblocked
- **`audit_logs`** ✅ table exists
- **recharts** ✅ in `package.json`
- **Resend** ✅ configured
- **Edge Functions** ✅ infrastructure in place

---

*This document is the source of truth for implementing the Trakalog Admin Dashboard.*
