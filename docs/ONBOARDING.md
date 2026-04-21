# TRAKALOG — Onboarding (Feature Spec)

> **Document créé le :** 16 avril 2026
> **Basé sur :** Audit complet — 28 routes, 16 pages protégées, 15 modales, 13 contexts
> **Objectif :** Guider chaque nouvel utilisateur à travers TOUTES les fonctionnalités de Trakalog.
> **Statut :** Prochaine priorité

---

## Philosophie

L'utilisateur doit comprendre dès le premier login que Trakalog n'est pas un simple cloud musical — c'est un système nerveux intelligent pour son catalogue. Plus il remplit les détails, plus Trakalog travaille pour lui.

**Quatre couches d'onboarding :**
1. **Welcome + Setup** — premier contact, profil, workspace
2. **Guided Tour** — tour interactif step-by-step de toute l'interface
3. **Checklist Dashboard** — progress bar avec actions clés
4. **Guide permanent** — accessible à tout moment pour revoir les explications

---

## Couche 1 — Welcome + Setup (premier login)

### Welcome Screen (modal plein écran)

- Logo Trakalog gradient animé
- "Welcome to Trakalog"
- "Your intelligent catalog manager — manage, protect, pitch and connect your music."
- "Let us show you around — it takes 2 minutes."
- Deux boutons : **"Start Tour"** (primary gradient) et **"Skip for now"** (ghost)
- Si skip → Dashboard direct, tour disponible plus tard via "?"

### Step 1 — Profile Setup

- "Let's set up your profile"
- Champs : Full Name, Profile Photo (drag & drop ou click)
- "This is how your collaborators and contacts will see you."
- Bouton "Next →"

### Step 2 — Workspace Setup

- "Name your workspace"
- Explication : "A workspace is your creative space — your artist name, label, studio, or project."
- Input pré-rempli avec le nom auto-généré
- "You can create multiple workspaces later for different projects or clients."
- Bouton "Let's go! →"

---

## Couche 2 — Guided Tour (18 steps)

Chaque step = spotlight sur un élément + message box avec flèche + "Next" / "Skip Tour"
Progress bar : "Step X of 18"

### Sidebar Navigation (Steps 3-9)

**Step 3 — Dashboard**
- Highlight : icône Dashboard dans sidebar
- "📊 Dashboard — Your command center. See your catalog stats, recent activity, and quick actions at a glance."

**Step 4 — Tracks (Catalog)**
- Highlight : icône Tracks
- "📀 Your Catalog — Upload and manage all your tracks here. Each track is automatically analyzed by Sonic DNA to detect BPM, key, and audio characteristics. Search, filter by genre/key/status/BPM, switch between list and grid view."

**Step 5 — Playlists**
- Highlight : icône Playlists
- "🎵 Playlists — Organize your tracks into themed playlists for pitching. Customize with gradient colors and mood tags. Share entire playlists with one branded link."

**Step 6 — Pitch**
- Highlight : icône Pitch
- "🎯 Pitch — Send your tracks to A&R, labels, supervisors, and publishers. Trakalog tracks every interaction: when they open, listen, and how long they engage. Build a pipeline: Draft → Sent → Opened → Responded."

**Step 7 — Contacts**
- Highlight : icône Contacts
- "👥 Contacts — Your industry network, built automatically. When someone listens to your shared link, their info is captured through the gate screen. When collaborators scan your studio QR code, they're added too. You can also add contacts manually. Export to PDF, CSV or Excel anytime."

**Step 8 — Shared Links**
- Highlight : icône Shared Links
- "🔗 Shared Links — Create secure links to share individual tracks, playlists, or full packs (track + cover + stems + credits PDF). Password-protect them, set expiration dates, and track engagement in real-time. Every listener is audio-watermarked for leak protection."

**Step 9 — Workspace Settings**
- Highlight : icône Workspace (si visible)
- "🏢 Workspace Settings — Your workspace, your brand. This is where the magic happens behind the scenes."

### Header Tools (Steps 10-12)

**Step 10 — Smart A&R**
- Highlight : icône Smart A&R dans le header
- "🤖 Smart A&R — Your AI-powered music matchmaker. Paste any brief and Trakalog's AI analyzes your ENTIRE catalog using Sonic DNA data (BPM, key, energy, mood, structure) to find the perfect tracks. The more metadata you add to your tracks, the smarter the matching becomes."

**Step 11 — Trakalog Radio**
- Highlight : icône Radio dans le header
- "📻 Trakalog Radio — Shuffle through your catalog with crossfade. Filter by genre and mood. Rediscover forgotten gems in your catalog."

**Step 12 — Notifications**
- Highlight : icône cloche
- "🔔 Notifications — Stay informed. Get notified when someone listens to your shared links, leaves comments, signs splits, joins your workspace, or uploads tracks. Filter by time period."

### Workspace Features (Steps 13-16)

**Step 13 — Branding**
- Highlight : onglet Branding (si dans workspace settings) ou skip si pas visible
- "🎨 Branding — Make every shared link and pitch look professional. Upload a hero image, logo, set your brand color, and add your social media links (Instagram, TikTok, YouTube, etc.). Your recipients see YOUR brand, not Trakalog."

**Step 14 — Team & Permissions**
- Highlight : onglet Members (si visible)
- "👥 Team — Invite collaborators with 4 permission levels: Viewer (listen only), Pitcher (create playlists & pitch), Editor (modify metadata & stems), Admin (full control including splits & branding). Each member gets a professional title displayed on credits."

**Step 15 — Catalog Sharing**
- Highlight : onglet Catalog Sharing (si visible)
- "🔄 Catalog Sharing — Share your entire catalog with other workspaces (labels, managers, publishers). They can pitch your tracks under their own branding while you keep full control. Revoke access anytime."

**Step 16 — Leak Tracing**
- Highlight : onglet Leak Tracing (si visible)
- "🛡️ Leak Tracing — Every shared link is invisibly audio-watermarked. If your music leaks, upload the leaked file and Trakalog identifies exactly who received that version. Enterprise-grade protection built in."

### Track Features (Steps 17-18)

**Step 17 — Track Details**
- Highlight : bouton Upload Track
- "📝 Track Details — Each track has: lyrics (auto-transcribed or manual), stems management, splits with digital signatures, timecoded comments from recipients, and a full activity history. Everything in one place."

**Step 18 — Sonic DNA & Upload (CTA final)**
- Highlight : bouton Upload Track
- "🧬 Sonic DNA — When you upload a track, Trakalog automatically analyzes it: BPM, key, energy curves, spectral characteristics, and more. This powers the Smart A&R matching. Pro tip: the more you fill in (genre, mood tags, lyrics, language, type), the better the AI understands your music and finds opportunities."
- Bouton : **"Upload my first track →"** (ouvre le modal d'upload)
- Sous le bouton : "You can also use Quick Upload to skip the details and add them later."

### Comportement du tour

- Overlay semi-transparent avec spotlight (trou) autour de l'élément
- Message box positionnée intelligemment (ne masque pas l'élément)
- Flèche pointant vers l'élément
- Progress : "Step X of 18"
- "← Back" / "Next →" / "Skip Tour"
- Si refresh : reprend au même step (localStorage)
- Si skip : tout est marqué comme vu
- Quand terminé : confetti animation + "You're all set! 🎉"

---

## Couche 3 — Checklist Dashboard

### Emplacement
Bloc en haut du Dashboard, avec progress bar animée.

### Items (se cochent automatiquement)

1. ☐ Complete your profile (name & photo)
2. ☐ Name your workspace
3. ☐ Set up workspace branding (hero image or logo)
4. ☐ Upload your first track
5. ☐ Add mood tags to a track
6. ☐ Add lyrics to a track (manual or auto-transcribe)
7. ☐ Create a playlist
8. ☐ Create a shared link
9. ☐ Send your first pitch
10. ☐ Add a contact
11. ☐ Invite a team member (optionnel, marqué "bonus")

### Comportement
- Chaque item se coche automatiquement quand l'action est effectuée (pas de clic manuel)
- Progress bar : "4 of 11 completed"
- Message motivant à chaque milestone : "Great start!" / "You're getting the hang of it!" / "Power user! 🔥"
- Quand 10/11 (tout sauf invite) : "🎉 You've mastered Trakalog! You can dismiss this checklist."
- Bouton "Dismiss" pour masquer
- Peut être ré-affiché depuis le Guide

---

## Couche 4 — Guide permanent

### Accès
- Icône "?" dans le header (à côté de la cloche)
- Dans le dropdown profil : "Help & Guide"
- Option dans la checklist : "Replay Tour"

### Contenu du Guide (page ou modal avec accordion)

**🚀 Getting Started**
- What is Trakalog?
- "Trakalog is the intelligent nervous system for your music catalog. Think of it as Dropbox + intelligent catalog manager + pitch automation. Upload your tracks, and Trakalog protects them, analyzes them, connects them to opportunities, and tracks every interaction."
- Setting up your workspace
- Uploading your first track
- Quick Upload vs detailed upload

**🧬 Sonic DNA & Smart A&R**
- What is Sonic DNA?
- "When you upload a track, Trakalog analyzes the audio and creates a unique fingerprint: BPM, key, energy curves, spectral characteristics (brightness, warmth), structure, and intro analysis. This data powers the Smart A&R — the more complete your track metadata, the better the AI matching."
- How to maximize your Sonic DNA: add genre, mood tags, lyrics, language, gender, type
- Using Smart A&R: paste a brief, get instant matches
- How matching works: Sonic DNA + metadata + brief analysis

**📀 Catalog Management**
- Uploading tracks (single & bulk, Quick Upload)
- Editing track details (17+ metadata fields)
- Managing stems (upload, organize by type)
- Track sections (manual waveform editor: double-click to add, rename, delete)
- Lyrics (manual, import PDF/TXT, auto-transcribe)
- Re-analyzing audio (Sonic DNA re-analysis)

**🎵 Playlists**
- Creating playlists (gradient picker, mood/genre tags)
- Adding/removing/reordering tracks
- Sharing playlists (branded links)

**🎯 Pitching**
- Creating a pitch (select tracks or playlist)
- Pitch pipeline (Draft → Sent → Opened → Responded)
- Tracking engagement (who opened, listened, how long)
- Branded pitch emails

**🔗 Sharing & Security**
- Shared links (track, playlist, stems, Trakalog Pack)
- Gate screen (auto-collects visitor info: name, email, role, company)
- Password protection (PBKDF2 100k iterations)
- Expiration dates
- Audio watermarking (invisible, per-visitor)
- Leak tracing (upload leaked file → identify source)
- Download options (original, preview, Trakalog Pack ZIP)

**👥 Contacts**
- How contacts are auto-collected (gate screen, QR studio, manual)
- Contact fields (name, email, role, company, PRO, IPI)
- Export (PDF, CSV, XLSX)
- Contact history (pitch/shared link activity)

**✍️ Splits & Signatures**
- Adding splits (collaborator auto-complete from contacts)
- Roles: Songwriter, Producer, Artist, Musician
- PRO selection (60+ worldwide PROs)
- IPI number
- Digital signatures (canvas signature, PDF generation)
- Studio QR code (collaborators fill their info remotely)

**🏢 Workspace & Team**
- Multi-workspace (artist workspace, label workspace, client workspace)
- Workspace switcher
- Branding (hero image, logo, brand color, focal point, social links)
- Team permissions (Viewer / Pitcher / Editor / Admin)
- Professional titles (display only)
- Catalog sharing between workspaces (share & revoke)
- Invitation system

**📻 Radio**
- Shuffle mode with crossfade
- Genre and mood filters
- Rediscovering your catalog

**🔔 Notifications**
- 5 notification types: link activity, comments, signatures, new members, track uploads
- Email notifications (configurable per type)
- In-app notification center

**⚙️ Settings**
- Profile (name, email, avatar)
- Notifications preferences (5 toggles)
- Security (password, 2FA TOTP)
- Appearance (theme, accent color, motion, sidebar)
- Language (8 languages)

**💡 Tips & Best Practices**
- "The more metadata you add, the better Smart A&R matches your tracks to briefs."
- "Add mood tags — they help A&R professionals find exactly what they're looking for."
- "Add lyrics to unlock text-based search and matching."
- "Set up your branding before sharing links — first impressions matter."
- "Use Quick Upload for bulk imports, then add details later at your own pace."
- "Create sections on your waveform for professional track presentations."
- "Check your Shared Links dashboard regularly — see who's listening."
- "Use the Studio QR code during recording sessions to capture splits in real-time."

### Feature Spotlights (contextuel)

Petit icône "?" discret sur chaque page qui ouvre une explication contextuelle :

| Page | Explication |
|------|------------|
| Tracks | "Upload tracks, manage metadata. Sonic DNA auto-detects BPM & key." |
| Track Detail | "Edit all metadata, manage stems, splits, lyrics. Add sections on the waveform." |
| Playlists | "Organize tracks into themed playlists. Share with one branded link." |
| Pitch | "Send tracks to contacts. Track opens, listens, and responses." |
| Smart A&R | "Paste a brief. AI matches your catalog using Sonic DNA." |
| Contacts | "Auto-collected from gate screens and QR codes. Export anytime." |
| Shared Links | "Secure links with password, expiration, watermark. Track engagement." |
| Workspace Settings | "Branding, team, catalog sharing, leak tracing." |
| Approvals | "Review and approve changes from team members." |

---

## Couche 5 — Empty States

Chaque page vide a un message engageant avec CTA clair + illustration/icône :

**Dashboard (nouveau compte)**
- Illustration Trakalog
- "Welcome to your Dashboard"
- "This is where you'll see your catalog stats, recent activity, and getting started checklist."
- "Let's begin by uploading your first track."
- Bouton : "Upload Track"

**Tracks (vide)**
- Icône musique
- "Your catalog is empty"
- "Upload your first track — Sonic DNA will automatically detect BPM, key, and audio characteristics."
- Bouton : "Upload Track"
- Lien : "Or try Quick Upload for instant bulk import"

**Playlists (vide)**
- Icône playlist
- "No playlists yet"
- "Create a playlist to organize and pitch your tracks."
- Bouton : "Create Playlist"
- Note : "Upload at least one track first to create a playlist."

**Pitch (vide)**
- Icône cible
- "No pitches sent yet"
- "Start pitching your tracks to A&R, labels, and music supervisors."
- Bouton : "Create Pitch"
- Note : "Contacts are collected automatically when people listen to your shared links."

**Contacts (vide)**
- Icône personnes
- "No contacts yet"
- "Your contacts are built automatically:"
- "• When someone listens to your shared links (gate screen)"
- "• When collaborators scan your studio QR code"
- "• When you add them manually"
- Bouton : "Add Contact"

**Shared Links (vide)**
- Icône lien
- "No shared links yet"
- "Share your tracks with secure, branded links. Track who listens."
- Bouton : "Go to Tracks to share"

**Notes tab (vide)**
- Icône crayon
- "No notes or feedback yet"
- "Notes you add during upload or editing appear here."
- "Recipient feedback from shared links will also show up."

**Approvals (vide)**
- Icône check
- "No pending approvals"
- "When team members submit changes, they'll appear here for review."

---

## Implémentation technique

### Librairie recommandée
**react-joyride** (~15KB gzipped) ou **custom avec Framer Motion** (déjà dans le projet)

### Stockage

```typescript
// localStorage (rapide, pas de réseau)
trakalog_onboarding_complete: "true" | null
trakalog_onboarding_step: number | null
trakalog_checklist_dismissed: "true" | null

// DB (persistence cross-device)
profiles.onboarding_complete: boolean DEFAULT false
```

### Checklist — détection automatique

```typescript
// Chaque item se vérifie via les données existantes :
profile_complete: profiles.full_name !== null && profiles.avatar_url !== null
workspace_named: workspace.name !== "USER's Workspace" (pattern auto-généré)
branding_set: workspace.hero_image || workspace.logo
track_uploaded: tracks.length > 0
mood_added: tracks.some(t => t.mood?.length > 0)
lyrics_added: tracks.some(t => t.lyrics)
playlist_created: playlists.length > 0
shared_link_created: sharedLinks.length > 0
pitch_sent: pitches.length > 0
contact_added: contacts.length > 0
member_invited: workspaceMembers.length > 1
```

---

## Phases d'implémentation

### Phase 1 — Empty States (~3-4 jours)
- Messages engageants sur toutes les pages vides
- CTA clairs vers l'action suivante
- Le plus rapide et immédiatement utile

### Phase 2 — Welcome + Setup (~2-3 jours)
- Welcome screen modal
- Profile setup (nom, photo)
- Workspace naming
- Redirection vers le tour ou le dashboard

### Phase 3 — Guided Tour (~1-2 semaines)
- 18 steps avec spotlight
- react-joyride ou custom Framer Motion
- Progress bar, Back/Next/Skip
- Persistence localStorage
- CTA final : Upload first track

### Phase 4 — Checklist Dashboard (~3-4 jours)
- Bloc en haut du dashboard
- 11 items auto-détectés
- Progress bar animée
- Messages motivants
- Dismiss/re-show

### Phase 5 — Guide permanent (~1 semaine)
- Icône "?" dans le header
- Page Guide avec accordion
- Feature spotlights contextuels
- "Replay Tour" option

---

## Dépendances

- **Framer Motion** ✅ (déjà dans le projet)
- **react-joyride** ⏳ (à installer si choisi, npm install react-joyride)
- **Toutes les pages et features** ✅ (déjà implémentées)

---

*Ce document est vivant. Il sera mis à jour au fur et à mesure du développement.*
