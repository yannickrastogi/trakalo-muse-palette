# Architecture

> **Status:** Stable
> **Last Updated:** September 2, 2026
> **Owner:** Ishan

The seven numbered architecture documents, the cross-cutting notes, and the decision
records. For the full documentation tree, see the [main index](../INDEX.md).

## Legend

🟢 Stable — verified against the code · 🟡 Draft / Planned — not verified, or not built ·
⚠️ Partially built · 📋 Specification only

---

| # | Document | What it covers | Status |
|---|---|---|---|
| 01 | [Vision & Overview](01-VISION_AND_OVERVIEW.md) | Product vision, dual audience, core features | 🟢 Stable |
| 02 | [System Architecture](02-SYSTEM_ARCHITECTURE.md) | Layers, stack, data flows, environment | 🟢 Stable |
| 03 | [Data Architecture](03-DATA_ARCHITECTURE.md) | 45 tables, 12 enums, RLS helpers and policies | 🟢 Stable |
| 04 | [Component Architecture](04-COMPONENT_ARCHITECTURE.md) | React tree, contexts, routing, styling | 🟢 Stable |
| 05 | [Service Architecture](05-SERVICE_ARCHITECTURE.md) | Edge Functions, Railway, Groq, Stripe, R2 | 🟢 Stable |
| 06 | [Security Architecture](06-SECURITY_ARCHITECTURE.md) | Auth, RLS, data protection | 🟡 Draft — **not audited** |
| 07 | [Deployment Architecture](07-DEPLOYMENT_ARCHITECTURE.md) | Vercel, Supabase, `vercel.json`, CSP | 🟢 Stable |
| — | [Auth Patterns](AUTH_PATTERNS.md) | Session backup, public-page client rules, pitfalls | 🟢 Stable |
| — | [Product & UX Overview](PRODUCT_AND_UX_OVERVIEW.md) | Product surface and UX workflows | 🟡 Draft |
| — | [Groq Usage & Costs](GROQ_USAGE_AND_COSTS.md) | Model choice and cost model | 🟡 Draft |
| — | [Decision Records](DECISIONS/INDEX.md) | ADR-0001 … ADR-0010 | 🟢 Stable |
---

*Part of the [Trakalog documentation](../INDEX.md). Status labels here mirror each document's own
header — if they disagree, the document's own header is authoritative.*
