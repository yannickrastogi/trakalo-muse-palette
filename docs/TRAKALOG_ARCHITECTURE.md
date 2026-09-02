# TRAKALOG — Architecture & Product Vision

> **Created:** March 26, 2026
> **Last Updated:** September 2, 2026 (translated to English; claims re-verified against the code)
> **Purpose:** Source of truth for every Trakalog architecture decision.
> **Rule:** Read this document before any major feature.

---

## 1. User model

### Account (the human)

One human = one account = one login. Authentication via email/password or Google OAuth.

### Workspaces (the projects/entities)

Each workspace is a distinct identity. One account can hold **several workspaces**.

Examples:
- an artist's personal workspace
- "Studio XYZ" → a label workspace
- "Client — Eliot" → a workspace for managing one artist
- "Client — Sarah" → a workspace for managing another

Each workspace has:
- Its own track catalog
- Its own branding (hero image, logo, brand colour)
- Its own members with access levels
- Its own pitches, shared links and contacts

### Workspace switcher

The user moves between workspaces through a switcher in the sidebar. The app's entire context
follows the active workspace.

> **Billing note:** the *plan* is not per workspace. Subscriptions are user-based
> (`subscriptions.user_id`), and every workspace member consumes a seat. See
> [TRAKALOG_BILLING.md](FEATURES/TRAKALOG_BILLING.md).

---

## 2. Permission system

### Core principle

**Professional title and access level are separate.**

### Access levels

| Level | View/listen | Playlists/pitch/share | Edit metadata/stems/lyrics | Splits/delete/invite/branding |
|---|:---:|:---:|:---:|:---:|
| **Viewer** | ✅ | ❌ | ❌ | ❌ |
| **Pitcher** | ✅ | ✅ | ❌ | ❌ |
| **Editor** | ✅ | ✅ | ✅ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ |

> `pitcher` remains valid server-side, but is **no longer offered in role pickers** —
> `FEATURES.PITCHER_ROLE_ENABLED` is `false`. Legacy pitcher members still resolve and render.

### Professional titles (display only, no effect on permissions)

Producer, Songwriter, Musician, Mix Engineer, Mastering Engineer, Manager, Publisher, A&R,
Assistant, Artist, Viewer.

The title appears on the profile, credits and splits. It has **no impact** on what the person
can do in the platform.

### Invitation

Inviting someone into a workspace sets two independent things:

1. Their **access level** (Viewer / Pitcher / Editor / Admin)
2. Their **professional title** (Producer / Songwriter / etc.)

---

## 3. Catalog sharing (workspace to workspace)

### The problem

A label manages several artists, each with their own workspace. The label wants to pitch tracks
from several artists in one playlist, under the label's branding.

### The solution: catalog share

The artist **shares their tracks** into an external workspace. The track stays the artist's
property, but a **reference** appears in the label's catalog.

### Flow

1. The artist opens a track → "Share to Workspace" → selects the label's workspace
2. They choose the **access level** for that share:
   - **Viewer** — the label can view and listen
   - **Pitcher** — listen + playlist + pitch + share links
   - **Editor** — plus edit metadata, stems, lyrics, paperwork (**not** splits)
   - **Admin** — full access, identical to the artist's
3. The label sees the track in its catalog, tagged "via [artist]"
4. The label builds a playlist across artists and pitches it under its own branding
5. **The artist sees** that the track is shared, that the label pitched it, and the engagement
   stats

### Rules

- The track stays in the source workspace. The target workspace holds a **referenced access**.
- The artist can **revoke** at any time → the track disappears from the label's catalog.
  Revocation is `status = 'revoked'` plus a `revoked_at` stamp, not a delete.
- Engagement stats flow to **both** — the label and the artist see plays and downloads.
- Branding on pitches and share links is the **sending** workspace's, not the artist's.
- The artist can grant a different level **per track** or **for the whole catalog at once**.

### Table: `catalog_shares`

```sql
CREATE TABLE public.catalog_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    track_id uuid,                              -- NULL = the whole catalog
    source_workspace_id uuid NOT NULL,
    target_workspace_id uuid NOT NULL,
    shared_by uuid NOT NULL,
    access_level text DEFAULT 'pitcher' NOT NULL,
    status text DEFAULT 'active' NOT NULL,      -- active / revoked
    created_at timestamp with time zone DEFAULT now(),
    revoked_at timestamp with time zone,
    playlist_id uuid
);
```

---

## 4. Branding (brand kit)

### Per workspace

Each workspace can configure:

- **Hero image** — background (1920×600) shown on shared links and pitches
- **Logo** — displayed next to TRAKALOG
- **Brand colour** — accent colour for branded pages
- **Social links** — Instagram, TikTok, YouTube, Facebook, X, plus website, Spotify and Apple

### Where branding appears

- **Shared links** (track, playlist, pack) — hero + logo + colour + socials
- **Pitch emails** — hero as a banner, logo in the footer

### Where branding does *not* appear

- Studio QR page (`/studio/:token`) — generic Trakalog page
- Sign Agreement page (`/sign/:token`) — generic Trakalog page
- The app's internal interface — standard Trakalog branding
- Genesis public registry pages — kept neutral to preserve the registry's credibility

---

## 5. Track architecture

### Ownership

- A track belongs to **exactly one workspace** (`tracks.workspace_id`)
- The workspace it was uploaded into is its "home"
- It can be **shared** into other workspaces through `catalog_shares`

### Lifecycle

1. **Upload** → audio analysis (BPM, key, genre, mood) + waveform + MP3 preview compression
2. **Genesis Print** → cryptographic fingerprint + OpenTimestamps Bitcoin proof + declared AI
   licence → see §8. **Not built** — see the status note there.
3. **Documentation** → metadata, splits, paperwork, lyrics, stems
4. **Distribution** → pitches, shared links, Trakalog Pack
5. **Tracking** → engagement analytics (plays, downloads, comments)

### Associated files

- Original audio (WAV/MP3/FLAC/AIFF) → `tracks` bucket
- **MP3 preview at 128 kbps** → `tracks` bucket, as a `_preview.mp3` sibling of the original,
  recorded in `audio_preview_url`. Encoded **client-side** with lamejs
  (`src/lib/mp3Encoder.ts`, `const kbps = 128`).
- Cover art → `covers` bucket
- Stems → `stems` bucket
- Documents/contracts → `documents` bucket (TRAKALOG-watermarked on download)
- Per-visitor watermarked audio → `watermarked` bucket (cache)

> ⚠️ **Do not confuse the two bitrates.** The *preview* is 128 kbps and always has been.
> *Watermarked delivery copies* are **MP3 320 kbps CBR** — 128 kbps there belonged to a
> superseded pipeline that caused pre-echo artefacts and degraded watermark detection. See
> [WATERMARKING.md](FEATURES/WATERMARKING.md).

### Track versioning

Spec in [`docs/FEATURES/TRACK_VERSIONING.md`](FEATURES/TRACK_VERSIONING.md) — **implemented**.
Several audio versions under one track (V1, V2, Radio Edit), A/B switching at the same
timecode, an active version for pitches and shared links, and per-version Sonic DNA.

---

## 6. Shared links & Trakalog Pack

### Share types

- **Track share** — one track with player, lyrics, comments and credits
- **Playlist share** — a playlist with a player
- **Stems share** — a track's stems
- **Trakalog Pack** — a ZIP containing hi-res track, cover art, branded lyrics PDF, branded
  metadata PDF, splits PDF, TRAKALOG-watermarked paperwork, and the signed splits PDF where
  available

### Gate screen

Each shared link has a gate screen (name, email, role, company, city, country) that captures
the recipient's details. A `trakalog_visitor` cookie lasting 2 days (`max-age=172800`) skips
the gate on return.

### Protection

- Public (no password)
- Secured (password: PBKDF2-SHA256, 100,000 iterations)
- Optional expiry date
- Disable/enable by the owner
- **Invisible per-visitor audio watermarking** (audiowmark via Railway) on `track` and
  `playlist` links
- **Leak tracing** — upload a suspect file, identify the leaker from the watermarked payload
- **"Human-Made on Trakalog" badge** shown when a track has a Genesis Print with a signed human
  attestation *(planned)*

> Watermarking depends on `share_type`, never on delivery format. `stems` and `pack` links
> deliberately carry clean audio.

---

## 7. Splits & signatures

### Flow

1. Track uploaded → studio QR code so guests can declare their contributions
2. Admin approves/rejects the submissions
3. Splits adjusted (total = 100%)
4. "Send for Signature" → email to each collaborator
5. Each collaborator signs at `/sign/:token` (signature canvas)
6. "All splits signed" → download the signed PDF / send executed copies
7. Signatures work even with **a single collaborator**

### Structure

- Multi-role (max 4: Songwriter, Producer, Artist, Musician)
- Multi-PRO (max 3 from 68 worldwide PROs)
- Stage names supported
- Auto-fill from the workspace's contacts
- Automatic save-back into the contacts table

### Important rule

Splits and signatures attach to the **track**, not the workspace. When a track is shared via
`catalog_shares`, its splits stay managed by the source workspace. Splits live in the
`tracks.splits` **jsonb column** — there is no `splits` table — while signature state lives in
`signature_requests`, keyed by `token`.

---

## 8. GENESIS — creative provenance infrastructure

> **Detailed reference:** [`docs/PLANS/TRAKALOG_GENESIS.md`](PLANS/TRAKALOG_GENESIS.md)
>
> **Status: not built.** Verified September 2, 2026 — there is not a single `genesis` reference
> anywhere in the migrations. Everything in this section is design.
>
> Genesis is not one AI agent among others. It is the **cross-cutting infrastructure layer**
> that every agent and every creation/signature/distribution feature is eventually meant to
> rest on.

### The principle

For every uploaded track, Trakalog creates an **Origin Print**: a cryptographic fingerprint
timestamped on Bitcoin via OpenTimestamps, signed by the artist, with an explicitly declared AI
training licence. The equivalent of a notarised deed, but immutable, globally verifiable, and
free at scale.

### The five components

| Component | Role |
|---|---|
| **Origin Print** | Cryptographic creation fingerprint (SHA-256 + Chromaprint + neural embedding + Sonic DNA + Bitcoin timestamp) |
| **AI Training License** | A declared, enforceable training licence (NO-AI / PAID-AI / ATTR-AI / OPEN-AI) |
| **Public Registry** | A globally searchable registry at `trakalog.com/genesis/{id}` + public API |
| **Style Licensing** | Monetising Sonic DNA as a financial asset (opt-in, royalties via Stripe Connect) |
| **Derivation Detection** | Detecting derived/cloned tracks on DSPs, AI platforms and UGC |

### Integration into a track's lifecycle

```
Audio upload
  ↓
Preview compression + Sonic DNA (existing)
  ↓
GENESIS PIPELINE (new)
  - Audio hashing (SHA-256, Chromaprint, neural embedding)
  - Collect signed splits and the human attestation
  - Artist chooses the AI licence
  - Canonical JSON + Ed25519 signature
  - OpenTimestamps submission → Bitcoin proof
  - Store in genesis_records
  ↓
Track usable in pitches, shared links, etc.
  - "Human-Made on Trakalog" badge when an attestation is signed
  - /ai-training-license.txt served on each shared link
  - Public verification at trakalog.com/genesis/{id}
  ↓
IN THE BACKGROUND
  - Derivation Detection (daily cron over DSP/AI/UGC)
  - AI Training Royalties (monthly distribution via Stripe Connect)
```

### Principal tables *(none created yet)*

- `genesis_records` — one record per track: hashes, licence, signature, OTS proof
- `genesis_license_history` — audit trail of licence changes
- `genesis_derivations` — detected derived/cloned tracks
- `genesis_style_profiles` — public, licensable style profiles
- `genesis_style_licenses` — granted style licences
- `genesis_ai_royalties` — distributed AI training royalties

### Additional technical stack

- **Chromaprint** (fpcalc) — open-source perceptual fingerprint
- **CLAP / MERT** — open-source audio neural embeddings
- **pgvector** — similarity search over embeddings (already Supabase-compatible)
- **OpenTimestamps** — free, scalable Bitcoin timestamping
- **Ed25519** (libsodium) — modern cryptographic signatures
- **JCS (RFC 8785)** — canonical JSON for reproducible hashes

### Why now

2026 is the precise window: the EU AI Act becomes enforceable, the US Copyright Office is
legislating, the majors are alarmed by generative AI, and **no global standard exists**.
Trakalog already has 80% of the technical infrastructure (Sonic DNA, watermarking, leak
tracing, cryptographic splits). First mover = de facto standard.

### Business strategy

- **Open-source the protocol** on GitHub → fast adoption + antitrust protection
- **Trakalog stays the principal registry** → pure network effect
- **Direct revenue:** enterprise API (DSP/AI), AI training royalties (15-20% commission), style
  licensing, a Genesis Verified Badge add-on
- **Indirect revenue:** large Free→Paid conversion driven by stronger legal protection

---

## 9. AI agents (roadmap)

> *(A detailed AI-agents vision document was considered but never written; the reference was
> removed on September 2, 2026 rather than point at a nonexistent file.)*
>
> Genesis (§8) is the foundational infrastructure these agents rest on. The Sonic DNA Profiler,
> for instance, feeds Smart A&R, the Sync Matchmaker, and Genesis Style Licensing alike.

Implementation order:

1. Sonic DNA Profiler ✅ implemented
2. Smart Brief Matching — in progress
3. Brief Seeker — spec [`docs/FEATURES/BRIEF_SEEKER.md`](FEATURES/BRIEF_SEEKER.md)
4. Artist Seeker — spec [`docs/FEATURES/ARTIST_SEEKER.md`](FEATURES/ARTIST_SEEKER.md)
5. Sync Matchmaker
6. Session Replay Analyst
7. Ghost Revenue Hunter
8. Catalog Awakener
9. Network Weaver
10. Split Mediator

---

## 10. Technical stack

### Frontend

React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion + i18next (8 languages).

> Supabase configuration is **hardcoded** in `src/integrations/supabase/constants.ts`. `src/`
> reads no environment variables at all — a default checkout talks to **production**.

### Backend

Supabase (PostgreSQL + Auth + Storage + Edge Functions) — project ref `xhmeitivkclbeziqavxw`.

### Audio

- **Web Audio API** — client-side analysis in `src/lib/audio-analysis.ts`: BPM, musical key,
  duration and energy-based chapter segmentation, written as pure functions over an
  `AudioBuffer`. *(Not Essentia.js — that library is not used in the frontend.)*
- **Essentia (Python, Railway)** — `RhythmExtractor2013` for BPM, normalised to 80-180 BPM,
  through the `essentia.standard` bindings
- **lamejs** (`@breezystack/lamejs`) — client-side MP3 preview compression at 128 kbps
- **audiowmark (Railway)** — invisible audio watermarking, strength 10, MP3 320 kbps output
- **Chromaprint / fpcalc** *(future, Genesis)* — perceptual fingerprinting
- **CLAP / MERT** *(future, Genesis)* — audio neural embeddings

### AI

- **Groq** (Whisper transcription + Llama for Smart A&R)
- **Claude API** *(future — advanced agents, Brief Writer, Artist Seeker)*

### Cryptography *(future, Genesis)*

- **Ed25519 / libsodium** — signatures
- **OpenTimestamps** — Bitcoin timestamping
- **JCS (RFC 8785)** — canonical JSON

### Email

**Resend** (`noreply@trakalog.com`, reply-to routing).

### Payments

**Stripe** — the plumbing exists (`create-checkout-session`, `create-portal-session`,
`stripe-webhook`); add-on purchase remains to build. See
[TRAKALOG_BILLING.md](FEATURES/TRAKALOG_BILLING.md).
**Stripe Connect** *(future — Genesis royalties)*.

### Hosting

- **Vercel** (`app.trakalog.com`)
- **Cloudflare** (R2 storage, DNS; future cache for the Genesis API)
- **Railway** (watermarking service, sonic-dna-profiler; future Genesis crawler)

### PDF

- **jsPDF** — generation
- **pdf-lib** — watermarking
- **pdfjs-dist** — text extraction

### Security

- Supabase RLS + `SECURITY DEFINER` RPCs with an explicit `_user_id`
- Rate limiting on **32 of 34** Edge Functions, via the Postgres `check_rate_limit` RPC
- CSP headers, IP logging, audit logs
- 2FA TOTP, 300-second signed URLs, audio watermarking
- PBKDF2 100k iterations for shared-link passwords

---

## 11. Implementation roadmap

### Current phase — private beta ✅
- Core features (upload, player, lyrics, shared links, pitches, splits, signatures)
- UI/UX polish across every page
- Workspace branding (hero image, logo, brand colour, socials)
- Multi-workspace + four permission levels + catalog sharing
- Full security (rate limiting, CSP, audit logs, 2FA, watermarking, leak tracing)
- Sonic DNA Profiler operational
- Code audit and fixes

### Next — pre-launch
1. Complete onboarding (spec [`ONBOARDING.md`](FEATURES/ONBOARDING.md))
2. Billing / Stripe (spec [`TRAKALOG_BILLING.md`](FEATURES/TRAKALOG_BILLING.md)) — plumbing
   done, add-on purchase and storage-quota enforcement outstanding
3. Google OAuth production
4. End-to-end tests with beta testers
5. **Initial Genesis legal audit** (lawyer specialising in AI + intellectual property)

### Phase 3 — launch + Genesis MVP (12 weeks after pre-launch)
1. Genesis Phase 1 — Origin Print + Public Registry + AI Training License
2. Smart Brief Matching Phase 1
3. Admin Dashboard Phase 1 — partially built already, see
   [`TRAKALOG_ADMIN_DASHBOARD.md`](FEATURES/TRAKALOG_ADMIN_DASHBOARD.md) §0

### Phase 4 — adoption and differentiation
1. Genesis Phase 2 — "Human-Made" badge, white paper, EU AI Office, US Copyright Office
2. ~~Track Versioning~~ ✅ **shipped ahead of this phase**
3. Brief Seeker Phase 1
4. Artist Seeker Phase 1

### Phase 5 — industry standard
1. Genesis Phase 3 — Style Licensing + Derivation Detection + Enterprise API
2. Sync Matchmaker
3. Music supervisor accounts + catalog search
4. First official partnerships (AI platforms, DSPs, independent labels)

### Phase 6 — long term
1. Genesis Phase 4 — major-label adoption, PRO integration, seven-figure enterprise deals
2. Continuous Sonic DNA Profiler evolution
3. Ghost Revenue Hunter
4. Split Mediator
5. Session Replay Analyst
6. Catalog Awakener
7. Network Weaver

---

## 12. Cross-cutting architectural principles

- **Fragile auth is the absolute priority:** never write to the native Supabase key, always
  back the session up in localStorage, start `autoRefreshToken` manually once the session is
  validated
- **Public pages carry zero GoTrueClient:** direct REST `fetch()` using `constants.ts`
- **Sensitive writes:** `SECURITY DEFINER` RPCs with an explicit `_user_id`
- **PostgreSQL enums in RPCs:** explicit casts are mandatory
- **Workspaces** are the primary organisational unit (replacing the old teams concept)
- **Genesis ID** is meant to be a cross-cutting cryptographic identifier, to be woven into any
  feature touching creation or distribution
- **Open-source by design** for the Genesis protocol (antitrust + adoption)

> ⚠️ **One principle here does not match the code.** This document previously stated "soft
> deletes rather than hard deletes, for legal integrity". **That is not what is implemented.**
> `tracks` has no `is_deleted` or `deleted_at` column at all; `delete_track` (admin-only),
> `delete_workspace` (owner-only) and `delete_track_comment` (editor+) are all hard `DELETE`s.
> The only soft-delete in the system is `catalog_shares`, revoked via `status` + `revoked_at`.
>
> This matters for Genesis in particular: if a deleted track's row is gone, the Origin Print
> and any ISRC counter become the sole surviving record. Either adopt soft deletes for real, or
> stop claiming them as a principle — but the gap should be closed deliberately, not left as a
> false statement in the architecture document.

---

*This document is living, and will be updated as development proceeds.*
