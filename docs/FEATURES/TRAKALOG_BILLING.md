# TRAKALOG — Billing & Payment System (Stripe)

> **Version:** 5.0 · **Revised:** August 5, 2026 (Business storage cap, founder tier) · **Base:** 4.1 (August 2, 2026, seat model)
> **Last Updated:** September 2, 2026 (translated to English; §7-8 reconciled against the shipped implementation)
> **Supersedes:** every earlier version. The old document described $14/$29/$59 workspace-based pricing — **obsolete**.
> **Status:** Specification validated; server-side enforcement active.

> ⚠️ **Source of truth.** This document takes precedence over any memory or older version. The
> prices, limits and seat model below are **final**. Do not re-implement superseded logic.
>
> 🔴 **Change 4.1 (August 2, 2026) — seat model.** Viewers are **no longer** free or unlimited:
> **every workspace member consumes a seat**, whatever their level (viewer, editor, admin). The
> only free channel is the **shared link** — a recipient views without an account, without
> being a member, without limit, and without consuming a seat. New limits: Pro = **2 seats /
> 4 workspaces**, Business = **5 seats / 10 workspaces**. Pro/Business add-ons: **$10/seat/month**
> and **$5/workspace/month**. **Hard cap: 15 workspaces** on Pro/Business — beyond that, sales
> contact; the server genuinely blocks at 15.

---

## 1. Architecture (read before writing any code)

**Subscriptions are user-based.** One user = one subscription (`subscriptions` table, keyed on
`user_id`). There is no workspace-level plan.

- **Personal quotas** (tracks, storage, Smart A&R) follow the **uploader**. That is the user's
  total catalog across *all* their workspaces, not a per-workspace cap.
- **Workspace features** (branding, watermarking, catalog sharing, seats, workspace count)
  follow the **workspace owner's** plan.
- Consequence: a Free user invited into a Pro workspace gets access to the workspace, but stays
  bound by *their own* Free quotas for their uploads and actions.

**The seat model is "one seat per member".** Anyone added to a workspace occupies a seat,
**whatever their access level**, viewers included. Free external sharing goes exclusively
through **shared links** — the recipient is never a member.

| Access role | Billing |
|---|---|
| **Viewer / Pitcher / Editor / Admin** | = **1 seat**. Every member counts against the plan limit. |
| **Owner** | Counts as 1 seat, included in the plan's seats. |
| **Shared-link recipient** | Never a member, never counted, **unlimited — the free channel**. |

> The GitHub-style "dual Personal + Team" model was **abandoned**. It does not fit Trakalog — a
> collaborator joining a label does not have a parallel Trakalog "personal life". Do not
> resurrect it.

---

## 2. Pricing

All prices in **USD**. Annual discount **25%**.

| | Free | Starter | Pro | Business | Enterprise |
|---|---|---|---|---|---|
| **Monthly** | $0 | $10 | $25 | $45 | Contact us |
| **Annual** | — | $90 | $225 | $405 | Contact us |
| **Tracks** | 10 | 100 | 1,000 | 5,000 | Custom |
| **Storage** | 1.5 GB | 40 GB | 400 GB | **1 TB** | Custom |
| **Playlists** | 1 | ∞ | ∞ | ∞ | ∞ |
| **Shared links** | 1 (Trakalog branding) | ∞ | ∞ | ∞ | ∞ |
| **Smart A&R** | 2 lifetime | 15/month | 50/month | 500/month | Custom |
| **Lyrics** | Display only | Auto transcription | Auto transcription | Auto transcription | ✅ |
| **Workspaces** | 1 | 1 (solo) | 4 | 10 | Custom |
| **Seats (every member)** | 1 | 1 (strict solo) | 2 included (owner + 1) | 5 included (owner + 4) | Custom |
| **Additional seat** | — | — | $10/seat/month | $10/seat/month | Custom |
| **Additional workspace** | — | — | $5/workspace/month | $5/workspace/month | Custom |
| **Workspace hard cap** | 1 | 1 | 15 (then sales contact) | 15 (then sales contact) | Custom |
| **Link sharing** | ∞ | ∞ | ∞ | ∞ | ∞ |
| **Credit purchases** | ❌ | ✅ | ✅ | ✅ | ✅ |

> 🔵 **Change 5.0 (August 5, 2026).**
> 1. **Business storage: 2 TB → 1 TB** (`20260805203027_business_storage_cap_1tb.sql`). At
>    $0.015/GB/month on R2, 2 TB cost ~$30/month against a $45 subscription — too thin a margin.
>    1 TB brings the ceiling cost to ~$15, a third of revenue. No user was affected: the largest
>    consumer at the time was at 1.95 GB.
> 2. **Internal `founder` tier** (`20260802172732_add_founder_plan_unlimited_v2.sql`).

### Internal tier: `founder`

A fifth tier exists in the database and appears nowhere in the purchase UI.

| Attribute | Value |
|---|---|
| `plan` | `founder` |
| `tracks_max`, `workspaces_max`, `seats_included` | `-1` (unlimited) |
| `storage_bytes_max` | `9223372036854775807` (max `bigint`, effectively unlimited) |
| `pitches_per_month`, `smart_ar_per_month` | `-1` |
| `smart_ar_lifetime` | `NULL` (no lifetime cap) |
| `price_monthly_cents`, `price_yearly_cents` | `0` |
| `seats_addon_allowed`, `viewers_unlimited` | `false` |
| `features` | all 14 features `true` |

**Off Stripe:** the `stripe_prices.plan` CHECK allows only `starter`, `pro`, `business`, so no
Stripe price exists for `founder`. The tier is assigned manually in the database and must never
be exposed for purchase. The frontend surfaces it through the `founderNotice` i18n key.

**The `-1` convention:** in `plan_limits`, `-1` means *unlimited*. Any code comparing against a
limit must handle `-1` before comparing, or an unlimited plan reads as a quota of zero.

---

## 3. Customer-facing cards (validated copy)

### FREE — $0
*Get started — no credit card required.*
**For creators trying out Trakalog and sharing their first tracks.**

- **Catalog & storage** — 10 tracks · 1.5 GB storage · full metadata management (credits, genre, tags, BPM & key)
- **Sharing** — 1 playlist · 1 shared link (Trakalog branding) · password protection & expiry controls · 10 contacts
- **A&R intelligence** — 2 Smart A&R queries (lifetime) — try it once, on us
- **Sonic DNA** — automatic BPM & key detection + audio fingerprinting
- **Lyrics** — lyrics display
- **Trakalog Radio** — your own on-demand streaming platform for your catalog

**Not included — upgrade to Starter:** per-track stems · invisible watermarking & leak tracing · custom-branded links · automatic lyrics transcription · splits & digital signatures · QR Studio · unlimited playlists & shared links

---

### STARTER — $10/month
*billed monthly · or $90/year (save 25%)*
**For independent creators — solo artists, beatmakers, and songwriters managing their own catalog.**

- **Catalog & storage** — 100 tracks · 40 GB storage cap (tracks + stems + documents) · per-track stem storage · full metadata management (all standard music-industry credits, genre, tags, BPM & key, and more)
- **Sharing & distribution** — unlimited playlists · unlimited shared links · custom-branded links (logo, hero & colors) · password protection & expiry controls
- **Protection** — invisible audio watermarking · leak tracing
- **A&R intelligence** — 15 Smart A&R queries / month
- **Lyrics** — automatic lyrics transcription
- **Rights management** — splits & digital signatures · QR Studio (instant split signing with collaborators)
- **Contacts** — unlimited contacts · automatic contact capture
- **Trakalog Radio** — your own on-demand streaming platform for your catalog

**Not included — available in Pro:** multi-workspaces with multiple collaborators · cross-workspace catalog sharing · Trakalog Access (marketplace) · contact export (CSV / XLSX / PDF)

*Note: Starter is strictly solo. No invited members in the workspace at all — not editor, not
pitcher, not viewer. External sharing through links is of course still included.*

---

### PRO — $25/month
*billed monthly · or $225/year (save 25%)*
**For active producers, managers, and small labels running a catalog with a team.**

**Everything in Starter, plus —**

- **Scale** — 1,000 tracks · 400 GB storage cap (tracks + stems + documents) · 50 Smart A&R queries / month
- **Team & workspaces** — up to 4 workspaces · 2 seats included (owner + 1) · every member takes a seat, whatever their access level · add seats anytime — $10/seat/month · add workspaces — $5/workspace/month (hard cap 15 workspaces, then contact us)
- **Free external sharing** — share tracks & playlists with anyone through links: no account, not a member, unlimited, and never uses a seat
- **Collaboration & business** — cross-workspace catalog sharing · Trakalog Access — the marketplace: put your tracks in front of execs, and browse other creators' catalogs to find the song you need · contact export (CSV / XLSX / PDF)

**Not included — available in Business:** more tracks, workspaces & active seats · higher Smart A&R limits · priority support

---

### BUSINESS — $45/month
*billed monthly · or $405/year (save 25%)*
**For labels, publishers, and sync agencies managing large catalogs and teams.**

**Everything in Pro, plus —**

- **Scale** — 5,000 tracks · **1 TB** storage cap (tracks + stems + documents) · 500 Smart A&R queries / month
- **Team & workspaces** — up to 10 workspaces · 5 seats included (owner + 4) · every member takes a seat, whatever their access level · add seats — $10/seat/month · add workspaces — $5/workspace/month (hard cap 15 workspaces, then contact us for a custom plan)
- **Support** — priority support

**Need more? → Enterprise (Contact us)** — SSO/SAML, custom limits, SLA, dedicated support

---

### ENTERPRISE — Contact us

No Stripe price. A "Contact us" column on the pricing page. Aimed at majors and large catalogs
(50k+ tracks). Reserved: SSO/SAML, custom limits, SLA, dedicated CSM, PO-based invoicing.
**None of these components is built** — this is sales-led, not self-serve.

---

## 4. Seat model in detail

- **Free & Starter are solo.** Owner only, no other members in the workspace.
- **Pro & Business are team plans.** Owner plus included seats. **Every member consumes a
  seat**, whatever their access level, viewers included.
- **1 seat** = one workspace member at any level (Viewer / Pitcher / Editor / Admin). There is
  no longer a "free viewer".
- **Owner** = 1 seat, counted within the included allowance.
- **Additional seats** beyond the included allowance: **$10/seat/month** (Pro & Business), one
  price platform-wide. Native Stripe proration on add/remove.
- **Additional workspaces** beyond the included allowance: **$5/workspace/month** (Pro &
  Business). **Hard cap: 15 workspaces** — beyond that, sales contact; the server genuinely
  blocks at 15.
- **The free channel is shared links.** A link recipient views a track or playlist without an
  account, without being a member, without limit, and consumes no seat.
- **Limits (tracks, storage, Smart A&R) remain per user/workspace, not per seat.** An extra
  seat means one more person acting within the existing pool; it does not raise quotas. A
  workspace outgrowing its pool is an upgrade trigger to the tier above.

---

## 5. AI Credits (add-on)

Deliberately **simple**:

- **1 credit = 1 Smart A&R query** beyond the plan's monthly quota. That is **the only thing**
  credits buy today.
- **Packs:** 25 credits **$5** · 100 credits **$15**. *(The 500 pack is deferred post-launch.)*
- **Purchased credits never expire.**
- **The monthly Smart A&R quota** (15/50/500) **resets each month** and does not accumulate.
  Consumption order: monthly quota first, then purchased credits.
- **Free cannot buy credits** — paid plans only. After its 2 lifetime queries: wall → upgrade.
- Sales line: *"Your plan includes your monthly Smart A&R matches. Need more? Top up with
  credits that never expire."*

> When a new paid AI feature ships (stem generation, say), its credit cost will be added **at
> that point**. Nothing that does not exist gets listed.

**Lyrics transcription (Starter+, included, not a credit cost).** Whisper via Groq, ~$0.01/track
— negligible, and self-limiting, since only tracks with vocals trigger it. But because it is
triggered on demand it **must have an anti-abuse rate limit** (see §8bis) to prevent repeated
re-transcription of the same track.

---

## 6. Billing mechanics

- **Annual discount:** 25% (show annual by default on the pricing page, monthly toggle, "Save 25%" badge).
- **Stripe Tax** enabled from day one (VAT/sales tax automatic by location).
- **7-day money-back guarantee** on the first payment, no justification required.
- **Proration:** immediate on upgrade, end-of-cycle on downgrade.
- **Dunning:** Stripe Smart Retries over 21 days before downgrade to Free.
- **Beta Passes:** the `beta_passes` table (lifetime / annual / monthly access by email, granted
  plan, expiry). The `handle_new_user_subscription` trigger creates the subscription on the
  right plan at signup if an active pass exists for that email.
- **Downgrade with overage:** existing tracks and data stay readable; no new upload while the
  count exceeds the new plan's limit.

---

## 7. Stripe — products & prices

**Subscription products (recurring):**
- `trakalog_starter` — $10/mo · $90/yr
- `trakalog_pro` — $25/mo · $225/yr
- `trakalog_business` — $45/mo · $405/yr

**Credits (one-time):**
- `trakalog_credits_25` — $5
- `trakalog_credits_100` — $15

**Add-ons — still to create ⚠️**
- `trakalog_seat_addon` — **$10/seat/month**
- workspace add-on — **$5/workspace/month**

Both add-on columns already exist in the database (`subscriptions.purchased_seats`,
`subscriptions.purchased_workspaces`), and `plan_limits` carries `seats_addon_allowed` and
`seat_addon_price_cents`. What is missing is the Stripe products themselves, the webhook wiring
onto those columns, and any purchase UI — **none exists**.

Prices live in the `stripe_prices` table, never hardcoded. Its `plan` CHECK allows only
`starter`, `pro`, `business` — Enterprise and founder have no price row by design.

**Supabase secrets:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`.

---

## 8. Implementation status

> **This section was rewritten on September 2, 2026.** It previously reported a July 20 database
> scan claiming "no Stripe plumbing (0 Edge Functions)" and "no limit enforcement anywhere".
> Both statements are now false — the work landed in the August 2-5 migrations. What follows was
> verified against the migrations and `supabase/functions/`.

**In place ✅**

- Tables `subscriptions` (user-based, with counters), `beta_passes`, `credit_purchases`,
  `plan_limits`, `stripe_prices`, `stripe_webhook_events`.
- `handle_new_user_subscription` — assigns the plan at signup (beta pass → granted plan,
  otherwise Free).
- `sync_subscription_usage` — maintains `tracks_uploaded_count` and `storage_bytes_used` on
  track insert/delete.
- RLS: `subscriptions` / `credit_purchases` are SELECT-own only → **the plan cannot be forged
  client-side**.
- **Stripe plumbing exists**: the `create-checkout-session`, `create-portal-session` and
  `stripe-webhook` Edge Functions are all deployed, and `subscriptions.stripe_customer_id` is
  populated and looked up by the webhook handlers.
- **Plan-limit enforcement is live** for four resources, each raising an explicit
  `plan_limit_reached: <resource>` error the frontend catches to show the upgrade modal:
  `tracks`, `pitches`, `seats`, `workspaces`.
- **Seat and workspace enforcement** through triggers, `ERRCODE check_violation`
  (`20260802172409_seats_every_member_counts_no_free_viewers.sql`,
  `20260802173016_workspace_addon_5usd_hard_cap_15.sql`). The frontend surfaces this through
  `useWorkspaceSeats` and the `SEAT_LIMIT_ERROR = "plan_limit_reached: seats"` constant.
- **Smart A&R quota**: `check_smart_ar_quota(_user_id)` is called before any work in the
  `smart-ar` Edge Function, and `increment_smart_ar_usage(_user_id)` runs after success.
- **Storage tracking**: `compute_user_storage_bytes`, `recompute_all_storage_usage`, and the
  `backfill-storage-sizes` Edge Function for objects already in R2.

**Still missing ❌**

1. **Seat and workspace add-on purchase.** Stripe products not created, webhook not wired to
   `purchased_seats` / `purchased_workspaces`, no purchase UI.
2. **A `BEFORE INSERT` storage-quota trigger.** Storage usage is measured but nothing blocks an
   upload that exceeds `plan_limits.storage_bytes_max`.
3. **Quota display in the UI.** Users cannot see how close they are to any limit.
4. **`pitches_sent_this_month`** — verify the counter is incremented and reset on the
   `invoice.paid` webhook.
5. **`prevent_client_plan_change`** is attached to `workspaces` (the legacy `plan` column)
   rather than `subscriptions`. Should be moved — non-blocking, since RLS already protects the
   real value.

---

## 8bis. Anti-abuse guardrails

> **Guiding principle:** every quota or variable-cost action needs an **anti-abuse guardrail
> (rate limit + cap)**, not only a plan limit. A plan limit stops someone exceeding their
> quota; a rate limit stops someone hammering an action to cause harm — cost, spam, DoS — even
> *within* their quota.

1. **Rate-limit lyrics transcription.** Triggered on demand, so repeated re-transcription of
   the same track must be prevented. ✅ **Done** — `transcribe-lyrics` enforces 10/hour per IP,
   3/day per track, 500/day per user and 2000/day globally. The unit cost is negligible
   (~$0.01), but hammering it 10,000× remains an abuse vector.
2. **Rate-limit Smart A&R and every AI action**, including beyond the monthly quota and on
   purchased credits. ✅ **Done** — 20/hour per IP, 100/hour per user, 3000/day globally.
3. **Backend/RPC plan-limit enforcement.** ✅ **Done** for tracks, pitches, seats and
   workspaces (§8). Storage remains outstanding.
4. **Wire the counters.** `smart_ar_queries_this_month` ✅ via `increment_smart_ar_usage`;
   `pitches_sent_this_month` still to verify.
5. **Plan limits as server-side source of truth** — ✅ the `plan_limits` table, not frontend
   constants.
6. **Infrastructure rate limiting** on Edge Functions — ✅ in place through the Postgres
   `check_rate_limit` RPC against the `rate_limits` table.

---

## 9. Product honesty (binding on all copy)

- **No** mood detection and **no** automatic structure detection in marketing — both were
  removed from the UI as inaccurate.
- **Sonic DNA** is an internal engine. Permitted phrasing: *"Automatic BPM & key detection +
  audio fingerprinting that powers Smart A&R matching."* It is not a user-facing section.
- **No API access** in the plans — not built.
- **Brief Seeker / Artist Seeker / stem generation**: not built → **absent from the cards**.
  Add each at its own launch.
- **Enterprise**: SSO/SAML/SOC2/SLA not built → sales-led only.

---

## 10. Changelog versus the old version

- Pricing: ~~$14/$29/$59~~ → **$10/$25/$45** (revised after the Postal.music analysis, May 20; reconfirmed).
- Architecture: ~~workspace-based~~ → **user-based**.
- Team model: ~~5 flat members~~ → ~~active seats + free viewers~~ → **every member = 1 seat**
  (v4.1, August 2, 2026; no more free viewer). Pro 2 seats / 4 workspaces, Business 5 seats /
  10 workspaces; seat add-on $10 + workspace add-on $5; hard cap 15 workspaces; free channel =
  shared links.
- Free: **10 tracks / 1.5 GB / 1 playlist / 1 link / 2 lifetime Smart A&R**; no credit purchases.
- Starter: **strictly solo**; lyrics transcription added.
- AI Credits: ~~3 packs, multi-action~~ → **2 packs, 1 credit = 1 Smart A&R** only.
- Annual discount: ~~21%~~ → **25%**.
- Enterprise: "Contact us" column, no Stripe price.
- **v5.0 (August 5, 2026):** Business storage 2 TB → **1 TB**; internal `founder` tier added.
