# TRAKALOG — CLAUDE.md
> **Source de vérité pour toutes les sessions Claude Code.**
> **Dernière mise à jour :** 29 juin 2026
> **Lire ce fichier en entier avant toute modification de code.**

---

## 1. Identité du projet

**Trakalog** = SaaS premium de gestion de catalogue musical pré-release.
**Fondateur :** Yannick Rastogi (solo founder + CTO)
**Positionnement :** "Disco = Dropbox pour la musique. Trakalog = système nerveux intelligent (protège, analyse, connecte, fait travailler le catalogue)."
**App déployée :** https://app.trakalog.com
**Repo GitHub :** github.com/yannickrastogi/trakalo-muse-palette
**Local :** `~/Desktop/DEV/trakalog-app/`

---

## 2. Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion |
| Backend | Supabase (PostgreSQL 17 + Auth + Storage + Edge Functions) |
| Storage | Cloudflare R2 (5 buckets : `trakalog-tracks`, `trakalog-covers`, `trakalog-stems`, `trakalog-watermarked`, `trakalog-documents`) |
| Audio analyse | Railway (Sonic DNA Profiler — Python/Essentia RhythmExtractor2013) |
| Audio watermark | Railway (audiowmark) |
| IA | Groq (Whisper + Llama 3.3 70B pour Smart A&R / Maestro) |
| Email | Resend (`noreply@trakalog.com`, subdomain `send.trakalog.com`) |
| Billing | Stripe (test mode) |
| Déploiement | Vercel (`app.trakalog.com`) + Cloudflare DNS |

**Supabase project ref :** `xhmeitivkclbeziqavxw`
**Cloudflare account :** `98dfdbe6c0f7841eb91593b8af3eea71`
**R2 endpoint :** `https://98dfdbe6c0f7841eb91593b8af3eea71.r2.cloudflarestorage.com`
**Railway :** Sonic DNA API key = `89babfc0715985bf0f2cbe903a9778a0d01ef972549749bd702758a240d66bc5`

---

## 3. Division du travail (RÈGLE ABSOLUE)

| Outil | Rôle |
|---|---|
| **Claude Code** (`--dangerously-skip-permissions`) | Tous les changements de code multi-fichiers |
| **Cowork (cette conversation)** | Audits, diagnostics, SQL validation, planning — JAMAIS de code |
| **Supabase SQL Editor** | Toute exécution SQL (manuelle, jamais auto) |
| **Supabase MCP (Cowork)** | Peut exécuter SQL via `apply_migration` / `execute_sql` directement |
| **Terminal Mac** | Seulement si Claude Code est insuffisant |

**Chaque commande/prompt doit être explicitement labelisé :** `Terminal`, `Cowork`, ou `Claude Code`.

---

## 4. Structure de prompt Claude Code (OBLIGATOIRE)

Chaque prompt Claude Code doit contenir dans l'ordre :
1. **Agent Explorer (Haiku)** — diagnostique/cartographie au démarrage
2. **Steps de fix** précis
3. **Agent Reviewer (Sonnet)** — vérification avant push, cherche les régressions
4. `/security-review` avant push
5. `git add . && git commit -m '...' && git push`
6. `supabase functions deploy <name>` si Edge Function modifiée

**Règles dans chaque prompt :**
1. Ne pas changer le code qui marche déjà
2. Code sécurisé (pas de XSS/eval, RPCs SECURITY DEFINER pour les writes DB)
3. Tout doit continuer à fonctionner après les changements
4. Maintenir les traductions 8 langues + responsive mobile

**Format :** toujours un seul bloc copiable, jamais fragmenté.

---

## 5. Règles SQL critiques

- **JAMAIS auto-exécuter.** Toujours fournir en bloc copiable pour le SQL Editor — SAUF si Supabase MCP est disponible dans Cowork.
- **`CREATE OR REPLACE` avec signature différente = doublon.** Toujours DROP avec signature exacte d'abord via le loop pattern :
```sql
DO $drop$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname = 'function_name' AND pronamespace = 'public'::regnamespace LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig::text || ' CASCADE'; END LOOP; END $drop$;
```
- **Dollar-quoting :** utiliser `$func$ ... $func$` jamais `$$ ... $$` dans le SQL Editor Supabase.
- **Enums PostgreSQL dans les RPCs :** cast explicite (`_share_type::share_type`, `'active'::link_status`).

---

## 6. Patterns de sécurité (CRITIQUE)

### assert_caller — Pattern obligatoire sur toutes les RPCs mutantes
```sql
-- Première ligne de chaque RPC SECURITY DEFINER avec _user_id :
PERFORM public.assert_caller(_user_id);
-- Vérifie que auth.uid() IS NOT NULL ET _user_id = auth.uid()
-- Empêche l'usurpation d'identité
```

### RPCs sécurisées (assert_caller appliqué — 29 juin 2026)
15 RPCs critiques : `delete_workspace`, `delete_track`, `update_member_role`, `remove_workspace_member`, `add_to_whitelist`, `get_admin_overview`, `list_all_users`, `list_all_contacts`, `insert_track`, `delete_contacts`, `set_track_marketplace_public`, `create_pitch`, `create_shared_link`, `update_workspace_branding`, `delete_track_version`

23 RPCs supplémentaires : toutes les RPCs de mutation (versions, vidéo, alias, contacts, ratings, logs, etc.)

### legacy_v0 — Statut
- **3 droppées** (orphelines) : `insert_stem_legacy_v0`, `remove_workspace_member_legacy_v0`, `update_member_role_legacy_v0`
- **27 REVOKE** (EXECUTE révoqué de anon/authenticated/PUBLIC) — encore appelées par leurs wrappers en interne
- **Ne jamais appeler les _legacy_v0 directement** depuis le frontend

### RLS par niveau d'accès
Hiérarchie : `viewer(1) < pitcher(2) < editor(3) < admin(4)`
- `has_workspace_access_level(_user_id, workspace_id, 'editor')` → autorise editor ET admin
- `require_workspace_access_level` → lève une exception si niveau insuffisant

### Matrice de permissions
| Action | Viewer | Pitcher | Editor | Admin |
|---|:---:|:---:|:---:|:---:|
| Voir/écouter les tracks | ✅ | ✅ | ✅ | ✅ |
| Uploader des tracks | ❌ | ✅ | ✅ | ✅ |
| Éditer ses propres tracks | ❌ | ✅ | ✅ | ✅ |
| Éditer tous les tracks | ❌ | ❌ | ✅ | ✅ |
| Supprimer des tracks | ❌ | ❌ | ❌ | ✅ |
| Créer playlists/pitches/shared links | ❌ | ✅ | ✅ | ✅ |
| Gérer les splits | ❌ | ❌ | ❌ | ✅ |
| Inviter membres / branding | ❌ | ❌ | ❌ | ✅ |

---

## 7. Architecture audio (R2)

Tous les uploads audio vont sur R2 directement via Edge Function `get-upload-url`.
Le frontend lit l'audio via `src/lib/audio.ts` helper avec LRU cache.
**Jamais** stocker d'URL signée en DB — stocker le chemin relatif et re-signer à la lecture.

**Buckets R2 :**
- `trakalog-tracks` — audio original + preview MP3
- `trakalog-covers` — cover art (encore sur Supabase Storage, migration planifiée)
- `trakalog-stems` — stems audio
- `trakalog-watermarked` — cache audio watermarké
- `trakalog-documents` — PDF, contrats, paperwork

**Pattern upload :** frontend → `get-upload-url` EF → PUT R2 → RPC insert en DB
**Pattern lecture :** frontend → `get-audio-url` EF → signed URL R2 (300s)

**Watermarking :** `audiowmark` sur Railway. WAV uniquement — jamais re-encoder en MP3 avant watermark.

---

## 8. Edge Functions déployées

Toutes dans `supabase/functions/`. **Déploiement manuel requis après chaque modification :**
```bash
supabase functions deploy <name> --project-ref xhmeitivkclbeziqavxw
```

| Fonction | Rôle |
|---|---|
| `get-audio-url` | Signed URL R2 + vérif allow_download |
| `get-upload-url` | Pre-signed PUT URL R2 |
| `get-watermarked-audio` | Encode watermark via Railway |
| `trace-leak` | Decode watermark pour leak tracing |
| `get-shared-link-asset` | Stems/docs/signatures via R2 |
| `get-shared-link-video` | Vidéo via R2 |
| `add-track-comment` | Commentaire recipient (anon) |
| `get-track-comments` | Lecture commentaires (anon) |
| `send-pitch-email` | Email pitch via Resend |
| `send-invitation-email` | Email invitation membre |
| `create-invitation` | Créer invitation workspace |
| `accept-invitation` | Accepter invitation |
| `send-access-request-email` | Email demande Trakalog Access |
| `smart-ar` | Smart A&R (Groq Llama) — modes personal + marketplace |
| `analyze-sonic-dna` | Analyse audio Railway → DB |
| `transcribe-lyrics` | Whisper Groq → lyrics |
| `compress-audio` | MP3 preview compression |
| `verify-link-password` | Vérif password shared link |
| `hash-link-password` | Hash PBKDF2 password |
| `send-notification-email` | Email notifications |
| `log-link-access` | Log visite shared link |
| `log-link-event` | Log event (play/download) |
| `auto-add-contact` | Auto-création contact depuis gate screen |
| `update-studio-submission-status` | Statut soumission QR studio |

**Rate limiting sur toutes les EFs** via RPC `check_rate_limit`.

---

## 9. Features livrées (état au 29 juin 2026)

### Catalogue & Upload
- Upload single + bulk + Quick Upload
- Sonic DNA auto-analyse (BPM, key, energy, mood — via Railway)
- Track Versioning complet (V1/V2/V3, A/B switch, set active, Sonic DNA par version)
- Track Completeness Score (10 critères pondérés, 0-100%)
- Date d'upload affichée (TrackDetail sous waveform + tooltip catalogue + filtre mois/année)
- Production Stage (WIP/Finished) + Status (Available/On Hold/Released) à l'upload
- Track Rating (1-5 étoiles, moyenne équipe)
- Toggle "Public in Access" à l'upload + TrackDetail (accentué orange quand ON)
- Video attachment (upload R2, player HTML5, toggle shared links)
- Chapters/sections manuelles sur waveform
- Mood custom tags + auto-detect retiré (inaccurate)

### Splits & Crédits
- Multi-rôles (max 4) + Multi-PROs (max 3, parmi 68 worldwide)
- Stage name dans splits, QR Studio, PDF, SignAgreement
- Rebalancing manuel + bouton "Equal Split"
- Auto-fill complet depuis contacts (name, email, stage_name, roles, pros, ipi, publisher)
- Auto-split parsing depuis champ Artist :
  - Séparateur virgule ET "x/X/+/&"
  - Alias protégés avant découpe
  - Noms inconnus inclus (pas seulement les contacts existants)
  - PRO/IPI/publisher remplis à l'Apply
- Save-back contacts après save des splits

### Contacts & Artist Aliases
- Déduplication par email (insensible casse) + par nom si email absent
- Multi-select delete
- Stage Name dans AddContactModal → auto-crée un alias (trigger DB)
- Trigger `trg_auto_alias_on_contact` : non-bloquant (EXCEPTION WHEN OTHERS → NULL)
- Edit alias → ouvre AddContactModal du contact lié (1 contact : direct, plusieurs : picker)
- Panel détail alias : contacts liés cliquables, badges aliases dans fiche contact

### Comments
- Onglet "Comments" avec sous-sections Team + Recipients
- Edit (owner/editor) + Delete (editor/admin)
- Badge "edited" si modifié
- Sur SharedLinkPage : formulaire d'identification (prénom/email/rôle/compagnie) si pas de cookie gate
- Recipients peuvent edit/delete leurs propres commentaires via token

### Shared Links & Pitches
- Chapters pills cliquables sous waveform (seek au timecode)
- Download inline par track dans playlist partagée + fix sécurité `allow_download` EF
- Pitch multi-tracks + engagement isolé par recipient + watermark toggle
- See Credits sur shared links (splits cachés, crédits publics)
- Trakalog Pack ZIP (audio + cover + lyrics + metadata + stems + paperwork)

### Trakalog Access (marketplace)
- Page `/access` avec 3 onglets : Browse (filtres + grille + player), Brief IA (smart-ar marketplace), Requests (inbox owner)
- Toggle opt-in par track (TrackDetail + Upload + Bulk upload)
- Badge "Public" dans catalogue (liste + grille)
- Bouton "Request" → email artiste + notification interne
- Rate limiting searches par plan (Free: 10/jour, Starter: 25/jour, Pro/Business: illimité)
- RPC `search_marketplace_tracks` : projection sécurisée (jamais splits/credits/audio_url)

### Radio
- Background playback (lecture continue après navigation)
- Mini-lecteur RadioMiniBar dans PersistentPlayer
- `RadioPlayerContext` lazy (zéro Audio tant que radio non utilisée)
- Filtres genre + mood (masqué si 0 moods) + spinner au lancement
- Lancer track depuis Catalog → radio s'arrête

### Playlists
- Création avec preview audio par track (sans ajouter)
- Filtres Genre/Mood/BPM/Key/Type + Clear filters
- Rows enrichies (BPM, key, durée, genre tags)

### Sécurité
- `assert_caller` sur toutes les RPCs critiques (anti-usurpation)
- REVOKE legacy_v0 (bypass impossible)
- RLS complète par niveau (viewer/pitcher/editor/admin) sur toutes les tables
- RLS QR token → RPC `get_track_by_qr_token` (scopée, 5 champs seulement)
- `studio_submissions` : policy anon scopée au track QR
- ErrorBoundary global + handler `vite:preloadError` (anti-page noire)
- Providers layout unique (ProtectedAppLayout) → plus de remount à la navigation
- RoleContext défaut `viewer` + `setRole()` retiré
- Audio watermarking (audiowmark) + Leak tracing
- Rate limiting sur 18+ Edge Functions
- CSP headers + signed URLs 5min + noopener

### Billing (Stripe — test mode)
- Plans : Free / Starter $14/mo / Pro $29/mo / Business $59/mo
- AI Credits : 25/$5, 100/$15
- Architecture user-based (quotas suivent l'uploader)
- Tables : `subscriptions`, `beta_passes`, `credit_purchases`
- 8 Stripe Price IDs documentés dans `docs/TRAKALOG_BILLING.md`

---

## 10. Bugs connus / Dette technique

### Bugs ouverts
- **Upload metadata** (tags, credits, featuring, labels, publishers, ISRC, etc.) ne persistent pas malgré commit `839b2de` → inspecter Network tab pendant upload flow, vérifier `update_track` calls
- **Login loop** pour certains utilisateurs invités → vérifier `accept-invitation` EF dans Supabase Auth → Users
- **Covers** toujours sur Supabase Storage (pas migrés vers R2)
- **Orphelins R2** sur stems (nettoyage best-effort, vraie EF `delete-storage-object` à créer)
- **Split-brain commentaires** : `waveform_data.comments` (legacy jsonb) vs table `track_comments` — migration planifiée

### Dette technique (décision de ne pas toucher)
- `window.location.href` dans ProtectedRoute (4 endroits — migration vers `useNavigate` risquée)
- Lazy loading librairies (~1.3MB bundle : pdfjs-dist, pdf-lib, lamejs, jspdf, jszip)
- N+1 queries sur stems/catalog shares
- Refactoring fichiers géants (TrackDetail ~3800 lignes, UploadTrackModal ~2600)
- `var` → `let/const` (1100 lignes — diff trop grand)
- `Deno.env.get()!` sans fallback dans les EFs (env vars toujours présentes en prod)
- Pipeline analyse cassé : `analyze-sonic-dna` 502 + `transcribe-lyrics` 500 (pas investigué)
- workspace_members lu en direct dans RoleContext au lieu d'un RPC

---

## 11. Patterns de développement

### Session persistence (CRITIQUE)
Supabase ne persiste pas la session en localStorage pour certains users. Solution :
- Backup session dans `trakalog_session_backup` localStorage
- Restauration via `refreshSession()` à `getSession()`
- Guard contre les faux `SIGNED_OUT` events
- `ProtectedRoute` ne doit **jamais** unmount les enfants une fois une session vue

### RLS bypass pattern
`auth.uid()` retourne NULL pour les users avec sessions instables. Toutes les queries DB sensibles utilisent des RPCs SECURITY DEFINER avec `_user_id` explicite + `assert_caller`.

### Workspace auto-création
Dans `WorkspaceContext.tsx` (fetchWorkspaces, quand 0 workspaces trouvés), **PAS** dans Auth.tsx (cause des race conditions).

### Pages publiques (SharedLinkPage, SignAgreement, StudioSession...)
- **Zéro GoTrueClient** — utiliser `fetch()` REST direct
- Importer credentials depuis `src/integrations/supabase/constants.ts`
- Jamais instancier de client Supabase

### Shared link pages autonomes
```typescript
// Pattern correct pour les pages publiques :
const SB_HEADERS = {
  'apikey': SUPABASE_PUBLISHABLE_KEY,
  'Content-Type': 'application/json'
};
// Appels directs via fetch() REST API
```

### Workspace personnel
`is_personal = true` sur le workspace le plus ancien. Identifié dans le switcher. Jamais supprimable.

---

## 12. Collaborateurs & workspaces de test

| Personne | Email | Rôle |
|---|---|---|
| Yannick Rastogi | yannick.rastogi@gmail.com | Founder/owner |
| Eliot (Poultry) | pro.eliots@gmail.com | Beta tester principal |
| Quentin Mosimann | quentin@quentinmosimann.com | Beta tester artiste |
| Maud Brooke | maudbrooke@quentinmosimann.com | Manager de Mosimann |
| KNY Factory | kny.factory@gmail.com | Collaborateur |
| Manuel Sainsily | manuel.sainsily@gmail.com | Collaborateur |

**Workspace de test principal :** `38007e8a-605b-4852-8c5a-73f3bc5c827c` (Banx & Ranx)
**Workspace Yannick perso :** `b7ad1a43-8853-4599-8bca-c81e2025c3d0`

**Règle :** toujours tester sur le workspace Yannick/Banx & Ranx avant de toucher les workspaces clients.

---

## 13. Pré-launch blockers (priorité)

1. **Stripe plan limit enforcement** + frontend billing UI — spec prête dans `docs/TRAKALOG_BILLING.md`
2. **Google OAuth production approval** — soumettre à Google (actuellement mode TEST)
3. **RLS audit post-Stripe** — audit complet réalisé le 29 juin 2026 ✅
4. **Admin Dashboard Phase 1** — spec dans `docs/TRAKALOG_ADMIN_DASHBOARD.md`
5. **ISRC native generation** — initier demande Connect Music Licensing (2-4 semaines)

---

## 14. Roadmap features (specs prêtes, pas encore buildées)

| Feature | Spec | Priorité |
|---|---|---|
| ISRC generation native | `docs/ISRC_GENERATION.md` | 🔴 Critique pré-launch |
| DDEX + PRO exports | `docs/DDEX_PRO_EXPORTS.md` | 🔴 Critique pré-launch |
| Maestro AI assistant | `docs/TRAKALOG_MAESTRO.md` | 🟡 Post-launch |
| Trakalog Drop | `docs/TRAKALOG_DROP.md` | 🟡 Post-launch |
| Trakalog Desktop | repo `trakalog-desktop` (Electron) | 🟢 Moyen terme |
| Smart Brief Matching | `docs/BRIEF_SEEKER.md` | 🟡 Post-launch |
| Artist Seeker | `docs/ARTIST_SEEKER.md` | 🟡 Post-launch |
| Similarity Search | pgvector + embeddings | 🟡 Post-launch |
| Public API | — | 🟢 Moyen terme |

---

## 15. Ordre d'implémentation Maestro

Stripe billing → Admin Dashboard Phase 1 → Maestro Phase 1 (read-only chat) → Maestro Phase 2 (write actions + voice)

---

## 16. Agents IA Trakalog (roadmap long terme)

| # | Agent | Statut |
|---|---|---|
| 1 | Sonic DNA Profiler | ✅ Partiellement implémenté (BPM, key, energy) |
| 2 | Ghost Revenue Hunter | 📋 Spec dans `TRAKALOG_AI_AGENTS_VISION.md` |
| 3 | Split Mediator | 📋 Spec |
| 4 | Sync Matchmaker | 📋 Spec (Brief Seeker phase 1 = MVP) |
| 5 | Session Replay Analyst | 📋 Spec |
| 6 | Catalog Awakener | 📋 Spec |
| 7 | Network Weaver | 📋 Spec |

---

## 17. Learnings critiques (ne pas répéter ces erreurs)

- **JAMAIS écrire dans la clé Supabase native** (`sb-xhme...-auth-token`) — Supabase gère sa propre persistence
- **autoRefreshToken: false** au niveau module — démarrer manuellement dans AuthContext uniquement
- **Pages publiques : zéro GoTrueClient** — fetch() REST direct
- **audiowmark watermarks détruits par compression lossy** — toujours pipeline WAV
- **Mood detection inaccurate** (tracks joyeux taggés "dark") → Sonic DNA = moteur interne, jamais afficher les mood descriptors auto
- **ISWC codes** = saisie manuelle post-PRO registration (pas auto-générable)
- **`CREATE OR REPLACE` avec signature différente** = crée un doublon, pas un remplacement → toujours DROP d'abord
- **SQL Editor Supabase** : utiliser `$func$` pas `$$`
- **Claude Code SQL souvent subtil (wrong access_level checks, missing COALESCE)** → toujours valider en Cowork avant d'exécuter
- **Edge Functions = déploiement manuel** après chaque push (`supabase functions deploy`)
- **`assert_caller` doit être la première ligne** de toute RPC SECURITY DEFINER avec `_user_id`
- **Les `_legacy_v0` sont des wrappers internes** — ne jamais les appeler directement, ne jamais les DROP sans vérifier qu'elles ne sont pas référencées

---

## 18. Docs dans le repo (`docs/`)

- `TRAKALOG_BILLING.md` — Spec billing Stripe complète
- `TRAKALOG_MAESTRO.md` — Spec Maestro AI assistant (~95 tools)
- `TRAKALOG_ADMIN_DASHBOARD.md` — Spec Admin Dashboard
- `TRAKALOG_DROP.md` — Spec Trakalog Drop (fan collection)
- `ISRC_GENERATION.md` — Spec ISRC native generation
- `DDEX_PRO_EXPORTS.md` — Spec DDEX + PRO exports
- `TRACK_VERSIONING.md` — Spec Track Versioning (implémenté)
- `TRAKALOG_BATTLE_PLAN_POSTAL.md` — Stratégie vs concurrents
- `TRAKALOG_AI_AGENTS_VISION.md` — Vision 7 agents IA
- `TRAKALOG_ARCHITECTURE.md` — Architecture produit complète

---

## 19. Variables d'environnement (Supabase Secrets)

```
WATERMARK_API_URL — URL Railway watermarking service
WATERMARK_API_KEY — Clé auth Railway
GROQ_API_KEY — Groq API (Whisper + Llama)
RESEND_API_KEY — Resend email
STRIPE_SECRET_KEY — Stripe (test mode)
STRIPE_WEBHOOK_SECRET — Stripe webhooks
STRIPE_PUBLISHABLE_KEY — Stripe public key
SONIC_DNA_API_KEY — Railway Sonic DNA Profiler
```

---

## 20. Sécurité — roadmap (état au 29 juin 2026)

| # | Item | Statut |
|---|---|---|
| 1 | Audio watermarking invisible | ✅ |
| 2 | Rate limiting (18+ EFs) | ✅ |
| 3 | CSP headers | ✅ |
| 4 | IP logging | ✅ |
| 5 | Audit logs | ✅ |
| 6 | 2FA TOTP | ✅ |
| 7 | assert_caller sur RPCs critiques | ✅ |
| 8 | REVOKE legacy_v0 | ✅ |
| 9 | RLS complète par niveau d'accès | ✅ |
| 10 | QR token scopé via RPC | ✅ |
| 11 | RoleContext défaut viewer | ✅ |
| 12 | Session management | ✅ |
| 13 | Encryption at rest (Supabase Pro AES-256) | ✅ |
| 14 | Light DRM (signed URLs 5min, no right-click) | ✅ |
| 15 | Stripe enforcement (limites de plan) | ❌ À faire |
| 16 | Google OAuth production | ❌ À faire |
| 17 | Vulnerability scanning (Snyk) | ❌ À faire |
| 18 | Default privileges anon (Supabase infra) | ⚠️ Non modifiable via SQL Editor |
