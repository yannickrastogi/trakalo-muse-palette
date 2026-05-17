# TRAKALOG — SIGNAL

> **Document créé le :** 17 mai 2026
> **Objectif :** Créer la première marketplace inverse de l'industrie musicale — les music supervisors postent des micro-briefs, l'IA Trakalog matche silencieusement les catalogues, les artistes reçoivent uniquement des opportunités qualifiées.
> **Statut :** Concept stratégique — lancement 6-9 mois après le beta public (nécessite Genesis MVP + masse critique catalogue)
> **Vision :** *"Les artistes ne pitchent plus. Ils sont matchés. Les supervisors ne sont plus submergés. Ils reçoivent uniquement ce qu'ils ont demandé."*

---

## 1. Pourquoi SIGNAL — Le marché en 2026

### Le problème central
L'industrie musicale a évolué : la distribution n'est plus le moat, la production non plus. Le vrai bottleneck est la **rencontre entre l'offre et la demande qualifiée**.

**Côté offre** : Spotify reçoit ~120 000 tracks par jour. Les artistes indépendants représentent désormais 35% du marché global. Chaque artiste peut produire, distribuer et partager pour moins de 50€/an.

**Côté demande** : 
- Un music supervisor reçoit **plusieurs centaines de pitches par semaine** et n'en écoute environ que 10%
- Les timelines de production se sont effondrées : les shows qui avaient des semaines pour la music supervision ont désormais des jours, les pubs décident la semaine d'avant lancement
- Les A&R, publishers, brand managers, podcasteurs, game studios, content creators — tous cherchent constamment de la musique fraîche et clearable rapidement
- **Aucun canal propre n'existe** pour exprimer leurs besoins sans se faire spammer

### Les solutions actuelles sont toutes mauvaises

| Solution | Problème |
|---|---|
| **Disco / Sound Credit** | Outils de stockage, pas de marketplace. Les supervisors continuent à recevoir des centaines de pitches non sollicités |
| **Songtradr / Musicbed / Marmoset** | Libraries traditionnelles : l'artiste signe et perd le contrôle, les briefs restent fermés |
| **Sync agents personnels** | Coûteux (15-25% de commission), inaccessibles aux indés, ne scalent pas |
| **Email cold pitch** | Taux de réponse <1%, fatigue mentale des deux côtés, aucune traçabilité |
| **Plateformes de briefs publics (Taxi, Music Gateway)** | Briefs génériques sans matching IA, accessibles à tous donc même volume de spam |

### Le vide à combler
Il manque une **marketplace inversée** où la demande est exprimée par le supervisor (pas par l'artiste), et où la rencontre est filtrée par une IA qui comprend vraiment la musique. C'est précisément ce que **Sonic DNA + Genesis** rendent possible. Aucun concurrent n'a les deux briques.

---

## 2. La proposition de valeur

### Pour le music supervisor / A&R / brand manager
> *"Postez votre brief en 2 minutes. Recevez le matin 5-15 tracks ultra-qualifiées avec rights pré-clearés et preuve de paternité humaine. Pas de spam, pas de chasse, pas de négo de droits compliquée."*

### Pour l'artiste / producteur / label
> *"Votre catalogue travaille pendant que vous dormez. Quand un supervisor cherche quelque chose qui ressemble à votre son, vous recevez UNE notification. Un clic pour proposer votre track. Aucun pitch à écrire. Aucune relation à entretenir."*

### Pour Trakalog
> *"La première marketplace musicale où la demande paie. Commission sur chaque deal facilité. Effet réseau pur : plus de supervisors → plus d'artistes → plus de matches → plus de deals."*

---

## 3. La mécanique end-to-end

### Étape 1 — Le supervisor poste un brief (2 minutes)

Interface ultra-simple, 4 champs :

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

Le supervisor paye un **posting fee** au moment de poster (entre $50 et $500 selon urgence + budget — voir section 8 Business Model). Ce fee filtre les briefs sérieux des curieux, et finance la plateforme côté demande.

### Étape 2 — Trakalog SIGNAL transforme le brief en query sémantique

Pipeline interne instantané :

1. **Embedding du texte** → vecteur sémantique 512-d via Claude API (mood, energy, instrumentation, vocal style extraits)
2. **Embedding de la track de référence** → Sonic DNA + neural embedding CLAP via le service Railway existant
3. **Fusion des deux** → un vecteur de query unique pondéré (60% reference / 40% texte si les deux présents)
4. **Filtres durs** :
   - Genesis-certified ✅ (human-attested obligatoire)
   - Splits 100% signés ✅ (no clearance issues)
   - Sync-ready status (pas de samples uncleared, pas de dispute)
   - AI Training License = `NO-AI` ou `PAID-AI` (jamais `OPEN-AI` pour les briefs sync)
   - Budget compatible avec le tarif minimum déclaré par l'artiste
5. **Recherche pgvector** → top 50 tracks dont le DNA est dans le rayon de similarité (cosine distance)
6. **Re-ranking** par Claude avec contexte texte du brief → top 10-15 tracks finales

Le tout en moins de 5 secondes. Le supervisor n'attend pas.

### Étape 3 — Notification silencieuse à l'artiste

L'artiste reçoit **une seule notification** (push mobile + email) :

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

L'artiste clique. Il voit le brief complet, le profil du supervisor (vérifié par Trakalog, historique de placements, % paiement à temps, % de réponse), et **un bouton unique : "Submit this track"**.

Pas de pitch à écrire. Pas d'email à composer. Pas de fichier à uploader (la track existe déjà avec sa Genesis Print). Un clic. Trakalog s'occupe du reste.

### Étape 4 — Le supervisor reçoit son inbox SIGNAL

Le lendemain matin (ou dans la deadline demandée), le supervisor ouvre son inbox SIGNAL :

```
┌──────────────────────────────────────────────────────────┐
│  Brief: "Melancholic but hopeful..."                     │
│  Posted 2 days ago — 7 tracks submitted                  │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  🥇 92% match  Midnight Run — Yannick Rastogi             │
│       ▶️ Play  📄 One-sheet  ✅ Genesis verified  $8K     │
│                                                           │
│  🥈 89% match  Last Light — Eliot Smith                   │
│       ▶️ Play  📄 One-sheet  ✅ Genesis verified  $12K    │
│                                                           │
│  🥉 87% match  Hold On Slow — Sarah Vo                    │
│       ▶️ Play  📄 One-sheet  ✅ Genesis verified  $6K     │
│                                                           │
│  ... 4 more                                              │
│                                                           │
│  [ Shortlist ]  [ Request stems ]  [ Make an offer ]    │
└──────────────────────────────────────────────────────────┘
```

Chaque track est accompagnée de :
- Audio player streaming (avec watermark per-supervisor — leak tracing si la track fuite avant deal)
- **One-sheet auto-généré** : tous les credits, splits, PROs, IPI, contact one-stop
- **Genesis verification badge** cliquable → page publique avec Bitcoin timestamp + human attestation
- Tarif demandé par l'artiste (transparent)
- Sonic DNA résumé pour cross-référencer rapidement

### Étape 5 — Négociation et deal in-app

Le supervisor sélectionne sa track favorite, clique **"Make an offer"** :

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

L'artiste reçoit l'offre, peut accepter, contre-offrir, ou décliner — tout in-app. Si accord :

1. **Stripe Connect** prend le paiement du supervisor (en escrow)
2. **Contrat sync** auto-généré (template standardisé Trakalog, signature électronique Ed25519 réutilisée du système splits)
3. Les deux parties signent
4. Trakalog libère 85-90% à l'artiste (commission 10-15%), Stripe verse en 7 jours
5. La track passe automatiquement en statut "synced" dans le catalogue de l'artiste
6. **Audit log Genesis** : la licence sync est enregistrée comme historique de l'œuvre

### Étape 6 — Post-deal — La fly-wheel

- L'artiste gagne une **étoile de réputation** sur son profil (1 placement validé = boost de visibilité dans les futurs matches)
- Le supervisor gagne une **étoile de fiabilité** (placement réalisé = +0.1 sur sa note)
- **Reviews mutuelles** non publiques (visibles seulement de Trakalog pour modération) → améliore la qualité du réseau
- L'artiste peut **partager publiquement** le deal s'il le souhaite (placement validé devient social proof)
- La track entre dans la **liste des références** qui peuvent servir à matcher des futurs briefs similaires (le système apprend)

---

## 4. Pourquoi ça ne marcherait pas sans Genesis

C'est **la clé qui rend SIGNAL possible**. Sans Genesis Print, un supervisor doit :
- Vérifier que la track n'est pas générée par IA → impossible aujourd'hui
- Vérifier que les splits sont signés et tous les contributeurs OK → emails, attente, friction
- Vérifier que les rights master + composition sont clairs → recherches IPI, PROs
- Vérifier qu'il n'y a pas de samples uncleared → contact label, recherche, doute

**Tout ça prend 1-3 semaines aujourd'hui. C'est pour ça que les supervisors préfèrent les sync agents qui ont déjà "défriché" ces vérifications.**

Avec Genesis attaché à chaque track Trakalog :
- ✅ Human-attested → preuve cryptographique signée par l'artiste
- ✅ Splits 100% signés cryptographiquement → audit trail immutable
- ✅ One-stop ownership ou ownership chain claire → publié dans le registre
- ✅ Pas de samples uncleared → check automatique via derivation detection
- ✅ AI Training License explicite → le supervisor sait exactement ce qu'il peut faire

**Le supervisor passe de 1-3 semaines de vérifications à 30 secondes de validation.** C'est ça qui change le jeu et qui fait que SIGNAL n'est pas "encore un Disco" mais une nouvelle catégorie.

---

## 5. Architecture technique

### Tables DB principales

```sql
-- Briefs postés par les supervisors
CREATE TABLE signal_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid REFERENCES auth.users(id) NOT NULL,
  workspace_id uuid REFERENCES workspaces(id),

  -- Le brief lui-même
  vibe_description text NOT NULL,
  reference_track_url text,                     -- URL Spotify/SoundCloud ou upload temporaire
  reference_embedding vector(512),              -- DNA de la track de référence
  text_embedding vector(512),                   -- Embedding du vibe_description
  query_embedding vector(512),                  -- Fusion des deux pour matching

  -- Filtres
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

-- Matches générés par l'IA (avant submission)
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

-- Tracks soumises par les artistes au brief
CREATE TABLE signal_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid REFERENCES signal_briefs(id) NOT NULL,
  match_id uuid REFERENCES signal_matches(id),
  track_id uuid REFERENCES tracks(id) NOT NULL,
  artist_workspace_id uuid REFERENCES workspaces(id) NOT NULL,
  submitted_by uuid REFERENCES auth.users(id),

  artist_minimum_price_cents integer,
  artist_note text,                             -- Optional context to supervisor

  status text DEFAULT 'submitted',              -- submitted, shortlisted, offered, won, lost, withdrawn
  supervisor_viewed_at timestamptz,
  supervisor_shortlisted_at timestamptz,

  created_at timestamptz DEFAULT now()
);

-- Offres faites par les supervisors
CREATE TABLE signal_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES signal_submissions(id) NOT NULL,
  supervisor_id uuid REFERENCES auth.users(id) NOT NULL,
  artist_workspace_id uuid REFERENCES workspaces(id) NOT NULL,

  -- Termes proposés
  fee_cents integer NOT NULL,
  usage_description text,
  territory text DEFAULT 'worldwide',
  duration_years integer DEFAULT 5,
  exclusivity text DEFAULT 'non-exclusive',     -- non-exclusive, exclusive_genre, exclusive_full
  supervisor_message text,

  status text DEFAULT 'pending',                -- pending, accepted, counter_offered, declined, expired, paid
  artist_counter_fee_cents integer,
  artist_counter_message text,

  -- Paiement
  stripe_payment_intent_id text,
  trakalog_commission_cents integer,
  artist_payout_cents integer,
  paid_to_artist_at timestamptz,

  -- Contrat
  contract_pdf_url text,
  artist_signed_at timestamptz,
  supervisor_signed_at timestamptz,
  contract_genesis_id text,                     -- Hash de l'audit Genesis pour ce deal

  created_at timestamptz DEFAULT now(),
  expires_at timestamptz                        -- L'offre expire au bout de X jours
);

-- Profils Supervisor (séparé de profiles pour features spécifiques)
CREATE TABLE signal_supervisor_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  display_name text NOT NULL,
  company text,
  verified boolean DEFAULT false,               -- Vérifié manuellement par Trakalog
  verification_method text,                     -- 'imdb_credit', 'linkedin', 'industry_intro', 'past_deal'

  total_briefs_posted integer DEFAULT 0,
  total_deals_closed integer DEFAULT 0,
  total_spent_cents integer DEFAULT 0,
  on_time_payment_rate numeric DEFAULT 1.0,
  response_rate numeric DEFAULT 0.0,
  avg_response_time_hours numeric,
  rating numeric DEFAULT 5.0,                   -- 0.0 to 5.0

  notable_placements jsonb,                     -- Past credits (Netflix shows, ads, etc.)
  bio text,
  avatar_url text,

  created_at timestamptz DEFAULT now()
);

-- Reviews bilatéraux post-deal
CREATE TABLE signal_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES signal_offers(id) NOT NULL,
  reviewer_id uuid REFERENCES auth.users(id),
  reviewee_id uuid REFERENCES auth.users(id),
  reviewer_role text,                           -- 'artist' or 'supervisor'
  rating integer CHECK (rating BETWEEN 1 AND 5),
  comment text,                                 -- Privé, visible Trakalog seulement
  public boolean DEFAULT false,                 -- L'artiste peut choisir de rendre public si placement validé
  created_at timestamptz DEFAULT now()
);

-- Preferences artistes (filtres opt-in/opt-out)
CREATE TABLE signal_artist_preferences (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id),
  enabled boolean DEFAULT false,                -- Opt-in to receive matches
  minimum_budget_cents integer DEFAULT 0,
  excluded_usage_contexts text[],               -- ['ad', 'trailer'] si l'artiste ne veut pas
  excluded_brands text[],                       -- Marques explicitement refusées
  preferred_exclusivity text DEFAULT 'non-exclusive',
  auto_decline_below_match_score numeric DEFAULT 0.7,
  notification_method text DEFAULT 'push_email',  -- 'push_email', 'email_only', 'in_app_only'
  created_at timestamptz DEFAULT now()
);
```

### Edge Functions à créer

| Fonction | Rôle |
|---|---|
| `signal-post-brief` | Crée le brief, génère les embeddings, lance le matching, prend le posting fee Stripe |
| `signal-run-matching` | Re-rank et notifie les artistes (cron quotidien + déclenché à la création du brief) |
| `signal-submit-track` | L'artiste soumet sa track au brief (1 clic depuis la notif) |
| `signal-make-offer` | Le supervisor envoie une offre à un artiste |
| `signal-accept-offer` | L'artiste accepte → Stripe escrow → contrat généré |
| `signal-counter-offer` | Contre-offre artiste ou supervisor |
| `signal-finalize-deal` | Une fois les deux signatures collectées → Stripe transfer → notification finale |
| `signal-supervisor-verification` | Workflow de vérification manuel des supervisors (admin Trakalog) |

### Service Railway pour matching IA

Un nouveau service Railway dédié au matching (ou extension du service Sonic DNA Profiler existant) :

```python
# signal-matcher/app.py (Python/Flask)

@app.route('/embed-brief', methods=['POST'])
def embed_brief():
    """Génère les embeddings d'un brief"""
    data = request.json
    vibe_text = data['vibe_description']
    reference_url = data.get('reference_track_url')

    # 1. Embedding texte via Claude API
    text_embedding = claude_embed(vibe_text)

    # 2. Si référence audio fournie, calcul Sonic DNA + CLAP embedding
    reference_embedding = None
    if reference_url:
        audio = download_temp(reference_url)
        sonic_dna = analyze_sonic_dna(audio)
        clap_embedding = clap_extract(audio)
        reference_embedding = fuse_embeddings(sonic_dna, clap_embedding)

    # 3. Fusion finale (60% reference / 40% text si les deux)
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
    """Re-classement par Claude des top 50 candidats trouvés par pgvector"""
    data = request.json
    brief = data['brief']
    candidates = data['candidates']  # liste de 50 tracks avec sonic_dna + metadata

    # Demande à Claude de re-ranker les 50 en se basant sur le brief textuel
    # Retourne les top 15 avec match_reasons enrichis
    reranked = claude_rerank(brief, candidates)

    return jsonify({'ranked_matches': reranked})
```

---

## 6. UX — Les écrans clés

### Côté Supervisor

**1. Dashboard SIGNAL**
- Mes briefs actifs (avec compteur de submissions reçues)
- Mes briefs historiques (avec résultats : deal conclu ou non)
- Mon inbox de notifications (artistes qui ont soumis)
- Mon profil et rating
- Bouton CTA principal : **+ Post a new brief**

**2. Nouveau brief (modal 2-min)**
- 4 champs simples comme décrit section 3.1
- Preview du posting fee selon urgence/budget
- Paiement Stripe inline
- Confirmation : "Your brief is live. You'll receive your first matches within X hours."

**3. Brief Inbox (par brief)**
- Liste des submissions classées par % match
- Filtres : par mood, par budget, par durée, par vocal/instrumental
- Player audio in-line avec waveform
- Boutons d'action : Shortlist, Request stems, Make offer, Decline
- Sidebar : critères du brief (rappel constant), countdown deadline

**4. Make Offer modal**
- Champs : fee, territory, duration, exclusivity, message
- Aperçu du contrat qui sera généré
- Stripe escrow info : "Funds will be held until the artist signs"

### Côté Artiste

**1. Notifications SIGNAL** (intégré au notification center existant)
- Badge dédié 🎯 SIGNAL Match
- Affichage : % match, projet type, budget range, deadline countdown, rating supervisor
- Actions : View brief, Submit track, Dismiss

**2. SIGNAL Brief View**
- Lecture complète du brief
- Profil du supervisor (verified badge, past placements, rating)
- Ta track suggérée (player + Genesis Print badge)
- Champs optionnels : ton tarif minimum, note au supervisor (max 200 char)
- Bouton unique : **Submit this track**

**3. SIGNAL Deals Dashboard**
- Mes submissions en cours (status par brief)
- Mes offers reçues (à accepter / décliner / counter)
- Mes deals signés et en attente de paiement
- Mes deals historiques + revenus générés

**4. SIGNAL Preferences** (Settings)
- Toggle on/off de la marketplace
- Budget minimum acceptable
- Usage contexts exclus (jamais de pub, jamais de trailer)
- Marques explicitement refusées
- Notification method preference

---

## 7. Stratégie de lancement — Pourquoi 6-9 mois minimum

Tu ne peux pas lancer une marketplace sans liquidité des deux côtés. Le piège classique des marketplaces : **lancer avec une offre vide ou une demande vide tue le produit en 3 mois.**

### Phase 0 — Pré-conditions (3-6 mois après beta public)

Avant même de coder SIGNAL, tu dois avoir :

1. **Stripe / Billing en production** ✅ priorité actuelle
2. **Genesis MVP fonctionnel** : Origin Print + AI Training License + Public Registry
3. **Minimum 1000 tracks Genesis-certified humaines** dans la DB Trakalog
4. **Minimum 100 artistes actifs payants** (Starter ou Pro) qui auraient un intérêt direct
5. **Onboarding bien rodé** pour que les premiers supervisors invités aient une UX premium

Sans ça, un supervisor poste un brief, reçoit 2 matches médiocres, ne revient plus. Et tu n'as aucun second chance avec eux.

### Phase 1 — Recrutement supervisor (3 mois — "Founder mode")

**Toi, Yannick, contactes personnellement 50 supervisors et A&R triés sur le volet.** Pas de marketing mass, pas d'ads. Du 1-to-1.

Typologie cible pour les 50 premiers :
- **15 indie film music supervisors** (festivals Sundance, SXSW, TIFF — leurs émails sont publics via Guild of Music Supervisors)
- **10 streaming series supervisors** (Netflix, HBO, Amazon, Apple — niveau mi-confirmé, pas les stars)
- **10 ad agency music directors** (mid-size agencies — McCann, Wieden+Kennedy, DDB)
- **5 game audio directors** (studios indé : Annapurna, Devolver, Supergiant)
- **5 podcast music sourcing leads** (Wondery, Pushkin, Spotify Studios)
- **5 brand internal music leads** (Nike, Apple, Glossier, Aesop)

Approche pour chacun :
- LinkedIn DM ou email personnalisé
- Tu te présentes comme founder solo qui a construit Trakalog
- Tu leur offres **6 mois gratuits** (pas de posting fees) + commission Trakalog réduite à 5% sur les premiers deals
- Tu leur montres une démo vidéo de 3 min
- Tu fais un onboarding 1-to-1 (call Zoom 30 min)

Objectif réaliste : **15-25 supervisors actifs** à la fin du recrutement. C'est ta masse critique.

### Phase 2 — Soft launch invite-only (1-2 mois)

- Les 15-25 supervisors recrutés postent leurs premiers briefs (objectif : 3-5 briefs/semaine sur l'ensemble)
- Les artistes Trakalog Pro et Business reçoivent en exclusivité les matches
- Toi tu monitores chaque deal, tu interviews les deux parties après chaque transaction
- Tu itères vite sur les frictions détectées
- **Objectif** : 5 deals signés et payés dans cette période. Pas 50. Cinq vrais deals.

### Phase 3 — Public launch (mois 3+)

Une fois que tu as 5+ deals validés et au moins 3 témoignages publiables :

- Annonce publique avec case studies réels
- Ouverture aux Starter (avec match score minimum plus élevé)
- Ouverture du programme supervisor à candidatures (toujours vérifiées manuellement)
- Tarification supervisor activée (posting fees normaux)
- PR : Music Business Worldwide, Hypebot, Synchtank, Variety
- Influence : podcasts spécialisés (And the Writer Is, The Sync Report, Music Business Made Simple)

### Phase 4 — Scale (mois 6+)

- Onboarding automatisé pour les supervisors (formulaire de vérification + ID validation)
- API pour les agences pour intégrer SIGNAL dans leurs workflows
- Integration Slack pour les studios qui veulent recevoir les briefs en team
- Internationalisation (premiers supervisors UK, Allemagne, France)

---

## 8. Business model

### Revenus directs

**1. Posting fees (supervisors)** — Filtre la demande sérieuse, finance l'IA matching

| Urgence × Budget | Posting fee |
|---|---|
| 2 semaines × $1-5K | $50 |
| 1 semaine × $1-5K | $75 |
| 72h × $1-5K | $100 |
| 24h × $1-5K | $200 |
| 2 semaines × $5-20K | $100 |
| 72h × $5-20K | $250 |
| 24h × $5-20K | $500 |
| Any × $20-100K | $500-1000 |
| Any × $100K+ | $2000 (avec concierge service) |

**2. Commission sur deals** — Le revenu principal

- **10% sur deals < $10K** (cible : artistes indé, premiers placements)
- **12% sur deals $10-50K** (placements TV/streaming standards)
- **15% sur deals > $50K** (gros placements pub, films, exclusivités)

**3. SIGNAL Pro pour supervisors** — $99-299/mois pour les supervisors actifs

Avantages :
- Posting fees inclus (jusqu'à 20 briefs/mois)
- Accès à des features avancées : similarity search libre dans le catalogue Trakalog, alertes saved searches, équipes/workspaces
- Commission Trakalog réduite (8% au lieu de 10-15%)
- Cible : les power users qui postent 5+ briefs par mois

**4. Verified Supervisor Badge** — $200/an

Vérification renforcée (ID, credits IMDb, références industrielles). Devient un signal de confiance fort. Les artistes priorisent les briefs des verified.

### Modèle de marge brute

**Coût marginal d'un deal facilité :**
- Stripe Connect fees : ~2.9% + $0.30 sur le total
- AI matching (Claude + Sonic DNA) : ~$0.10 par brief
- Storage et compute : négligeable (existant Trakalog)
- Support humain pour deal complexes : variable, ~$5-50 par deal selon complexité

**Marge brute moyenne attendue : >85%** sur les commissions.

### Projections (réalistes, 18 mois après launch SIGNAL)

Hypothèse conservatrice : 50 supervisors actifs, 5 briefs/supervisor/mois = 250 briefs/mois.

- **Posting fees moyens** : 250 briefs × $150 moyen = **$37 500/mois**
- **Taux de conversion brief → deal** : 20% (estimation industrielle) = 50 deals/mois
- **Deal value moyen** : $8 000
- **Commission moyenne 12%** : 50 × $8 000 × 12% = **$48 000/mois**
- **SIGNAL Pro abos** : 15 supervisors × $200 = **$3 000/mois**

**Revenu mensuel SIGNAL estimé : ~$88 500/mois** (~$1M/an)

À ce stade, SIGNAL représente probablement **40-60% des revenus totaux Trakalog**. Et la croissance est exponentielle car chaque deal validé attire 2-3 nouveaux supervisors via le bouche-à-oreille industrie.

---

## 9. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Pas assez de supervisors recrutés en Phase 1 | Élevée | Critique | Sales personnel intensif par Yannick + offre gratuite généreuse + démo killer |
| Matching IA pas assez précis | Moyenne | Élevé | Beta privée 2 mois avant lancement, calibration manuelle des seuils, feedback loop supervisor (rating de chaque match) |
| Spam de briefs par des faux supervisors | Élevée | Moyen | Posting fee dès la première utilisation + vérification manuelle systématique + ban si abuse |
| Spam de submissions par les artistes | Moyenne | Faible | Limite à 1 submission par match (pas de re-soumission après dismissal) + score de réputation artiste |
| Concurrence directe par Disco/Songtradr | Moyenne | Moyen | Disco a un conflit d'intérêt (storage business), Songtradr ne fait pas de matching IA. Notre moat = Genesis + Sonic DNA + UX |
| Litige contractuel après un deal | Faible | Élevé | Contrat type bien rédigé par avocat, escrow Stripe, signatures Ed25519, audit log Genesis |
| Plagiat / vol de track via la marketplace | Faible | Élevé | Watermarking invisible per-supervisor sur tous les previews + leak tracing existant |
| Supervisors mécontents du volume de spam d'artistes en pré-match | Moyenne | Critique | C'est notre proposition de valeur principale — l'IA filtre AVANT que les artistes voient le brief. Zéro spam visible. |
| Réglementation marketplace musicale | Faible | Moyen | Pas de différence légale avec Songtradr/Musicbed qui opèrent depuis 10 ans |
| Dépendance Stripe Connect (pour les paiements internationaux) | Faible | Moyen | Stripe Connect est solide, alternatives : Wise Business, Paddle si besoin |

### Le risque principal et non-évident : la chicken-and-egg
Si les premiers supervisors postent et ne reçoivent que 2 matches médiocres, ils ne reviennent jamais. Si les artistes ne voient que des briefs irréalistes, ils désactivent SIGNAL.

**Mitigation** : tu ne lances PAS SIGNAL avant :
- Au moins 1000 tracks Genesis-certified dans la DB
- Au moins 15 supervisors engagés en privé (qui te promettent au moins 2 briefs/mois pendant 6 mois)
- Calibration manuelle des matches pendant 2 mois (toi qui review chaque match avant qu'il soit envoyé à l'artiste, pour ajuster les seuils)

---

## 10. Phases d'implémentation détaillées

### Phase 0 — Préparation (en parallèle de Stripe + Onboarding + Genesis)
- ✅ Genesis MVP terminé (Phase 3 de la roadmap globale)
- Atteindre 1000 tracks Genesis-certified
- Atteindre 100 artistes payants actifs
- Préparer les listes de supervisors cibles
- Rédiger les CGU SIGNAL (avocat — réutilise le brief Genesis)

### Phase 1 — Build MVP (~6-8 semaines de dev)

**Semaines 1-2** — Setup DB + Edge Functions skeleton
- Tables `signal_briefs`, `signal_matches`, `signal_submissions`, `signal_offers`
- RPCs SECURITY DEFINER pour writes
- Edge Function `signal-post-brief` basique

**Semaines 3-4** — Service Railway de matching
- Nouveau service Python/Flask `signal-matcher`
- Endpoints `/embed-brief` et `/rerank-matches`
- Intégration Claude API pour embeddings textuels et re-ranking
- Tests avec dataset de 100 tracks

**Semaines 5-6** — Frontend Supervisor
- Page Dashboard SIGNAL
- Modal nouveau brief (4 champs)
- Brief Inbox avec liste des matches
- Offer modal
- Onboarding supervisor simplifié

**Semaines 7-8** — Frontend Artiste + Notifications
- Intégration des matches dans le notification center existant
- Brief View page (lecture du brief, submission)
- Deals dashboard
- Preferences SIGNAL dans Settings

### Phase 2 — Beta privée (2 mois)

- Invitations personnelles 15-25 supervisors
- Yannick review chaque match avant envoi à l'artiste
- Itération rapide sur les frictions UX
- Premiers deals (objectif : 5 deals signés)
- Rédaction de 3 case studies

### Phase 3 — Public launch (mois 3)

- Activation tarification supervisor
- PR + content marketing
- Programme verified supervisor
- Tracking analytics complet (funnel brief → match → submission → offer → deal)

### Phase 4 — Scale (mois 6+)

- API supervisor pour intégrations
- Slack integration
- Internationalisation
- SIGNAL Pro pour power users

---

## 11. Intégrations avec le reste de Trakalog

### Bénéficie de
- **Sonic DNA Profiler** ✅ : moteur de matching (cœur de SIGNAL)
- **Genesis Print** ✅ : preuve de paternité humaine + splits clearés (déverrouille la confiance supervisor)
- **Watermarking invisible** ✅ : protection des previews per-supervisor
- **Stripe / Billing** ✅ : escrow et paiements
- **Workspaces & permissions** ✅ : multi-membres pour les labels qui veulent gérer SIGNAL en équipe
- **Notification center** ✅ : delivery des matches

### Renforce
- **Genesis** : chaque deal SIGNAL devient une preuve d'usage commercial, valorise le badge
- **Style Licensing (Composant 4 Genesis)** : SIGNAL devient le canal naturel de monétisation des Style Profiles
- **Catalog Sharing** : les labels qui gèrent plusieurs artistes peuvent activer SIGNAL pour tout leur catalogue d'un coup
- **Smart A&R** : peut maintenant aider l'artiste à comprendre POURQUOI son catalogue match (ou pas) certains types de briefs

### Différencie de
- **Brief Seeker (spec V2)** : Brief Seeker scrape les briefs externes publics. SIGNAL est la source primaire propriétaire. Brief Seeker reste pertinent pour les briefs hors-Trakalog, mais SIGNAL devient le canal premium.
- **Artist Seeker** : Artist Seeker cherche des artistes externes pour matcher avec ton catalogue. SIGNAL est l'inverse (les supervisors viennent à toi).

---

## 12. KPIs à tracker

### KPIs de liquidité (les plus critiques en early stage)
- **Nombre de supervisors actifs** (postent au moins 1 brief/mois)
- **Nombre de briefs postés/semaine**
- **Nombre de matches générés par brief** (cible : 5-15 matches qualifiés)
- **Taux d'opt-in artistes** : % des artistes Pro/Business qui activent SIGNAL

### KPIs de conversion
- **Taux d'acceptation des matches** par les artistes (cible : >40%)
- **Taux brief → submission** : briefs qui reçoivent au moins 1 submission (cible : >80%)
- **Taux submission → offer** (cible : >15%)
- **Taux offer → signed deal** (cible : >50%)

### KPIs de qualité
- **Rating moyen des supervisors** par les artistes
- **Rating moyen des artistes** par les supervisors
- **Délai moyen brief → first match notified** (cible : <5 min)
- **Délai moyen brief → deal closed** (cible : <14 jours)

### KPIs financiers
- **Revenue posting fees**
- **Revenue commissions**
- **Average deal value**
- **Revenue per supervisor par mois**
- **Take rate effectif** (Trakalog commission / GMV)

---

## 13. Le pitch en une phrase

**"Trakalog SIGNAL est la première marketplace musicale inversée : les music supervisors postent ce qu'ils cherchent, l'IA matche silencieusement les catalogues Genesis-certifiés, les artistes reçoivent des opportunités au lieu d'envoyer des pitches. Zéro spam, zéro friction, deal signé en jours au lieu de semaines."**

---

## 14. La phrase à retenir pour Yannick

SIGNAL est **le coup de grâce** de Trakalog. Genesis donne la preuve de provenance. SIGNAL la monétise. Ensemble, ils forment une catégorie nouvelle : la première plateforme où la confiance cryptographique permet une marketplace musicale instantanée.

**Disco est un dropbox.** Tu construis Spotify pour les supervisors. **Sound Credit est un metadata manager.** Tu construis Stripe pour le sync. Le moat n'est pas la tech (qui peut être copiée) mais **la combinaison Genesis + SIGNAL** qui crée un écosystème auto-renforçant que personne ne peut rattraper sans repartir de zéro sur 3 ans de produit.

Le timing : lance SIGNAL en mode beta privée 6-9 mois après le beta public Trakalog. Pas avant. Tu as exactement le temps de construire Genesis, atteindre 1000 tracks certifiées, et recruter tes 25 premiers supervisors.

**Quand SIGNAL est en place, Trakalog n'est plus un SaaS musical. C'est l'infrastructure d'une nouvelle économie de la musique pré-release.**

---

*Ce document est vivant. Il sera mis à jour au fur et à mesure du développement, des retours supervisors, et de l'évolution du marché.*
