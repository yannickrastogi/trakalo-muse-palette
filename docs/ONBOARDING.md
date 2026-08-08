# TRAKALOG — Onboarding (Feature Spec)

> **Document created:** April 16, 2026
> **Based on:** Full audit — 28 routes, 16 protected pages, 15 modals, 13 contexts
> **Objective:** Guide each new user through ALL of Trakalog's features.
> **Status:** Next priority

---

## Philosophy

The user should understand from the first login that Trakalog is not a simple music cloud — it's an intelligent nervous system for their catalog. The more they fill in details, the more Trakalog works for them.

**Four onboarding layers:**
1. **Welcome + Setup** — first contact, profile, workspace
2. **Guided Tour** — interactive step-by-step tour of the entire interface
3. **Checklist Dashboard** — progress bar with key actions
4. **Permanent guide** — accessible at any time to review explanations

---

## Layer 1 — Welcome + Setup (first login)

### Welcome Screen (full-screen modal)

- Animated gradient Trakalog logo
- "Welcome to Trakalog"
- "Your intelligent catalog manager — manage, protect, pitch and connect your music."
- "Let us show you around — it takes 2 minutes."
- Two buttons: **"Start Tour"** (primary gradient) and **"Skip for now"** (ghost)
- If skip → direct to Dashboard, tour available later via "?"

### Step 1 — Profile Setup

- "Let's set up your profile"
- Fields: Full Name, Profile Photo (drag & drop or click)
- "This is how your collaborators and contacts will see you."
- Button "Next →"

### Step 2 — Workspace Setup

- "Name your workspace"
- Explanation: "A workspace is your creative space — your artist name, label, studio, or project."
- Pre-filled input with auto-generated name
- "You can create multiple workspaces later for different projects or clients."
- Button "Let's go! →"

---

## Layer 2 — Guided Tour (18 steps)

Each step = spotlight on an element + message box with arrow + "Next" / "Skip Tour"
Progress bar: "Step X of 18"

### Sidebar Navigation (Steps 3-9)

**Step 3 — Dashboard**
- Highlight: Dashboard icon in sidebar
- "📊 Dashboard — Your command center. See your catalog stats, recent activity, and quick actions at a glance."

**Step 4 — Tracks (Catalog)**
- Highlight: Tracks icon
- "📀 Your Catalog — Upload and manage all your tracks here. Each track is automatically analyzed by Sonic DNA to detect BPM, key, and audio characteristics. Search, filter by genre/key/status/BPM, switch between list and grid view."

**Step 5 — Playlists**
- Highlight: Playlists icon
- "🎵 Playlists — Organize your tracks into themed playlists for pitching. Customize with gradient colors and mood tags. Share entire playlists with one branded link."

**Step 6 — Pitch**
- Highlight: Pitch icon
- "🎯 Pitch — Send your tracks to A&R, labels, supervisors, and publishers. Trakalog tracks every interaction: when they open, listen, and how long they engage. Build a pipeline: Draft → Sent → Opened → Responded."

**Step 7 — Contacts**
- Highlight: Contacts icon
- "👥 Contacts — Your industry network, built automatically. When someone listens to your shared link, their info is captured through the gate screen. When collaborators scan your studio QR code, they're added too. You can also add contacts manually. Export to PDF, CSV or Excel anytime."

**Step 8 — Shared Links**
- Highlight: Shared Links icon
- "🔗 Shared Links — Create secure links to share individual tracks, playlists, or full packs (track + cover + stems + credits PDF). Password-protect them, set expiration dates, and track engagement in real-time. Every listener is audio-watermarked for leak protection."

**Step 9 — Workspace Settings**
- Highlight: Workspace icon (if visible)
- "🏢 Workspace Settings — Your workspace, your brand. This is where the magic happens behind the scenes."

### Header Tools (Steps 10-12)

**Step 10 — Smart A&R**
- Highlight: Smart A&R icon in header
- "🤖 Smart A&R — Your AI-powered music matchmaker. Paste any brief and Trakalog's AI analyzes your ENTIRE catalog using Sonic DNA data (BPM, key, energy, mood, structure) to find the perfect tracks. The more metadata you add to your tracks, the smarter the matching becomes."

**Step 11 — Trakalog Radio**
- Highlight: Radio icon in header
- "📻 Trakalog Radio — Shuffle through your catalog with crossfade. Filter by genre and mood. Rediscover forgotten gems in your catalog."

**Step 12 — Notifications**
- Highlight: Bell icon
- "🔔 Notifications — Stay informed. Get notified when someone listens to your shared links, leaves comments, signs splits, joins your workspace, or uploads tracks. Filter by time period."

### Workspace Features (Steps 13-16)

**Step 13 — Branding**
- Highlight: Branding tab (if in workspace settings) or skip if not visible
- "🎨 Branding — Make every shared link and pitch look professional. Upload a hero image, logo, set your brand color, and add your social media links (Instagram, TikTok, YouTube, etc.). Your recipients see YOUR brand, not Trakalog."

**Step 14 — Team & Permissions**
- Highlight: Members tab (if visible)
- "👥 Team — Invite collaborators with 4 permission levels: Viewer (listen only), Pitcher (create playlists & pitch), Editor (modify metadata & stems), Admin (full control including splits & branding). Each member gets a professional title displayed on credits."

**Step 15 — Catalog Sharing**
- Highlight: Catalog Sharing tab (if visible)
- "🔄 Catalog Sharing — Share your entire catalog with other workspaces (labels, managers, publishers). They can pitch your tracks under their own branding while you keep full control. Revoke access anytime."

**Step 16 — Leak Tracing**
- Highlight: Leak Tracing tab (if visible)
- "🛡️ Leak Tracing — Every shared link is invisibly audio-watermarked. If your music leaks, upload the leaked file and Trakalog identifies exactly who received that version. Enterprise-grade protection built in."

### Track Features (Steps 17-18)

**Step 17 — Track Details**
- Highlight: Upload Track button
- "📝 Track Details — Each track has: lyrics (auto-transcribed or manual), stems management, splits with digital signatures, timecoded comments from recipients, and a full activity history. Everything in one place."

**Step 18 — Sonic DNA & Upload (Final CTA)**
- Highlight: Upload Track button
- "🧬 Sonic DNA — When you upload a track, Trakalog automatically analyzes it: BPM, key, energy curves, spectral characteristics, and more. This powers the Smart A&R matching. Pro tip: the more you fill in (genre, mood tags, lyrics, language, type), the better the AI understands your music and finds opportunities."
- Button: **"Upload my first track →"** (opens upload modal)
- Below button: "You can also use Quick Upload to skip the details and add them later."

### Tour behavior

- Semi-transparent overlay with spotlight (hole) around the element
- Message box intelligently positioned (does not obscure the element)
- Arrow pointing to the element
- Progress: "Step X of 18"
- "← Back" / "Next →" / "Skip Tour"
- If refresh: resumes at the same step (localStorage)
- If skip: everything marked as seen
- When complete: confetti animation + "You're all set! 🎉"

---

## Layer 3 — Checklist Dashboard

### Location
Block at the top of the Dashboard, with animated progress bar.

### Items (auto-check when action is performed)

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
11. ☐ Invite a team member (optional, marked "bonus")

### Behavior
- Each item checks itself automatically when the action is performed (no manual click)
- Progress bar: "4 of 11 completed"
- Encouraging message at each milestone: "Great start!" / "You're getting the hang of it!" / "Power user! 🔥"
- When 10/11 (everything except invite): "🎉 You've mastered Trakalog! You can dismiss this checklist."
- "Dismiss" button to hide
- Can be re-shown from the Guide

---

## Layer 4 — Permanent Guide

### Access
- "?" icon in the header (next to the bell)
- In the profile dropdown: "Help & Guide"
- Option in the checklist: "Replay Tour"

### Guide content (page or modal with accordion)

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

### Feature Spotlights (contextual)

Small "?" icon on each page that opens a contextual explanation:

| Page | Explanation |
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

## Layer 5 — Empty States

Each empty page has an engaging message with clear CTA + illustration/icon:

**Dashboard (new account)**
- Trakalog illustration
- "Welcome to your Dashboard"
- "This is where you'll see your catalog stats, recent activity, and getting started checklist."
- "Let's begin by uploading your first track."
- Button: "Upload Track"

**Tracks (empty)**
- Music icon
- "Your catalog is empty"
- "Upload your first track — Sonic DNA will automatically detect BPM, key, and audio characteristics."
- Button: "Upload Track"
- Link: "Or try Quick Upload for instant bulk import"

**Playlists (empty)**
- Playlist icon
- "No playlists yet"
- "Create a playlist to organize and pitch your tracks."
- Button: "Create Playlist"
- Note: "Upload at least one track first to create a playlist."

**Pitch (empty)**
- Target icon
- "No pitches sent yet"
- "Start pitching your tracks to A&R, labels, and music supervisors."
- Button: "Create Pitch"
- Note: "Contacts are collected automatically when people listen to your shared links."

**Contacts (empty)**
- People icon
- "No contacts yet"
- "Your contacts are built automatically:"
- "• When someone listens to your shared links (gate screen)"
- "• When collaborators scan your studio QR code"
- "• When you add them manually"
- Button: "Add Contact"

**Shared Links (empty)**
- Link icon
- "No shared links yet"
- "Share your tracks with secure, branded links. Track who listens."
- Button: "Go to Tracks to share"

**Notes tab (empty)**
- Pencil icon
- "No notes or feedback yet"
- "Notes you add during upload or editing appear here."
- "Recipient feedback from shared links will also show up."

**Approvals (empty)**
- Check icon
- "No pending approvals"
- "When team members submit changes, they'll appear here for review."

---

## Technical implementation

### Recommended library
**react-joyride** (~15KB gzipped) or **custom with Framer Motion** (already in the project)

### Storage

```typescript
// localStorage (fast, no network)
trakalog_onboarding_complete: "true" | null
trakalog_onboarding_step: number | null
trakalog_checklist_dismissed: "true" | null

// DB (cross-device persistence)
profiles.onboarding_complete: boolean DEFAULT false
```

### Checklist — automatic detection

```typescript
// Each item checks itself via existing data:
profile_complete: profiles.full_name !== null && profiles.avatar_url !== null
workspace_named: workspace.name !== "USER's Workspace" (auto-generated pattern)
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

## Implementation phases

### Phase 1 — Empty States (~3-4 days)
- Engaging messages on all empty pages
- Clear CTAs to the next action
- The fastest and immediately useful

### Phase 2 — Welcome + Setup (~2-3 days)
- Welcome screen modal
- Profile setup (name, photo)
- Workspace naming
- Redirect to tour or dashboard

### Phase 3 — Guided Tour (~1-2 weeks)
- 18 steps with spotlight
- react-joyride or custom Framer Motion
- Progress bar, Back/Next/Skip
- Persistence localStorage
- Final CTA: Upload first track

### Phase 4 — Checklist Dashboard (~3-4 days)
- Block at the top of the dashboard
- 11 auto-detected items
- Animated progress bar
- Encouraging messages
- Dismiss/re-show

### Phase 5 — Permanent Guide (~1 week)
- "?" icon in the header
- Guide page with accordion
- Contextual feature spotlights
- "Replay Tour" option

---

## Dependencies

- **Framer Motion** ✅ (already in the project)
- **react-joyride** ⏳ (to install if chosen, npm install react-joyride)
- **All pages and features** ✅ (already implemented)

---

*This document is live. It will be updated as development progresses.*
