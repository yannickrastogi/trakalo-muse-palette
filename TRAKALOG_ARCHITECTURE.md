# TRAKALOG — Architecture & Vision Produit

> **Document créé le :** 26 mars 2026
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

### Où le branding apparaît
- **Shared Links** (track, playlist, pack) — hero + logo + color
- **Pitch emails** — hero en bannière, logo en footer (phase 2)

### Où le branding N'apparaît PAS
- Studio QR page (/studio/:token) — page générique Trakalog
- Sign Agreement page (/sign/:token) — page générique Trakalog
- L'interface interne de l'app — reste en branding Trakalog standard

---

## 5. Architecture des Tracks

### Ownership
- Un track appartient à **un seul workspace** (workspace_id sur la table tracks)
- Le track est uploadé dans un workspace = c'est son "home"
- Le track peut être **partagé** vers d'autres workspaces via catalog_shares

### Cycle de vie
1. **Upload** → analyse audio (BPM, Key, Genre, Mood) + waveform + compression MP3 preview
2. **Documentation** → métadonnées, splits, paperwork, lyrics, stems
3. **Distribution** → pitches, shared links, Trakalog Pack
4. **Suivi** → engagement analytics (plays, downloads, comments)

### Fichiers associés
- Audio original (WAV/MP3) → bucket "tracks"
- Preview MP3 128kbps → bucket "tracks" (path audio_preview_url)
- Cover art → bucket "covers"
- Stems → bucket "stems"
- Documents/Contracts → bucket "documents" (watermarkés TRAKALOG au download)

---

## 6. Shared Links & Trakalog Pack

### Types de partage
- **Track Share** — un track avec player + lyrics + comments
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

### Règle importante
Les splits et signatures sont liés au **track**, pas au workspace. Si un track est partagé via catalog_shares, les splits restent gérés par le workspace source (l'artiste).

---

## 8. IA Agents (Roadmap)

Référence : TRAKALOG_AI_AGENTS_VISION.md

Ordre d'implémentation :
1. Sonic DNA Profiler (analyse audio avancée)
2. Split Mediator (médiation splits en studio)
3. Sync Matchmaker (matching avec briefs sync)
4. Session Replay Analyst (interprétation heatmaps)
5. Ghost Revenue Hunter (revenus non-réclamés)
6. Catalog Awakener (réactivation catalogues dormants)
7. Network Weaver (connexions artistes)

---

## 9. Stack Technique

- **Frontend** : React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion
- **Backend** : Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Audio** : Essentia.js (analyse), lamejs (compression MP3), Web Audio API (waveform)
- **IA** : Groq (Whisper transcription + Llama Smart A&R)
- **Email** : Resend (noreply@trakalog.com)
- **Hébergement** : Vercel (app.trakalog.com) + Cloudflare (DNS)
- **PDF** : jsPDF (génération) + pdf-lib (watermarking)

---

## 10. Roadmap d'implémentation

### Phase actuelle — Private Beta
- ✅ Core features (upload, player, lyrics, shared links, pitches, splits, signatures)
- ✅ UI/UX polish (toutes les pages redesignées style Trakalog premium)
- ✅ Branding workspace (hero image, logo, brand color)
- 🔄 Audit et bug fixes

### Phase suivante — Multi-Workspace
1. Multi-workspace par compte + switcher
2. Nouveau système de permissions (4 niveaux d'accès + titre professionnel)
3. Catalog sharing entre workspaces

### Phase 3 — Sécurité avancée
1. Watermarking audio invisible
2. Rate limiting global
3. CSP headers
4. IP logging
5. Audit logs

### Phase 4 — IA Agents
Référence : TRAKALOG_AI_AGENTS_VISION.md

---

*Ce document est vivant. Il sera mis à jour au fur et à mesure du développement.*
