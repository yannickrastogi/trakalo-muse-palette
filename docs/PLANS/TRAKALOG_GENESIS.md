# TRAKALOG — GENESIS

> **Created:** May 15, 2026
> **Last Updated:** September 2, 2026 (translated to English)
> **Goal:** Position Trakalog as the world's creative-provenance infrastructure for music in the
> generative-AI era. Become the de facto standard the whole industry adopts.
> **Status:** 📋 **Strategic concept — nothing implemented.** Verified September 2, 2026: there
> is not a single `genesis` reference anywhere in `supabase/migrations/`. MVP plannable in
> 12 weeks.
> **Vision:** *"The ISRC was born in 1986 to identify recordings in the CD era. GENESIS is the
> ISRC of the AI era — it identifies who created what, when, under which permissions, and
> guarantees compensation."*

---

## 1. Why now — the 2026 window

The music industry is at a historic tipping point. Three forces converge at this precise
moment.

**Force 1 — the explosion of generative music AI.**
Suno, Udio, Stable Audio and their successors train their models on tens of millions of tracks
without explicit consent. In 2025 Suno passed 12 million users. The majors (Universal, Sony,
Warner) have filed suit, but what they are really looking for is technical infrastructure to
structure compensation. **That infrastructure does not exist.**

**Force 2 — the incoming regulatory wave.**
The EU AI Act (in force since August 2024, enforceable for General Purpose AI models from
August 2025) imposes transparency obligations on training data. The US Copyright Office
published its report on generative AI in early 2025. The California AI Transparency Act and the
Tennessee ELVIS Act are already in force. Every legislator is looking for a technical standard
to enforce the new rules. **Whoever proposes that standard first becomes unavoidable.**

**Force 3 — rightsholder alarm.**
For the first time since Napster, the music industry faces an existential threat larger than a
monetisation question: the **threat of creative replacement**. Artists and labels are paying
well for protection. Demand exceeds supply.

**Trakalog is the only platform that has already built the necessary technical
infrastructure** — Sonic DNA, invisible watermarking, leak tracing, audit logs,
cryptographically signed splits. Three pieces are missing to become world infrastructure: the
**cryptographic chain of custody**, the **verifiable public registry**, and the **AI licence
standard**.

---

## 2. System overview

GENESIS combines five interconnected subsystems. Each has value alone; together they create a
moat that cannot be reproduced.

| # | Component | Role | Differentiation |
|---|---|---|---|
| 1 | **Origin Print** | Cryptographic creation fingerprint | No competitor combines Sonic DNA + perceptual hash + blockchain timestamp |
| 2 | **AI Training License** | A declared, enforceable AI training licence | The world's first legally usable standard |
| 3 | **Public Registry** | A globally searchable registry | The first human-first registry of pre-release music provenance |
| 4 | **Style Licensing** | Monetising Sonic DNA as an asset | Inverts the market: style becomes a financial product |
| 5 | **Derivation Detection** | Detecting derived/cloned tracks | Protects artists against undeclared AI imitation |

---

## 3. Component 1 — Origin Print

### What it is

On every upload to Trakalog, the track receives a unique, cryptographically signed and
timestamped identifier constituting enforceable proof of priority. The musical equivalent of a
notarised deed, but immutable and globally verifiable.

### Composition of an Origin Print

```json
{
  "genesis_id": "GEN-2026-A4F3-9B2E-...",
  "track_id": "uuid",
  "workspace_id": "uuid",
  "creator": {
    "name": "Artist Name",
    "ipi": "00576901234",
    "verified": true
  },
  "audio_hashes": {
    "sha256": "...",                    // exact file hash
    "chromaprint": "...",               // perceptual fingerprint (survives re-encoding)
    "neural_embedding": "...",          // 512-d audio embedding (survives transformation)
    "sonic_dna_signature": "..."        // condensed Sonic DNA signature
  },
  "creation_timestamp": "2026-05-15T10:32:14.000Z",
  "blockchain_proof": {
    "method": "opentimestamps",
    "ots_file": "base64...",
    "bitcoin_block": 892341,
    "verified": true
  },
  "collaborators": [
    { "name": "...", "role": "Songwriter", "share": 50, "signed": true }
  ],
  "ai_training_license": "no-training-without-permission",
  "human_attestation": {
    "signed_by_creator": true,
    "signature": "...",
    "statement": "I attest that this work is substantially of human authorship."
  }
}
```

### Technical creation pipeline

1. **Audio upload** (already built) → file stored in storage
2. **SHA-256 hash** of the raw file → exact identifier
3. **Chromaprint** (acoustic fingerprint via fpcalc, open-source) → survives MP3/AAC
   re-encoding
4. **Neural embedding** via CLAP or MERT (open-source models) → survives major transformations
   (slowed, sped up, pitch shifted)
5. **Sonic DNA signature** (already computed by the Railway service) → musical fingerprint
6. **Collect signed splits** (already built) → contributor list
7. **AI Training License** (new) → the artist's recorded choice
8. **Human attestation** → the artist signs a declaration of human authorship
9. **Canonical JSON serialisation** → reproducible format
10. **OpenTimestamps** → submit the JSON hash to an aggregator that includes it in a Bitcoin
    transaction
11. **Storage** in `genesis_records` + a reference in `tracks.genesis_id`

### Why OpenTimestamps rather than an L2 like Polygon or Base

OpenTimestamps is **free, scalable to millions of tracks per day, and uses Bitcoin** — the most
resilient chain. It aggregates millions of hashes into a single Merkle tree, then publishes the
root on Bitcoin. Each track gets a cryptographic proof of priority verifiable by anyone,
without gas fees and without crypto infrastructure to operate. It is what Wikipedia uses
internally. For the MVP it is unbeatable.

Later (Phase 3+), if smart contracts are wanted for automated licences, Base or Polygon can be
added as an option — but neither is necessary to start.

---

## 4. Component 2 — AI Training License

### The standard to create

Trakalog publishes a **standardised licence in four levels** that each creator chooses at
upload (changeable later). This is what the market is sorely missing and everyone is waiting
for.

| Level | Code | Description |
|---|---|---|
| 🚫 **No Training** | `NO-AI` | No use to train any AI model, generative or otherwise. Any use is an infringement. |
| 💰 **Paid Training** | `PAID-AI` | Use permitted against a licence and royalties through Trakalog. Default or artist-set rate. |
| 🤝 **Attribution Training** | `ATTR-AI` | Use permitted free of charge, conditional on credit and inclusion in training-data disclosures. |
| ✅ **Open Training** | `OPEN-AI` | Free use. For artists who deliberately want to feed the AI ecosystem. |

### Why these four levels

They cover every philosophical and economic position in the industry. Inspired by Creative
Commons but adapted to the specific case of AI training. **Legally defensible**, because the
artist explicitly consented — or refused — with a timestamped cryptographic signature.

### Crawler protection

Trakalog publishes an `/ai-training-license.txt` file at the root of every shared link and
audio preview, in a machine-readable format inspired by `robots.txt` but standardised.
Respectful AI platforms can read it automatically. For the others, the file becomes **legal
proof** that the platform should have known.

```
# AI Training License — Trakalog Genesis Protocol v1.0
genesis-id: GEN-2026-A4F3-9B2E-...
license: NO-AI
attribution-required: true
contact: licensing@trakalog.com
verify: https://trakalog.com/genesis/verify/GEN-2026-A4F3-9B2E
last-modified: 2026-05-15T10:32:14Z
```

### Public standardisation

Trakalog publishes the **Genesis protocol as open source** on GitHub — the technical spec, the
JSON format, the licence levels, all public. **That is precisely what makes it a standard.**
Competitors can implement it, but Trakalog remains the principal registry (network effect).

---

## 5. Component 3 — Public Registry

### The public interface

Every Origin Print generates a publicly verifiable page, accessible to anyone:

```
https://trakalog.com/genesis/GEN-2026-A4F3-9B2E-...
```

The page shows:

- The track title and artist (if made public)
- The cryptographically proven creation date
- Contributors and their roles
- The active AI licence
- A "Verify" button that recomputes the Bitcoin hash live
- A verified **"Human-Made on Trakalog"** badge (if the artist signed the attestation)
- The licence change history (immutable audit log)

### Public verification API

```
GET  https://api.trakalog.com/v1/genesis/{genesis_id}
GET  https://api.trakalog.com/v1/genesis/verify-by-hash/{chromaprint_or_sha256}
POST https://api.trakalog.com/v1/genesis/check-license   // for AI platforms
```

### Use cases

- **A music supervisor** wants to confirm a submitted track is human-made and clearable → scans
  the Origin Print QR code → instant confidence
- **Spotify or Apple Music** wants to filter undeclared AI tracks → queries the API with the
  track hash → learns whether it is human-attested
- **A court** must establish priority of a work → cryptographic proof with a Bitcoin timestamp
- **An AI platform** wants to train legally → batch-queries the API → a list of permitted
  tracks with their conditions

---

## 6. Component 4 — Style Licensing

### The inverted concept

Today, tracks are searched by genre, mood and BPM. Tomorrow they will be searched **by precise
audio style** through Sonic DNA embeddings. Style becomes a financial asset — for the first
time in history.

### How it works

1. The artist publishes their aggregated Sonic DNA (a weighted average of their catalog) as a
   public, licensable **Style Profile**
2. They set their rates: `$X per AI-generated track in their style`, `$Y for a 12-month
   exclusive licence`
3. When an AI platform or a music supervisor searches for "a track in the style of [artist]"
   through the Trakalog API, the system matches available Style Profiles **with prior consent**
4. Automatic royalties on each use, paid through Stripe Connect

### Why this is revolutionary

- The first transparent market for an artist's **stylistic signature**
- Independent artists can monetise their "sound" without releasing a new track
- AI platforms get a legal channel to draw on specific styles
- Majors can **buy exclusive style licences** the way they buy catalogs

### Ethical guardrail

Style Licensing is **strictly opt-in**. No artist is included without actively publishing their
profile. Every use is traced, audited and compensated. That is the fundamental difference from
current generative AI, which takes without permission.

---

## 7. Component 5 — Derivation Detection

### The problem

When an AI track imitates an artist, the artist has no way to prove it. When a producer samples
without authorisation, litigation takes years.

### What Trakalog does

A persistent agent scans the web (DSPs, SoundCloud, YouTube, AI platforms) for tracks whose
audio fingerprint or neural embedding matches a Genesis track. Three match levels:

| Level | Confidence | Signal |
|---|---|---|
| **Exact** | >95% | The same file re-encoded or re-uploaded. Action: automatic DMCA. |
| **Derivative** | 70-95% | Unauthorised sample, remix or undeclared cover. Action: alert + suggested claim. |
| **Stylistic** | 40-70% | Potential stylistic imitation, often AI. Action: flag for manual investigation. |

### Technique

- **Exact match:** Chromaprint database
- **Derivative match:** neural embedding distance (cosine similarity over CLAP/MERT)
- **Stylistic match:** Sonic DNA signature distance + sliding-window comparison

### Strategic value

This is the natural complement to the watermarking already in place. The watermark identifies
**who leaked**. Derivation Detection identifies **who copied or imitated**. Together, the most
protected environment on the market.

---

## 8. End-to-end pipeline

```
ARTIST UPLOADS A TRACK
  ↓
  Audio upload (existing) → storage
  ↓
  MP3 preview compression (existing)
  ↓
  Sonic DNA analysis (existing) → Railway service
  ↓
  ┌─────────────────────────────────────────────┐
  │ GENESIS PIPELINE (new)                      │
  ├─────────────────────────────────────────────┤
  │ 1. Audio hashing                            │
  │    - SHA-256 (raw file)                     │
  │    - Chromaprint (fpcalc) → audio_hash      │
  │    - Neural embedding (CLAP) → embedding    │
  │ 2. Splits & attestation collection          │
  │    - Verify collaborator signatures         │
  │    - Request the human attestation          │
  │    - Record the chosen AI licence           │
  │ 3. Canonical JSON serialization             │
  │ 4. OpenTimestamps submission                │
  │    - JSON hash → OTS aggregator             │
  │    - Receive the OTS proof file             │
  │ 5. Storage in DB                            │
  │    - INSERT genesis_records                 │
  │    - UPDATE tracks.genesis_id               │
  │ 6. Public page generation                   │
  │    - https://trakalog.com/genesis/{id}      │
  │ 7. ai-training-license.txt generation       │
  │    - For each associated shared link        │
  └─────────────────────────────────────────────┘
  ↓
ARTIST SHARES THE TRACK (shared link)
  ↓
  - The shared link carries the Genesis ID
  - The "Human-Made on Trakalog" badge is shown
  - The visitor can click through to verify authenticity
  - ai-training-license.txt served at the root
  - Invisible per-visitor watermarking (existing)
  ↓
IN THE BACKGROUND — Derivation Detection (daily cron)
  ↓
  - Scan DSPs, AI platforms, SoundCloud, YouTube
  - Match Chromaprint / neural embedding
  - Alert the artist on a match
  - Generate an automatic DMCA for exact matches
  ↓
IN THE BACKGROUND — AI Training Royalties (monthly)
  ↓
  - Receive reports from partner AI platforms
  - Compute royalties per track used
  - Distribute through Stripe Connect to the artists
  - Trakalog takes a 15-20% commission
```

---

## 9. Database schema

```sql
-- Main table: one record per track
CREATE TABLE genesis_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  genesis_id text UNIQUE NOT NULL,              -- "GEN-2026-A4F3-9B2E-..."
  track_id uuid REFERENCES tracks(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id),
  creator_user_id uuid REFERENCES auth.users(id),

  -- Audio hashes
  sha256_hash text NOT NULL,
  chromaprint text NOT NULL,
  chromaprint_compressed bytea,                 -- for fast lookup
  neural_embedding vector(512),                 -- pgvector, for similarity search
  sonic_dna_signature text,

  -- Metadata
  collaborators jsonb,                          -- snapshot of the splits at creation time
  ai_training_license text NOT NULL DEFAULT 'no-ai',
  ai_license_price_cents integer DEFAULT 0,
  human_attested boolean DEFAULT false,
  attestation_signature text,                   -- the artist's signature

  -- Blockchain proof
  blockchain_method text DEFAULT 'opentimestamps',
  ots_proof bytea,                              -- binary OTS file
  bitcoin_block_height integer,
  bitcoin_tx_hash text,
  blockchain_verified_at timestamptz,

  -- Audit
  created_at timestamptz DEFAULT now() NOT NULL,
  canonical_json text NOT NULL                  -- the exact version that was hashed
);

CREATE UNIQUE INDEX idx_genesis_track ON genesis_records(track_id);
CREATE INDEX idx_genesis_chromaprint ON genesis_records USING gin(chromaprint_compressed);
CREATE INDEX idx_genesis_embedding ON genesis_records USING ivfflat (neural_embedding vector_cosine_ops);
CREATE INDEX idx_genesis_license ON genesis_records(ai_training_license);

-- Licence changes (audit trail)
CREATE TABLE genesis_license_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  genesis_record_id uuid REFERENCES genesis_records(id),
  previous_license text,
  new_license text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now(),
  reason text,
  signature text                                -- cryptographic signature of the change
);

-- Detected derivative tracks
CREATE TABLE genesis_derivations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_genesis_id uuid REFERENCES genesis_records(id),
  detected_url text NOT NULL,
  detected_platform text,                       -- 'spotify', 'soundcloud', 'youtube', 'suno', etc.
  match_type text,                              -- 'exact', 'derivative', 'stylistic'
  confidence numeric,
  detected_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending',                -- pending, confirmed, dismissed, dmca_sent
  artist_action text,                           -- claim, ignore, dispute
  notes text
);

-- Style Profiles (Component 4)
CREATE TABLE genesis_style_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id),
  artist_name text NOT NULL,
  aggregated_dna jsonb NOT NULL,                -- weighted-average Sonic DNA
  representative_tracks uuid[],                 -- 3-5 tracks illustrating the style
  is_public boolean DEFAULT false,
  pricing jsonb,                                -- { per_use_cents: 5000, exclusive_12mo_cents: 5000000 }
  created_at timestamptz DEFAULT now()
);

-- Granted style licences
CREATE TABLE genesis_style_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_profile_id uuid REFERENCES genesis_style_profiles(id),
  licensee_name text NOT NULL,
  licensee_contact text,
  license_type text,                            -- 'per_use', 'exclusive_12mo', etc.
  price_cents integer,
  granted_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  stripe_payment_intent_id text,
  status text DEFAULT 'active'
);

-- AI training royalties
CREATE TABLE genesis_ai_royalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  genesis_record_id uuid REFERENCES genesis_records(id),
  ai_platform text NOT NULL,                    -- 'suno', 'udio', 'stability', etc.
  usage_period_start date,
  usage_period_end date,
  usage_count integer,
  amount_cents integer,
  paid_at timestamptz,
  stripe_transfer_id text
);
```

### RLS and public access

```sql
-- The public registry: free read through the API
CREATE POLICY "Public can read genesis records by genesis_id"
  ON genesis_records FOR SELECT
  USING (true);  -- public read, with sensitive fields filtered by the view

-- Public view exposing only the fields needed for verification
CREATE VIEW public_genesis AS
SELECT
  genesis_id,
  sha256_hash,
  chromaprint,
  human_attested,
  ai_training_license,
  bitcoin_block_height,
  created_at
FROM genesis_records;
```

> **Implementation note:** a `USING (true)` SELECT policy on the base table exposes *every*
> column to `anon`, including `canonical_json`, `collaborators` and `attestation_signature`.
> The view does not restrict that — a view is not a security boundary unless the base table's
> policy is. Either scope the policy to the columns the view needs, or keep the base table
> policy-free (service-role only, as `watermark_payloads` is today) and serve the registry
> through a `SECURITY DEFINER` RPC. The current project convention is the latter.

---

## 10. Recommended technical stack

| Component | Technology | Why |
|---|---|---|
| Audio fingerprint | **Chromaprint** (fpcalc) | Open-source, de facto standard, used by AcoustID/MusicBrainz |
| Neural embedding | **CLAP** (LAION) or **MERT** | Open-source, state-of-the-art audio models |
| Embedding storage | **pgvector** on Supabase | Already compatible, fast similarity search |
| Timestamping | **OpenTimestamps** | Free, Bitcoin-backed, infinitely scalable |
| Canonical JSON | **JCS (RFC 8785)** | W3C standard for canonical serialisation |
| Crypto signature | **Ed25519** via libsodium | Modern, fast, universally supported |
| Public API | **Supabase Edge Functions** + **Cloudflare cache** | Existing infrastructure |
| Crawler detection | Custom Railway service (Python) | Spotify API, YouTube Data API, scrapers |
| Payment distribution | **Stripe Connect** | Already being integrated for billing |

### Additional infrastructure cost

- **Embedding storage:** ~100 KB per track → negligible
- **OpenTimestamps:** free (within reasonable limits on public aggregators)
- **Crawler service:** ~$20-40/month on Railway
- **Audio fingerprinting:** CPU only, can run on the existing Railway instance
- **Estimated total:** ~$30-50/month additional up to 50K tracks

---

## 11. Business model

### Direct revenue

**1. AI Training Royalties (12-24 months out).** Trakalog brokers AI training licences between
platforms (Suno, Udio, etc.) and artists. 15-20% commission on each transaction. Potential
global market: estimated in the billions of dollars by 2030 on current sector analyses.

**2. Style Licensing (6-12 months out).** 15-20% commission on style licences. Target:
producers and independent artists who want to monetise their stylistic signature.

**3. Enterprise API (6 months out).** Metered API access for DSPs, music supervisors,
publishers and AI platforms that must verify a licence before use. Pricing: $500-5,000/month by
volume.

**4. Genesis Verified Badge (3 months out).** An add-on for Pro and Business: official badge +
publicly verifiable page + strengthened legal protection. $5-10/month extra.

### Indirect revenue

- **A large lift in Free→Paid conversion** — protection is a stronger sales argument than
  storage
- **Adoption by the majors** — if UMG or Sony adopt Trakalog as provenance infrastructure, that
  is a six- or seven-figure partnership
- **Strategic acquisition** — infrastructure of this kind eventually interests acquirers (PROs,
  DSPs, infrastructure plays)

### Gross margin model

Estimated gross margin >85% on AI licence transactions — the marginal cost of a licence is close
to zero. >90% on API access and badges.

---

## 12. Legal compliance — doing it right from the start

> **Important:** this section is strategic analysis, not legal advice. Before official launch it
> is **essential** to consult a lawyer specialising in music and digital law, ideally with AI
> and IP expertise. Recommended budget: €10-20K for drafting the terms, the licences, and the
> initial compliance audit.

### 12.1 EU AI Act (priority 1)

In force since August 2024, enforceable for General Purpose AI models from August 2025. The
obligations relevant to Trakalog Genesis:

- **Article 53:** GPAI providers must publish a sufficiently detailed summary of training data.
  → Trakalog can supply that transparency infrastructure.
- **Article 50:** AI-generated content must be marked as such, machine-readably. → The
  "Human-Made on Trakalog" badge is the positive inverse of that obligation.
- **GPAI code of practice:** encourages good practice on copyright. → Genesis becomes the
  reference tool.

**Recommended action:** apply for Trakalog to join the EU AI Office working groups on GPAI good
practice. Free, visible, and perfectly positioned.

### 12.2 US Copyright Office

The office published several reports in 2024-2025 on AI and copyright. Current position: only
content with **substantial human contribution** is copyrightable. Trakalog Genesis provides
exactly the evidence needed to demonstrate that human contribution.

**Recommended action:** publish a white paper on the Genesis protocol and submit it to the
Copyright Office through their public consultations. Free visibility, maximum credibility.

### 12.3 GDPR (Europe)

The public registry exposes personal data (artist name, IPI). Implications:

- **Legal basis:** the artist's explicit consent at upload, to be built into the Genesis terms
- **Right to erasure:** complex, because the blockchain is immutable. Solution: only **the
  hash** goes to OpenTimestamps, never personal data. Personal data stays in Supabase and can be
  erased without breaking the cryptographic proof.
- **Pseudonymisation:** an option to publish a Genesis ID without revealing the artist's
  identity — useful for ghostwriters, uncredited producers and so on

### 12.4 DMCA and equivalents

Derivative-track detections can trigger automatic DMCA notices. Risks:

- **False positives:** an unjustified DMCA can carry sanctions
- **Mitigations:** mandatory human in the loop for notices, high confidence thresholds (>95% for
  automatic DMCA), and a transparent dispute path

### 12.5 Right of publicity (US) and neighbouring rights (Europe)

**Style Licensing** touches an artist's image and voice rights. The Tennessee ELVIS Act (2024)
prohibits unauthorised reproduction of an artist's voice. The NO FAKES Act (US) is before
Congress.

**Implication:** Genesis Style Licensing is **perfectly aligned** with these laws precisely
because it is strictly opt-in. It is exactly the legal mechanism legislators are trying to
promote.

### 12.6 Berne Convention and international copyright

Creative provenance with cryptographic timestamping constitutes proof of priority recognised in
most signatory jurisdictions (175 countries). It is stronger than national registries in 90% of
cases, being immutable and globally verifiable.

### 12.7 Evidential admissibility

Cryptographic proofs with a Bitcoin timestamp via OpenTimestamps are **already admitted in
court** in several European countries and in the US. Notable case law exists from 2018 onward.
Worth documenting for the pitch.

### 12.8 Antitrust and competition

If Genesis becomes a de facto standard, antitrust questions follow:

- Keep the protocol **open source** (already planned)
- Keep the public API with a free tier
- Do not exclude competitors — the philosophy is to be the principal registry, not the only one

### Pre-launch compliance checklist

- [ ] Trakalog Genesis terms drafted by a specialist lawyer
- [ ] Standard AI Training Licence published in several languages (EN, FR, DE, ES)
- [ ] Privacy policy updated to mention blockchain timestamping
- [ ] DPA (Data Processing Agreement) for enterprise customers
- [ ] Documented DMCA procedure
- [ ] Procedure for opposing an Origin Print
- [ ] Full GDPR audit
- [ ] "Human-Made" badge eligibility verified (clear criteria)
- [ ] Attestation revocation mechanism, for detected fraud

---

## 13. Risks and mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| AI platforms refuse the standard | Medium | High | Lobbying + the EU AI Act forces transparency + open source makes adoption easy |
| False positives in derivation detection | High | Medium | Mandatory human in the loop, high thresholds, transparency |
| False human attestation (artist lies) | Medium | Medium | Cryptographic signature = personal liability, contractual sanctions, revocation possible |
| Slow Bitcoin timestamp (10 min - 1h confirmation) | Low | Low | Fine for MVP; display "pending → confirmed" |
| A competitor copies the protocol | Medium | Low | It is OPEN SOURCE by design — the moat is the network effect, not the technology |
| Litigation over the proof's validity | Medium | High | Favourable case law exists, and we are not alone (Wikipedia and French media use OTS) |
| Cost of scaling derivation detection | High | Medium | API pricing + Pro/Business plans + DSP data partnerships |
| Majors adopt too slowly | High | Medium | Start with independents and sync supervisors, build social proof; the majors follow |
| Regulation changes abruptly | Medium | High | Stay flexible: adapt to regulations rather than depend on one |
| Hashing performance at scale | Low | Low | Async fire-and-forget hashing, horizontal Railway scaling |

---

## 14. Implementation roadmap

### Phase 1 — MVP (12 weeks)

**Objective:** Origin Print + Public Registry + basic AI Training License

| Week | Deliverable |
|---|---|
| 1-2 | Initial legal audit + terms drafting + public protocol spec |
| 3-4 | Audio fingerprinting (Chromaprint + neural embedding via CLAP) on Railway |
| 5-6 | Canonical JSON + Ed25519 signature + OpenTimestamps integration |
| 7-8 | DB tables + `SECURITY DEFINER` RPCs + RLS |
| 9-10 | UI: licence choice at upload, human attestation, public Genesis page |
| 11 | Public verification API + documentation |
| 12 | End-to-end tests + soft launch to 10 beta testers |

**Estimated cost:** ~€15-25K (legal audit + 1-2 months of focused development).

### Phase 2 — Adoption and badges (months 4-6)

- "Human-Made on Trakalog" badge on every shared link and pitch
- Publish the white paper and submit it to the US Copyright Office
- Apply to join the EU AI Office working groups
- First music-supervisor partnerships (proof of concept)

### Phase 3 — Style Licensing and derivation detection (months 6-12)

- Public, licensable Style Profiles
- Stripe Connect for royalties
- Derivation Detection across the major DSPs (Spotify, SoundCloud, YouTube)
- DMCA automation
- Enterprise API for DSPs and AI platforms

### Phase 4 — Industry standard (months 12-24)

- Official partnerships with 2-3 AI platforms (first AI licence deal)
- Inclusion in Spotify/Apple Music terms ("Human-Made certified by Trakalog" badge)
- Negotiations with PROs for mutual integration
- First enterprise deals with independent labels, then majors

---

## 15. Dependencies on the rest of the project

### Already built, and feeding Genesis ✅

- Sonic DNA Profiler (stylistic signature)
- Invisible watermarking (natural complement to Derivation Detection)
- Cryptographic splits and signatures (verified contributors)
- Audit logs (internal chain of trust)
- Workspaces and permissions (contributor management)
- `SECURITY DEFINER` RPCs (established pattern for sensitive writes)

### To build or extend in parallel

- **Stripe Connect** — the base Stripe integration now exists; Connect is still to add
- **Public API** — benefits the Genesis API and Trakalog's general API alike
- **Email branding and multilingual terms** — the basis for internationalisation

### Features that gain value from Genesis

- **Smart A&R:** can filter by "Human-Made certified"
- **Pitches:** a badge in each email adds credibility
- **Shared links:** strengthened legal protection
- **Sync Matchmaker** (future): a decisive sales argument against the competition

---

## 16. KPIs to track

### Adoption

- Genesis Records created per month
- % of uploaded tracks choosing Genesis (target: >70% of paid plans)
- Public API verifications (a proxy for external adoption)
- "Human-Made" badge embeds outside Trakalog

### Business

- AI Training Royalty revenue (from month 12)
- Style Licensing revenue (from month 6)
- Free→Pro conversion (expected impact: +15-25%)
- Pro→Business conversion (expected impact: +10-20%)

### Strategic

- Mentions in trade and tech press
- Citations in regulatory reports
- Official partnerships with AI platforms and DSPs
- Adoption by labels and publishers

---

## 17. The pitch in one sentence

**"Trakalog Genesis is the world registry of musical creative provenance in the AI era — the
cryptographic proof that says who created what, when, under which permissions, and who must be
paid. It is the infrastructure the whole industry is looking for, and that nobody else is in a
position to build."**

---

## 18. The line to remember

Trakalog is no longer a "premium Disco". Trakalog becomes **the regulatory and ethical
infrastructure of the music industry in the AI era**. That is the difference between selling a
product — which competitors copy in six months — and building a category, which nobody can
copy.

The moment is *now*. The window closes as soon as the first large platform, or a consortium of
majors, launches its own solution. Six to twelve months to position Trakalog as the de facto
standard before someone else tries.

---

*This document is living, and will be updated as development, legal consultation, and
regulation evolve.*
