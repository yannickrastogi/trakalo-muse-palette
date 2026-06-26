# TRAKALOG — Source de vérité CTO (pour Claude)

> **Dernière mise à jour :** 25 avril 2026
> **Ce document prime sur tout autre contexte.** Lire avant toute implémentation.
> **Résumés détaillés :** `docs/TRAKALOG_SESSION_RESUME_*.md`

---

## Identité projet

**Trakalog** = SaaS premium de gestion de catalogue musical pré-release.
Fondateur solo : Yannick Rastogi (CTO IA = Claude).
Statut : late-stage beta privée. Pas de launch public encore.

**Positionnement :** "Disco = Dropbox de la musique. Trakalog = système nerveux intelligent."
**Différenciateurs clés :** watermarking invisible + leak tracing, Sonic DNA, Smart A&R, splits + signatures digitales, pitch pipeline avec engagement tracking, multi-workspace, sécurité enterprise.

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Storage audio | Cloudflare R2 (migration complète ✅) |
| IA | Groq (Whisper + Llama 3.3 70B) |
| Email | Resend (`send.trakalog.com`) |
| Hébergement | Vercel (`app.trakalog.com`) + Cloudflare (DNS) |
| Watermarking | Railway microservice (audiowmark + Node.js/Express) |
| Sonic DNA | Railway (essentia Python + Hobby plan 8GB RAM) |
| Billing | Stripe (mode test, 5 produits + 8 Price IDs) |

**Repo GitHub :** `yannickrastogi/trakalo-muse-palette`
**Projet Supabase :** `xhmeitivkclbeziqavxw`
**Railway :** `https://trakalo-muse-palette-production.up.railway.app`

---

## Division du travail (OBLIGATOIRE — ne jamais dévier)

| Outil | Rôle |
|-------|------|
| 💻 **Claude Code** | Tout le code — multi-fichiers, Edge Functions, migrations complexes, push/deploy |
| 💬 **Cowork** | Audits, diagnostics, browser smoke tests, SQL reads, monitoring |
| 🖥️ **Terminal** | Uniquement si indispensable |

**Chaque bloc de commande DOIT être labelisé avec sa destination. Sans exception.**

---

## Structure d'un prompt Claude Code (template obligatoire)

```
1. Agent Explorer (Haiku) → diagnostiquer/mapper le codebase
2. Fix steps
3. Agent Reviewer (Sonnet) → vérifier les régressions avant push
4. /security-review STRICT
5. git add . && git commit -m '...' && git push
6. supabase functions deploy <name>  ← si Edge Function modifiée
```

**3 règles dans chaque prompt Claude Code :**
1. Ne rien changer au code qui marche déjà
2. Code sécurisé (pas XSS/eval, RPC SECURITY DEFINER pour writes DB)
3. S'assurer que tout fonctionne après les changements

**Format :** toujours un seul bloc copyable.

---

## Base de données — état actuel

### Tables principales
`workspaces`, `workspace_members`, `user_roles`, `tracks`, `stems`, `playlists`, `playlist_tracks`, `contacts`, `pitches`, `shared_links`, `link_events`, `link_downloads`, `approvals`, `notifications`, `catalog_shares`, `watermark_payloads`, `leak_traces`, `rate_limits`, `audit_logs`, `whitelisted_emails`, `subscriptions`, `beta_passes`, `credit_purchases`

### Colonnes importantes (noms réels, ne pas deviner)
- `cover_url` (PAS `cover_art_url`)
- `track_type` (PAS `type`)
- `labels[]` (PAS `label`)
- `joined_at` sur `workspace_members` (PAS `created_at`)
- `contacts.pro` est `text[]` (PAS `text` — migré multi-PRO)
- `contacts.stage_name` existe

### ENUMs actifs
- `track_status` : `available / on_hold / released`
- `track_type` : `song / instrumental / sample / acapella`
- `document_status` : `draft / pending / signed`
- `share_type`, `link_status`, `pitch_status`, `stem_type`, `approval_status`, `member_status`, `notification_type`, `track_gender`

### Niveaux d'accès workspace
`Viewer < Pitcher < Editor < Admin` (dans `workspace_members.access_level`)

### RPCs SECURITY DEFINER créées
`get_user_workspaces`, `create_workspace_with_member`, `update_user_profile`, `save_track_to_trakalog`, `remove_track_from_trakalog`, `get_workspace_catalog_shares`, `get_track_comments`, `add_track_comment`, `delete_track_comment`, `delete_contact`, `clean_revoked_playlist_tracks`, `create_playlist`, `add_playlist_tracks`, `replace_playlist_tracks`, `update_playlist`, `delete_playlist`, `create_shared_link`, `create_pitch`, `is_email_whitelisted`, `check_rate_limit`, `write_audit_log`, `get_shared_workspace_tracks`, `insert_track` (25 params), `update_track` (JSONB _updates), `insert_track_document`, `upsert_contact`

### Règles SQL critiques
- JAMAIS auto-exécuter du SQL — toujours donner un bloc unique à copier dans Supabase SQL Editor
- `CREATE OR REPLACE` avec signature différente → crée des doublons — toujours `DROP` explicitement d'abord
- Dollar-quoting : utiliser `$func$...$func$` (Supabase SQL Editor bug avec `$$`)
- `auth.uid()` peut retourner NULL pour certains users → toujours passer `_user_id` explicit aux RPCs

---

## Edge Functions — état actuel (18 fonctions)

Toutes protégées par rate limiting + UUID validation + error masking.

| Fonction | Description |
|----------|-------------|
| `analyze-sonic-dna` | Analyse audio Railway → BPM/key/sonic_dna en DB |
| `smart-ar` | Groq Llama 3.3 70B + Sonic DNA condensé + tracks partagés |
| `transcribe-lyrics` | Groq Whisper → lyrics + sync sonic_dna |
| `compress-audio` | MP3 preview 128kbps |
| `get-storage-url` | Signed URLs R2 (LRU cache 4min, retry) |
| `get-watermarked-audio` | Watermark via Railway + cache bucket R2 `watermarked` |
| `trace-leak` | Decode watermark → identifier leaker |
| `send-pitch-email` | Resend + branding workspace + template premium |
| `send-invitation-email` | Resend + template premium |
| `create-invitation` | Invitation en DB + email |
| `accept-invitation` | Ajoute workspace_member avec access_level/professional_title |
| `verify-link-password` | PBKDF2 100k itérations |
| `hash-link-password` | Hash côté serveur |
| `log-link-access` | IP logging |
| `log-link-event` | IP logging |
| `auto-add-contact` | Gate screen → contacts |
| `send-executed-splits` | PDF splits signé envoyé à tous |
| `send-split-signature` | Email signature splits |
| `send-notification-email` | Notifications email |

**⚠️ Les Edge Functions doivent être déployées manuellement après chaque push :**
```
💻 CLAUDE CODE
supabase functions deploy <nom-fonction>
```

---

## Storage — Cloudflare R2 (migration complète ✅)

**5 buckets actifs :**
- `trakalog-tracks` — audio original
- `trakalog-covers` — cover art
- `trakalog-stems` — stems
- `trakalog-watermarked` — cache audio watermarké
- `trakalog-documents` — paperwork

**`STORAGE_PROVIDER=r2` actif.** Tous les reads audio via `get-storage-url` Edge Function + `src/lib/audio.ts` (LRU cache 4min).

**Supabase Storage conservé** pendant la période de soak (2 semaines) avant cleanup définitif.

**Pending (à faire) :**
- Révoquer la clé S3 `rclone-phase3-migration` dans Supabase
- Nettoyer `SUPABASE_S3_*` du `.env.local`
- Après soak → supprimer les objets Supabase Storage

---

## Sécurité — état actuel ✅ Complet

- **XSS :** `htmlEscape()` sur tous les emails, `sanitizeEmailSubject()`, `sanitizeUrl()`, `sanitizeCssColor()`
- **Rate limiting :** 18/18 Edge Functions protégées
- **UUID validation :** `isValidUUID()` dans `_shared/validation.ts` — appliqué partout
- **Watermarking invisible :** payload SHA-256 128bits par visiteur, cache R2
- **Signed URLs :** 300s (5 min)
- **PBKDF2 :** 100k itérations pour passwords shared links
- **CSP headers :** configurés dans `vercel.json`
- **2FA TOTP :** fonctionnel (enrollment + login verification + disable)
- **Session management :** 7 jours max, 24h inactivité
- **DRM léger :** no right-click, signed URLs courtes
- **safeLocalStorage :** helper try-catch partout (`src/lib/safeStorage.ts`)
- **isMounted guards :** pages publiques (AcceptInvitation, StudioSession, SharedStemAccess)
- **Audit logs :** table `audit_logs`, RPC `write_audit_log`
- **IP logging :** `link_events.visitor_ip`, `link_downloads.visitor_ip`

---

## Auth — fixes critiques

**Le vrai problème historique :** `AuthContext.tsx` écrasait la clé Supabase native → session corrompue au reload.

**Solution en place :**
- `persistSession: true` — Supabase gère sa propre persistence
- `trakalog_session_backup` localStorage → fallback si clé native absente
- `autoRefreshToken: false` au niveau module → démarré manuellement dans AuthContext
- `ProtectedRoute` : ne jamais unmount children une fois une session vue
- Pages publiques (SharedLinkPage, StudioSession, AcceptInvitation...) → **zéro createClient()** — fetch() REST direct + constants.ts
- `auth.uid()` retourne NULL pour certains users → passer `_user_id` explicit à TOUTES les RPCs

---

## Sonic DNA Profiler ✅ Fonctionnel

- **Railway** (Hobby plan, 8GB RAM) : essentia Python → BPM (heuristique 80-180 BPM), key, energy, valence, arousal, brightness, warmth, sync_ready
- **BPM heuristique :** <80 → doubler, >180 → diviser (pour genres syncopés)
- **Fire-and-forget à l'upload** avec queue séquentielle (évite OOM Railway)
- **Données écrites en DB :** `tracks.bpm`, `tracks.key` (si confidence >0.7 et pas déjà rempli), `tracks.sonic_dna` (JSONB complet)
- **Badge "Analyzing..."** orange pendant 5 min max
- **Sections waveform :** éditeur manuel (double-clic = ajouter marker, rename, delete) — sync vers `sonic_dna.structure`
- **Mood :** tags custom (max 8) + 19 prédéfinis. Les descriptors auto supprimés (trop imprécis)

---

## Fonctionnalités complètes

### Upload
- Quick Upload (skip toutes les étapes) + upload détaillé en 6 étapes
- Formats : WAV, MP3, FLAC, AIFF, M4A, OGG — max 50MB
- Compression MP3 preview fire-and-forget
- Auto-extraction titre/artiste depuis nom de fichier
- Transcription lyrics Whisper (skippée si lyrics fournis manuellement)

### Splits & Signatures
- Multi-rôles (max 4 : Songwriter, Producer, Artist, Musician)
- Multi-PROs (max 3 parmi 68)
- Stage name
- NameAutocomplete → suggestions depuis contacts (2 caractères, debounce 150ms)
- Save-back contacts → upsert après chaque save
- PDF splits avec splitTextToSize() + hauteur dynamique
- Signatures canvas → PDF signé → Send Executed Copies

### Catalog Sharing
- Track individuel ou catalogue complet entre workspaces
- Niveaux d'accès : Viewer / Pitcher / Editor / Admin par track ou par catalogue
- Revoke nettoie automatiquement les playlists (RPC `clean_revoked_playlist_tracks`)

### Smart A&R
- Groq Llama 3.3 70B + Sonic DNA condensé (energy, valence, brightness, warmth, sync_ready, tempo_stability)
- Cherche dans tracks du workspace + tracks partagés via catalog_shares
- Rate limit : 20/h par IP

### Shared Links
- Gate screen (nom, email, rôle, company) → auto-add contacts
- Password PBKDF2, expiration, disable/enable
- Watermarking audio invisible par visiteur
- Engagement tracking (plays, downloads, comments)
- "See Credits" sur SharedLinkPage (rôles depuis splits JSONB, sans %/IPI/PRO)

### Branding workspace
- Hero image, logo, brand color, focal point
- Réseaux sociaux : Instagram, TikTok, YouTube, Facebook, X (icônes SVG sur SharedLinkPage)
- Logo agrandi : w-28 desktop, w-20 mobile

### Permissions (4 niveaux)
- Viewer : voir/écouter uniquement
- Pitcher : + playlists/pitch/share
- Editor : + modifier metadata/stems/lyrics
- Admin : tout (splits/branding/invitations/delete)

---

## Billing Stripe — état actuel

**Statut :** Mode test. Partiellement implémenté. Architecture finalisée.

**Modèle :** Abonnements **user-based** (pas workspace).

**Plans :**
| Plan | Mensuel | Annuel |
|------|---------|--------|
| Free | $0 | — |
| Starter | $10/mo | $90/yr |
| Pro | $25/mo | $225/yr |
| Business | $45/mo | $405/yr |

**AI Credits :** 25-pack ($5), 100-pack ($15) — one-time.

**5 Stripe products + 8 Price IDs** créés en test mode. Documentés dans `docs/TRAKALOG_BILLING.md` (v3.1).

**Tables DB :** `subscriptions`, `beta_passes`, `credit_purchases` migrées avec triggers et RPCs.

**Pending (bloquant pour launch) :**
- Stripe plan limit enforcement (RPCs)
- Frontend billing interface (pricing page + Settings → Billing)
- Google OAuth production approval

---

## Bugs connus — à corriger

1. **Upload metadata fields pas persistants** (tags, credits, featuring, labels, publishers, isrc, album, upc, copyright, explicit, notes) malgré commit 839b2de. **Prochaine étape :** Yannick ouvre Network tab + Console pendant upload pour checker `update_track` call count, `_updates` payload, HTTP status, erreurs console.

2. **RLS audit** requis avant launch public : RLS actuel basé sur `user_roles` (11 rôles), pas `workspace_members.access_level`. Writes protégés par RPCs SECURITY DEFINER. Reads (SELECT) ne vérifient pas access_level. Aussi auditer le flux "Save to Trakalog" RLS.

---

## Priorités immédiates (ordre)

1. ✅ R2 migration — COMPLETE
2. 🔴 **Fix bug upload metadata** (Network tab debug)
3. 🔴 **Stripe enforcement + frontend billing UI**
4. 🔴 **Google OAuth production approval**
5. 🟡 **RLS audit** (pre-launch blocker)
6. 🟢 **Onboarding** (empty states → welcome → tour → checklist)
7. 🟢 **Maestro AI** Phase 1 (read-only chat)

---

## Features planifiées (specs dans docs/)

| Feature | Spec | Statut |
|---------|------|--------|
| Native ISRC generation | `docs/ISRC_GENERATION.md` | Urgent pré-launch |
| DDEX + PRO exports | `docs/DDEX_PRO_EXPORTS.md` | Urgent pré-launch |
| Track Versioning | `docs/TRACK_VERSIONING.md` | Spec prête |
| Trakalog Desktop (Electron) | Spec prête | Post-launch |
| Maestro AI assistant | `docs/TRAKALOG_MAESTRO.md` | Phase 1 proche |
| Trakalog DROP | `docs/TRAKALOG_DROP.md` | Post-launch |
| Smart Brief Matching | Sonic DNA + findability score 0-100% | Haute priorité |
| Brief Seeker | `docs/BRIEF_SEEKER.md` | Après Smart Brief |
| Artist Seeker | `docs/ARTIST_SEEKER.md` | Après Smart Brief |
| Admin Dashboard | `docs/TRAKALOG_ADMIN_DASHBOARD.md` | Après Stripe |
| Similarity Search | pgvector | Post-launch |

---

## Learnings critiques (ne jamais répéter ces erreurs)

### Auth
- JAMAIS écrire dans la clé Supabase native localStorage
- `auth.uid()` retourne NULL → toujours passer `_user_id` explicitement
- `CREATE OR REPLACE` avec signature différente = doublons → `DROP` d'abord
- Pages publiques = zéro `createClient()` = fetch() REST pur

### SQL
- Ne jamais auto-exécuter → toujours un bloc copyable unique
- Claude Code génère souvent du SQL subtillement incorrect → valider avant exécution
- Noms réels colonnes : `cover_url` / `track_type` / `labels[]` / `joined_at`

### Edge Functions
- Déploiement manuel obligatoire après chaque push
- Version stale déployée = trap récurrent

### Architecture
- Workspace auto-création dans `WorkspaceContext.tsx` (PAS dans Auth.tsx → race condition)
- Personal workspace = `is_personal = true` (unique constraint)
- Supabase SQL Editor bug avec `$$` → utiliser `$func$...$func$`

---

## Beta testers

| Contact | Email | Workspace |
|---------|-------|-----------|
| Eliot (Poultry) | pro.eliots@gmail.com | collaborateur principal |
| Quentin Mosimann | — | workspace "Mosimann", manager : Maud Brooke |
| KNY | kny.factory@gmail.com | beta tester |
| Manuel | manuel.sainsily@gmail.com | beta tester |
| Petitjean | petitjean.montaufray@gmail.com | beta tester |

**Workspace test principal :** Banx & Ranx Test (`38007e8a-605b-4852-8c5a-73f3bc5c827c`)

---

## Entité légale

Yannick Rastogi Productions Inc. (corporation canadienne, Québec).
Migration vers Trakalog Inc. prévue avec traction.
Docs légaux : CGU, Privacy Policy, NDA, DPA, IP Assignment, DMCA policy — Quebec/PIPEDA/GDPR/CCPA (Law 25).

---

*Ce document doit être mis à jour à chaque session majeure. Il remplace la lecture des résumés individuels.*
