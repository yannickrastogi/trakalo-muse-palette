# TRAKALOG — DROP (Pre-Release Fan Collection Module)

> **Created:** May 17, 2026
> **Last Updated:** September 2, 2026 (translated to English)
> **Status:** 📋 **Spec ready to implement — nothing built.** Verified September 2, 2026: no
> `drops`, `drop_supporters` or `drop_tips` table, no `drop` value in the `share_type` enum, and
> no Stripe Connect integration. Sequenced after Stripe/Billing.
> **Priority:** The wow feature for the public beta launch.
> **Positioning:** DROP is a MODULE of Trakalog, not a separate platform. It reuses 100% of the
> existing infrastructure — shared links, watermarking, branding, gate screen, engagement
> analytics, Stripe Connect.

---

## 1. Vision

**The universal problem it solves.** In 2026 every artist has the same release problem. Their
track lands on Spotify, the algorithm keeps the fan data, the artist receives €0.003 per
stream, and nobody knows who their real fans are. This is the "buzz to bond" shift the whole
industry has identified: artists must **own their direct relationship with their fans**, not
rent it from platforms.

**The Trakalog DROP solution.** Before a track officially releases to DSPs, the artist creates a
private **DROP** — exclusive early access for 50-250 fans. Fans give their details (name,
email, city), receive a branded streaming link, can tip the artist freely, and get their own
watermarked downloadable version. At the end of the DROP the artist has 100 real, qualified
fans in their CRM, ready to stream on official release day.

**The pitch in one sentence:** *"Build 100 real fans before your Spotify release. Trakalog DROP
— the only platform where 100% of tips go to the artist."*

---

## 2. Why DROP is a Trakalog module, not another app

**The job-to-be-done test.** Trakalog's mission is *"make the catalog work"*. DROP does exactly
that — it turns a dormant pre-release track into a fan-database machine. That is inside the
mission, not adjacent to it.

**The fan-experience test.** The fan does not "use" Trakalog. They open a page branded 100% in
the artist's colours, with a discreet "powered by Trakalog" in the footer. The artist uses
Trakalog; fans consume the experience the artist produces with it. This is exactly the pattern
of the existing B2B shared links — the A&Rs receiving those links do not become "Trakalog
users" either.

**The technical test.** DROP reuses everything that already exists:

- Shared links (unique URL infrastructure + gate screen)
- Invisible per-visitor watermarking (Railway audiowmark service)
- Engagement analytics (plays, downloads, geography)
- Automatic contact collection (gate screen → contacts table)
- Workspace branding (hero image, logo, brand colour, socials)
- Genesis Print (future — human attestation for authenticity)
- Stripe Connect (still to add; the base Stripe integration exists)
- Resend email branding
- Notification system

**Nothing is technically new.** DROP is an intelligent **marketing rearrangement** of what is
already built.

**Anti-drift guardrail.** DROP is positioned as **the fourth dimension** of Trakalog, after
Catalog, Pitch and Provenance. It NEVER becomes the platform's narrative centre. Trakalog
remains a premium B2B product for music creators, with DROP as an eye-catching module visible
in the plans and on a dedicated `trakalog.com/drop` landing page.

---

## 3. Module architecture

### Overview

```
┌──────────────────────────────────────────────────────────────┐
│ ARTIST SIDE (Trakalog app, behind auth)                       │
│                                                                │
│  TrackDetail page                                              │
│       ↓                                                        │
│  Button "Create DROP"                                          │
│       ↓                                                        │
│  DROP configuration modal                                      │
│       ↓                                                        │
│  drops table + drop_settings → shared_link of type 'drop'     │
│       ↓                                                        │
│  Unique URL : trakalog.com/d/{slug}                            │
│       ↓                                                        │
│  Real-time dashboard : 47/100 fans, $237 collected, etc.       │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ FAN SIDE (public, fully branded artist workspace)              │
│                                                                │
│  Gate screen "You're early" → name, email, city, source        │
│       ↓                                                        │
│  Tip layer (Stripe Connect) : $0 / $3 / $7 / $15 / custom      │
│       ↓                                                        │
│  Streaming player with watermarked audio + countdown to RD     │
│       ↓                                                        │
│  Download HD (watermarked) if tipped, plus thank-you email     │
│       ↓                                                        │
│  Post-release : Honor Wall page with fan's name credited       │
└──────────────────────────────────────────────────────────────┘
```

### Reuse of existing components

| Existing component | Reuse in DROP |
|---|---|
| `shared_links` table | A new `share_type = 'drop'` |
| Gate screen | Extended with city, acquisition_source, tip_amount |
| `contacts` auto-collect | Auto-collect fans (new type: 'fan') |
| Audio watermarking | Unchanged — each fan gets a watermarked version |
| Workspace branding | Hero + logo + brand colour applied to the DROP page |
| Engagement analytics | Plays/downloads/geography per fan |
| Resend email | Thank-you email + release notification |
| Stripe Connect | Tips via destination charges (Trakalog 0% commission) |
| Genesis Print (future) | "Human-Made" badge shown on the DROP page |

> **Note:** adding `'drop'` to the `share_type` enum is a schema change. The enum today is
> `('stems', 'track', 'playlist', 'pack')`, and existing code branches on those four values —
> notably the watermarking rule, which keys off `share_type`. A DROP is watermarked, so it must
> land on the watermarked side of that branch explicitly.

---

## 4. Additional database tables

```sql
-- Main table: one DROP per pre-release
CREATE TABLE drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  shared_link_id uuid REFERENCES shared_links(id) ON DELETE SET NULL,

  -- Configuration
  slug text UNIQUE NOT NULL,                    -- short URL slug
  title text NOT NULL,                          -- "Crystal Eyes — Early Access"
  description text,                             -- optional artist message to fans
  max_slots integer NOT NULL DEFAULT 100,       -- 25 / 50 / 100 / 250 / unlimited (NULL)
  slots_used integer NOT NULL DEFAULT 0,

  -- Timing
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,                 -- usually = official release date
  release_date timestamptz,                     -- when the track hits DSPs (informational)

  -- Tipping
  tipping_enabled boolean NOT NULL DEFAULT true,
  tip_suggestions integer[] DEFAULT ARRAY[0, 3, 7, 15],  -- $ amounts
  tip_total_cents integer NOT NULL DEFAULT 0,   -- aggregated for a fast dashboard

  -- Permissions
  download_enabled boolean NOT NULL DEFAULT true,
  download_requires_tip boolean NOT NULL DEFAULT false,
  download_min_tip_cents integer DEFAULT 500,   -- if download_requires_tip

  -- State
  status text NOT NULL DEFAULT 'active',        -- active / paused / completed / cancelled
  is_public_after_release boolean NOT NULL DEFAULT true,  -- Honor Wall visibility

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_drops_workspace ON drops(workspace_id);
CREATE INDEX idx_drops_track ON drops(track_id);
CREATE INDEX idx_drops_slug ON drops(slug);
CREATE INDEX idx_drops_status ON drops(status) WHERE status = 'active';

-- Fans who took part in a DROP
CREATE TABLE drop_supporters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,

  -- Captured info
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  city text,
  country text,
  acquisition_source text,                      -- instagram / tiktok / friend / newsletter / direct

  -- Behaviour
  joined_at timestamptz DEFAULT now(),
  first_play_at timestamptz,
  play_count integer NOT NULL DEFAULT 0,
  total_listen_seconds integer NOT NULL DEFAULT 0,
  downloaded_at timestamptz,
  share_count integer NOT NULL DEFAULT 0,

  -- Audio watermarking trace
  watermark_hash text,                          -- links to watermark_payloads.hash_hex

  -- Honor Wall
  display_name text,                            -- may be a pseudonym for privacy
  show_on_honor_wall boolean NOT NULL DEFAULT true,

  -- Slot number (Early Fan #N / total)
  slot_number integer NOT NULL,                 -- 1, 2, 3...

  UNIQUE(drop_id, email)
);

CREATE INDEX idx_drop_supporters_drop ON drop_supporters(drop_id);
CREATE INDEX idx_drop_supporters_contact ON drop_supporters(contact_id);
CREATE INDEX idx_drop_supporters_email ON drop_supporters(email);

-- Tips (Stripe Connect payments)
CREATE TABLE drop_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  supporter_id uuid NOT NULL REFERENCES drop_supporters(id) ON DELETE CASCADE,

  -- Stripe
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  stripe_connect_account_id text NOT NULL,      -- the artist's Stripe Connect account

  -- Amounts (cents)
  amount_cents integer NOT NULL,                -- what the fan paid
  stripe_fee_cents integer NOT NULL DEFAULT 0,
  artist_received_cents integer NOT NULL,       -- what the artist actually got
  trakalog_fee_cents integer NOT NULL DEFAULT 0, -- ALWAYS 0 for tips (zero-commission policy)
  currency text NOT NULL DEFAULT 'usd',

  -- State
  status text NOT NULL DEFAULT 'pending',       -- pending / succeeded / failed / refunded
  refunded_at timestamptz,
  refund_reason text,

  -- Optional message from the fan
  message text,
  is_public_message boolean NOT NULL DEFAULT false,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_drop_tips_drop ON drop_tips(drop_id);
CREATE INDEX idx_drop_tips_supporter ON drop_tips(supporter_id);
CREATE INDEX idx_drop_tips_stripe ON drop_tips(stripe_payment_intent_id);

-- Gate-screen capture extension
ALTER TABLE shared_links ADD COLUMN IF NOT EXISTS drop_id uuid REFERENCES drops(id) ON DELETE SET NULL;
```

### RLS policies

`drops`: visible only to the workspace owner and members with `access_level >= 'pitcher'`.
`drop_supporters`: SELECT for the workspace; INSERT through the `register_drop_supporter`
`SECURITY DEFINER` RPC. `drop_tips`: SELECT for the workspace; INSERT from the Stripe webhook
(Edge Function, service role).

### Required RPCs (all `SECURITY DEFINER` with `_user_id`)

| RPC | Description |
|---|---|
| `create_drop(_user_id, _workspace_id, _track_id, _config jsonb)` | Creates a DROP and its associated shared_link |
| `update_drop(_user_id, _drop_id, _updates jsonb)` | Changes the config (slots, ends_at, tip suggestions) |
| `register_drop_supporter(_drop_id, _fan_data jsonb)` | Registers a fan: checks slot availability, creates the contact, returns slot_number |
| `record_drop_play(_supporter_id)` | Increments play_count |
| `record_drop_download(_supporter_id, _watermark_hash)` | Stamps downloaded_at and links the watermark |
| `get_drop_honor_wall(_slug)` | Public RPC: returns the Early Fans list (display_name only, opt-in fans) |
| `cancel_drop(_user_id, _drop_id)` | Cancels a running DROP |
| `complete_drop(_user_id, _drop_id)` | Marks a DROP complete, triggering release notifications |

---

## 5. Stripe Connect — the 0%-commission tip mechanism

### Stripe architecture

Each artist has their own **Stripe Connect Express account**, with KYC handled by Stripe
directly rather than by Trakalog. Trakalog is never the payment processor, only a platform that
facilitates the connection.

**Charge mode:** `destination_charge` with `application_fee_amount = 0`.

```typescript
// Edge Function: create-drop-tip-payment-intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: tipAmountCents,
  currency: 'usd',
  application_fee_amount: 0,  // TRAKALOG TAKES ZERO COMMISSION ON TIPS
  transfer_data: {
    destination: artistStripeConnectAccountId,
  },
  metadata: {
    drop_id: dropId,
    supporter_id: supporterId,
    type: 'drop_tip',
  },
});
```

**Why 0% is strategically brilliant:**

- Patreon takes 5-12%, Bandcamp 10-15%, Kickstarter 8-10%
- Trakalog positions itself as **the only platform in the world where 100% of the tip reaches
  the artist**
- It becomes DROP's number-one marketing argument
- Trakalog monetises elsewhere: the Pro subscription, future SIGNAL commissions of 10-15%, and
  the future Genesis enterprise API
- Estimated sacrifice: ~$32/month per active artist running one DROP a month — a narrative that
  distinguishes Trakalog from the entire market

### Stripe Connect onboarding flow

```
Artist clicks "Create DROP" for the first time
  → If no Stripe Connect account exists
    → Edge Function: stripe-connect-onboarding-link
      → Returns Stripe-hosted onboarding URL
        → Artist completes KYC on Stripe (1-5 minutes)
          → Webhook account.updated → updates workspaces.stripe_connect_account_id
            → Returns to Trakalog with the DROP creation modal open
  → If a Stripe Connect account exists → straight to DROP creation
```

### Legal framing

The Trakalog terms state explicitly:

- *"Tips on Trakalog DROP are voluntary contributions to support an artist. They are not
  purchases of digital goods."*
- *"Trakalog does not act as an intermediary in financial transactions. All payments are
  processed by Stripe directly between fan and artist."*
- *"Refunds are at the artist's discretion within 24 hours of the DROP end date, unless
  otherwise specified by local law."*

Each artist is solely responsible for declaring their tips for tax. Trakalog generates **a
downloadable annual report** ("you received $X in tips on Trakalog in YYYY") to make that
easier.

---

## 6. UX — artist side

### 6.1 Creating a DROP

A **"Create DROP"** button is available on the TrackDetail page (top, beside "Share") and in
the "…" menu on each track in the catalog.

Creation modal, three simple steps:

**Step 1 — Track & timing**

```
┌─────────────────────────────────────────────────────────┐
│   🎵 Create a DROP for "Crystal Eyes"                   │
│                                                          │
│   How many slots?                                        │
│   ○ 25  ● 50  ○ 100  ○ 250  ○ Unlimited                 │
│                                                          │
│   DROP ends on:                                          │
│   [📅 May 24, 2026 at 12:00 AM ▼]                        │
│   ☑ Use my official release date                         │
│                                                          │
│              [ Cancel ]    [ Next → ]                    │
└─────────────────────────────────────────────────────────┘
```

**Step 2 — Fan experience**

```
┌─────────────────────────────────────────────────────────┐
│   What do fans get?                                      │
│                                                          │
│   ☑ Stream the track before release (always on)         │
│   ☑ Download in HD (MP3 320kbps, watermarked)           │
│   ☑ HD cover art download                                │
│   ☑ Be credited on the Honor Wall after release          │
│   ☑ Get a thank-you email from you                       │
│   ☐ Personal voice message (record one — coming soon)    │
│                                                          │
│              [ ← Back ]    [ Next → ]                    │
└─────────────────────────────────────────────────────────┘
```

**Step 3 — Tipping (optional)**

```
┌─────────────────────────────────────────────────────────┐
│   💝 Allow fans to tip you?                              │
│                                                          │
│   ● Yes, with these suggestions: $0 $3 $7 $15            │
│   ○ No tipping for this DROP                             │
│                                                          │
│   Custom amount allowed?  ● Yes  ○ No                    │
│                                                          │
│   Require tip to download?  ○ Yes  ● No (free download) │
│                                                          │
│   100% of tips go directly to you.                       │
│   Trakalog takes 0% commission. Just Stripe fees (~3%).  │
│                                                          │
│              [ ← Back ]    [ Create DROP ✓ ]             │
└─────────────────────────────────────────────────────────┘
```

On "Create DROP": if there is no Stripe Connect account, redirect to Stripe onboarding (5
minutes maximum); otherwise the DROP is created and the artist lands on its dashboard with the
URL and a QR code.

### 6.2 DROP dashboard (real time)

The artist-side page at `/drops/:slug`:

```
┌──────────────────────────────────────────────────────────────┐
│  Crystal Eyes — Early Access                                  │
│  Status: 🟢 Active · Ends in 1d 14h                           │
│                                                                │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐│
│  │ 47/100 fans  │ $237 tips    │ 142 plays    │ 38 downloads ││
│  │ ●●●●●○○○○○   │ 100% to you  │ 3.0 per fan  │              ││
│  └──────────────┴──────────────┴──────────────┴─────────────┘│
│                                                                │
│  📋 Share URL:                                                 │
│  trakalog.com/d/crystal-eyes-early                            │
│  [ Copy ]  [ Download QR ]  [ Open ]                          │
│                                                                │
│  📊 Acquisition sources:                                       │
│  • Instagram (18 fans)     ████████░░░░                       │
│  • TikTok (14 fans)        ██████░░░░░░                       │
│  • Friend referrals (9)    ████░░░░░░░░                       │
│  • Direct (6)              ███░░░░░░░░░                       │
│                                                                │
│  🌍 Map of fans (geographic distribution)                      │
│  [interactive map with markers]                                │
│                                                                │
│  👥 Recent fans (real-time):                                   │
│  • Marie K. (Paris) · 2 plays · tipped $7 · 2 min ago         │
│  • James T. (London) · 4 plays · tipped $3 · 12 min ago       │
│  • Anna W. (Berlin) · 1 play · no tip · 23 min ago            │
│  • ... [see all supporters]                                    │
│                                                                │
│  [ Edit DROP ] [ Pause ] [ Export fans CSV ] [ Send message ] │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Real-time notifications

In-app and email notifications to the artist:

- On each new fan: *"Marie K. just joined your DROP!"*
- On each tip: *"💝 James T. tipped you $5 with the message 'Love this!'"*
- Milestones: *"🎉 You hit 50 fans!"*, *"🚀 100 fans reached — DROP is full"*
- End of DROP: *"Your DROP ended. 87 fans collected, $312 in tips. Your fan database is
  ready."*

### 6.4 Fan Pages (unlocked automatically after the first DROP)

After the first DROP, a new **"Fans"** section appears in the workspace sidebar:

```
┌─────────────────────────────────────────────────────────┐
│  👥 Your Fans (347 total)                                │
│                                                          │
│  By release:                                             │
│  • Crystal Eyes — 100 fans (May 22-24) [view]            │
│  • Last Light — 87 fans (Mar 15-17) [view]               │
│  • Midnight Run — 160 fans (Jan 8-10) [view]             │
│                                                          │
│  💎 Top supporters this year:                            │
│  1. Marie K. — $47 across 3 releases                     │
│  2. James T. — $23 across 2 releases                     │
│  3. Anna W. — $18 across 4 releases                      │
│                                                          │
│  📨 Newsletter actions:                                   │
│  [ Send to all fans ]  [ Send to top supporters ]        │
│  [ Send to fans of "Crystal Eyes" ]                      │
│                                                          │
│  [ Export all fans CSV ]  [ Create next DROP ]           │
└─────────────────────────────────────────────────────────┘
```

This is what turns Trakalog from a passive tool into **the artist's daily tool**. Every release
feeds their fan CRM.

---

## 7. UX — fan side

### 7.1 Entry page (gate screen)

URL: `trakalog.com/d/{slug}` — a page branded **100%** to the artist's workspace (hero image,
logo, brand colour). Trakalog appears only discreetly in the footer.

```
┌──────────────────────────────────────────────────────────┐
│                                                            │
│         [HERO IMAGE — artist's branded background]         │
│                                                            │
│         🎁 You're early.                                   │
│                                                            │
│   [Artist] releases "Crystal Eyes" on May 24.              │
│   You can hear it 48 hours before everyone else.           │
│                                                            │
│   Only 53 slots left out of 100.                           │
│                                                            │
│   ┌─────────────────────────────────────────────────┐    │
│   │  Tell me who you are:                            │    │
│   │                                                   │    │
│   │  Name:       [___________________]                │    │
│   │  Email:      [___________________]                │    │
│   │  City:       [___________________]                │    │
│   │  Phone (optional): [_______________]              │    │
│   │                                                   │    │
│   │  How did you find this?                           │    │
│   │  [ Instagram ▼ ]                                  │    │
│   │                                                   │    │
│   └─────────────────────────────────────────────────┘    │
│                                                            │
│   ┌─────────────────────────────────────────────────┐    │
│   │  💝 Support the artist (optional)                │    │
│   │                                                   │    │
│   │   ○ $0  ● $3  ○ $7  ○ $15  ○ Custom              │    │
│   │                                                   │    │
│   │   What you get if you tip:                       │    │
│   │   • Your name on the Honor Wall (post-release)   │    │
│   │   • HD cover art download                        │    │
│   │   • Personal thank-you message from the artist   │    │
│   │   • Lifetime "Early Fan #N" badge                │    │
│   │                                                   │    │
│   │   ✨ 100% goes directly to the artist.           │    │
│   │   Trakalog takes 0%.                             │    │
│   └─────────────────────────────────────────────────┘    │
│                                                            │
│           [ Get my access — $3 ]                           │
│                                                            │
│   By continuing, you agree to receive an email from        │
│   the artist. This is a voluntary contribution to support  │
│   them, not a purchase of digital goods.                   │
│                                                            │
│                          —                                 │
│              powered by Trakalog                           │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Streaming page (after signup + optional tip)

```
┌──────────────────────────────────────────────────────────┐
│         [HERO IMAGE artist branded]                        │
│                                                            │
│         🎉 You're Early Fan #47                            │
│                                                            │
│   ┌─────────────────────────────────────────────────┐    │
│   │  [COVER ART]                                     │    │
│   │  Crystal Eyes                                     │    │
│   │  [Artist]                                         │    │
│   │                                                   │    │
│   │  ▶ [waveform player]   2:14 / 3:42               │    │
│   │                                                   │    │
│   │  Releases officially in: 1d 14h 23m              │    │
│   └─────────────────────────────────────────────────┘    │
│                                                            │
│   [ Download HD (watermarked) ]  [ Download cover art ]   │
│                                                            │
│   📖 A note from the artist:                               │
│   "Thank you for being early. This song means the world   │
│    to me. Hope you enjoy it before everyone else."        │
│                                                            │
│   📤 Share with a friend:                                  │
│   [ Send invite link ]                                     │
│                                                            │
│   🛡️ Genesis Print verified · Human-Made                  │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

**Technical notes:**

- Streaming uses the existing invisible watermarking system, watermarked to the fan
- The download links to the fan's `watermark_hash` → automatic leak tracing
- The "Share" button generates a **unique invite link**: if a friend signs up through it, the
  referring fan receives a "you brought in a new fan" email and `acquisition_source` is set to
  `'friend_referral'`

### 7.3 Thank-you email (Resend, automatic)

Sent immediately after DROP signup:

```
Subject: 🎁 You're early — Crystal Eyes is yours

Hey Marie,

You're Early Fan #47 for "Crystal Eyes".

The song drops officially on May 24, but you can listen to it
right now: [Listen here →]

You can also download the HD version with your unique signature.

Thanks for being early. See you on release day.

—
This email was sent through Trakalog on behalf of the artist.
You can unsubscribe at any time.
```

### 7.4 Post-release email (Honor Wall reveal)

When the DROP ends — that is, at official release — every fan receives:

```
Subject: 🎉 Crystal Eyes is out — and you helped

Hey Marie,

It's out. "Crystal Eyes" is now live on all streaming platforms.

You were Early Fan #47. Your name is on the Honor Wall:
[See the Honor Wall →]

If you want to support the song, here's where to stream it:
[Spotify] [Apple Music] [YouTube]

Thanks for everything.
```

### 7.5 Honor Wall (public post-release page)

URL: `trakalog.com/d/{slug}/wall` — public, indexable by Google, shareable.

```
┌──────────────────────────────────────────────────────────┐
│         🏆 The Early Fans of "Crystal Eyes"               │
│                                                            │
│   These people heard it first. On May 22, 2026.            │
│                                                            │
│   #1 — Sarah M. (Paris) 💝                                 │
│   #2 — David L. (NYC) 💝💝                                 │
│   #3 — Marie K. (Berlin) 💝                                │
│   #4 — James T. (London)                                   │
│   #5 — Anna W. (Tokyo) 💝💝💝                              │
│   ...                                                      │
│   #100 — Sophie B. (Montreal)                              │
│                                                            │
│   💝 = supporter (tipped the artist)                       │
│                                                            │
│   🎵 Listen to Crystal Eyes:                                │
│   [Spotify] [Apple Music] [YouTube]                        │
│                                                            │
│   👀 Want to be early next time?                            │
│   [ Follow the artist on Trakalog ]                        │
└──────────────────────────────────────────────────────────┘
```

**Why the Honor Wall is viral:**

- Fans share their credited name on Instagram → free publicity for the artist and for Trakalog
- FOMO for the next DROP: *"I want to be on the Honor Wall too"*
- Free public recognition for the artist — zero cost, enormous identity value for the fan

---

## 8. Trakalog plans and access to DROP

> ⚠️ **Superseded prices.** The $14 / $29 / $59 figures below come from the abandoned
> workspace-based pricing. Current pricing is in
> [`TRAKALOG_BILLING.md`](../FEATURES/TRAKALOG_BILLING.md) v5.0: Starter $10, Pro $25,
> Business $45 monthly. This section has not been recalculated — read the ratios, not the
> amounts.

### Availability by plan

| Plan | DROPs available | Max slots per DROP | Honor Wall | Fan Pages CRM |
|---|---|---|---|---|
| **Free** | 1 lifetime | 25 fans | ✅ | ✅ Limited (25 fans total) |
| **Starter ($14/month)** | Unlimited | 100 fans | ✅ | ✅ |
| **Pro ($29/month)** | Unlimited | 500 fans | ✅ | ✅ Advanced (segments, newsletter) |
| **Business ($59/month)** | Unlimited | Unlimited | ✅ | ✅ Multi-artist analytics |

**Strategy:** DROP is deliberately available on Free with a hard limit — one lifetime DROP, 25
fans maximum. That turns DROP into a **viral acquisition machine**: an artist discovers
Trakalog → creates their first free DROP → sees the magic → upgrades to run a second.

**Stripe Connect** is available on every plan, Free included. Tipping is a universal feature.

**Trakalog NEVER takes a commission on tips, on any plan.** That is set in stone.

---

## 9. Terms & Conditions additions

### Section "DROP and tipping"

> *Tips on Trakalog DROP are voluntary contributions to support an artist. They are not
> purchases of digital goods or services.*
>
> *By tipping, you are making a personal donation to the artist. In exchange, the artist may
> grant you access to pre-release content, downloads, or other non-material rewards as a
> thank-you. These rewards have no determined commercial value and are at the artist's
> discretion.*
>
> *Trakalog does not act as a financial intermediary. All tip payments are processed by Stripe
> Inc., directly between you (the supporter) and the artist's Stripe Connect account. Trakalog
> does not hold, transfer, or own any of the funds.*
>
> *Trakalog applies a commission of 0% on all tips. Standard Stripe processing fees (~2.9% +
> $0.30 per transaction) apply and are deducted by Stripe before the artist receives the
> funds.*
>
> *Refunds are at the artist's sole discretion within 24 hours of the DROP end date, unless
> otherwise required by local law. To request a refund, contact the artist directly.*
>
> *The artist is solely responsible for declaring tips as income in their local tax
> jurisdiction. Trakalog provides annual reports of received tips to facilitate this
> declaration.*

### Section "Pre-release content access"

> *Pre-release content shared via Trakalog DROP is intended for the supporter's personal
> listening only. Downloads include invisible audio watermarking (Trakalog Watermarking
> technology) that identifies the original recipient.*
>
> *Unauthorized distribution, public sharing, or redistribution of pre-release content before
> the artist's official release date may result in legal action by the artist, and Trakalog
> will cooperate with leak tracing requests to identify the source of any leak.*

---

## 10. Implementation roadmap (2-3 weeks)

### Phase 1 — Backend infrastructure (4-5 days)

**Days 1-2: DB + RPCs**
SQL migration for `drops`, `drop_supporters`, `drop_tips`; `SECURITY DEFINER` RPCs
(`create_drop`, `register_drop_supporter`, `record_drop_play`, `record_drop_download`,
`complete_drop`, `cancel_drop`); `shared_links.drop_id` plus `share_type = 'drop'`; RLS
policies.

**Days 3-4: Stripe Connect**
Edge Functions `stripe-connect-onboarding-link` (Express account creation) and
`stripe-connect-account-status` (KYC completeness); `create-drop-tip-payment-intent`
(destination charge with `application_fee_amount = 0`); webhook handlers for
`payment_intent.succeeded` → insert into `drop_tips`, and `account.updated` → update
`workspaces.stripe_connect_account_id`.

**Day 5: Watermarking + audio**
Extend the existing watermarking logic to produce a per-supporter version; cache the
watermarked versions in the `watermarked` bucket.

### Phase 2 — Artist-side frontend (4-5 days)

**Days 6-7:** `CreateDropModal.tsx` (3-step wizard); `DropDashboard.tsx` (real-time via
Supabase Realtime); the `/drops/:slug` route.

**Days 8-9:** `FanPagesView.tsx` (fans by release); `TopSupportersWidget.tsx`; CSV export;
"Send newsletter" button with a Resend template modal.

**Day 10:** real-time toasts for new fans and tips; Resend email notifications; updates to the
existing notification centre.

### Phase 3 — Fan-side frontend (3-4 days)

**Days 11-12:** `PublicDropPage.tsx` (gate screen + tip + streaming), reusing SharedLinkPage
with extensions; workspace branding applied; Stripe Elements for tip checkout; watermarked
audio streaming.

**Day 13:** Resend templates — "You're early" (welcome), "Crystal Eyes is out" (post-release),
"Thank you for tipping" (tip confirmation).

**Day 14:** the public `/d/:slug/wall` page; SEO meta tags for social sharing; Open Graph image
generation.

### Phase 4 — Polish + launch (2-3 days)

**Days 15-16:** end-to-end testing — DROP creation → fan signup → Stripe tip → watermarked
download → leak tracing; multi-currency; refund flow; edge cases (full, expired, cancelled
DROP).

**Day 17:** the `trakalog.com/drop` marketing page; a 60-second TikTok launch video; help-centre
documentation.

**Total: 17 days, so 3-4 realistic weeks.**

---

## 11. TikTok launch demo script (60s)

**Hook (0-3s):** on-screen text — *"How indie artists build 100 fans before Spotify."*

**Setup (3-15s):** the artist shows their MacBook, drags a track into Trakalog, clicks "Create
DROP", the modal opens, they choose 100 slots, click "Create".

**Magic (15-35s):** split screen — on the left the artist posts the DROP to their Instagram
story; on the right five different fans scan and unlock. An on-screen counter races 0 → 12 → 28
→ 47 → 73 fans. *"$0 → $47 → $112 → $237 in tips. 100% to the artist."*

**Reveal (35-50s):** the artist opens their Fan Pages dashboard — 100 fans with verified
emails. On-screen text: *"100 real fans. Real emails. Real relationship. Zero algorithm."*

**Closer (50-60s):** Trakalog logo. *"Trakalog DROP. The only platform where 100% of tips go to
the artist."* CTA: *"trakalog.com/drop"*

---

## 12. KPIs to track

### Adoption
- % of active artists creating at least one DROP (target: 40% of Pro+ within the first 90 days)
- Average DROPs per artist per month (target: 1.5)
- Free → paid conversion after a first successful DROP (target: 25%)

### Fan engagement
- Slots used per DROP (average fill rate)
- Acquisition mix (Instagram / TikTok / referral / direct)
- Play rate (% of fans listening at least 30s)
- Download rate

### Monetisation
- Tip conversion rate (% of fans who tip)
- Average tip (target: $4-5)
- Total tips processed per month (Stripe volume)
- Marketing leverage: new Trakalog accounts created via DROPs (UTM tracking)

### Quality
- Refund rate (target: <2%)
- Leak detection events (watermarked tracks found outside Trakalog)
- Artist NPS (target: >50)

---

## 13. Risks and mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| Legal confusion between sale and donation | Medium | Explicit terms, Stripe Connect (never an intermediary), careful checkout wording |
| Stripe Connect onboarding friction | Medium | A smooth 5-minute flow, support ticket if KYC fails, email follow-up |
| Leak before official release | Low | Invisible per-fan watermarking + automatic leak tracing, explicit terms on consequences |
| Fan account abuse or fraud | Low | Email verification, rate limiting on signups, captcha beyond 5 fans per IP per hour |
| Confusion that "DROP is another app" | Low | Clear "Trakalog DROP" branding; a dedicated landing page reachable from trakalog.com |
| Dilution of the Trakalog narrative | Medium | DROP positioned as the fourth dimension alongside Catalog/Pitch/Provenance, never as the main product |
| Stripe fees hurting tip economics | Low | Let the fan optionally "cover the Stripe fees" (~$0.30 added), standard in the industry |

---

## 14. Dependencies and timing

### Blocking dependencies

- ✅ Shared links system
- ✅ Audio watermarking (via Railway)
- ✅ Workspace branding
- ✅ Engagement analytics
- 🔄 **Stripe billing & subscriptions** — the base integration now exists; **Stripe Connect
  does not** and is the real blocker, since tips depend on it
- 🔄 **Cloudflare R2 migration** — the storage abstraction and the R2 provider **are
  implemented** (`supabase/functions/_shared/storage.ts`, plus `scripts/test-r2-parity.ts`),
  and CLAUDE.md lists the five R2 buckets as live infrastructure. Whether the bulk data
  migration has fully run is not determinable from the repository — confirm before relying on
  it. Not a blocker either way; it reduces bandwidth cost as fans download

### Optional dependencies (they strengthen DROP)

- ⏳ **Genesis Print** — adds the "Human-Made" badge to the DROP page, raising perceived value
- ⏳ **SIGNAL** — a track with a successful DROP already has a fan base, a bonus for supervisors

### Recommended order in the global roadmap

1. **Stripe billing** — highest priority, blocks the beta launch
2. **DROP** — 2-3 weeks, immediately after Stripe
3. **Public beta launch** with DROP as the wow feature → TikTok video + landing page
4. **Cloudflare R2 migration** — the provider layer is built; confirm the data migration status
5. **Admin dashboard** — to track DROP KPIs in real time
6. **Genesis MVP** — strategic phase 3
7. **SIGNAL** — strategic phase 4

---

## 15. Strategic recap

**DROP is Trakalog's fourth dimension:**

1. **Catalog** — organise your work
2. **Pitch** — sell your work to professionals (A&R, supervisors)
3. **Provenance** — certify your work (Genesis, future)
4. **Fan-bond** — give your work to your fans before anyone else (DROP) ← new

**Why DROP is the perfect wow feature:**

- ✅ Serves every artist, from bedroom producer to label — not only studio sessions
- ✅ Buildable in 2-3 weeks, reusing 80% of existing infrastructure
- ✅ No dependency on paid metadata APIs
- ✅ No extensive human intervention — the fan self-serves
- ✅ Instantly demonstrable in a 60-second TikTok
- ✅ Deeply emotional for fans, strategic for artists
- ✅ Viral by construction (Honor Wall + fan sharing)
- ✅ Creates a marketing argument unique in the world (0% commission)
- ✅ Becomes Trakalog's principal acquisition funnel
- ✅ Nobody is doing this in 2026

**Trakalog becomes:**

- On the B2B side: catalog management + pitch + provenance — for the music career
- On the D2C side (new, with DROP): fan collection + pre-release + direct-to-fan — for the music
  community

**One platform. Two markets. Four dimensions. One clear mission: make the catalog work.**

---

*This document is living, and will be updated as development proceeds.*
