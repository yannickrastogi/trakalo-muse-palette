# Features

> **Status:** Stable
> **Last Updated:** September 2, 2026
> **Owner:** Ishan

Deep-dives into Trakalog's major capabilities. For the full documentation tree, see the
[main index](../INDEX.md).

## Legend

🟢 Stable — verified against the code · 🟡 Draft / Planned — not verified, or not built ·
⚠️ Partially built · 📋 Specification only

---

| Document | What it covers | Status |
|---|---|---|
| [Track Management](TRACK_MANAGEMENT.md) | Upload pipeline, storage, metadata, `tracks` schema | 🟢 Stable |
| [Sharing System](SHARING_SYSTEM.md) | Shared links, gate screen, engagement tables, leak tracing | 🟢 Stable |
| [Watermarking](WATERMARKING.md) | audiowmark pipeline, payload derivation, cache keys | 🟢 Stable |
| [Smart A&R](SMART_AR.md) | Groq matching, quotas, rate limits | 🟢 Stable |
| [Splits & Signatures](SPLITS_AND_SIGNATURES.md) | `tracks.splits` jsonb, `signature_requests`, PDF generation | 🟢 Stable |
| [Track Versioning](TRACK_VERSIONING.md) | Multiple versions per track, A/B switching, active version | 🟢 Implemented |
| [Trakalog Billing](TRAKALOG_BILLING.md) | Plans, seats, storage caps, Stripe, the `founder` tier | 🟢 v5.0 |
| [Admin Dashboard](TRAKALOG_ADMIN_DASHBOARD.md) | Platform admin console | ⚠️ Partially built — see §0 |
| [Onboarding](ONBOARDING.md) | First-run flow and activation steps | 🟡 Draft |
| [ISRC Generation](ISRC_GENERATION.md) | ISRC format, registrant code, allocation | 📋 Spec only |
| [DDEX & PRO Exports](DDEX_PRO_EXPORTS.md) | BMI/ASCAP/SOCAN/SoundExchange/MLC exports | 📋 Spec only |
| [Artist Seeker](ARTIST_SEEKER.md) | Artist discovery | 📋 Planned |
| [Brief Seeker](BRIEF_SEEKER.md) | External brief discovery and matching | 📋 Planned |
---

*Part of the [Trakalog documentation](../INDEX.md). Status labels here mirror each document's own
header — if they disagree, the document's own header is authoritative.*
