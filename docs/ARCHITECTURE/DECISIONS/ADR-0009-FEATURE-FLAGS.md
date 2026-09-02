# ADR-0009: Feature Flags Approach

> **Status:** Accepted
> **Date:** August 11, 2026 · **Revised:** September 2, 2026
> **Author:** Ishan
> **Supersedes:** None

---

## Context

Trakalog reached a point where whole product surfaces needed to be **withdrawn from the UI without being deleted from the codebase**. Pitch and Approvals were built, shipped, and then pulled back while sharing consolidated around Shared Links. The `pitcher` access level was likewise retired from role pickers while existing `pitcher` members still had to render correctly.

Deleting that code would have meant losing working pages, routes, RPCs, Edge Functions, contexts and i18n keys — and re-adding them later at considerable cost. Leaving it reachable would have shipped a half-consolidated product.

### Problem Statement

The concrete need was narrow: **hide a feature surface at build time, reversibly, in one edit.** Not:

- per-user or per-workspace targeting,
- percentage rollouts,
- runtime toggling in a deployed build,
- experiment measurement.

Those are real capabilities with real costs, and none of them were required by the actual problem — a small team consolidating its own product, deploying continuously from `main` via Vercel.

### Constraints

- Must work with a React/Vite SPA (no server-rendered request context)
- Must be type-safe (TypeScript)
- Must be trivially reversible — flipping a feature back on should require no other change
- Must add no runtime overhead and no network dependency
- Must be obvious to a reader six months later

---

## Decision

**We use compile-time constants in a single module: `src/config/features.ts`, exporting one frozen `FEATURES` object consumed by direct import.**

That module is the entire system:

```typescript
// src/config/features.ts — single source of truth.
//
// Pitch and Approvals are hidden from the UI while we consolidate sharing around
// Shared Links. Nothing is deleted: pages, routes, RPCs, Edge Functions, contexts
// and i18n keys all stay in place. Flip a flag back to `true` to fully restore the
// corresponding section — no other change is required.
export const FEATURES = {
  PITCH_ENABLED: false,
  APPROVALS_ENABLED: false,
  // "pitcher" access level is no longer offered in role pickers (it only granted the
  // right to create pitches). The level stays in the server hierarchy and in the display
  // maps so any legacy 'pitcher' member still renders. Flip to restore the choice.
  PITCHER_ROLE_ENABLED: false,
} as const;
```

### How flags are consumed

By plain import — there is no hook, no provider, no service. Roughly 14 modules import `FEATURES`.

Route gating (`src/App.tsx`):

```typescript
<Route
  path="/pitch"
  element={FEATURES.PITCH_ENABLED
    ? <Suspense fallback={<LazyFallback />}><Pitch /></Suspense>
    : <Navigate to="/dashboard" replace />}
/>
```

Navigation and UI gating:

```typescript
// src/components/AppSidebar.tsx
if (item.url === "/pitch") return FEATURES.PITCH_ENABLED;

// src/components/InviteMemberModal.tsx — hide the retired access level
ACCESS_LEVEL_CARDS.filter(card => FEATURES.PITCHER_ROLE_ENABLED || card.level !== "pitcher")
```

### What this explicitly is not

- **Not runtime configuration.** Values are inlined at build time. Changing a flag requires a rebuild and redeploy; there is no way to toggle one in a running deployment.
- **Not per-user or per-workspace.** Every user of a given build sees the same flags.
- **Not environment-varying.** The frontend reads no environment variables at all — `src/` contains no `import.meta.env` — so flags cannot differ between dev and prod except by editing the file.
- **Not backed by a database.** There are no `workspace_feature_flags`, `user_feature_flags` or `global_feature_flags` tables.
- **Not a security boundary.** Flags hide UI. The routes, RPCs and Edge Functions behind a disabled flag remain deployed and reachable; authorization is enforced separately by RLS and `SECURITY DEFINER` RPCs. Never rely on a flag to protect data.

---

## Alternatives Considered

### Option 1: Third-Party Service (LaunchDarkly, Flagsmith, PostHog)

**Pros:** targeting, percentage rollouts, audit trails, runtime toggling, an admin UI out of the box.

**Cons:** per-seat cost; a network dependency in the render path; SDK weight; another vendor and another set of credentials; flag state lives outside the repo, so the code no longer tells you what is on.

**Why Not Chosen:** the requirement was to hide two product surfaces during a consolidation, not to run experiments. A subscription and a runtime dependency to express three booleans is a poor trade.

### Option 2: Environment Variables

**Pros:** conventional; per-environment values without code changes; no vendor.

**Cons:** **not actually available here.** The frontend reads no environment variables; Supabase config is hardcoded in `src/integrations/supabase/constants.ts`. Adopting env-var flags would have meant introducing `import.meta.env` plumbing first. Env vars are also untyped strings and easy to get wrong in a Vercel dashboard.

**Why Not Chosen:** more infrastructure than the problem justified, and it would have made the flag set invisible in the repository.

### Option 3: Database-Backed Flags with Overrides

Three tables (`global_feature_flags`, `workspace_feature_flags`, `user_feature_flags`), a `useFeatureFlag()` hook, in-memory caching, and an admin screen.

**Pros:** runtime toggling without deploy; per-workspace and per-user targeting; instant kill switch; auditable.

**Cons:** a query (or a cache with invalidation) on the render path; three tables plus RLS policies to maintain; an admin UI to build; flag state split between code and database, so neither alone tells the truth.

**Why Not Chosen:** this is the right design *if* per-tenant targeting or runtime kill switches are needed. Neither is. **It remains the natural upgrade path** — see "Future Work" below.

### Option 4: Long-Lived Feature Branches

**Pros:** no flag machinery at all; incomplete work never reaches `main`.

**Cons:** divergence and merge pain; the code doesn't get exercised; and it doesn't solve this problem at all — Pitch and Approvals were *already shipped* and needed withdrawing, which no branching strategy addresses.

**Why Not Chosen:** wrong tool for the actual situation.

---

## Consequences

### Positive

1. **Zero overhead** — constants are inlined; no query, no network, no provider.
2. **Type-safe** — `as const` makes the keys a literal union; a typo fails the build.
3. **The repository is the source of truth** — reading one 14-line file tells you exactly what is on.
4. **Genuinely reversible** — flipping one boolean restores an entire product surface, because nothing was deleted.
5. **Easy to reason about** — no cache invalidation, no staleness, no per-user divergence.

### Negative

1. **A deploy is required to change a flag.** There is no kill switch for a live incident.
2. **No targeting.** Cannot beta a feature with a subset of workspaces.
3. **Dead code accumulates.** Disabled surfaces stay in the bundle — Pitch and Approvals ship to every user as unreachable code. This is the deliberate price of reversibility, but it is a real cost that grows.
4. **No audit trail** beyond `git log`.
5. **Flags can outlive their purpose.** A permanently-`false` flag is deferred deletion; without review it becomes permanent clutter.

### Mitigations

1. Routes gated by a flag lazily import their page, so a disabled surface is at least split into its own chunk rather than the main bundle.
2. The comments in `features.ts` record *why* each flag exists and what flipping it restores — this is the audit trail, and it must be kept accurate.
3. Review the flag list at each planning cycle: either restore the feature or delete it and the flag together.

---

## Future Work

Adopt Option 3 (database-backed flags) when — and only when — one of these becomes true:

- a feature needs to be enabled for specific workspaces (beta cohorts, enterprise pilots),
- an incident requires disabling a feature without a deploy,
- flags are needed to measure an experiment.

Until then, the constants file is the appropriate level of machinery.

---

## References

- `src/config/features.ts` — the flag definitions
- `src/App.tsx` — route-level gating for `/pitch` and `/approvals`
- [04 - Component Architecture](../04-COMPONENT_ARCHITECTURE.md) — where flags sit in the component tree
- [ADR-0008: Dual-Audience Model](ADR-0008-DUAL-AUDIENCE.md) — the sharing consolidation that motivated hiding Pitch

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

*Revised September 2, 2026: the original version documented a database-backed system with three tables, a `useFeatureFlag()` hook and a `FeatureFlagService` singleton, none of which exist. That design is retained above as Option 3 — a considered alternative and the future upgrade path — and the Decision now describes what the code actually does.*
