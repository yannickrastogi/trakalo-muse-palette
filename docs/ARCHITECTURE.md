# Architecture — Trakalog

## Modèle de données principal

### Hiérarchie
User (compte) → Workspaces (projets/entités) → Tracks, Playlists, Contacts, Pitches, Shared Links

### Workspaces
- Un user peut avoir plusieurs workspaces (artiste perso, label, client)
- Chaque workspace : son catalogue, branding, membres, pitches, shared links
- Workspace switcher dans le sidebar — le contexte entier change

### Permissions (4 niveaux, séparés du titre professionnel)
- **Viewer** : voir/écouter uniquement
- **Pitcher** : + playlists, pitch, share links
- **Editor** : + modifier metadata, stems, lyrics
- **Admin** : + splits, supprimer, inviter, branding

### Titres professionnels (display only)
Producer, Songwriter, Musician, Mix Engineer, Mastering Engineer, Manager, Publisher, A&R, Assistant, Artist, Viewer

### Catalog Sharing (catalog_shares)
- Un track appartient à UN workspace (owner)
- Peut être partagé en référence vers d'autres workspaces
- `track_id = NULL` → full catalog share
- L'artiste peut révoquer l'accès à tout moment
- Branding des pitches = celui du workspace qui envoie

### Track Versioning
- Track parent : metadata permanente
- Table `track_versions` : fichiers audio successifs
- Une seule version active (partial unique index)
- Soft deletes (intégrité légale)

## Branding (per-workspace)
- Hero Image (1920×600px), Logo, Brand Color
- Appliqué sur : shared links, pitch emails
- PAS appliqué sur : studio QR, sign agreement, interface interne

## Shared Links
- Types : track, playlist, stems, Trakalog Pack (ZIP complet)
- Gate screen : nom, email, rôle, company (cookie 2 jours)
- Protection : public, secured (PBKDF2 100k via Edge Function), expiration
- SharedLinkPage = 100% autonome, aucun provider authentifié

## Edge Functions déployées
get-audio-url, hash-link-password, verify-link-password, send-pitch-email, send-invitation-email, create-invitation, accept-invitation, log-link-access, log-link-event

## Outils externes
- Audio : Essentia.js (BPM/key/genre/mood), lamejs (MP3 128kbps), Web Audio API (waveform)
- IA : Groq (Whisper transcription + Llama Smart A&R)
- PDF : jsPDF (génération) + pdf-lib (watermarking TRAKALOG)
- Email : Resend (noreply@trakalog.com)
- Hosting : Vercel (app.trakalog.com), Cloudflare (DNS + Email Routing)

## Droits musicaux (contexte métier)
- PROs : SOCAN, ASCAP, BMI, SACEM → songwriters/composers
- Neighbouring rights : ADAMI, SPEDIDAM, SCPP, PPL, GVL → performers/master owners
- Digital performance : SoundExchange → non-interactive digital radio
