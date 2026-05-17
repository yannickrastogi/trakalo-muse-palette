# TRAKALOG — DROP (Pre-Release Fan Collection Module)

> **Document créé le :** 17 mai 2026
> **Statut :** Spec prête à implémenter — après Stripe/Billing
> **Priorité :** Wow feature pour le beta launch public
> **Positionnement :** DROP est un MODULE de Trakalog, pas une plateforme distincte. Il réutilise 100% de l'infrastructure existante (shared links, watermarking, branding, gate screen, engagement analytics, Stripe Connect).

---

## 1. Vision

**Problème universel résolu :** En 2026, tous les artistes ont le même problème de release. Leur track sort sur Spotify, l'algorithme garde la data des fans, l'artiste reçoit 0.003€ par stream, et personne ne sait qui sont ses vrais fans. C'est le mouvement "buzz to bond" identifié par toute l'industrie : les artistes doivent **posséder leur relation directe avec leurs fans**, pas la louer aux plateformes.

**Solution Trakalog DROP :** Avant qu'une track sorte officiellement sur les DSPs, l'artiste crée un **DROP privé** — un accès anticipé exclusif pour 50-250 fans. Les fans donnent leurs coordonnées (nom, email, ville), reçoivent un lien streaming branded, peuvent tipper l'artiste librement, et reçoivent leur version watermarkée téléchargeable. À la fin du DROP, l'artiste a 100 vrais fans qualifiés dans son CRM, prêts à streamer le jour de la release officielle.

**Le pitch en une phrase :** *"Construis 100 vrais fans avant ta release Spotify. Trakalog DROP — la seule plateforme où 100% des tips vont à l'artiste."*

---

## 2. Pourquoi DROP est un module de Trakalog (pas une autre app)

**Test du job-to-be-done :** La mission Trakalog est *"faire travailler le catalogue"*. DROP fait exactement ça — il transforme une track pré-release dormante en machine à fan database. C'est dans la mission, pas à côté.

**Test du fan-experience :** Le fan ne "utilise" pas Trakalog. Il ouvre une page brandée à 100% aux couleurs de l'artiste, avec un discret "powered by Trakalog" en bas. L'artiste utilise Trakalog ; les fans consomment l'expérience que l'artiste produit avec Trakalog. C'est strictement le même pattern que les shared links B2B existants (les A&R qui reçoivent les liens ne deviennent pas "users Trakalog" non plus).

**Test technique :** DROP réutilise tout ce qui existe déjà :
- Shared links (infrastructure des URLs uniques + gate screen)
- Watermarking invisible per-visitor (Railway audiowmark service)
- Engagement analytics (plays, downloads, geographic)
- Auto-collection des contacts (gate screen → table contacts)
- Branding workspace (hero image, logo, brand color, socials)
- Genesis Print (futur — human attestation pour authenticité)
- Stripe Connect (en cours pour Billing)
- Resend email branding
- Notification system

**Rien de nouveau techniquement.** DROP est un **réarrangement marketing intelligent** de tout ce que tu as déjà.

**Guard-rail anti-dérive :** DROP est positionné comme **la 4ème dimension** de Trakalog (après Catalog, Pitch, Provenance). Il ne devient JAMAIS le centre narratif de la plateforme. Trakalog reste un produit B2B premium pour créateurs musicaux, avec DROP comme module accrocheur visible dans les plans et sur une landing page dédiée `trakalog.com/drop`.

---

## 3. Architecture du module

### Vue d'ensemble

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

### Réutilisation des composants existants

| Composant existant | Réutilisation dans DROP |
|---|---|
| `shared_links` table | Nouveau `share_type = 'drop'` |
| Gate screen | Étendu avec : city, acquisition_source, tip_amount |
| `contacts` auto-collect | Auto-collect des fans (nouveau type : 'fan') |
| Watermarking audio | Idem (chaque fan reçoit version watermarkée) |
| Branding workspace | Hero + logo + brand color appliqués à la page DROP |
| Engagement analytics | Plays/downloads/geographic par fan |
| Resend email | Thank-you email + release notification |
| Stripe Connect | Tips via destination charges (Trakalog 0% commission) |
| Genesis Print (futur) | Affichage du badge "Human-Made" sur la page DROP |

---

## 4. Tables DB additionnelles

```sql
-- Table principale : un DROP par release pré-release
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
  tip_total_cents integer NOT NULL DEFAULT 0,   -- aggregated for fast dashboard
  
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

-- Table des fans qui ont participé à un DROP
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
  
  -- Behavior
  joined_at timestamptz DEFAULT now(),
  first_play_at timestamptz,
  play_count integer NOT NULL DEFAULT 0,
  total_listen_seconds integer NOT NULL DEFAULT 0,
  downloaded_at timestamptz,
  share_count integer NOT NULL DEFAULT 0,
  
  -- Audio watermarking trace
  watermark_hash text,                          -- links to watermark_payloads
  
  -- Honor Wall
  display_name text,                            -- can be pseudo if fan wants privacy
  show_on_honor_wall boolean NOT NULL DEFAULT true,
  
  -- Slot number (Early Fan #N / total)
  slot_number integer NOT NULL,                 -- 1, 2, 3...
  
  UNIQUE(drop_id, email)
);

CREATE INDEX idx_drop_supporters_drop ON drop_supporters(drop_id);
CREATE INDEX idx_drop_supporters_contact ON drop_supporters(contact_id);
CREATE INDEX idx_drop_supporters_email ON drop_supporters(email);

-- Table des tips (paiements Stripe Connect)
CREATE TABLE drop_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  supporter_id uuid NOT NULL REFERENCES drop_supporters(id) ON DELETE CASCADE,
  
  -- Stripe
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  stripe_connect_account_id text NOT NULL,      -- artist's Stripe Connect account
  
  -- Amounts (cents)
  amount_cents integer NOT NULL,                -- what fan paid
  stripe_fee_cents integer NOT NULL DEFAULT 0,
  artist_received_cents integer NOT NULL,       -- what artist actually got (amount - stripe_fee)
  trakalog_fee_cents integer NOT NULL DEFAULT 0, -- ALWAYS 0 for tips (zero commission policy)
  currency text NOT NULL DEFAULT 'usd',
  
  -- State
  status text NOT NULL DEFAULT 'pending',       -- pending / succeeded / failed / refunded
  refunded_at timestamptz,
  refund_reason text,
  
  -- Optional message from fan
  message text,                                 -- "love your work, can't wait!"
  is_public_message boolean NOT NULL DEFAULT false,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_drop_tips_drop ON drop_tips(drop_id);
CREATE INDEX idx_drop_tips_supporter ON drop_tips(supporter_id);
CREATE INDEX idx_drop_tips_stripe ON drop_tips(stripe_payment_intent_id);

-- Extension du gate screen captures
ALTER TABLE shared_links ADD COLUMN IF NOT EXISTS drop_id uuid REFERENCES drops(id) ON DELETE SET NULL;
```

### RLS policies

Drops : visibles uniquement par le workspace owner et les membres avec `access_level >= 'pitcher'`.
Drop_supporters : SELECT pour le workspace, INSERT via RPC `register_drop_supporter` (SECURITY DEFINER).
Drop_tips : SELECT pour le workspace, INSERT via Stripe webhook (Edge Function service role).

### RPCs nécessaires (toutes SECURITY DEFINER avec `_user_id`)

| RPC | Description |
|---|---|
| `create_drop(_user_id, _workspace_id, _track_id, _config jsonb)` | Crée un DROP + son shared_link associé |
| `update_drop(_user_id, _drop_id, _updates jsonb)` | Modifie la config (slots, ends_at, tip suggestions) |
| `register_drop_supporter(_drop_id, _fan_data jsonb)` | Inscription d'un fan (vérifie slots disponibles, crée contact, retourne slot_number) |
| `record_drop_play(_supporter_id)` | Incrémente play_count |
| `record_drop_download(_supporter_id, _watermark_hash)` | Marque downloaded_at + lie au watermark |
| `get_drop_honor_wall(_slug)` | Public RPC : retourne la liste des Early Fans (display_name uniquement, ceux qui ont opt-in) |
| `cancel_drop(_user_id, _drop_id)` | Annule un DROP en cours |
| `complete_drop(_user_id, _drop_id)` | Marque un DROP comme terminé (déclenche release notifications) |

---

## 5. Stripe Connect : la mécanique du tip à 0% commission

### Architecture Stripe

Chaque artiste a son propre **Stripe Connect Express account** (KYC géré par Stripe directement, pas par Trakalog). Trakalog n'est jamais "payment processor", juste une plateforme qui facilite la connexion.

**Mode de charge :** `destination_charge` avec `application_fee_amount = 0`.

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

**Pourquoi 0% est stratégiquement génial :**
- Patreon prend 5-12%, Bandcamp 10-15%, Kickstarter 8-10%
- Trakalog se positionne comme **la seule plateforme au monde où 100% du tip va à l'artiste**
- Ça devient l'argument marketing #1 de DROP
- Trakalog monétise ailleurs (abonnement Pro $29/mois, futur SIGNAL commission 10-15%, futur Genesis enterprise API)
- Sacrifice estimé : ~$32/mois par artiste actif faisant 1 DROP/mois → narrative qui distingue Trakalog de tout le marché

### Stripe Connect onboarding flow

```
Artist clicks "Create DROP" for the first time
  → If no Stripe Connect account exists
    → Edge Function: stripe-connect-onboarding-link
      → Returns Stripe-hosted onboarding URL
        → Artist completes KYC on Stripe (1-5 minutes)
          → Webhook account.updated → updates workspaces.stripe_connect_account_id
            → Returns to Trakalog with DROP creation modal opened
  → If Stripe Connect account exists → directly to DROP creation
```

### Important — Aspect juridique

Les CGU Trakalog mentionnent explicitement :
- *"Tips on Trakalog DROP are voluntary contributions to support an artist. They are not purchases of digital goods."*
- *"Trakalog does not act as an intermediary in financial transactions. All payments are processed by Stripe directly between fan and artist."*
- *"Refunds are at the artist's discretion within 24 hours of the DROP end date, unless otherwise specified by local law."*

Chaque artiste est seul responsable de la déclaration fiscale de ses tips. Trakalog génère **un rapport annuel téléchargeable** ("vous avez reçu $X en tips sur Trakalog en YYYY") pour faciliter leurs impôts.

---

## 6. UX — Côté artiste

### 6.1 Création d'un DROP

Bouton **"Create DROP"** disponible sur :
- TrackDetail page (en haut, à côté de "Share")
- Catalog page : menu "..." sur chaque track

Modal de création (3 étapes simples) :

**Étape 1 — Track & Timing**
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

**Étape 2 — Fan experience**
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

**Étape 3 — Tipping (optional)**
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

Au clic sur "Create DROP" :
- Si pas de Stripe Connect : redirection vers Stripe onboarding (5 min max)
- Sinon : DROP créé, redirection vers le dashboard du DROP avec URL + QR code

### 6.2 Dashboard d'un DROP (temps réel)

Page `/drops/:slug` côté artiste :

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
│  [Carte interactive avec markers]                              │
│                                                                │
│  👥 Recent fans (real-time):                                   │
│  • Marie K. (Paris) · 2 plays · tipped $7 · 2 min ago         │
│  • James T. (London) · 4 plays · tipped $3 · 12 min ago       │
│  • Anna W. (Berlin) · 1 play · no tip · 23 min ago            │
│  • ... [voir tous les supporters]                              │
│                                                                │
│  [ Edit DROP ] [ Pause ] [ Export fans CSV ] [ Send message ] │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Notifications temps réel

Notification in-app + email à l'artiste :
- À chaque nouveau fan : *"Marie K. just joined your DROP!"*
- À chaque tip : *"💝 James T. tipped you $5 with the message 'Love this!'"*
- Milestones : *"🎉 You hit 50 fans!"*, *"🚀 100 fans reached — DROP is full"*
- Fin du DROP : *"Your DROP ended. 87 fans collected, $312 in tips. Your fan database is ready."*

### 6.4 Fan Pages (unlock automatique après le 1er DROP)

Après le premier DROP, une nouvelle section **"Fans"** apparaît dans le sidebar workspace :

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

C'est ce qui transforme Trakalog d'un outil "passif" en **l'outil quotidien de l'artiste**. Chaque release nourrit son CRM fans.

---

## 7. UX — Côté fan

### 7.1 Page d'entrée (gate screen)

URL : `trakalog.com/d/{slug}` — page **branded à 100%** au workspace de l'artiste (hero image, logo, brand color). Trakalog n'apparaît que discrètement en footer.

```
┌──────────────────────────────────────────────────────────┐
│                                                            │
│         [HERO IMAGE — artist's branded background]         │
│                                                            │
│         🎁 You're early.                                   │
│                                                            │
│   Yannick releases "Crystal Eyes" on May 24.               │
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
│   │  💝 Support Yannick (optional)                   │    │
│   │                                                   │    │
│   │   ○ $0  ● $3  ○ $7  ○ $15  ○ Custom              │    │
│   │                                                   │    │
│   │   What you get if you tip:                       │    │
│   │   • Your name on the Honor Wall (post-release)   │    │
│   │   • HD cover art download                        │    │
│   │   • Personal thank-you message from Yannick      │    │
│   │   • Lifetime "Early Fan #N" badge                │    │
│   │                                                   │    │
│   │   ✨ 100% goes directly to Yannick.              │    │
│   │   Trakalog takes 0%.                             │    │
│   └─────────────────────────────────────────────────┘    │
│                                                            │
│           [ Get my access — $3 ]                           │
│                                                            │
│   By continuing, you agree to receive an email from        │
│   Yannick. This is a voluntary contribution to support     │
│   the artist, not a purchase of digital goods.             │
│                                                            │
│                          —                                 │
│              powered by Trakalog                           │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Page de streaming (après inscription + tip optionnel)

```
┌──────────────────────────────────────────────────────────┐
│         [HERO IMAGE artist branded]                        │
│                                                            │
│         🎉 You're Early Fan #47                            │
│                                                            │
│   ┌─────────────────────────────────────────────────┐    │
│   │  [COVER ART]                                     │    │
│   │  Crystal Eyes                                     │    │
│   │  Yannick                                          │    │
│   │                                                   │    │
│   │  ▶ [waveform player]   2:14 / 3:42               │    │
│   │                                                   │    │
│   │  Releases officially in: 1d 14h 23m              │    │
│   └─────────────────────────────────────────────────┘    │
│                                                            │
│   [ Download HD (watermarked) ]  [ Download cover art ]   │
│                                                            │
│   📖 A note from Yannick:                                  │
│   "Thank you for being early. This song means the world   │
│    to me. Hope you enjoy it before everyone else."        │
│                                                            │
│   📤 Share Yannick with a friend:                          │
│   [ Send invite link ]                                     │
│                                                            │
│   🛡️ Genesis Print verified · Human-Made                  │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

**Notes importantes côté technique :**
- Le streaming utilise le système watermarking invisible existant (audio watermarké au nom du fan)
- Le download est lié au `watermark_hash` du fan → leak tracing automatique
- Le bouton "Share Yannick" génère un **lien d'invitation unique** : si un ami s'inscrit via ce lien, le fan referrer reçoit un email "tu as ramené un nouveau fan" + acquisition_source = 'friend_referral'

### 7.3 Email de remerciement (Resend, automatique)

Après inscription au DROP, le fan reçoit immédiatement :

```
Subject: 🎁 You're early — Crystal Eyes is yours

Hey Marie,

You're Early Fan #47 for "Crystal Eyes" by Yannick.

The song drops officially on May 24, but you can listen to it
right now: [Listen here →]

You can also download the HD version with your unique signature.

Thanks for being early. See you on release day.

— Yannick

—
This email was sent through Trakalog on behalf of Yannick.
You can unsubscribe at any time.
```

### 7.4 Email post-release (Honor Wall reveal)

Au moment où le DROP se termine (= release officielle), tous les fans reçoivent :

```
Subject: 🎉 Crystal Eyes is out — and you helped

Hey Marie,

It's out. "Crystal Eyes" is now live on all streaming platforms.

You were Early Fan #47. Your name is on the Honor Wall:
[See the Honor Wall →]

If you want to support the song, here's where to stream it:
[Spotify] [Apple Music] [YouTube]

Thanks for everything.

— Yannick
```

### 7.5 Honor Wall (page publique post-release)

URL : `trakalog.com/d/{slug}/wall` — publique, indexable par Google, partageable.

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
│   [ Follow Yannick on Trakalog ]                           │
└──────────────────────────────────────────────────────────┘
```

**Pourquoi le Honor Wall est viral :**
- Les fans partagent leur nom credité sur Instagram → pub gratuite pour l'artiste et Trakalog
- Effet FOMO sur le prochain DROP : *"je veux être sur le Honor Wall moi aussi"*
- Reconnaissance publique gratuite pour l'artiste (zéro coût, valeur identitaire énorme pour le fan)

---

## 8. Plans Trakalog et accès à DROP

### Disponibilité par plan

| Plan | DROPs disponibles | Slots max par DROP | Honor Wall | Fan Pages CRM |
|---|---|---|---|---|
| **Free** | 1 à vie | 25 fans | ✅ | ✅ Limité (25 fans total max) |
| **Starter ($14/mois)** | Illimité | 100 fans | ✅ | ✅ |
| **Pro ($29/mois)** | Illimité | 500 fans | ✅ | ✅ Avancé (segments, newsletter) |
| **Business ($59/mois)** | Illimité | Unlimited | ✅ | ✅ Multi-artist analytics |

**Stratégie :** DROP est volontairement accessible sur Free avec une limite forte (1 DROP à vie, max 25 fans). C'est ce qui transforme DROP en **machine d'acquisition virale** : un artiste découvre Trakalog → crée son premier DROP gratuit → voit la magie → upgrade pour faire le 2ème.

**Stripe Connect** : disponible sur tous les plans (incl. Free). Le tip est une feature universelle.

**Trakalog ne prend JAMAIS de commission sur les tips, peu importe le plan.** C'est gravé dans le marbre.

---

## 9. CGU additions

À ajouter dans les Terms & Conditions Trakalog :

### Section "DROP and tipping"

> *Tips on Trakalog DROP are voluntary contributions to support an artist. They are not purchases of digital goods or services.*
>
> *By tipping, you are making a personal donation to the artist. In exchange, the artist may grant you access to pre-release content, downloads, or other non-material rewards as a thank-you. These rewards have no determined commercial value and are at the artist's discretion.*
>
> *Trakalog does not act as a financial intermediary. All tip payments are processed by Stripe Inc., directly between you (the supporter) and the artist's Stripe Connect account. Trakalog does not hold, transfer, or own any of the funds.*
>
> *Trakalog applies a commission of 0% on all tips. Standard Stripe processing fees (~2.9% + $0.30 per transaction) apply and are deducted by Stripe before the artist receives the funds.*
>
> *Refunds are at the artist's sole discretion within 24 hours of the DROP end date, unless otherwise required by local law. To request a refund, contact the artist directly.*
>
> *The artist is solely responsible for declaring tips as income in their local tax jurisdiction. Trakalog provides annual reports of received tips to facilitate this declaration.*

### Section "Pre-release content access"

> *Pre-release content shared via Trakalog DROP is intended for the supporter's personal listening only. Downloads include invisible audio watermarking (Trakalog Watermarking technology) that identifies the original recipient.*
>
> *Unauthorized distribution, public sharing, or redistribution of pre-release content before the artist's official release date may result in legal action by the artist, and Trakalog will cooperate with leak tracing requests to identify the source of any leak.*

---

## 10. Implementation roadmap (2-3 semaines)

### Phase 1 — Backend infrastructure (4-5 jours)

**Day 1-2: DB + RPCs**
- Migration SQL : tables `drops`, `drop_supporters`, `drop_tips`
- RPCs SECURITY DEFINER : `create_drop`, `register_drop_supporter`, `record_drop_play`, `record_drop_download`, `complete_drop`, `cancel_drop`
- Extension `shared_links.drop_id` + `share_type = 'drop'`
- RLS policies

**Day 3-4: Stripe Connect**
- Edge Function `stripe-connect-onboarding-link` (création account Express)
- Edge Function `stripe-connect-account-status` (check KYC complet)
- Edge Function `create-drop-tip-payment-intent` (destination_charge avec app_fee=0)
- Webhook handler pour `payment_intent.succeeded` → insert dans `drop_tips`
- Webhook handler pour `account.updated` → mise à jour `workspaces.stripe_connect_account_id`

**Day 5: Watermarking + audio**
- Extension de la logique watermarking existante pour générer une version per-supporter
- Cache des versions watermarkées dans bucket Supabase ou R2 (future migration)

### Phase 2 — Frontend artist side (4-5 jours)

**Day 6-7: Création + dashboard**
- Composant `CreateDropModal.tsx` (3 étapes wizard)
- Composant `DropDashboard.tsx` (real-time avec Supabase Realtime)
- Page route `/drops/:slug` côté artiste

**Day 8-9: Fan Pages CRM**
- Composant `FanPagesView.tsx` (liste des fans par release)
- Composant `TopSupportersWidget.tsx`
- Export CSV des fans
- Bouton "Send newsletter" (modal avec template Resend)

**Day 10: Notifications**
- Real-time toast pour nouveaux fans / tips
- Notifications email via Resend
- Updates du notification center existant

### Phase 3 — Frontend fan side (3-4 jours)

**Day 11-12: Page DROP publique**
- Composant `PublicDropPage.tsx` (gate screen + tip + streaming)
- Réutilisation de SharedLinkPage avec extensions
- Branding workspace appliqué
- Stripe Elements pour le tip checkout
- Watermarking audio streaming

**Day 13: Email templates**
- Template Resend "You're early" (welcome)
- Template "Crystal Eyes is out" (post-release notification)
- Template "Thank you for tipping" (tip confirmation)

**Day 14: Honor Wall**
- Page publique `/d/:slug/wall`
- SEO meta tags pour partage social
- Open Graph image generation

### Phase 4 — Polish + launch (2-3 jours)

**Day 15-16: Testing end-to-end**
- Test flow complet : création DROP → fan inscription → tip Stripe → download watermarké → leak tracing
- Test multi-currency
- Test refund flow
- Test edge cases (DROP plein, expiré, annulé)

**Day 17: Landing page + demo**
- Page marketing `trakalog.com/drop`
- Vidéo TikTok 60s pour le launch
- Documentation help center

**Total : 17 jours = 3-4 semaines réalistes avec Claude Code**

---

## 11. Script de démo TikTok pour le launch (60s)

**Hook (0-3s) :**
*Texte à l'écran : "How indie artists build 100 fans before Spotify."*

**Setup (3-15s) :**
- L'artiste (Yannick) montre son MacBook
- Il drag une track dans Trakalog
- Il clique "Create DROP"
- Modal s'ouvre, il choisit 100 slots
- Clic "Create"

**Magic (15-35s) :**
- Split-screen : à gauche, l'artiste poste son DROP sur sa story Instagram. À droite, 5 fans différents scannent et débloquent.
- Compteur à l'écran qui passe de 0 → 12 → 28 → 47 → 73 fans en accéléré
- "$0 → $47 → $112 → $237 in tips. 100% to the artist."

**Reveal (35-50s) :**
- L'artiste ouvre son dashboard Fan Pages
- Liste de 100 fans avec emails verified
- Texte à l'écran : *"100 real fans. Real emails. Real relationship. Zero algorithm."*

**Closer (50-60s) :**
- Logo Trakalog
- Texte : *"Trakalog DROP. The only platform where 100% of tips go to the artist."*
- CTA : *"trakalog.com/drop"*

---

## 12. KPIs à tracker

### Adoption
- % d'artistes actifs créant au moins 1 DROP (cible : 40% des Pro+ dans les 90 premiers jours)
- Nombre moyen de DROPs par artiste par mois (cible : 1.5)
- Conversion Free → paid après un premier DROP réussi (cible : 25%)

### Engagement fans
- Slots utilisés par DROP (taux de remplissage moyen)
- Acquisition mix (Instagram / TikTok / referral / direct)
- Play rate (% des fans qui écoutent au moins 30s)
- Download rate (% des fans qui téléchargent)

### Monétisation
- Tip conversion rate (% des fans qui tippent)
- Tip moyen (cible : $4-5)
- Total tips processed par mois (volume Stripe)
- Marketing leverage : combien de nouveaux comptes Trakalog créés via des DROPs (UTM tracking)

### Quality
- Refund rate (cible : <2%)
- Leak detection events (combien de tracks watermarkées retrouvées hors Trakalog)
- NPS artist (cible : >50)

---

## 13. Risques et mitigations

| Risque | Probabilité | Mitigation |
|---|---|---|
| Confusion juridique vente vs don | Moyenne | CGU explicites, Stripe Connect (jamais intermédiaire), wording sur la page de checkout |
| Stripe Connect onboarding friction | Moyenne | Onboarding fluide 5 min max, support ticket si KYC fail, accompagnement par email |
| Leak avant release officielle | Faible | Watermarking invisible per-fan + leak tracing automatique, CGU explicites sur les conséquences |
| Abus / fraude fan accounts | Faible | Email verification, rate limiting sur inscriptions, captcha au-delà de 5 fans/IP en 1h |
| Confusion "DROP est une autre app" | Faible | Branding clair "Trakalog DROP", landing page dédiée mais accessible depuis trakalog.com |
| Dilution narrative Trakalog | Moyenne | DROP positionné comme la 4ème dimension parmi Catalog/Pitch/Provenance, jamais comme le produit principal |
| Stripe fees impact tip economics | Faible | Option pour le fan de "cover the Stripe fees" (~$0.30 added to tip), standard dans l'industrie |

---

## 14. Dépendances et timing

### Dépendances bloquantes (à finir avant DROP)
- ✅ Shared links system (existant)
- ✅ Watermarking audio (existant via Railway)
- ✅ Branding workspace (existant)
- ✅ Engagement analytics (existant)
- 🔄 **Stripe Billing & Subscriptions** (en cours — bloquant car Stripe Connect partage la même infra)
- 🔄 **Cloudflare R2 storage migration** (souhaitable mais pas bloquant — réduira les coûts de bande passante avec les fans qui téléchargent)

### Dépendances optionnelles (renforcent DROP)
- ⏳ **Genesis Print** : ajoute le badge "Human-Made" sur la page DROP, encore plus de valeur perçue
- ⏳ **SIGNAL** : un track avec DROP réussi a déjà une fan base = bonus pour les supervisors qui regardent

### Ordre recommandé dans la roadmap globale
1. **Stripe Billing** (priorité absolue, bloquant beta launch) — 3-4 semaines
2. **DROP** — 2-3 semaines (immédiatement après Stripe)
3. **Beta public launch** avec DROP comme wow feature → vidéo TikTok + landing page
4. **Cloudflare R2 migration** — après mesurer la consommation post-launch
5. **Admin Dashboard** — pour suivre les KPIs DROP en temps réel
6. **Genesis MVP** — Phase 3 stratégique
7. **SIGNAL** — Phase 4 stratégique

---

## 15. Récap stratégique

**DROP est la 4ème dimension de Trakalog :**
1. **Catalog** — organiser ton œuvre
2. **Pitch** — vendre ton œuvre aux pros (A&R, supervisors)
3. **Provenance** — certifier ton œuvre (Genesis, futur)
4. **Fan-bond** — donner ton œuvre à tes fans avant tout le monde (DROP) ← nouveau

**Pourquoi DROP est le wow feature parfait :**
- ✅ Sert tous les artistes (bedroom producer → label, pas seulement les sessions studio)
- ✅ Réalisable en 2-3 semaines (réutilise 80% de l'infra existante)
- ✅ Aucune dépendance à des APIs metadata payantes
- ✅ Aucune intervention humaine extensive (le fan se gère seul)
- ✅ Démontrable instantanément en vidéo TikTok 60s
- ✅ Hyper émotionnel pour les fans, stratégique pour les artistes
- ✅ Viral par construction (Honor Wall + partages fans)
- ✅ Crée un argument marketing unique au monde (0% commission)
- ✅ Devient le funnel d'acquisition principal de Trakalog
- ✅ Personne ne fait ça aujourd'hui en 2026

**Trakalog devient :**
- Côté B2B : la gestion catalogue + pitch + provenance — pour la carrière musicale
- Côté D2C (nouveau avec DROP) : la collecte de fans + pré-release + direct-to-fan — pour la communauté musicale

**Une plateforme. Deux marchés. Quatre dimensions. Une mission claire : faire travailler le catalogue.**

---

*Ce document est vivant. Il sera mis à jour au fur et à mesure du développement.*
