# TRAKALOG — SIGNAL

> **Created:** May 17, 2026
> **Last Updated:** September 2, 2026 (translated to English)
> **Goal:** Build the music industry's first reverse marketplace — music supervisors post
> micro-briefs, Trakalog's AI silently matches catalogs, and artists receive only qualified
> opportunities.
> **Status:** 📋 **Strategic concept — nothing implemented.** Verified September 2, 2026: no
> `signal_*` table and no `signal-*` Edge Function exists. Launch is 6-9 months after the
> public beta, and requires the Genesis MVP plus critical catalog mass.
> **Vision:** *"Artists stop pitching. They get matched. Supervisors stop drowning. They receive
> only what they asked for."*

---

## 1. Why SIGNAL — the market in 2026

### The central problem

The music industry has moved on: distribution is no longer the moat, and neither is production.
The real bottleneck is the **meeting of supply and qualified demand**.

**Supply side:** Spotify receives ~120,000 tracks a day. Independent artists now represent 35%
of the global market. Any artist can produce, distribute and share for under €50/year.

**Demand side:**

- A music supervisor receives **several hundred pitches a week** and listens to roughly 10%
- Production timelines have collapsed: shows that once had weeks for music supervision now have
  days; ads decide the week before launch
- A&Rs, publishers, brand managers, podcasters, game studios, content creators — all constantly
  hunting for fresh, quickly clearable music
- **No clean channel exists** for them to express what they need without being spammed

### Every current solution is bad

| Solution | Problem |
|---|---|
| **Disco / Sound Credit** | Storage tools, not marketplaces. Supervisors still receive hundreds of unsolicited pitches |
| **Songtradr / Musicbed / Marmoset** | Traditional libraries: the artist signs away control, and briefs stay closed |
| **Personal sync agents** | Expensive (15-25% commission), inaccessible to independents, do not scale |
| **Cold email pitching** | <1% response rate, mental fatigue on both sides, no traceability |
| **Public brief platforms (Taxi, Music Gateway)** | Generic briefs with no AI matching, open to everyone, so the same spam volume |

### The gap to fill

What is missing is a **reverse marketplace** where demand is expressed by the supervisor rather
than the artist, and where the meeting is filtered by an AI that genuinely understands music.
That is precisely what **Sonic DNA + Genesis** make possible. No competitor has both pieces.

---

## 2. Value proposition

### For the music supervisor / A&R / brand manager

> *"Post your brief in 2 minutes. In the morning, receive 5-15 highly qualified tracks with
> pre-cleared rights and proof of human authorship. No spam, no hunting, no complicated rights
> negotiation."*

### For the artist / producer / label

> *"Your catalog works while you sleep. When a supervisor looks for something that sounds like
> you, you get ONE notification. One click to submit your track. No pitch to write. No
> relationship to maintain."*

### For Trakalog

> *"The first music marketplace where demand pays. Commission on every facilitated deal. Pure
> network effect: more supervisors → more artists → more matches → more deals."*

---

## 3. End-to-end mechanics

### Step 1 — The supervisor posts a brief (2 minutes)

An extremely simple interface, four fields:

```
┌─────────────────────────────────────────────────────────┐
│  Post a Brief                                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Describe the vibe                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Melancholic but hopeful, slow build, female      │   │
│  │ vocal preferred, no aggressive synths, fits a    │   │
│  │ moment of reconciliation in a coming-of-age      │   │
│  │ scene                                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  2. Sonic reference (optional but recommended)           │
│  [ Drop a track file or paste Spotify/SoundCloud URL ]   │
│                                                          │
│  3. Deadline                                             │
│  ○ 24h (rush)    ● 72h    ○ 1 week    ○ 2 weeks          │
│                                                          │
│  4. Budget range                                         │
│  ○ $1-5K    ● $5-20K    ○ $20-100K    ○ $100K+           │
│                                                          │
│  5. Usage context (optional)                             │
│  ○ TV    ○ Film    ● Streaming series    ○ Ad           │
│  ○ Game  ○ Podcast ○ Trailer             ○ Other        │
│                                                          │
│              [ Post brief — $X posting fee ]            │
└─────────────────────────────────────────────────────────┘
```

The supervisor pays a **posting fee** on submission ($50-$500 by urgency and budget — see §8).
The fee separates serious briefs from curiosity, and funds the platform from the demand side.

### Step 2 — SIGNAL turns the brief into a semantic query

An instantaneous internal pipeline:

1. **Text embedding** → a 512-d semantic vector via the Claude API (mood, energy,
   instrumentation and vocal style extracted)
2. **Reference-track embedding** → Sonic DNA + CLAP neural embedding through the existing
   Railway service
3. **Fusion of the two** → a single weighted query vector (60% reference / 40% text when both
   are present)
4. **Hard filters:**
   - Genesis-certified ✅ (human attestation mandatory)
   - Splits 100% signed ✅ (no clearance issues)
   - Sync-ready status (no uncleared samples, no dispute)
   - AI Training License is `NO-AI` or `PAID-AI` — never `OPEN-AI` for sync briefs
   - Budget compatible with the artist's declared minimum
5. **pgvector search** → the top 50 tracks whose DNA falls within the similarity radius (cosine
   distance)
6. **Re-ranking** by Claude using the brief's text context → the final top 10-15

All in under 5 seconds. The supervisor does not wait.

### Step 3 — A silent notification to the artist

The artist receives **one** notification (mobile push + email):

```
┌──────────────────────────────────────────────────────┐
│  🎯 New match — 87% similarity                       │
│                                                       │
│  Your track "Midnight Run" matches a brief from      │
│  a verified supervisor.                              │
│                                                       │
│  Project: Streaming series (drama)                   │
│  Budget: $5–20K                                      │
│  Deadline: 72h                                       │
│  Supervisor rating: 4.8/5 (12 past placements)       │
│                                                       │
│           [ View brief ]    [ Dismiss ]              │
└──────────────────────────────────────────────────────┘
```

The artist clicks. They see the full brief, the supervisor's profile (Trakalog-verified,
placement history, on-time payment rate, response rate), and **a single button: "Submit this
track"**.

No pitch to write. No email to compose. No file to upload — the track already exists with its
Genesis Print. One click. Trakalog handles the rest.

### Step 4 — The supervisor's SIGNAL inbox

The next morning, or within the requested deadline, the supervisor opens their SIGNAL inbox:

```
┌──────────────────────────────────────────────────────────┐
│  Brief: "Melancholic but hopeful..."                     │
│  Posted 2 days ago — 7 tracks submitted                  │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  🥇 92% match  Midnight Run — Artist One                  │
│       ▶️ Play  📄 One-sheet  ✅ Genesis verified  $8K     │
│                                                           │
│  🥈 89% match  Last Light — Artist Two                    │
│       ▶️ Play  📄 One-sheet  ✅ Genesis verified  $12K    │
│                                                           │
│  🥉 87% match  Hold On Slow — Artist Three                │
│       ▶️ Play  📄 One-sheet  ✅ Genesis verified  $6K     │
│                                                           │
│  ... 4 more                                              │
│                                                           │
│  [ Shortlist ]  [ Request stems ]  [ Make an offer ]    │
└──────────────────────────────────────────────────────────┘
```

Each track comes with:

- A streaming audio player, watermarked per supervisor — leak tracing if the track escapes
  before a deal
- An **auto-generated one-sheet**: all credits, splits, PROs, IPI, one-stop contact
- A clickable **Genesis verification badge** → the public page with the Bitcoin timestamp and
  human attestation
- The artist's asking price, shown transparently
- A Sonic DNA summary for fast cross-referencing

### Step 5 — Negotiation and deal, in-app

The supervisor picks their favourite and clicks **"Make an offer"**:

```
┌──────────────────────────────────────────────────────┐
│  Offer for "Midnight Run"                            │
│                                                       │
│  Usage: Streaming series — single scene              │
│  Territory: Worldwide                                 │
│  Duration: 5 years                                    │
│  Exclusivity: Non-exclusive                          │
│                                                       │
│  Offered fee: $ [ 8000 ]                             │
│                                                       │
│  Message to the artist (optional):                   │
│  ┌─────────────────────────────────────────────┐    │
│  │ Love the build at 1:34. We'd use it in       │    │
│  │ episode 4, scene 7. Need final by Friday.    │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│            [ Send offer ]                            │
└──────────────────────────────────────────────────────┘
```

The artist receives the offer and can accept, counter or decline — all in-app. On agreement:

1. **Stripe Connect** takes the supervisor's payment into escrow
2. A **sync contract** is auto-generated (standardised Trakalog template, reusing the Ed25519
   electronic signature from the splits system)
3. Both parties sign
4. Trakalog releases 85-90% to the artist (10-15% commission); Stripe pays out in 7 days
5. The track automatically moves to "synced" status in the artist's catalog
6. **Genesis audit log:** the sync licence is recorded in the work's history

### Step 6 — Post-deal: the flywheel

- The artist gains a **reputation star** on their profile (one validated placement boosts
  visibility in future matches)
- The supervisor gains a **reliability star** (a completed placement adds +0.1 to their rating)
- **Mutual reviews**, not public — visible only to Trakalog for moderation — improve network
  quality
- The artist may **publicly share** the deal if they wish; a validated placement becomes social
  proof
- The track joins the **reference list** used to match future similar briefs — the system learns

---

## 4. Why this would not work without Genesis

This is **the key that makes SIGNAL possible**. Without a Genesis Print, a supervisor must:

- Verify the track is not AI-generated → impossible today
- Verify the splits are signed and every contributor is on board → emails, waiting, friction
- Verify that master and composition rights are clear → IPI and PRO research
- Verify there are no uncleared samples → contacting the label, research, doubt

**All of that takes 1-3 weeks today. It is exactly why supervisors prefer sync agents who have
already cleared this ground.**

With Genesis attached to every Trakalog track:

- ✅ Human-attested → a cryptographic signature from the artist
- ✅ Splits cryptographically signed 100% → an immutable audit trail
- ✅ One-stop ownership, or a clear ownership chain → published in the registry
- ✅ No uncleared samples → automatic check via derivation detection
- ✅ An explicit AI Training License → the supervisor knows exactly what they may do

**The supervisor goes from 1-3 weeks of verification to 30 seconds of validation.** That is
what changes the game, and what makes SIGNAL a new category rather than "another Disco".

---

## 5. Technical architecture

### Principal tables *(none created yet)*

```sql
-- Briefs posted by supervisors
CREATE TABLE signal_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid REFERENCES auth.users(id) NOT NULL,
  workspace_id uuid REFERENCES workspaces(id),

  -- The brief itself
  vibe_description text NOT NULL,
  reference_track_url text,                     -- Spotify/SoundCloud URL or temporary upload
  reference_embedding vector(512),              -- DNA of the reference track
  text_embedding vector(512),                   -- embedding of vibe_description
  query_embedding vector(512),                  -- fusion of both, used for matching

  -- Filters
  deadline_at timestamptz NOT NULL,
  budget_min_cents integer,
  budget_max_cents integer,
  usage_context text,                           -- 'tv', 'film', 'streaming', 'ad', 'game', 'podcast', 'trailer', 'other'

  -- Status
  status text DEFAULT 'active',                 -- active, expired, filled, cancelled
  posting_fee_cents integer NOT NULL,
  stripe_payment_intent_id text,

  created_at timestamptz DEFAULT now(),
  expires_at timestamptz GENERATED ALWAYS AS (deadline_at + interval '7 days') STORED
);

CREATE INDEX idx_signal_briefs_active ON signal_briefs(status) WHERE status = 'active';
CREATE INDEX idx_signal_briefs_embedding ON signal_briefs USING ivfflat (query_embedding vector_cosine_ops);

-- AI-generated matches, before submission
CREATE TABLE signal_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid REFERENCES signal_briefs(id) ON DELETE CASCADE,
  track_id uuid REFERENCES tracks(id) NOT NULL,
  artist_workspace_id uuid REFERENCES workspaces(id),

  similarity_score numeric,                     -- 0.0 to 1.0
  ai_ranking_position integer,                  -- 1 = top match
  match_reasons text[],                         -- ["BPM aligned", "Mood match", "Vocal style fit"]

  artist_notified_at timestamptz,
  artist_response text DEFAULT 'pending',       -- pending, accepted, dismissed, expired
  artist_responded_at timestamptz,

  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_signal_matches_unique ON signal_matches(brief_id, track_id);
CREATE INDEX idx_signal_matches_pending ON signal_matches(artist_workspace_id, artist_response) WHERE artist_response = 'pending';

-- Tracks submitted by artists against a brief
CREATE TABLE signal_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid REFERENCES signal_briefs(id) NOT NULL,
  match_id uuid REFERENCES signal_matches(id),
  track_id uuid REFERENCES tracks(id) NOT NULL,
  artist_workspace_id uuid REFERENCES workspaces(id) NOT NULL,
  submitted_by uuid REFERENCES auth.users(id),

  artist_minimum_price_cents integer,
  artist_note text,                             -- optional context for the supervisor

  status text DEFAULT 'submitted',              -- submitted, shortlisted, offered, won, lost, withdrawn
  supervisor_viewed_at timestamptz,
  supervisor_shortlisted_at timestamptz,

  created_at timestamptz DEFAULT now()
);

-- Offers made by supervisors
CREATE TABLE signal_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES signal_submissions(id) NOT NULL,
  supervisor_id uuid REFERENCES auth.users(id) NOT NULL,
  artist_workspace_id uuid REFERENCES workspaces(id) NOT NULL,

  -- Proposed terms
  fee_cents integer NOT NULL,
  usage_description text,
  territory text DEFAULT 'worldwide',
  duration_years integer DEFAULT 5,
  exclusivity text DEFAULT 'non-exclusive',     -- non-exclusive, exclusive_genre, exclusive_full
  supervisor_message text,

  status text DEFAULT 'pending',                -- pending, accepted, counter_offered, declined, expired, paid
  artist_counter_fee_cents integer,
  artist_counter_message text,

  -- Payment
  stripe_payment_intent_id text,
  trakalog_commission_cents integer,
  artist_payout_cents integer,
  paid_to_artist_at timestamptz,

  -- Contract
  contract_pdf_url text,
  artist_signed_at timestamptz,
  supervisor_signed_at timestamptz,
  contract_genesis_id text,                     -- hash of the Genesis audit for this deal

  created_at timestamptz DEFAULT now(),
  expires_at timestamptz                        -- the offer expires after X days
);

-- Supervisor profiles (separate from profiles, for feature-specific fields)
CREATE TABLE signal_supervisor_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  display_name text NOT NULL,
  company text,
  verified boolean DEFAULT false,               -- manually verified by Trakalog
  verification_method text,                     -- 'imdb_credit', 'linkedin', 'industry_intro', 'past_deal'

  total_briefs_posted integer DEFAULT 0,
  total_deals_closed integer DEFAULT 0,
  total_spent_cents integer DEFAULT 0,
  on_time_payment_rate numeric DEFAULT 1.0,
  response_rate numeric DEFAULT 0.0,
  avg_response_time_hours numeric,
  rating numeric DEFAULT 5.0,                   -- 0.0 to 5.0

  notable_placements jsonb,                     -- past credits (Netflix shows, ads, etc.)
  bio text,
  avatar_url text,

  created_at timestamptz DEFAULT now()
);

-- Bilateral post-deal reviews
CREATE TABLE signal_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES signal_offers(id) NOT NULL,
  reviewer_id uuid REFERENCES auth.users(id),
  reviewee_id uuid REFERENCES auth.users(id),
  reviewer_role text,                           -- 'artist' or 'supervisor'
  rating integer CHECK (rating BETWEEN 1 AND 5),
  comment text,                                 -- private, visible to Trakalog only
  public boolean DEFAULT false,                 -- the artist may publish it on a validated placement
  created_at timestamptz DEFAULT now()
);

-- Artist preferences (opt-in / opt-out filters)
CREATE TABLE signal_artist_preferences (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id),
  enabled boolean DEFAULT false,                -- opt in to receive matches
  minimum_budget_cents integer DEFAULT 0,
  excluded_usage_contexts text[],               -- ['ad', 'trailer'] where the artist opts out
  excluded_brands text[],                       -- explicitly refused brands
  preferred_exclusivity text DEFAULT 'non-exclusive',
  auto_decline_below_match_score numeric DEFAULT 0.7,
  notification_method text DEFAULT 'push_email',  -- 'push_email', 'email_only', 'in_app_only'
  created_at timestamptz DEFAULT now()
);
```

### Edge Functions to create

| Function | Role |
|---|---|
| `signal-post-brief` | Creates the brief, generates embeddings, launches matching, takes the Stripe posting fee |
| `signal-run-matching` | Re-ranks and notifies artists (daily cron + triggered on brief creation) |
| `signal-submit-track` | The artist submits their track to the brief (one click from the notification) |
| `signal-make-offer` | The supervisor sends an offer to an artist |
| `signal-accept-offer` | The artist accepts → Stripe escrow → contract generated |
| `signal-counter-offer` | Counter-offer from either side |
| `signal-finalize-deal` | Once both signatures are collected → Stripe transfer → final notification |
| `signal-supervisor-verification` | Manual supervisor verification workflow (Trakalog admin) |

### Railway service for AI matching

A new Railway service dedicated to matching, or an extension of the existing Sonic DNA
Profiler:

```python
# signal-matcher/app.py (Python/Flask)

@app.route('/embed-brief', methods=['POST'])
def embed_brief():
    """Generate a brief's embeddings."""
    data = request.json
    vibe_text = data['vibe_description']
    reference_url = data.get('reference_track_url')

    # 1. Text embedding via the Claude API
    text_embedding = claude_embed(vibe_text)

    # 2. If an audio reference is supplied, compute Sonic DNA + CLAP embedding
    reference_embedding = None
    if reference_url:
        audio = download_temp(reference_url)
        sonic_dna = analyze_sonic_dna(audio)
        clap_embedding = clap_extract(audio)
        reference_embedding = fuse_embeddings(sonic_dna, clap_embedding)

    # 3. Final fusion (60% reference / 40% text when both are present)
    if reference_embedding is not None:
        query_embedding = 0.6 * reference_embedding + 0.4 * text_embedding
    else:
        query_embedding = text_embedding

    return jsonify({
        'text_embedding': text_embedding.tolist(),
        'reference_embedding': reference_embedding.tolist() if reference_embedding is not None else None,
        'query_embedding': query_embedding.tolist()
    })

@app.route('/rerank-matches', methods=['POST'])
def rerank_matches():
    """Claude re-ranks the top 50 candidates found by pgvector."""
    data = request.json
    brief = data['brief']
    candidates = data['candidates']  # 50 tracks with sonic_dna + metadata

    # Ask Claude to re-rank the 50 against the brief text.
    # Returns the top 15 with enriched match_reasons.
    reranked = claude_rerank(brief, candidates)

    return jsonify({'ranked_matches': reranked})
```

---

## 6. UX — the key screens

### Supervisor side

**1. SIGNAL dashboard** — active briefs (with a submission counter), past briefs (with
outcomes: deal or no deal), the notification inbox of artists who submitted, profile and
rating, and the primary CTA: **+ Post a new brief**.

**2. New brief (2-minute modal)** — the four simple fields from §3, a preview of the posting fee
by urgency and budget, inline Stripe payment, and confirmation: "Your brief is live. You'll
receive your first matches within X hours."

**3. Brief inbox (per brief)** — submissions ranked by match %, filters (mood, budget,
duration, vocal/instrumental), an inline audio player with waveform, action buttons (Shortlist,
Request stems, Make offer, Decline), and a sidebar with the brief criteria and a deadline
countdown.

**4. Make Offer modal** — fee, territory, duration, exclusivity, message; a preview of the
contract to be generated; Stripe escrow information: "Funds will be held until the artist
signs."

### Artist side

**1. SIGNAL notifications** (folded into the existing notification centre) — a dedicated
🎯 SIGNAL Match badge showing match %, project type, budget range, deadline countdown and
supervisor rating; actions: View brief, Submit track, Dismiss.

**2. SIGNAL brief view** — the full brief; the supervisor's profile (verified badge, past
placements, rating); the suggested track (player + Genesis Print badge); optional fields for a
minimum price and a note to the supervisor (max 200 characters); and a single button:
**Submit this track**.

**3. SIGNAL deals dashboard** — submissions in flight (status per brief), offers received (to
accept, decline or counter), signed deals awaiting payment, and past deals with revenue
generated.

**4. SIGNAL preferences** (Settings) — marketplace on/off, minimum acceptable budget, excluded
usage contexts (never ads, never trailers), explicitly refused brands, notification method.

---

## 7. Launch strategy — why 6-9 months minimum

You cannot launch a marketplace without liquidity on both sides. The classic marketplace trap:
**launching with an empty supply or an empty demand kills the product in three months.**

### Phase 0 — Preconditions (3-6 months after the public beta)

Before writing any SIGNAL code, these must exist:

1. **Stripe / billing in production** ✅ current priority
2. **A working Genesis MVP:** Origin Print + AI Training License + Public Registry
3. **At least 1,000 human Genesis-certified tracks** in the database
4. **At least 100 active paying artists** (Starter or Pro) with a direct interest
5. **A well-drilled onboarding**, so the first invited supervisors get a premium experience

Without those, a supervisor posts a brief, receives two mediocre matches, and never returns.
There is no second chance with them.

### Phase 1 — Supervisor recruitment (3 months, "founder mode")

**Personally contact 50 hand-picked supervisors and A&Rs.** No mass marketing, no ads. One to
one.

Target mix for the first 50:

- **15 indie film music supervisors** (Sundance, SXSW, TIFF — their emails are public through
  the Guild of Music Supervisors)
- **10 streaming series supervisors** (Netflix, HBO, Amazon, Apple — mid-career, not the stars)
- **10 ad agency music directors** (mid-size agencies — McCann, Wieden+Kennedy, DDB)
- **5 game audio directors** (indie studios: Annapurna, Devolver, Supergiant)
- **5 podcast music sourcing leads** (Wondery, Pushkin, Spotify Studios)
- **5 in-house brand music leads** (Nike, Apple, Glossier, Aesop)

Approach for each: a personalised LinkedIn DM or email; introduce yourself as the founder who
built Trakalog; offer **6 months free** (no posting fees) plus a reduced 5% Trakalog commission
on the first deals; show a 3-minute demo video; run a one-to-one onboarding (30-minute call).

Realistic objective: **15-25 active supervisors** by the end of recruitment. That is critical
mass.

### Phase 2 — Invite-only soft launch (1-2 months)

- The 15-25 recruited supervisors post their first briefs (target: 3-5 briefs/week in total)
- Trakalog Pro and Business artists receive the matches exclusively
- Monitor every deal; interview both parties after each transaction
- Iterate fast on the friction found
- **Objective: 5 signed and paid deals** in the period. Not 50. Five real deals.

### Phase 3 — Public launch (month 3+)

Once there are 5+ validated deals and at least 3 publishable testimonials:

- Public announcement with real case studies
- Open to Starter (with a higher minimum match score)
- Open the supervisor programme to applications, still manually verified
- Supervisor pricing switched on (normal posting fees)
- PR: Music Business Worldwide, Hypebot, Synchtank, Variety
- Influence: specialist podcasts (And the Writer Is, The Sync Report, Music Business Made
  Simple)

### Phase 4 — Scale (month 6+)

- Automated supervisor onboarding (verification form + ID validation)
- An API for agencies to fold SIGNAL into their workflows
- Slack integration for studios that want briefs delivered to a team
- Internationalisation (first UK, German and French supervisors)

---

## 8. Business model

### Direct revenue

**1. Posting fees (supervisors)** — filters serious demand and funds the AI matching.

| Urgency × budget | Posting fee |
|---|---|
| 2 weeks × $1-5K | $50 |
| 1 week × $1-5K | $75 |
| 72h × $1-5K | $100 |
| 24h × $1-5K | $200 |
| 2 weeks × $5-20K | $100 |
| 72h × $5-20K | $250 |
| 24h × $5-20K | $500 |
| Any × $20-100K | $500-1,000 |
| Any × $100K+ | $2,000 (with concierge service) |

**2. Commission on deals** — the primary revenue.

- **10% on deals under $10K** (independent artists, first placements)
- **12% on deals $10-50K** (standard TV/streaming placements)
- **15% on deals over $50K** (large ad placements, films, exclusives)

**3. SIGNAL Pro for supervisors** — $99-299/month for active supervisors. Includes posting fees
(up to 20 briefs/month), advanced features (free similarity search across the Trakalog catalog,
saved-search alerts, teams/workspaces), and a reduced Trakalog commission (8% instead of
10-15%). Target: power users posting 5+ briefs a month.

**4. Verified Supervisor Badge** — $200/year. Enhanced verification (ID, IMDb credits, industry
references). Becomes a strong trust signal; artists prioritise verified briefs.

### Gross margin model

Marginal cost of a facilitated deal:

- Stripe Connect fees: ~2.9% + $0.30 on the total
- AI matching (Claude + Sonic DNA): ~$0.10 per brief
- Storage and compute: negligible, reusing existing Trakalog infrastructure
- Human support for complex deals: variable, ~$5-50 per deal

**Expected average gross margin: >85%** on commissions.

### Projections (conservative, 18 months after the SIGNAL launch)

Assumption: 50 active supervisors, 5 briefs each per month = 250 briefs/month.

- **Average posting fees:** 250 briefs × $150 = **$37,500/month**
- **Brief → deal conversion:** 20% (industry estimate) = 50 deals/month
- **Average deal value:** $8,000
- **Average commission 12%:** 50 × $8,000 × 12% = **$48,000/month**
- **SIGNAL Pro subscriptions:** 15 supervisors × $200 = **$3,000/month**

**Estimated SIGNAL monthly revenue: ~$88,500** (~$1M/year).

At that point SIGNAL likely represents **40-60% of total Trakalog revenue**, and growth is
exponential, since each validated deal attracts 2-3 new supervisors through industry
word-of-mouth.

---

## 9. Risks and mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Too few supervisors recruited in Phase 1 | High | Critical | Intensive personal selling + a generous free offer + a killer demo |
| AI matching not precise enough | Medium | High | A 2-month private beta before launch, manual threshold calibration, a supervisor feedback loop rating each match |
| Brief spam from fake supervisors | High | Medium | A posting fee from the first use + systematic manual verification + bans for abuse |
| Submission spam from artists | Medium | Low | One submission per match (no resubmission after dismissal) + an artist reputation score |
| Direct competition from Disco/Songtradr | Medium | Medium | Disco has a conflict of interest (storage business); Songtradr does no AI matching. Our moat is Genesis + Sonic DNA + UX |
| Contractual dispute after a deal | Low | High | A well-drafted standard contract, Stripe escrow, Ed25519 signatures, the Genesis audit log |
| Track theft through the marketplace | Low | High | Invisible per-supervisor watermarking on every preview + existing leak tracing |
| Supervisors unhappy with artist spam pre-match | Medium | Critical | This is the core value proposition — the AI filters BEFORE artists see the brief. Zero visible spam. |
| Music marketplace regulation | Low | Medium | No legal difference from Songtradr/Musicbed, operating for 10 years |
| Stripe Connect dependency for international payment | Low | Medium | Stripe Connect is solid; alternatives are Wise Business or Paddle |

### The principal, non-obvious risk: chicken and egg

If the first supervisors post and receive only two mediocre matches, they never come back. If
artists only ever see unrealistic briefs, they switch SIGNAL off.

**Mitigation:** do NOT launch SIGNAL before there are at least 1,000 Genesis-certified tracks in
the database, at least 15 supervisors privately committed to 2 briefs a month for six months,
and two months of manual match calibration — reviewing each match before it reaches an artist,
to tune the thresholds.

---

## 10. Implementation phases

### Phase 0 — Preparation (in parallel with Stripe, onboarding and Genesis)

- Genesis MVP complete
- Reach 1,000 Genesis-certified tracks
- Reach 100 active paying artists
- Prepare the target supervisor lists
- Draft the SIGNAL terms (lawyer — reuse the Genesis brief)

### Phase 1 — Build the MVP (~6-8 weeks of development)

**Weeks 1-2 — DB setup + Edge Function skeletons**
`signal_briefs`, `signal_matches`, `signal_submissions`, `signal_offers`; `SECURITY DEFINER`
RPCs for writes; a basic `signal-post-brief`.

**Weeks 3-4 — Railway matching service**
A new Python/Flask `signal-matcher`; the `/embed-brief` and `/rerank-matches` endpoints; Claude
API integration for text embeddings and re-ranking; tests against a 100-track dataset.

**Weeks 5-6 — Supervisor frontend**
SIGNAL dashboard; new-brief modal (4 fields); brief inbox with the match list; offer modal;
simplified supervisor onboarding.

**Weeks 7-8 — Artist frontend + notifications**
Matches folded into the existing notification centre; brief view page (read the brief, submit);
deals dashboard; SIGNAL preferences in Settings.

### Phase 2 — Private beta (2 months)

- Personal invitations to 15-25 supervisors
- Every match reviewed before it reaches an artist
- Fast iteration on UX friction
- First deals (objective: 5 signed)
- Three case studies written

### Phase 3 — Public launch (month 3)

- Supervisor pricing activated
- PR + content marketing
- Verified supervisor programme
- Full funnel analytics (brief → match → submission → offer → deal)

### Phase 4 — Scale (month 6+)

- Supervisor API for integrations
- Slack integration
- Internationalisation
- SIGNAL Pro for power users

---

## 11. Integration with the rest of Trakalog

### Benefits from

- **Sonic DNA Profiler** ✅ — the matching engine, SIGNAL's core
- **Genesis Print** ⏳ — proof of human authorship + cleared splits; unlocks supervisor trust
- **Invisible watermarking** ✅ — per-supervisor preview protection
- **Stripe / billing** ✅ — the base integration exists; escrow needs Stripe Connect
- **Workspaces & permissions** ✅ — multi-member labels can run SIGNAL as a team
- **Notification centre** ✅ — match delivery

### Strengthens

- **Genesis:** each SIGNAL deal is proof of commercial use, adding value to the badge
- **Style Licensing** (Genesis component 4): SIGNAL becomes the natural monetisation channel
  for Style Profiles
- **Catalog sharing:** labels managing several artists can enable SIGNAL across the whole
  catalog at once
- **Smart A&R:** can now help an artist understand WHY their catalog matches — or fails to
  match — certain brief types

### Distinct from

- **Brief Seeker** — scrapes external public briefs. SIGNAL is the proprietary primary source.
  Brief Seeker stays relevant for briefs outside Trakalog, but SIGNAL becomes the premium
  channel.
- **Artist Seeker** — hunts external artists to match against your catalog. SIGNAL is the
  inverse: supervisors come to you.

---

## 12. KPIs to track

### Liquidity (the most critical early on)

- Active supervisors (posting at least 1 brief/month)
- Briefs posted per week
- Matches generated per brief (target: 5-15 qualified)
- Artist opt-in rate: % of Pro/Business artists who enable SIGNAL

### Conversion

- Match acceptance rate by artists (target: >40%)
- Brief → submission: briefs receiving at least one submission (target: >80%)
- Submission → offer (target: >15%)
- Offer → signed deal (target: >50%)

### Quality

- Average supervisor rating from artists
- Average artist rating from supervisors
- Average brief → first match notified (target: <5 min)
- Average brief → deal closed (target: <14 days)

### Financial

- Posting-fee revenue
- Commission revenue
- Average deal value
- Revenue per supervisor per month
- Effective take rate (Trakalog commission / GMV)

---

## 13. The pitch in one sentence

**"Trakalog SIGNAL is the first reverse music marketplace: music supervisors post what they are
looking for, the AI silently matches Genesis-certified catalogs, and artists receive
opportunities instead of sending pitches. Zero spam, zero friction, a deal signed in days
instead of weeks."**

---

## 14. The line to remember

SIGNAL is Trakalog's **finishing move**. Genesis provides the proof of provenance. SIGNAL
monetises it. Together they form a new category: the first platform where cryptographic trust
enables an instantaneous music marketplace.

**Disco is a Dropbox.** You are building Spotify for supervisors. **Sound Credit is a metadata
manager.** You are building Stripe for sync. The moat is not the technology — which can be
copied — but **the Genesis + SIGNAL combination**, which creates a self-reinforcing ecosystem
nobody can catch without starting three years of product from zero.

Timing: launch SIGNAL as a private beta 6-9 months after Trakalog's public beta. Not before.
That is exactly the time needed to build Genesis, reach 1,000 certified tracks, and recruit the
first 25 supervisors.

**When SIGNAL is in place, Trakalog is no longer a music SaaS. It is the infrastructure of a new
pre-release music economy.**

---

*This document is living, and will be updated as development, supervisor feedback, and the
market evolve.*
