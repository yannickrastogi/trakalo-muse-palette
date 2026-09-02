# Trakalog Documentation

> **Status:** Stable
> **Last Updated:** September 2, 2026
> **Owner:** Ishan
> **Audience:** Developers, architects, product

The single source of truth for Trakalog's technical architecture and design decisions.

> **How to read the status labels.** 🟢 **Stable** means the document was verified
> line-by-line against the migrations and source during the September 2026 remediation.
> 🟡 **Draft** means it exists but has **not** been verified — treat its specifics with
> suspicion. 📋 **Spec / Planned** means the thing it describes is not built.
>
> **Ground truth, in order:** `supabase/migrations/20260626144305_baseline_prod.sql` plus later
> migrations → `src/` and `supabase/functions/` → `package.json` and configs. **Never trust a
> document over the code.**

---

## New here? Read in this order

1. [01 — Vision & Overview](ARCHITECTURE/01-VISION_AND_OVERVIEW.md) — what Trakalog is and why
2. [02 — System Architecture](ARCHITECTURE/02-SYSTEM_ARCHITECTURE.md) — technical context
3. [Getting Started](DEVELOPMENT/GETTING_STARTED.md) — set up your environment
4. [03 — Data Architecture](ARCHITECTURE/03-DATA_ARCHITECTURE.md) — the schema you will live in

> ⚠️ Before running the app locally, read the environment warning in
> [Getting Started](DEVELOPMENT/GETTING_STARTED.md): Supabase configuration is **hardcoded** in
> `src/integrations/supabase/constants.ts`, `src/` reads no environment variables, and a
> default checkout therefore talks to **production**.

---

## Architecture

[**TRAKALOG_ARCHITECTURE.md**](TRAKALOG_ARCHITECTURE.md) sits above this set — the product-and-
architecture overview CLAUDE.md points sessions at, covering the user model, permissions,
catalog sharing, branding, the track lifecycle, Genesis and the cross-cutting principles.
🟢 Stable.

| # | Document | Status |
|---|---|---|
| 01 | [Vision & Overview](ARCHITECTURE/01-VISION_AND_OVERVIEW.md) | 🟢 Stable |
| 02 | [System Architecture](ARCHITECTURE/02-SYSTEM_ARCHITECTURE.md) | 🟢 Stable |
| 03 | [Data Architecture](ARCHITECTURE/03-DATA_ARCHITECTURE.md) | 🟢 Stable |
| 04 | [Component Architecture](ARCHITECTURE/04-COMPONENT_ARCHITECTURE.md) | 🟢 Stable |
| 05 | [Service Architecture](ARCHITECTURE/05-SERVICE_ARCHITECTURE.md) | 🟢 Stable |
| 06 | [Security Architecture](ARCHITECTURE/06-SECURITY_ARCHITECTURE.md) | 🟡 Draft — **not audited** |
| 07 | [Deployment Architecture](ARCHITECTURE/07-DEPLOYMENT_ARCHITECTURE.md) | 🟢 Stable |
| — | [Auth Patterns](ARCHITECTURE/AUTH_PATTERNS.md) | 🟢 Stable |
| — | [Product & UX Overview](ARCHITECTURE/PRODUCT_AND_UX_OVERVIEW.md) | 🟡 Draft |
| — | [Groq Usage & Costs](ARCHITECTURE/GROQ_USAGE_AND_COSTS.md) | 🟡 Draft |

**Decision records** — all ten verified during the remediation:
[ADR index](ARCHITECTURE/DECISIONS/INDEX.md) ·
[0001 Multi-Workspace](ARCHITECTURE/DECISIONS/ADR-0001-MULTI-WORKSPACE-MODEL.md) ·
[0002 Seat-Based Billing](ARCHITECTURE/DECISIONS/ADR-0002-SEAT-BASED-BILLING.md) ·
[0003 Supabase](ARCHITECTURE/DECISIONS/ADR-0003-SUPABASE-CHOICE.md) ·
[0004 State Management](ARCHITECTURE/DECISIONS/ADR-0004-STATE-MANAGEMENT.md) ·
[0005 R2 Storage](ARCHITECTURE/DECISIONS/ADR-0005-R2-STORAGE.md) ·
[0006 Groq](ARCHITECTURE/DECISIONS/ADR-0006-GROQ-AI.md) ·
[0007 Watermarking](ARCHITECTURE/DECISIONS/ADR-0007-INVISIBLE-WATERMARKING.md) ·
[0008 Dual Audience](ARCHITECTURE/DECISIONS/ADR-0008-DUAL-AUDIENCE.md) ·
[0009 Feature Flags](ARCHITECTURE/DECISIONS/ADR-0009-FEATURE-FLAGS.md) ·
[0010 shadcn/ui](ARCHITECTURE/DECISIONS/ADR-0010-SHADCN-UI.md)

---

## Development

| Document | Status |
|---|---|
| [Getting Started](DEVELOPMENT/GETTING_STARTED.md) | 🟢 Stable |
| [Coding Standards](DEVELOPMENT/CODING_STANDARDS.md) | 🟢 Stable |
| [Testing Strategy](DEVELOPMENT/TESTING_STRATEGY.md) | 🟢 Stable |
| [RPC Reference](DEVELOPMENT/RPCS.md) | 🟡 Draft — 47 verified, 47 undocumented |
| API Reference *(not yet written)* | 🟡 Planned |

---

## Features

| Document | Status |
|---|---|
| [Track Management](FEATURES/TRACK_MANAGEMENT.md) | 🟢 Stable |
| [Sharing System](FEATURES/SHARING_SYSTEM.md) | 🟢 Stable |
| [Watermarking](FEATURES/WATERMARKING.md) | 🟢 Stable |
| [Smart A&R](FEATURES/SMART_AR.md) | 🟢 Stable |
| [Splits & Signatures](FEATURES/SPLITS_AND_SIGNATURES.md) | 🟢 Stable |
| [Track Versioning](FEATURES/TRACK_VERSIONING.md) | 🟢 Implemented |
| [Billing](FEATURES/TRAKALOG_BILLING.md) | 🟢 v5.0 |
| [Admin Dashboard](FEATURES/TRAKALOG_ADMIN_DASHBOARD.md) | ⚠️ Partially built |
| [Onboarding](FEATURES/ONBOARDING.md) | 🟡 Draft |
| [ISRC Generation](FEATURES/ISRC_GENERATION.md) | 📋 Spec only |
| [DDEX & PRO Exports](FEATURES/DDEX_PRO_EXPORTS.md) | 📋 Spec only |
| [Artist Seeker](FEATURES/ARTIST_SEEKER.md) · [Brief Seeker](FEATURES/BRIEF_SEEKER.md) | 📋 Planned |

---

## Operations

| Document | Status |
|---|---|
| [Monitoring](OPERATIONS/MONITORING.md) | 🟡 Draft — **not audited** |
| [Cost Optimization](OPERATIONS/COST_OPTIMIZATION.md) | 🟡 Draft — **not audited** |
| Performance *(not yet written)* | 🟡 Planned |

---

## Plans

Strategic direction. These describe intent, not shipped behaviour.

| Document | Build status |
|---|---|
| [Trakalog Genesis](PLANS/TRAKALOG_GENESIS.md) | 📋 Nothing built |
| [Trakalog Signal](PLANS/TRAKALOG_SIGNAL.md) | 📋 Nothing built |
| [Trakalog Drop](PLANS/TRAKALOG_DROP.md) | 📋 Nothing built |
| [Storage Migration](PLANS/TRAKALOG_STORAGE_MIGRATION.md) | ⚠️ Shipped, but not as designed |
| [Dev/Staging Setup](PLANS/TRAKALOG_DEV_STAGING_SETUP.md) | 📋 Planned |
| [Documentation Plan](PLANS/DOCUMENTATION.md) | 🟢 Complete |

---

## Reports & archive

- [Frontend Fetching Audit](REPORTS/FRONTEND_FETCHING_AUDIT.md) — 🟡 Draft
- [Archived reports](_archive/reports/INDEX.md) — 26 historical fix and diagnostic reports, not
  maintained
- RLS implementation history, frozen in French:
  [Phase 1](_archive/rls-phases/RLS_PHASE1_GUIDE.md) ·
  [Phase 2](_archive/rls-phases/RLS_PHASE2_GUIDE.md) ·
  [Phase 3](_archive/rls-phases/RLS_PHASE3_GUIDE.md) ·
  [Audit](_archive/rls-phases/RLS_AUDIT_2026-05-10.md)

> The `_archive/` tree is historical record. It references files and migrations that no longer
> exist, and is deliberately not maintained. Never treat it as live schema.

---

## Section indexes

[Architecture](ARCHITECTURE/INDEX.md) · [Decisions](ARCHITECTURE/DECISIONS/INDEX.md) ·
[Development](DEVELOPMENT/INDEX.md) · [Features](FEATURES/INDEX.md) ·
[Operations](OPERATIONS/INDEX.md) · [Plans](PLANS/INDEX.md) · [Reports](REPORTS/INDEX.md)

---

## Contributing

1. **Typos and clarifications** — submit a PR
2. **New features** — document them in the feature PR
3. **Architectural changes** — write an ADR first, then update the affected documents
4. **A document that has gone stale** — fix it, and move its status back to 🟡 Draft if you
   cannot verify the whole file

When you change a document, verify the claim against the code rather than against another
document. The September 2026 remediation existed because a large amount of plausible-sounding
detail had been written that the schema and source did not support.

---

*A living resource, updated as Trakalog evolves.*
