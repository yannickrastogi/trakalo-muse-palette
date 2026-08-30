# TRAKALOG — GENESIS

> **Document créé le :** 15 mai 2026
> **Objectif :** Positionner Trakalog comme l'infrastructure mondiale de provenance créative musicale à l'ère de l'IA générative. Devenir le standard de facto que toute l'industrie adopte.
> **Statut :** Concept stratégique — MVP planifiable sous 12 semaines
> **Vision :** *"L'ISRC est né en 1986 pour identifier les enregistrements à l'ère du CD. GENESIS est l'ISRC de l'ère IA — il identifie qui a créé quoi, quand, avec quelles permissions, et garantit la compensation."*

---

## 1. Pourquoi maintenant — La fenêtre de tir 2026

L'industrie musicale est à un point de bascule historique. Trois forces convergent en ce moment précis :

**Force 1 — L'explosion de l'IA générative musicale**
Suno, Udio, Stable Audio, et leurs successeurs entraînent leurs modèles sur des dizaines de millions de tracks sans consentement explicite. En 2025, Suno a dépassé 12 millions d'utilisateurs. Les majors (Universal, Sony, Warner) ont déposé plainte mais cherchent surtout une infrastructure technique pour structurer la compensation. **Cette infrastructure n'existe pas.**

**Force 2 — Le tsunami réglementaire qui arrive**
L'EU AI Act (entré en vigueur en août 2024, exécutoire pour les modèles General Purpose AI en août 2025) impose des obligations de transparence sur les données d'entraînement. Le US Copyright Office a publié son rapport sur l'IA générative début 2025. La California AI Transparency Act et la Tennessee ELVIS Act sont déjà en vigueur. Chaque législateur cherche un standard technique pour faire respecter les nouvelles règles. **Le premier qui propose ce standard devient incontournable.**

**Force 3 — La panique des ayants droit**
Pour la première fois depuis Napster, l'industrie musicale fait face à une menace existentielle plus grande qu'une simple question de monétisation : la **menace de remplacement créatif**. Les artistes et labels paient cher pour des solutions de protection. La demande dépasse l'offre.

**Trakalog est la seule plateforme qui a déjà construit l'infrastructure technique nécessaire** (Sonic DNA, watermarking invisible, leak tracing, audit logs, splits cryptographiquement signés). Il manque trois pièces pour devenir l'infrastructure mondiale : la **chain of custody cryptographique**, le **registre public vérifiable**, et le **standard de licence IA**.

---

## 2. Vue d'ensemble du système

GENESIS combine cinq sous-systèmes interconnectés. Chacun a de la valeur seul, ensemble ils créent un moat impossible à reproduire.

| # | Composant | Rôle | Différenciation |
|---|-----------|------|-----------------|
| 1 | **Origin Print** | Empreinte cryptographique de création | Aucun concurrent ne combine Sonic DNA + perceptual hash + timestamp blockchain |
| 2 | **AI Training License** | Licence d'entraînement IA déclarée et opposable | Premier standard légalement utilisable au monde |
| 3 | **Public Registry** | Registre mondial consultable | Premier registre human-first de provenance musicale pré-release |
| 4 | **Style Licensing** | Monétisation du Sonic DNA comme asset | Inverse le marché : le style devient un produit financier |
| 5 | **Derivation Detection** | Détection des tracks dérivés / clonés | Protège les artistes contre les imitations IA non-déclarées |

---

## 3. Composant 1 — Origin Print (l'empreinte cryptographique)

### Ce que c'est
À chaque upload sur Trakalog, le track reçoit un identifiant unique cryptographiquement signé et horodaté qui constitue une preuve d'antériorité opposable. C'est l'équivalent musical d'un acte notarié, mais immutable et vérifiable mondialement.

### Composition d'une Origin Print
```
{
  "genesis_id": "GEN-2026-A4F3-9B2E-...",
  "track_id": "uuid",
  "workspace_id": "uuid",
  "creator": {
    "name": "Yannick Rastogi",
    "ipi": "00576901234",
    "verified": true
  },
  "audio_hashes": {
    "sha256": "...",                    // Hash exact du fichier
    "chromaprint": "...",               // Empreinte perceptive (résistante au ré-encodage)
    "neural_embedding": "...",          // Embedding audio 512-d (résistant aux transformations)
    "sonic_dna_signature": "..."        // Signature condensée du Sonic DNA
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

### Pipeline technique de création

1. **Upload audio** (déjà fait) → fichier stocké dans Supabase Storage
2. **Hash SHA-256** du fichier brut → identifiant exact
3. **Chromaprint** (acoustic fingerprint via fpcalc, open-source) → résiste au ré-encodage MP3/AAC
4. **Neural embedding** via CLAP ou MERT (modèles open-source) → résiste aux transformations majeures (slowed, sped up, pitch shift)
5. **Sonic DNA signature** (déjà calculée par le service Railway) → empreinte musicale
6. **Collecte des splits signés** (déjà fait) → liste des contributeurs
7. **AI Training License** (nouveau) → choix de l'artiste enregistré
8. **Human Attestation** → l'artiste signe une déclaration de paternité humaine
9. **Sérialisation JSON canonique** → format reproductible
10. **OpenTimestamps** → soumission du hash JSON à un agrégateur OpenTimestamps qui l'inclut dans une transaction Bitcoin
11. **Stockage** dans la table `genesis_records` + référence dans `tracks.genesis_id`

### Pourquoi OpenTimestamps et pas un L2 type Polygon/Base

OpenTimestamps est **gratuit, scalable à des millions de tracks/jour, et utilise Bitcoin** (la blockchain la plus résiliente). Il agrège des millions de hashes dans un seul arbre Merkle puis publie la racine sur Bitcoin. Chaque track obtient une preuve cryptographique d'antériorité vérifiable par n'importe qui, sans gas fees, sans infrastructure crypto à gérer. C'est ce que Wikipedia utilise en interne. Pour le MVP, c'est imbattable.

Plus tard (Phase 3+), si on veut ajouter des smart contracts pour des licences automatisées, on pourra ajouter Base ou Polygon en option, mais ce n'est pas nécessaire pour démarrer.

---

## 4. Composant 2 — AI Training License

### Le standard à créer
Trakalog publie une **licence standardisée en quatre niveaux** que chaque créateur choisit à l'upload (modifiable plus tard). C'est ce qui manque cruellement au marché et que tout le monde attend.

| Niveau | Code | Description |
|--------|------|-------------|
| 🚫 **No Training** | `NO-AI` | Aucune utilisation pour entraîner un modèle IA, génératif ou non. Toute utilisation constitue une infraction. |
| 💰 **Paid Training** | `PAID-AI` | Utilisation autorisée moyennant licence et royalties via Trakalog. Tarif par défaut ou personnalisé par l'artiste. |
| 🤝 **Attribution Training** | `ATTR-AI` | Utilisation autorisée gratuitement à condition de crédit et de référencement dans les training data disclosures. |
| ✅ **Open Training** | `OPEN-AI` | Utilisation libre. Pour les artistes qui veulent volontairement nourrir l'écosystème IA. |

### Pourquoi ces quatre niveaux
Ils couvrent toutes les positions philosophiques et économiques de l'industrie. Inspirés des Creative Commons mais adaptés au cas spécifique de l'entraînement IA. **Légalement défendable** car l'artiste a explicitement consenti (ou refusé) avec une signature cryptographique horodatée.

### Crawler protection
Trakalog publie un fichier `/ai-training-license.txt` à la racine de chaque shared link et de chaque preview audio, dans un format machine-readable inspiré de `robots.txt` mais standardisé. Les plateformes IA respectueuses pourront le lire automatiquement. Pour les autres, ce fichier devient une **preuve juridique** que la plateforme aurait dû savoir.

```
# AI Training License — Trakalog Genesis Protocol v1.0
genesis-id: GEN-2026-A4F3-9B2E-...
license: NO-AI
attribution-required: true
contact: licensing@trakalog.com
verify: https://trakalog.com/genesis/verify/GEN-2026-A4F3-9B2E
last-modified: 2026-05-15T10:32:14Z
```

### Standardisation publique
Trakalog publie le **protocole Genesis en open-source** sur GitHub. La spec technique, le format JSON, les niveaux de licence — tout est public. **C'est précisément ce qui en fait un standard.** Les concurrents peuvent l'implémenter, mais Trakalog reste le registre principal (effet réseau).

---

## 5. Composant 3 — Public Registry

### L'interface publique
Chaque Origin Print génère une page publique vérifiable, accessible à n'importe qui :

```
https://trakalog.com/genesis/GEN-2026-A4F3-9B2E-...
```

Cette page affiche :
- Le titre du track et l'artiste (si rendu public)
- La date de création cryptographiquement prouvée
- Les contributeurs et leurs rôles
- La licence IA active
- Un bouton "Verify" qui re-calcule le hash Bitcoin en live
- Un badge **"Human-Made on Trakalog"** vérifié (si l'artiste a signé l'attestation)
- L'historique des modifications de licence (audit log immuable)

### API publique de vérification
```
GET https://api.trakalog.com/v1/genesis/{genesis_id}
GET https://api.trakalog.com/v1/genesis/verify-by-hash/{chromaprint_or_sha256}
POST https://api.trakalog.com/v1/genesis/check-license  // pour les plateformes IA
```

### Cas d'usage
- **Un music supervisor** veut vérifier qu'un track soumis est human-made et clearable → scan le QR code de l'Origin Print → confiance instantanée
- **Spotify ou Apple Music** veut filtrer les tracks IA non-déclarés → query l'API avec le hash du track → savoir si c'est human-attested
- **Un tribunal** doit établir l'antériorité d'une œuvre → preuve cryptographique avec horodatage Bitcoin
- **Une plateforme IA** veut entraîner légalement → query l'API par batch → liste des tracks autorisés avec leurs conditions

---

## 6. Composant 4 — Style Licensing

### Le concept inversé
Aujourd'hui, on cherche des tracks par genre, mood, BPM. Demain, on cherchera **par style audio précis** via les embeddings du Sonic DNA. Le style devient un asset financier — la première fois dans l'histoire.

### Comment ça marche
1. L'artiste publie son Sonic DNA aggregé (moyenne pondérée de son catalogue) comme un "**Style Profile**" public et licensable
2. Il fixe ses tarifs : `$X par track généré par IA dans son style`, `$Y pour licence exclusive sur 12 mois`
3. Quand une plateforme IA ou un music supervisor cherche "un track type Burna Boy" via l'API Trakalog, le système match les Style Profiles disponibles **avec consentement préalable**
4. Royalties automatiques sur chaque utilisation, payées via Stripe Connect

### Pourquoi c'est révolutionnaire
- C'est le premier marché transparent pour **la signature stylistique** d'un artiste
- Les artistes indépendants peuvent monétiser leur "son" sans avoir à sortir un nouveau track
- Les plateformes IA ont un canal légal pour s'inspirer de styles précis
- Les majors peuvent **acheter des style licenses exclusives** comme elles achètent des catalogues

### Garde-fou éthique
Le Style Licensing est **strictement opt-in**. Aucun artiste n'est inclus sans avoir activement publié son profil. Et chaque utilisation est tracée, auditée, et compensée. C'est la différence fondamentale avec l'IA générative actuelle qui pille sans permission.

---

## 7. Composant 5 — Derivation Detection

### Le problème
Quand un track IA imite un artiste, l'artiste n'a aucun moyen de le prouver. Quand un producteur sample sans autorisation, ça prend des années en justice.

### Ce que fait Trakalog
Un agent persistant qui scanne le web (DSP, SoundCloud, YouTube, plateformes IA) et cherche des tracks dont l'empreinte audio ou le neural embedding match un track Genesis. Trois niveaux de match :

| Niveau | Confidence | Signal |
|--------|------------|--------|
| **Exact** | >95% | Même fichier ré-encodé / ré-uploadé. Action : DMCA automatique. |
| **Derivative** | 70-95% | Sample, remix non-autorisé, ou cover non-déclarée. Action : alerte + suggestion de réclamation. |
| **Stylistic** | 40-70% | Imitation stylistique potentielle (souvent IA). Action : flag pour investigation manuelle. |

### Technique
- **Exact match** : Chromaprint database
- **Derivative match** : Neural embedding distance (cosine similarity sur CLAP/MERT)
- **Stylistic match** : Sonic DNA signature distance + sliding window comparison

### Valeur stratégique
C'est le complément naturel du watermarking déjà en place. Le watermark identifie **qui a leak**. Derivation Detection identifie **qui a copié ou imité**. Ensemble, c'est l'environnement le plus protégé du marché.

---

## 8. Pipeline complet — Le flux end-to-end

```
ARTISTE UPLOAD UN TRACK
  ↓
  Upload audio (déjà fait) → Storage
  ↓
  Compression preview MP3 (déjà fait)
  ↓
  Sonic DNA analysis (déjà fait) → Railway service
  ↓
  ┌─────────────────────────────────────────────┐
  │ GENESIS PIPELINE (nouveau)                  │
  ├─────────────────────────────────────────────┤
  │ 1. Audio hashing                            │
  │    - SHA-256 (fichier brut)                 │
  │    - Chromaprint (fpcalc) → audio_hash      │
  │    - Neural embedding (CLAP) → embedding    │
  │ 2. Splits & attestation collection          │
  │    - Vérifie signatures collaborateurs      │
  │    - Demande l'attestation humaine          │
  │    - Enregistre la licence IA choisie       │
  │ 3. Canonical JSON serialization             │
  │ 4. OpenTimestamps submission                │
  │    - Hash du JSON → OTS aggregator          │
  │    - Reçoit OTS proof file                  │
  │ 5. Storage in DB                            │
  │    - INSERT genesis_records                 │
  │    - UPDATE tracks.genesis_id               │
  │ 6. Public page generation                   │
  │    - https://trakalog.com/genesis/{id}      │
  │ 7. ai-training-license.txt generation       │
  │    - Pour chaque shared link associé        │
  └─────────────────────────────────────────────┘
  ↓
ARTISTE PARTAGE LE TRACK (shared link)
  ↓
  - Le shared link inclut le Genesis ID
  - Le badge "Human-Made on Trakalog" affiché
  - Le visiteur peut cliquer pour vérifier l'authenticité
  - ai-training-license.txt servi à la racine
  - Watermarking invisible per-visitor (déjà fait)
  ↓
EN ARRIÈRE-PLAN — Derivation Detection (cron quotidien)
  ↓
  - Scan DSP, plateformes IA, SoundCloud, YouTube
  - Match Chromaprint / Neural embedding
  - Alertes à l'artiste si match trouvé
  - Génération de DMCA automatique pour exact matches
  ↓
EN ARRIÈRE-PLAN — AI Training Royalties (mensuel)
  ↓
  - Réception des reports des plateformes IA partenaires
  - Calcul des royalties par track utilisé
  - Distribution via Stripe Connect aux artistes
  - Trakalog prend 15-20% de commission
```

---

## 9. Schéma de base de données

```sql
-- Table principale : un record par track
CREATE TABLE genesis_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  genesis_id text UNIQUE NOT NULL,              -- "GEN-2026-A4F3-9B2E-..."
  track_id uuid REFERENCES tracks(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id),
  creator_user_id uuid REFERENCES auth.users(id),

  -- Hashes audio
  sha256_hash text NOT NULL,
  chromaprint text NOT NULL,
  chromaprint_compressed bytea,                 -- pour recherche rapide
  neural_embedding vector(512),                 -- pgvector pour similarity search
  sonic_dna_signature text,

  -- Métadonnées
  collaborators jsonb,                          -- snapshot des splits au moment de la création
  ai_training_license text NOT NULL DEFAULT 'no-ai',
  ai_license_price_cents integer DEFAULT 0,
  human_attested boolean DEFAULT false,
  attestation_signature text,                   -- signature de l'artiste

  -- Blockchain proof
  blockchain_method text DEFAULT 'opentimestamps',
  ots_proof bytea,                              -- fichier OTS binaire
  bitcoin_block_height integer,
  bitcoin_tx_hash text,
  blockchain_verified_at timestamptz,

  -- Audit
  created_at timestamptz DEFAULT now() NOT NULL,
  canonical_json text NOT NULL                  -- la version exacte qui a été hashée
);

CREATE UNIQUE INDEX idx_genesis_track ON genesis_records(track_id);
CREATE INDEX idx_genesis_chromaprint ON genesis_records USING gin(chromaprint_compressed);
CREATE INDEX idx_genesis_embedding ON genesis_records USING ivfflat (neural_embedding vector_cosine_ops);
CREATE INDEX idx_genesis_license ON genesis_records(ai_training_license);

-- Table pour les modifications de licence (audit trail)
CREATE TABLE genesis_license_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  genesis_record_id uuid REFERENCES genesis_records(id),
  previous_license text,
  new_license text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now(),
  reason text,
  signature text                                -- signature cryptographique du changement
);

-- Table pour les détections de tracks dérivés
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

-- Table pour les Style Profiles (Composant 4)
CREATE TABLE genesis_style_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id),
  artist_name text NOT NULL,
  aggregated_dna jsonb NOT NULL,                -- Sonic DNA moyen pondéré
  representative_tracks uuid[],                 -- 3-5 tracks qui illustrent le style
  is_public boolean DEFAULT false,
  pricing jsonb,                                -- { per_use_cents: 5000, exclusive_12mo_cents: 5000000 }
  created_at timestamptz DEFAULT now()
);

-- Table pour les licences de Style octroyées
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

-- Table pour les redevances d'entraînement IA
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

### RLS et accès public

```sql
-- Le registre public : lecture libre sur l'API
CREATE POLICY "Public can read genesis records by genesis_id"
  ON genesis_records FOR SELECT
  USING (true);  -- lecture publique, mais on filtre les champs sensibles dans la vue

-- Vue publique avec uniquement les champs nécessaires à la vérification
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

---

## 10. Stack technique recommandé

| Composant | Technologie | Pourquoi |
|-----------|-------------|----------|
| Audio fingerprint | **Chromaprint** (fpcalc) | Open-source, standard de facto, utilisé par AcoustID/MusicBrainz |
| Neural embedding | **CLAP** (LAION) ou **MERT** | Open-source, modèles audio state-of-the-art |
| Embedding storage | **pgvector** sur Supabase | Déjà compatible, similarity search rapide |
| Timestamping | **OpenTimestamps** | Gratuit, Bitcoin-backed, scalable infiniment |
| Canonical JSON | **JCS (RFC 8785)** | Standard W3C pour la sérialisation canonique |
| Signature crypto | **Ed25519** via libsodium | Standard moderne, rapide, supporté partout |
| Public API | **Supabase Edge Functions** + **Cloudflare cache** | Déjà infra existante |
| Crawler detection | Service Railway custom (Python) | Spotify API, YouTube Data API, scrapers |
| Payment distribution | **Stripe Connect** | Déjà en cours d'intégration pour billing |

### Coût d'infrastructure additionnel
- **Storage embeddings** : ~100 KB par track → négligeable
- **OpenTimestamps** : gratuit (limites raisonnables via aggregators publics)
- **Crawler service** : ~$20-40/mois Railway
- **Audio fingerprinting** : CPU only, peut tourner sur Railway existant
- **Total estimé** : ~$30-50/mois additionnel jusqu'à 50K tracks

---

## 11. Business model

### Revenus directs
**1. AI Training Royalties (à 12-24 mois)**
Trakalog facilite les licences d'entraînement IA entre les plateformes (Suno, Udio, etc.) et les artistes. Commission 15-20% sur chaque transaction. Marché potentiel mondial : estimé en milliards de dollars d'ici 2030 d'après les analyses sectorielles actuelles.

**2. Style Licensing (à 6-12 mois)**
Commission 15-20% sur les licences de style. Cible : producteurs et artistes indépendants qui veulent monétiser leur signature stylistique.

**3. Enterprise API (à 6 mois)**
Accès API tarifé pour DSP, music supervisors, publishers, et plateformes IA qui doivent vérifier la licence avant utilisation. Pricing : $500-5000/mois selon le volume.

**4. Genesis Verified Badge (à 3 mois)**
Add-on pour les plans Pro et Business : badge officiel + page publique vérifiable + protection légale renforcée. $5-10/mois additionnel.

### Revenus indirects
- **Augmentation massive de la conversion Free→Paid** : la protection est un argument de vente plus fort que le storage
- **Adoption par les majors** : si UMG/Sony adoptent Trakalog comme infrastructure de provenance, c'est un partenariat à six ou sept chiffres
- **Acquisition stratégique** : à terme, ce type d'infrastructure peut intéresser des acquéreurs (PROs, DSP, infrastructure plays)

### Modèle de marge brute
Marge brute estimée >85% sur les transactions de licence IA (le coût marginal d'une licence est quasi-nul). Marge >90% sur l'API et les badges.

---

## 12. Conformité légale — Faire les choses bien dès le départ

> **Note importante :** Cette section est une analyse stratégique, pas un conseil juridique. Pour le launch officiel, il faudra **impérativement** consulter un avocat spécialisé en droit de la musique et en droit du numérique, idéalement avec une expertise en IA et propriété intellectuelle. Budget recommandé : 10-20K€ pour la rédaction des CGU, des licences, et l'audit de conformité initial.

### 12.1 EU AI Act (priorité 1)
Entré en vigueur en août 2024, exécutoire pour les General Purpose AI Models à partir d'août 2025. Les obligations pertinentes pour Trakalog Genesis :

- **Article 53** : Les fournisseurs de GPAI doivent publier un résumé suffisamment détaillé des données d'entraînement. → Trakalog peut leur fournir cette infrastructure de transparence.
- **Article 50** : Les contenus générés par IA doivent être marqués comme tels (machine-readable). → Le badge "Human-Made on Trakalog" est l'inverse positif de cette obligation.
- **Code de conduite GPAI** : Encourage les bonnes pratiques sur le respect des droits d'auteur. → Genesis devient l'outil de référence.

**Action recommandée** : Demander à Trakalog d'être inclus dans les groupes de travail de l'EU AI Office sur les bonnes pratiques GPAI. C'est gratuit, c'est visible, et c'est positionnement parfait.

### 12.2 US Copyright Office
Le bureau a publié plusieurs rapports en 2024-2025 sur l'IA et le copyright. Position actuelle : seuls les contenus avec **contribution humaine substantielle** sont protégeables par copyright. Trakalog Genesis fournit exactement la preuve nécessaire pour démontrer cette contribution humaine.

**Action recommandée** : Publier un livre blanc sur le protocole Genesis et le soumettre au Copyright Office dans le cadre de leurs consultations publiques. Visibilité gratuite, crédibilité maximale.

### 12.3 GDPR (Europe)
Le registre public expose des données personnelles (nom de l'artiste, IPI). Implications :
- **Base légale** : consentement explicite de l'artiste à l'upload (à intégrer dans les CGU Genesis)
- **Droit à l'effacement** : complexe car la blockchain est immuable. Solution : on n'enregistre **que le hash** sur OpenTimestamps, jamais les données personnelles. Les données personnelles restent dans Supabase et peuvent être effacées sans casser la preuve cryptographique.
- **Pseudonymisation** : option de publier un Genesis ID sans révéler l'identité de l'artiste (utile pour les ghostwriters, les producteurs cachés, etc.)

### 12.4 DMCA et équivalents
Les détections de tracks dérivés peuvent déclencher des notifications DMCA automatiques. Risques :
- **Faux positifs** : un DMCA injustifié peut entraîner des sanctions
- **Mitigations** : human-in-the-loop obligatoire pour les notifications, seuils de confidence élevés (>95% pour DMCA auto), possibilité de contestation transparente

### 12.5 Right of Publicity (US) et droits voisins (Europe)
Le **Style Licensing** touche au droit à l'image et à la voix de l'artiste. La Tennessee ELVIS Act (2024) interdit la reproduction non-autorisée de la voix d'un artiste. Le NO FAKES Act (US) est en discussion au Congrès.

**Implication** : Genesis Style Licensing est **parfaitement aligné** avec ces lois car il est strictement opt-in. C'est exactement le mécanisme légal que les législateurs cherchent à promouvoir.

### 12.6 Berne Convention et copyright international
La provenance créative avec horodatage cryptographique constitue une preuve d'antériorité reconnue dans la plupart des juridictions signataires (175 pays). C'est plus solide que les registres nationaux dans 90% des cas car immutable et globalement vérifiable.

### 12.7 Statut d'admission en preuve
Les preuves cryptographiques avec horodatage Bitcoin via OpenTimestamps sont **déjà admises en justice** dans plusieurs pays européens et aux US. Quelques jurisprudences notables existent depuis 2018. À documenter pour le pitch.

### 12.8 Anti-trust et concurrence
Si Genesis devient un standard de facto, attention aux questions anti-trust :
- Garder le protocole **open-source** (déjà prévu)
- Garder l'API publique avec un free tier
- Ne pas exclure les concurrents (philosophie : on est le registre principal, pas le seul)

### Checklist conformité avant launch
- [ ] CGU Trakalog Genesis rédigées par avocat spécialisé
- [ ] Licence AI Training Standard publiée en plusieurs langues (EN, FR, DE, ES)
- [ ] Politique de confidentialité mise à jour (mention du blockchain timestamping)
- [ ] DPA (Data Processing Agreement) pour les clients enterprise
- [ ] Procédure DMCA documentée
- [ ] Procédure d'opposition à une Origin Print
- [ ] Audit RGPD complet
- [ ] Vérification de l'éligibilité du badge "Human-Made" (critères clairs)
- [ ] Mécanisme de révocation d'attestation (si fraude détectée)

---

## 13. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Plateformes IA refusent le standard | Moyenne | Élevé | Lobbying + EU AI Act force la transparence + open-source = adoption facile |
| Faux positifs en derivation detection | Élevée | Moyen | Human-in-the-loop obligatoire, seuils élevés, transparence |
| Attestation humaine fausse (artiste ment) | Moyenne | Moyen | Signature crypto = responsabilité personnelle, sanctions contractuelles, révocation possible |
| Bitcoin timestamp lent (10 min - 1h confirm) | Faible | Faible | OK pour MVP, on peut afficher "pending → confirmed" |
| Concurrent copie le protocole | Moyenne | Faible | C'est OPEN-SOURCE par design — l'effet réseau crée le moat, pas la techno |
| Litige juridique sur la validité de la preuve | Moyenne | Élevé | Jurisprudence favorable existe + on n'est jamais seuls (Wikipedia, Médias français utilisent OTS) |
| Coûts de scaling derivation detection | Élevée | Moyen | Tarification API + plans Pro/Business + partenariats DSP pour data |
| Acceptation par les majors trop lente | Élevée | Moyen | Commencer par les indés et superviseurs sync, créer la preuve sociale, les majors suivent |
| Réglementation change brusquement | Moyenne | Élevé | Position flexible : on s'adapte aux régulations, on ne dépend pas d'une seule |
| Performance hashing à grande échelle | Faible | Faible | Hashing async fire-and-forget, scaling Railway horizontal |

---

## 14. Roadmap d'implémentation

### Phase 1 — MVP (12 semaines)
**Objectif** : Origin Print + Public Registry + AI Training License basique

| Semaine | Livrable |
|---------|----------|
| 1-2 | Audit légal initial + rédaction CGU + spec publique du protocole |
| 3-4 | Audio fingerprinting (Chromaprint + Neural embedding via CLAP) sur Railway |
| 5-6 | Canonical JSON + signature Ed25519 + OpenTimestamps integration |
| 7-8 | Tables DB + RPCs SECURITY DEFINER + RLS |
| 9-10 | UI : choix de licence à l'upload, attestation humaine, page Genesis publique |
| 11 | API publique de vérification + documentation |
| 12 | Tests end-to-end + soft launch sur 10 beta testers |

**Coût estimé** : ~15-25K€ (audit légal + 1-2 mois de dev focusé)

### Phase 2 — Adoption et badges (mois 4-6)
- Badge "Human-Made on Trakalog" intégré sur tous les shared links et pitches
- Publication du livre blanc et soumission au US Copyright Office
- Demande d'inclusion dans les groupes de travail EU AI Office
- Premiers partenariats avec music supervisors (proof of concept)

### Phase 3 — Style Licensing et derivation detection (mois 6-12)
- Style Profiles publics et licensables
- Stripe Connect pour les royalties
- Derivation Detection sur DSP majeurs (Spotify, SoundCloud, YouTube)
- DMCA automation
- API enterprise pour DSP et plateformes IA

### Phase 4 — Standard de l'industrie (mois 12-24)
- Partenariats officiels avec 2-3 plateformes IA (premier deal de licence IA)
- Inclusion dans les conditions d'usage de Spotify/Apple Music (badge "Human-Made certified by Trakalog")
- Negotiations avec les PROs pour intégration mutuelle
- Premiers deals enterprise avec labels indépendants puis majors

---

## 15. Dépendances avec le reste du projet

### Features déjà construites qui alimentent Genesis ✅
- Sonic DNA Profiler (signature stylistique)
- Watermarking invisible (complément naturel de Derivation Detection)
- Splits et signatures cryptographiques (contributeurs vérifiés)
- Audit logs (chaîne de confiance interne)
- Workspaces et permissions (gestion des contributeurs)
- RPCs SECURITY DEFINER (pattern établi pour les writes sensibles)

### Features à construire ou enrichir en parallèle
- **Stripe Connect** (déjà en cours pour billing) — sera réutilisé pour les royalties
- **API publique** — bénéficie au Genesis API mais aussi à l'API générale Trakalog
- **Email branding et CGU multi-langues** — base pour l'internationalisation

### Features qui prendront de la valeur grâce à Genesis
- **Smart A&R** : peut filtrer par "Human-Made certified"
- **Pitches** : badge dans chaque email pour ajouter de la crédibilité
- **Shared Links** : protection légale renforcée
- **Sync Matchmaker** (futur) : argument de vente décisif vs concurrence

---

## 16. KPIs à tracker

### KPIs d'adoption
- Nombre de Genesis Records créés par mois
- Pourcentage de tracks uploadés qui choisissent Genesis (cible : >70% des plans payants)
- Nombre de vérifications publiques de l'API (proxy d'adoption externe)
- Nombre d'embed du badge "Human-Made" en dehors de Trakalog

### KPIs business
- Revenus AI Training Royalties (à partir du mois 12)
- Revenus Style Licensing (à partir du mois 6)
- Conversion Free→Pro (impact attendu : +15-25%)
- Conversion Pro→Business (impact attendu : +10-20%)

### KPIs stratégiques
- Mentions dans la presse spécialisée et tech
- Citations dans des rapports réglementaires
- Partenariats officiels avec plateformes IA et DSP
- Adoption par des labels et publishers

---

## 17. Le pitch en une phrase

**"Trakalog Genesis est le registre mondial de provenance créative musicale à l'ère de l'IA — la preuve cryptographique qui dit qui a créé quoi, quand, avec quelles permissions, et qui doit être payé. C'est l'infrastructure que toute l'industrie cherche et que personne d'autre n'est en position de construire."**

---

## 18. La phrase à retenir pour Yannick

Trakalog n'est plus un "Disco premium". Trakalog devient **l'infrastructure réglementaire et éthique de l'industrie musicale à l'ère de l'IA**. C'est la différence entre vendre un produit (que les concurrents copient en 6 mois) et construire une catégorie (que personne ne peut copier).

Le moment est *maintenant*. La fenêtre se ferme dès que la première grosse plateforme (ou un consortium des majors) lance sa propre solution. Six à douze mois pour positionner Trakalog comme standard de facto avant que quelqu'un d'autre essaie.

---

*Ce document est vivant. Il sera mis à jour au fur et à mesure du développement, des consultations légales, et de l'évolution réglementaire.*
