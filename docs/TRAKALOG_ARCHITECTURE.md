# TRAKALOG — Architecture & Vision Produit

> **Document créé le :** 26 mars 2026
> **Dernière mise à jour :** 15 mai 2026
> **Objectif :** Source de vérité pour toutes les décisions d'architecture Trakalog.
> **Règle :** Consulter ce document avant chaque feature majeure.

---

## 1. Modèle Utilisateur

### Compte (l'humain)
Un humain = un compte = un login. Authentification via email/password ou Google OAuth.

### Workspaces (les projets/entités)
Chaque workspace = une identité distincte. Un compte peut avoir **plusieurs workspaces**.

Exemples :
- "Yannick Rastogi" → workspace artiste perso
- "Studio XYZ" → workspace label
- "Client — Eliot" → workspace pour gérer un artiste
- "Client — Sarah" → workspace pour gérer une autre artiste

Chaque workspace a :
- Son propre catalogue de tracks
- Son propre branding (hero image, logo, brand color)
- Ses propres membres avec des niveaux d'accès
- Ses propres pitches, shared links, contacts

### Workspace Switcher
L'utilisateur peut naviguer entre ses workspaces via un switcher dans le sidebar/header. Le contexte entier de l'app change selon le workspace actif.

---

## 2. Système de Permissions

### Principe fondamental
**Le titre professionnel et le niveau d'accès sont séparés.**

### Niveaux d'accès (permissions)

| Niveau | Voir/Écouter | Playlists/Pitch/Share | Modifier Metadata/Stems/Lyrics | Splits/Supprimer/Inviter/Branding |
|--------|:---:|:---:|:---:|:---:|
| **Viewer** | ✅ | ❌ | ❌ | ❌ |
| **Pitcher** | ✅ | ✅ | ❌ | ❌ |
| **Editor** | ✅ | ✅ | ✅ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ |

### Titres professionnels (display only, aucun impact sur les permissions)
Producer, Songwriter, Musician, Mix Engineer, Mastering Engineer, Manager, Publisher, A&R, Assistant, Artist, Viewer

Le titre est affiché sur le profil, les crédits, les splits. Il n'a **aucun impact** sur ce que la personne peut faire dans la plateforme.

### Invitation
Quand on invite quelqu'un dans un workspace, on choisit :
1. Son **niveau d'accès** (Viewer / Pitcher / Editor / Admin)
2. Son **titre professionnel** (Producer / Songwriter / etc.)

---

## 3. Catalog Sharing (partage entre workspaces)

### Le problème
Un label (Universal) gère plusieurs artistes (Eliot, Sarah). Chaque artiste a son workspace. Le label veut pitcher des tracks de plusieurs artistes dans une même playlist, sous le branding du label.

### La solution : Catalog Share

L'artiste **partage ses tracks** vers un workspace externe. Le track reste propriété de l'artiste, mais une **référence** apparaît dans le catalogue du label.

### Flow

1. **Eliot** (workspace "Eliot") → ouvre un track → "Share to Workspace" → sélectionne "Universal Music"
2. Eliot choisit le **niveau d'accès** pour ce partage :
   - **Viewer** — Universal peut voir et écouter
   - **Pitcher** — Universal peut écouter + playlist + pitch + share links
   - **Editor** — + modifier métadonnées, stems, lyrics, paperwork (PAS les splits)
   - **Admin** — accès complet, identique à Eliot
3. **Universal** voit le track dans son catalogue, tagué "via Eliot"
4. Universal crée une playlist avec tracks d'Eliot + Sarah → pitche sous branding Universal
5. **Eliot voit** que son track est partagé, que Universal l'a pitché, et les stats d'engagement

### Règles
- Le track reste dans le workspace source (Eliot). Le workspace cible (Universal) a un **accès référencé**.
- L'artiste peut **révoquer** l'accès à tout moment → le track disparaît du catalogue du label.
- Les stats d'engagement remontent **aux deux** : le label ET l'artiste voient les plays/downloads.
- Le branding des pitches/share links est celui du **workspace qui envoie** (Universal), pas celui de l'artiste.
- L'artiste peut donner un accès différent **par track** ou **pour tout son catalogue d'un coup**.

### Table DB : catalog_shares
```sql
catalog_shares (
  id uuid PRIMARY KEY,
  track_id uuid REFERENCES tracks(id),
  source_workspace_id uuid REFERENCES workspaces(id),  -- Eliot
  target_workspace_id uuid REFERENCES workspaces(id),  -- Universal
  shared_by uuid REFERENCES auth.users(id),
  access_level text NOT NULL DEFAULT 'pitcher',  -- viewer/pitcher/editor/admin
  status text NOT NULL DEFAULT 'active',  -- active/revoked
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz DEFAULT NULL
)
```

---

## 4. Branding (Brand Kit)

### Par workspace
Chaque workspace peut configurer :
- **Hero Image** — image de fond (1920×600px) affichée sur les shared links et pitches
- **Logo** — logo affiché à côté de TRAKALOG
- **Brand Color** — couleur accent pour les pages brandées
- **Réseaux sociaux** — Instagram, TikTok, YouTube, Facebook, X (affichés sur les shared links)

### Où le branding apparaît
- **Shared Links** (track, playlist, pack) — hero + logo + color + socials
- **Pitch emails** — hero en bannière, logo en footer

### Où le branding N'apparaît PAS
- Studio QR page (/studio/:token) — page générique Trakalog
- Sign Agreement page (/sign/:token) — page générique Trakalog
- L'interface interne de l'app — reste en branding Trakalog standard
- Genesis public registry pages — restent neutres pour préserver la crédibilité du registre

---

## 5. Architecture des Tracks

### Ownership
- Un track appartient à **un seul workspace** (workspace_id sur la table tracks)
- Le track est uploadé dans un workspace = c'est son "home"
- Le track peut être **partagé** vers d'autres workspaces via catalog_shares

### Cycle de vie
1. **Upload** → analyse audio (BPM, Key, Genre, Mood) + waveform + compression MP3 preview
2. **Genesis Print** → empreinte cryptographique (Chromaprint + Neural embedding + Sonic DNA signature) + OpenTimestamps Bitcoin proof + licence IA déclarée → voir section 8
3. **Documentation** → métadonnées, splits, paperwork, lyrics, stems
4. **Distribution** → pitches, shared links, Trakalog Pack
5. **Suivi** → engagement analytics (plays, downloads, comments)

### Fichiers associés
- Audio original (WAV/MP3/FLAC/AIFF/M4A/OGG) → bucket "tracks"
- Preview MP3 128kbps → bucket "tracks" (path audio_preview_url)
- Cover art → bucket "covers"
- Stems → bucket "stems"
- Documents/Contracts → bucket "documents" (watermarkés TRAKALOG au download)
- Audio watermarkés per-visitor → bucket "watermarked" (cache)

### Track Versioning
Spec dans `docs/TRACK_VERSIONING.md`. Plusieurs versions audio sous un même track (V1, V2, Radio Edit), A/B switching au même timecode, version active pour pitches/shared links, Sonic DNA et Genesis Print par version.

---

## 6. Shared Links & Trakalog Pack

### Types de partage
- **Track Share** — un track avec player + lyrics + comments + credits
- **Playlist Share** — une playlist avec player
- **Stems Share** — stems d'un track
- **Trakalog Pack** — ZIP contenant : track hi-res, cover art, lyrics PDF brandé, metadata PDF brandé, splits PDF, paperwork watermarké TRAKALOG, signed splits PDF si disponible

### Gate Screen
Chaque shared link a un gate screen (nom, email, rôle, company) qui collecte les infos du recipient. Cookie "trakalog_visitor" de 2 jours pour skip le gate screen au retour.

### Protection
- Public (pas de password)
- Secured (password PBKDF2 100k itérations)
- Expiration date optionnelle
- Disable/Enable par l'owner
- **Audio watermarking invisible** per-visitor (audiowmark via Railway)
- **Leak tracing** : upload d'un fichier suspect → identification du leaker via le payload watermarké
- **Badge "Human-Made on Trakalog"** affiché si le track a une Genesis Print avec attestation humaine signée

### Fichiers servis à la racine
- `/ai-training-license.txt` — déclaration machine-readable de la licence IA du track (voir section 8)

---

## 7. Splits & Signatures

### Flow
1. Track uploadé → QR code studio pour que les guests déclarent leurs contributions
2. Admin approve/reject les submissions
3. Splits ajustés (total = 100%)
4. "Send for Signature" → email à chaque collaborateur
5. Chaque collaborateur signe sur /sign/:token (canvas signature)
6. "All splits signed" → Download Signed PDF / Send Executed Copies
7. Les signatures fonctionnent même avec **un seul collaborateur**

### Structure
- Multi-rôles (max 4 : Songwriter, Producer, Artist, Musician)
- Multi-PROs (max 3 parmi 68 PROs mondiaux)
- Stage name supporté
- Auto-fill depuis les contacts du workspace
- Save-back automatique vers la table contacts

### Règle importante
Les splits et signatures sont liés au **track**, pas au workspace. Si un track est partagé via catalog_shares, les splits restent gérés par le workspace source (l'artiste). Les splits signés sont intégrés dans la Genesis Print du track (voir section 8).

---

## 8. GENESIS — Infrastructure de provenance créative

> **Référence détaillée :** `docs/TRAKALOG_GENESIS.md`
>
> Genesis n'est pas un agent IA parmi d'autres. C'est **la couche d'infrastructure transverse** sur laquelle s'appuient à terme tous les agents et toutes les features touchant à la création, la signature, et la distribution de tracks.

### Le principe
À chaque track uploadé, Trakalog crée une **Origin Print** : empreinte cryptographique horodatée sur Bitcoin via OpenTimestamps, signée par l'artiste, avec licence d'entraînement IA explicitement déclarée. C'est l'équivalent d'un acte notarié, mais immutable, vérifiable mondialement, et gratuit à grande échelle.

### Les cinq composants

| Composant | Rôle |
|-----------|------|
| **Origin Print** | Empreinte cryptographique de création (SHA-256 + Chromaprint + Neural embedding + Sonic DNA + Bitcoin timestamp) |
| **AI Training License** | Licence d'entraînement IA déclarée et opposable (NO-AI / PAID-AI / ATTR-AI / OPEN-AI) |
| **Public Registry** | Registre mondial consultable via `trakalog.com/genesis/{id}` + API publique |
| **Style Licensing** | Monétisation du Sonic DNA comme asset financier (opt-in, royalties via Stripe Connect) |
| **Derivation Detection** | Détection des tracks dérivés / clonés sur DSP, plateformes IA, et UGC |

### Intégration dans le cycle de vie d'un track

```
Upload audio
  ↓
Compression preview + Sonic DNA (existant)
  ↓
GENESIS PIPELINE (nouveau)
  - Audio hashing (SHA-256, Chromaprint, Neural embedding)
  - Collecte des splits signés et attestation humaine
  - Choix de la licence IA par l'artiste
  - Canonical JSON + signature Ed25519
  - Submission OpenTimestamps → Bitcoin proof
  - Stockage dans genesis_records
  ↓
Track utilisable dans pitches, shared links, etc.
  - Badge "Human-Made on Trakalog" affiché si attestation signée
  - `/ai-training-license.txt` servi sur chaque shared link
  - Vérification publique via trakalog.com/genesis/{id}
  ↓
EN ARRIÈRE-PLAN
  - Derivation Detection (cron quotidien sur DSP/IA/UGC)
  - AI Training Royalties (distribution mensuelle via Stripe Connect)
```

### Tables DB principales
- `genesis_records` — un record par track avec hashes, licence, signature, OTS proof
- `genesis_license_history` — audit trail des modifications de licence
- `genesis_derivations` — détections de tracks dérivés / clonés
- `genesis_style_profiles` — profils stylistiques publics et licensables
- `genesis_style_licenses` — licences de style octroyées
- `genesis_ai_royalties` — redevances d'entraînement IA distribuées

### Stack technique additionnel
- **Chromaprint** (fpcalc) — fingerprint perceptive open-source
- **CLAP / MERT** — neural embeddings audio open-source
- **pgvector** — similarity search sur les embeddings (déjà compatible Supabase)
- **OpenTimestamps** — timestamping Bitcoin gratuit et scalable
- **Ed25519** (libsodium) — signatures cryptographiques modernes
- **JCS (RFC 8785)** — canonical JSON pour les hashes reproductibles

### Pourquoi maintenant
2026 est la fenêtre de tir précise : l'EU AI Act devient exécutoire, le US Copyright Office légifère, les majors paniquent face à l'IA générative, et **aucun standard mondial n'existe**. Trakalog a déjà 80% de l'infrastructure technique (Sonic DNA, watermarking, leak tracing, splits cryptographiques). Premier mover = standard de facto.

### Stratégie business
- **Open-source du protocole** sur GitHub → adoption rapide + protection anti-trust
- **Trakalog reste le registre principal** → effet réseau pur
- **Revenus directs** : API enterprise (DSP/IA), AI Training Royalties (commission 15-20%), Style Licensing, Genesis Verified Badge add-on
- **Revenus indirects** : conversion Free→Paid massive grâce à la protection légale renforcée

---

## 9. IA Agents (Roadmap)

> **Référence détaillée :** `docs/TRAKALOG_AI_AGENTS_VISION.md`
>
> Note : Genesis (section 8) est l'infrastructure fondamentale sur laquelle ces agents s'appuient. Le Sonic DNA Profiler, par exemple, alimente à la fois le Smart A&R, le Sync Matchmaker, et le Style Licensing du protocole Genesis.

Ordre d'implémentation :
1. Sonic DNA Profiler ✅ (déjà implémenté)
2. Smart Brief Matching (en cours)
3. Brief Seeker — spec `docs/BRIEF_SEEKER.md`
4. Artist Seeker — spec `docs/ARTIST_SEEKER.md`
5. Sync Matchmaker
6. Session Replay Analyst
7. Ghost Revenue Hunter
8. Catalog Awakener
9. Network Weaver
10. Split Mediator

---

## 10. Stack Technique

### Frontend
React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion + i18next (8 langues)

### Backend
Supabase (PostgreSQL + Auth + Storage + Edge Functions) — project ref `xhmeitivkclbeziqavxw`

### Audio
- **Essentia.js** — analyse client-side (waveform, durée)
- **Essentia Python (Railway)** — RhythmExtractor2013 pour BPM avec normalisation 80-180 BPM
- **lamejs** — compression MP3 preview
- **Web Audio API** — waveform et player
- **audiowmark (Railway)** — watermarking audio invisible
- **Chromaprint / fpcalc** (futur Genesis) — perceptual fingerprinting
- **CLAP / MERT** (futur Genesis) — neural embeddings audio

### IA
- **Groq** (Whisper transcription + Llama Smart A&R)
- **Claude API** (futur — pour les agents avancés, Brief Writer, Artist Seeker)

### Cryptographie (futur Genesis)
- **Ed25519 / libsodium** — signatures
- **OpenTimestamps** — Bitcoin timestamping
- **JCS (RFC 8785)** — canonical JSON

### Email
**Resend** (noreply@trakalog.com, reply-to routing)

### Payments
**Stripe** (en cours d'intégration — voir `docs/TRAKALOG_BILLING.md`)
**Stripe Connect** (futur — pour Genesis royalties)

### Hébergement
- **Vercel** (app.trakalog.com)
- **Cloudflare** (DNS, futur cache pour Genesis API)
- **Railway** (watermarking service, sonic-dna-profiler, futur crawler Genesis)

### PDF
- **jsPDF** — génération
- **pdf-lib** — watermarking
- **pdfjs-dist** — extraction texte

### Sécurité
- RLS Supabase + SECURITY DEFINER RPCs
- Rate limiting (18/18 Edge Functions)
- CSP headers, IP logging, audit logs
- 2FA TOTP, signed URLs 5min, audio watermarking
- PBKDF2 100k iterations pour les passwords de shared links

---

## 11. Roadmap d'implémentation

### Phase actuelle — Private Beta ✅
- Core features (upload, player, lyrics, shared links, pitches, splits, signatures)
- UI/UX polish (toutes les pages redesignées style Trakalog premium)
- Branding workspace (hero image, logo, brand color, socials)
- Multi-workspace + permissions 4 niveaux + catalog sharing
- Sécurité complète (rate limiting, CSP, audit logs, 2FA, watermarking, leak tracing)
- Sonic DNA Profiler opérationnel
- Audit code et fixes

### Phase suivante — Pré-launch
1. Onboarding complet (spec `docs/ONBOARDING.md`)
2. Billing / Stripe (spec `docs/TRAKALOG_BILLING.md`)
3. Google OAuth production
4. Tests end-to-end avec beta testers
5. **Audit légal initial Genesis** (avocat spécialisé IA + propriété intellectuelle)

### Phase 3 — Launch + Genesis MVP (12 semaines après pré-launch)
1. Genesis Phase 1 — Origin Print + Public Registry + AI Training License (voir `docs/TRAKALOG_GENESIS.md`)
2. Smart Brief Matching Phase 1
3. Admin Dashboard Phase 1 (spec `docs/TRAKALOG_ADMIN_DASHBOARD.md`)

### Phase 4 — Adoption et différenciation
1. Genesis Phase 2 — Badge "Human-Made", livre blanc, EU AI Office, US Copyright Office
2. Track Versioning (spec `docs/TRACK_VERSIONING.md`)
3. Brief Seeker Phase 1 (spec `docs/BRIEF_SEEKER.md`)
4. Artist Seeker Phase 1 (spec `docs/ARTIST_SEEKER.md`)

### Phase 5 — Standard de l'industrie
1. Genesis Phase 3 — Style Licensing + Derivation Detection + API Enterprise
2. Sync Matchmaker
3. Music Supervisor accounts + catalogue search
4. Premiers partenariats officiels (plateformes IA, DSP, labels indépendants)

### Phase 6 — Long terme
1. Genesis Phase 4 — Adoption majors, intégration PROs, deals enterprise sept chiffres
2. Sonic DNA Profiler évolution continue
3. Ghost Revenue Hunter
4. Split Mediator
5. Session Replay Analyst
6. Catalog Awakener
7. Network Weaver

---

## 12. Principes architecturaux transversaux

- **Auth fragile = priorité absolue** : ne jamais écrire dans la clé Supabase native, toujours backup en localStorage, autoRefreshToken démarré manuellement après session validée
- **Pages publiques zéro GoTrueClient** : fetch() REST direct depuis constants.ts
- **Writes sensibles** : RPCs SECURITY DEFINER avec `_user_id` explicite
- **Enums PostgreSQL dans RPCs** : casts explicites obligatoires
- **Soft deletes** au lieu de hard deletes pour l'intégrité légale
- **Workspaces** = unité organisationnelle principale (remplace les anciens teams)
- **Genesis ID** = identifiant cryptographique transverse, à intégrer dans toute feature touchant à la création/distribution
- **Open-source par design** pour le protocole Genesis (anti-trust + adoption)

---

*Ce document est vivant. Il sera mis à jour au fur et à mesure du développement.*
