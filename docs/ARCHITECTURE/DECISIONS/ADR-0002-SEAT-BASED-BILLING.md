# ADR-0002: Seat-Based Billing Model

> **Status:** Accepted
> **Date:** August 11, 2026 · **Revised:** September 2, 2026
> **Author:** Ishan
> **Supersedes:** None

---

## Context

Trakalog needed a billing model that aligns with how music industry professionals collaborate. The platform serves teams working on pre-release music catalogs, where multiple individuals (A&R managers, producers, label representatives, artists) need access to shared workspaces.

### Problem Statement
When designing the billing system, we considered several approaches:

1. **Per-workspace billing:** Charge based on the number of workspaces
2. **Per-track billing:** Charge based on the number of tracks stored
3. **Storage-based billing:** Charge based on total storage used
4. **Seat-based billing:** Charge based on the number of users (seats) in the organization

The music industry operates with teams of varying sizes. A solo artist might need just one workspace, while a label could have a dozen team members across multiple workspaces. Per-workspace or per-track models don't account for team size, leading to either overcharging (many users in few workspaces) or undercharging (few users in many workspaces).

### Constraints
- Must accommodate teams from a solo artist upward
- Must support multiple workspaces per owner
- Must be predictable and easy to understand for budgeting
- Must scale with team growth
- Must allow for different permission levels within a team
- **Must not make external sharing expensive** — pitching a track to an A&R or a music supervisor is the platform's core motion, and those recipients must never require a paid seat

---

## Decision

**We chose a Seat-Based Billing model where the workspace owner pays per user seat, with tiered plans offering different numbers of included seats and workspace limits, plus paid add-ons above those.**

### Seat definition (revised August 2, 2026)

**Every member of a workspace consumes exactly one seat, regardless of access level** — viewer, editor, admin, and the owner alike. Pending invitations also hold a seat until they expire.

This replaced an earlier "Figma model" in which viewers were free and unlimited. The reasoning for the change: permanent access to a catalog *is* use of the service, so it should be paid. Free viewers made the highest-value use case (a label giving its whole team standing access) cost nothing.

**The free channel is the shared link.** A recipient opens a track, playlist or pack through a link without an account, without becoming a member, unlimited, and never consumes a seat. This is deliberate and load-bearing — it is how pitching works, and it is why removing free viewers did not damage the core motion.

### Tier structure

The authority is the `plan_limits` table. Values below reflect it as of September 2026:

| Plan | Seats included | Workspaces | Seat add-on | Workspace add-on |
|---|---|---|---|---|
| `free` | 1 (solo) | 1 | — | — |
| `starter` | 1 (solo) | 1 | — | — |
| `pro` | 2 | 4 | $10/seat/mo | $5/workspace/mo |
| `business` | 5 | 10 | $10/seat/mo | $5/workspace/mo |
| `founder` | unlimited (`-1`) | unlimited (`-1`) | n/a | n/a |

- **Free and Starter are strictly solo.** No other member may join the workspace at any access level.
- **Pro and Business are team plans.** Seats beyond those included are $10/seat/month; workspaces beyond those included are $5/workspace/month, both prorated natively by Stripe.
- **Hard cap of 15 workspaces** on Pro and Business (`plan_limits.workspaces_hard_cap`). Beyond that the server genuinely refuses; the customer is routed to sales for a custom arrangement.
- **`founder`** is an internal tier: unlimited, off Stripe, assigned manually to founders and gifted accounts. It is never exposed for purchase.
- **There is no "Enterprise" plan row.** Enterprise is sales-led and priced per deal — `plan_limits.plan` and `subscriptions.plan` are both constrained to `free | starter | pro | business | founder`. (A vestigial `workspaces.plan` column carries a different, unused `free | pro | enterprise` constraint; ignore it.)

### Billing mechanics

- **Monthly or annual billing** (annual saves 25%), via Stripe with Stripe Tax enabled.
- **Seat counting:** all workspace members plus unexpired pending invitations.
- **Plan upgrades:** instant, prorated. **Downgrades:** at next billing cycle.
- **Dunning:** Stripe Smart Retries over 21 days before downgrade to Free.
- **Usage quotas** are separate from seats and follow the **uploader**, not the workspace — tracks, storage and Smart A&R totals are per user across all their workspaces. Adding a seat does not raise a quota.

---

## Alternatives Considered

### Option 1: Per-Workspace Billing

**Pros:** simple to understand and implement; aligns with workspace creation; easy to isolate costs per project.

**Cons:** doesn't scale with team size (many users in one workspace costs the same); encourages workspace sprawl to dodge seat limits; hard to predict costs for growing teams; an empty workspace costs the same as an active one.

**Why Not Chosen:** doesn't align with how teams actually work. A label with a dozen team members across several workspaces would pay the same as a solo artist with one workspace.

*(Note: workspaces are not free of charge in the final model — they carry a $5/month add-on above the included count. But they are priced as a secondary lever, not the primary one. A workspace costs almost nothing to provide, since storage is capped per user rather than per workspace.)*

### Option 2: Per-Track Billing

**Pros:** directly tied to value (tracks = assets being managed); scales with usage; easy to understand for the music industry.

**Cons:** doesn't account for team collaboration; penalizes power users with large catalogs; hard to predict as upload activity varies; doesn't reflect team size or workflow complexity.

**Why Not Chosen:** catalogs vary enormously in size. Per-track billing would be prohibitive for established labels and near-free for new artists, and ignores the collaborative nature of the platform. Track counts survive as a **quota** per plan rather than a price input.

### Option 3: Storage-Based Billing

**Pros:** directly tied to resource consumption; common in cloud services; scales predictably.

**Cons:** hard to predict (depends on audio file sizes and formats); doesn't account for team size or collaboration features; WAV vs MP3 makes a large difference; doesn't reflect the value of Smart A&R or watermarking.

**Why Not Chosen:** R2 storage is cheap relative to the platform's value — this would undercharge for the collaborative and AI features while overemphasizing raw bytes. Storage survives as a per-plan quota (`plan_limits.storage_bytes_max`).

### Option 4: Hybrid Billing (Seats + Storage)

**Pros:** captures both team size and usage; more revenue streams; better cost alignment.

**Cons:** complex for customers to understand; hard to predict total cost; two variables to manage; potential sticker shock on usage spikes.

**Why Not Chosen:** adds complexity without clear benefit. Seat-based billing with usage quotas gives the predictability of seat pricing while still bounding resource use.

---

## Consequences

### Positive

1. **Scalability:** the model scales naturally with team growth.
2. **Predictability:** customers budget against a known seat count.
3. **External sharing stays free:** shared links cost nothing and consume no seat, so the pitching motion is never taxed.
4. **Flexibility:** seats and workspaces can be added or removed at any time, prorated.
5. **Alignment:** cost tracks value — more collaborators means more use of the platform.

### Negative

1. **Inactive users still consume seats.** There is no automatic reclamation; owners must remove people.
2. **Viewers are no longer free.** Giving a colleague read-only standing access now costs a seat. The mitigation is that a shared link covers most read-only needs at no cost — but this is a real friction for teams who want persistent browse access for many people.
3. **Pending invitations hold seats.** An owner can be blocked from inviting by invitations nobody accepted, until they expire.
4. **The 15-workspace hard cap is absolute.** It is enforced in the database, not just the UI, so a large customer *cannot* self-serve past it.
5. **Admin overhead:** organizations must actively manage membership.

### Mitigations

1. **Seat visibility:** `get_workspace_seats()` returns `seats_used`, `seats_pending`, `seats_available` and `can_invite_active` for the UI to surface before an invite is attempted.
2. **Shared links as the pressure valve** for read-only access.
3. **Invitation expiry** releases held seats automatically.
4. **Add-ons** let a team grow without a full tier upgrade.

---

## Implementation

### Schema

Seat and workspace limits live in `public.plan_limits`, keyed by `plan` (there is **no** `plans` table):

```sql
-- public.plan_limits (relevant columns; PK is `plan`)
plan                        text     -- free | starter | pro | business | founder
seats_included              integer  -- -1 = unlimited
workspaces_max              integer  -- -1 = unlimited
seats_addon_allowed         boolean
seat_addon_price_cents      integer
viewers_unlimited           boolean  -- false everywhere since 2026-08-02
workspace_addon_allowed     boolean
workspace_addon_price_cents integer  -- 500 on pro/business
workspaces_hard_cap         integer  -- 15 on pro/business, NULL elsewhere
```

Purchased capacity lives on the subscription:

```sql
-- public.subscriptions
plan                  text     -- matches plan_limits.plan
purchased_seats       integer  NOT NULL DEFAULT 0
purchased_workspaces  integer  NOT NULL DEFAULT 0
```

Effective allowance is `seats_included + purchased_seats`, and `least(workspaces_max + purchased_workspaces, workspaces_hard_cap)`.

### Enforcement

Enforcement is **server-side, in Postgres triggers** — not in RLS policies and not in a periodic sync job:

| Function | Fires on | Raises |
|---|---|---|
| `enforce_seat_limit_member()` | INSERT on `workspace_members` (UPDATE is exempt — an existing member changing level already holds their seat) | `plan_limit_reached: seats (n/m)` |
| `enforce_seat_limit_invitation()` | INSERT on `invitations` | `plan_limit_reached: seats (n/m used, p pending)` |
| `enforce_workspace_limit()` | INSERT on `workspaces` | `plan_limit_reached: workspaces (n/m)` |

All three raise with `ERRCODE = 'check_violation'`, and all three exempt `service_role` so backend jobs can bypass them. `get_workspace_seats(_workspace_id)` is the read-side RPC backing the UI.

Stripe webhooks reconcile `subscriptions` on subscription change.

### Known gaps (as of September 2026)

- Stripe products for the seat add-on (`$10`) and workspace add-on (`$5`) **have not been created**, and no webhook writes `purchased_seats` / `purchased_workspaces`. The columns and the trigger arithmetic exist; the purchase path does not.
- There is no purchase UI for add-ons.

---

## References

- [TRAKALOG_BILLING.md](../../FEATURES/TRAKALOG_BILLING.md) — full billing specification (source of truth for pricing)
- [ADR-0001: Multi-Workspace Model](ADR-0001-MULTI-WORKSPACE-MODEL.md) — what a workspace is and why seats attach to it
- [07 - Deployment Architecture](../07-DEPLOYMENT_ARCHITECTURE.md) — infrastructure supporting billing
- [Stripe Documentation](https://stripe.com/docs/billing) — payment processing integration

Migrations that define the current model:
`20260802172027_plan_limits_reduce_seats_pro_business.sql` ·
`20260802172409_seats_every_member_counts_no_free_viewers.sql` ·
`20260802172732_add_founder_plan_unlimited_v2.sql` ·
`20260802173016_workspace_addon_5usd_hard_cap_15.sql`

---

## Document Metadata

| Property | Value |
|----------|-------|
| **Created** | August 11, 2026 |
| **Version** | 2.0.0 |
| **Status** | Accepted |
| **Owner** | Ishan |
| **Last Review** | September 2, 2026 |
| **Next Review** | March 2, 2027 |

---

*Revised September 2, 2026: the original version described tiers, a `plans` table, and enforcement mechanics that did not exist. Every figure above is now traced to a migration.*
