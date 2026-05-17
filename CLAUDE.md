# CLAUDE.md — Trakalog Project Instructions

> Source de vérité pour Claude lors du développement Trakalog avec Claude Code.
> Dernière mise à jour : 17 mai 2026

---

## QUI JE SUIS

Je suis **Yannick Rastogi**, fondateur solo de **Trakalog**, un SaaS premium de gestion de catalogue musical pré-release. Je travaille en français. Tu es mon CTO IA.

---

## LE PROJET TRAKALOG

**Trakalog** = système nerveux intelligent pour les artistes, producteurs, labels et superviseurs musicaux. Pas juste un cloud de tracks. Une plateforme qui **protège, analyse, connecte, et fait travailler le catalogue**.

### Vision stratégique : 4 dimensions

Trakalog se construit autour de 4 dimensions complémentaires, toutes au service d'une mission unique (*"faire travailler le catalogue"*) :

1. **CATALOG** — Organiser et gérer l'œuvre musicale (tracks, splits, stems, metadata, versions)
2. **PITCH** — Vendre l'œuvre aux professionnels (Smart A&R, shared links, pitches, futur SIGNAL marketplace)
3. **PROVENANCE** — Certifier l'œuvre (watermarking invisible, leak tracing, futur protocole Genesis cryptographique)
4. **FAN-BOND** — Donner l'œuvre aux fans avant tout le monde (DROP, pre-release exclusive access, tip-to-support)

Une seule plateforme. Deux marchés (B2B pros + D2C fans). Une seule mission. C'est la non-séparation entre ces 4 dimensions qui crée la moat.

### Positionnement marketing

- *"Disco = Dropbox de la musique. Trakalog = système nerveux intelligent."*
- *"Catalog manager. Sync pitch engine. Provenance protocol. Fan collection module. All in one."*
- DROP est le module accrocheur avec sa propre landing page (`trakalog.com/drop`) mais reste intégré à Trakalog (pas une app séparée).

---

## STACK TECHNIQUE

- **Frontend** : React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion
- **Backend** : Supabase (PostgreSQL + Auth + Storage + Edge Functions Deno)
- **Storage futur** : Cloudflare R2 (migration prévue post-Billing pour bande passante gratuite — voir @docs/TRAKALOG_STORAGE_MIGRATION.md)
- **Audio analysis** : Sonic DNA Profiler (Python/Flask sur Railway avec Essentia RhythmExtractor2013)
- **Audio watermarking** : audiowmark sur Railway (URL : `trakalo-muse-palette-production.up.railway.app`)
- **IA** : Groq (Whisper transcription + Llama Smart A&R)
- **Email** : Resend (noreply@trakalog.com)
- **Payments** : Stripe (Billing en cours) + Stripe Connect (pour DROP tips, 0% commission)
- **Hébergement** : Vercel (app.trakalog.com) + Cloudflare (DNS trakalog.com)
- **PDF** : jsPDF (génération) + pdf-lib (watermarking)
- **i18n** : i18next (8 langues)

### Identifiants critiques
- Supabase project ref : `xhmeitivkclbeziqavxw`
- Browser dev : Firefox — console shortcut Cmd + Option + K
- Test accounts : yannick.rastogi@gmail.com (primary), kny.factory@gmail.com (beta tester), petitjean.montaufray@gmail.com (signup test)
- Legal entity : Yannick Rastogi Productions Inc. (Canadian corp) — future migration vers Trakalog Inc.

---

## DOCS DE RÉFÉRENCE

Tous dans le dossier `docs/` du repo :

### Architecture & stratégie
- **@docs/TRAKALOG_ARCHITECTURE.md** — Source de vérité architecture (workspaces, permissions, catalog sharing, branding, shared links, splits, Genesis integration)
- **@docs/TRAKALOG_GENESIS.md** — Protocole de provenance cryptographique (Origin Print, AI Training License, Public Registry, Style Licensing, Derivation Detection) — Phase 3
- **@docs/TRAKALOG_SIGNAL.md** — Marketplace inversée pour superviseurs sync (briefs → matching → submissions → escrow) — Phase 4
- **@docs/TRAKALOG_DROP.md** — Module pre-release fan collection avec tipping 0% commission — wow feature pour beta launch
- **@docs/TRAKALOG_BILLING.md** — Spec Stripe Billing & plans (Free/Starter/Pro/Business + AI Credits) — priorité actuelle
- **@docs/TRAKALOG_STORAGE_MIGRATION.md** — Plan migration Supabase Storage → Cloudflare R2 (post-Billing)
- **@docs/TRAKALOG_ADMIN_DASHBOARD.md** — Spec admin dashboard (9 pages, KPIs, impersonation, email digest)

### Features planifiées
- **@docs/ONBOARDING.md** — Spec onboarding (Welcome + Tour + Checklist + Guide)
- **@docs/TRACK_VERSIONING.md** — Plusieurs versions audio sous un même track (V1/V2/Radio Edit/Master)
- **@docs/TRAKALOG_AI_AGENTS_VISION.md** — Vision long terme des 7 agents IA
- **@docs/ARTIST_SEEKER.md** — Scanner artistes via Spotify/YouTube (Phase 4)
- **@docs/BRIEF_SEEKER.md** — Scanner briefs sync automatiquement (Phase 4)

### Référence technique
- **@docs/RPCS.md** — Catalogue des RPCs SECURITY DEFINER
- **@docs/AUTH_PATTERNS.md** — Patterns d'auth + session backup + RLS bypass

---

## RÈGLES CRITIQUES (à respecter dans CHAQUE prompt Claude Code)

### Les 3 règles à inclure dans CHAQUE prompt
Chaque prompt envoyé à Claude Code DOIT se terminer par :

1. **Ne rien changer au code qui marche déjà**
2. **Code sécurisé** (pas XSS/eval, RPC SECURITY DEFINER pour writes DB)
3. **S'assurer que tout fonctionne après les changements**

Et chaque prompt doit se terminer par :
```bash
git add . && git commit -m '...' && git push
```

### Auth & session (CRITIQUE)
- **JAMAIS écrire dans la clé Supabase native** (`sb-xhmeitivkclbeziqavxw-auth-token`) — ça corrompt le format de persistence interne
- **`autoRefreshToken: false` au niveau module** dans `client.ts` ; démarrer manuellement dans AuthContext via `supabase.auth.startAutoRefresh()` uniquement quand une session valide est confirmée
- **Backup session** dans `trakalog_session_backup` localStorage + restore via `refreshSession()` sur `getSession()`
- **ProtectedRoute ne doit JAMAIS unmount** ses children une fois qu'une session a été vue
- **Pages publiques (SharedLinkPage, AcceptInvitation, SharedStemAccess, StudioSession, SignAgreement, Privacy, Terms, et toute la couche DROP fan-side)** : zéro `createClient()`, utiliser `fetch()` REST direct avec credentials importés depuis `src/integrations/supabase/constants.ts`

### RLS bypass pattern (CRITIQUE)
`auth.uid()` retourne NULL pour les users avec sessions instables. **Tous les writes DB sur tables protégées par RLS** doivent passer par des **RPC SECURITY DEFINER** avec paramètre explicite `_user_id`.

RPCs existantes (liste non exhaustive — voir @docs/RPCS.md) :
- `get_user_workspaces`, `create_workspace_with_member`, `update_user_profile`
- `save_track_to_trakalog`, `remove_track_from_trakalog`
- `get_workspace_catalog_shares`, `get_shared_workspace_tracks`
- `get_track_comments`, `add_track_comment`, `delete_track_comment`
- `create_playlist`, `add_playlist_tracks`, `replace_playlist_tracks`, `update_playlist`, `delete_playlist`
- `create_shared_link` (avec cast `_share_type::share_type` et `'active'::link_status`)
- `create_pitch`, `is_email_whitelisted`, `check_rate_limit`, `write_audit_log`
- `insert_track`, `update_track`, `insert_track_document`, `upsert_contact`
- `clean_revoked_playlist_tracks`
- **À ajouter pour DROP** : `create_drop`, `register_drop_supporter`, `record_drop_play`, `record_drop_download`, `complete_drop`, `cancel_drop`, `get_drop_honor_wall`

### Storage paths
- Format actuel Supabase Storage : path direct
- Format futur Cloudflare R2 : `r2://bucket-name/key` (préfixe à détecter dans le code pour router vers le bon backend)
- **Migration progressive** : nouveau code doit gérer les deux formats via un helper `resolveStoragePath()`

### Enums PostgreSQL dans RPCs
Cast explicite obligatoire :
- `_share_type::share_type`
- `'active'::link_status`
- `_status::track_status`
- `'drop'::share_type` (nouveau pour DROP)

### Sécurité Edge Functions
- Rate limiting sur les 18 Edge Functions (voir @docs/AUTH_PATTERNS.md pour les limites par fonction)
- `htmlEscape()` partout (XSS prevention)
- `sanitizeEmailSubject()` strip newlines + max 200 chars
- `sanitizeUrl()` pour les CTA URLs (https://trakalog.com only)
- `sanitizeCssColor()` pour les brand colors (hex only, fallback #f97316)
- `isValidUUID()`, `isValidEmail()`, `isValidStoragePath()` dans `_shared/validation.ts`
- DB errors masqués au client (messages génériques + `console.error` côté serveur)
- Path traversal checks (`../` et `//` rejetés)
- Prompt injection : briefs cappés à 2000 chars dans smart-ar

### React anti-patterns à éviter
- **Aucun hook après early return** (anti-React-#310). Toujours conditional rendering à la place.
- **Closures périmées** : utiliser des refs (`queueRef.current`) ou dépendances explicites (activeWorkspace dans le dep array)
- **Promesses non gérées** : toujours `.catch()` ou try/finally
- **Blob URLs** : toujours `URL.revokeObjectURL()` après usage
- **isMounted guards** sur les pages publiques (cleanup des async operations)

### Sonic DNA & analyse audio
- Sonic DNA est un **moteur interne** — JAMAIS affiché tel quel à l'utilisateur
- BPM normalization heuristique 80-180 (corrige le half-time sur genres syncopés caribéens)
- Mood descriptors auto **PAS écrits** dans la colonne `mood` (les utilisateurs ajoutent eux-mêmes)
- Sonic DNA tourne en fire-and-forget après upload, queue séquentielle pour bulk uploads (évite OOM Railway)
- Smart A&R enrichi avec Sonic DNA condensé (energy, valence, brightness, warmth, sync_ready, tempo_stability)

---

## WORKFLOW DE TRAVAIL AVEC MOI

### Communication
- **Parle-moi en français**
- Sois direct et concis — je comprends les concepts techniques
- Je suis le fondateur, pas un dev senior — explique le "pourquoi" pour les décisions importantes
- Pour les décisions architecturales, présente les options avec ta recommandation claire
- Si tu as besoin de contexte que tu n'as pas, demande-moi

### Format des prompts Claude Code
- **Toujours en un seul bloc copiable** — jamais éclaté en plusieurs blocs
- **Toujours finir** par les 3 règles + `git add . && git commit -m '...' && git push`
- Inclure le contexte fichiers concernés en début de prompt

### Migrations SQL
- **JAMAIS auto-executer** — toujours me donner le SQL à coller manuellement dans Supabase SQL Editor
- Vérifier d'abord les RPCs/colonnes existantes avant de proposer une migration

### Sessions de travail
- Itératives : terminal output / screenshots → diagnostic → prompt Claude Code → test
- Pour les features complexes : audit (explorer agent) → spec → implementation → review (reviewer agent) → security review (`/security-review` avant push touchant auth/shared links/permissions)

### Agents Claude Code à suggérer
- **Explorer agent (Haiku)** : avant features multi-fichiers complexes (cheap multi-file scanning)
- **Reviewer agent (Sonnet)** : après modifications importantes
- **`/security-review`** : avant tout push touchant auth, shared links, permissions, paiements

### Voice-to-text
J'utilise parfois la dictée vocale → mes messages peuvent contenir des imprécisions de phrasing à interpréter intelligemment.

---

## PRIORITÉS ACTUELLES (mai 2026)

### Ordre d'exécution stratégique

1. **🔴 Stripe Billing & Subscriptions** (en cours, bloquant beta launch)
   - 4 plans : Free / Starter $14 / Pro $29 / Business $59
   - Stripe Smart Retries 21 jours avant downgrade
   - Beta Passes system (admin UI, grants per-person)
   - Proration immédiate upgrades, end-of-cycle downgrades
   - 7-day money-back guarantee
   - AI Credits + free trials reportés V2
   - Voir @docs/TRAKALOG_BILLING.md
   - **AUDIT COMPLET REQUIS** avant d'écrire du SQL ou du code

2. **🟠 Trakalog DROP** (2-3 semaines après Stripe — wow feature pour beta launch)
   - Module pre-release fan collection
   - Stripe Connect 0% commission sur les tips
   - Watermarking per-supporter + leak tracing
   - Honor Wall public post-release
   - Fan Pages CRM unlock automatique
   - Voir @docs/TRAKALOG_DROP.md

3. **🟡 Beta public launch** avec DROP comme wow feature
   - Vidéo TikTok 60s focalisée sur DROP
   - Landing page dédiée `trakalog.com/drop`
   - Onboarding (voir @docs/ONBOARDING.md)
   - Google OAuth production submission

4. **🟢 Specs urgentes pré-launch identifiées par audit Sound Credit**
   - Génération ISRC native (1 clic) — besoin d'acheter un préfixe ISRC
   - Exports DDEX + PRO (BMI/ASCAP/SOCAN/SoundExchange/MLC minimum)
   - Track Versioning (spec prête dans @docs/TRACK_VERSIONING.md)
   - Trakalog Desktop (Electron, watched folder — repo séparé `trakalog-desktop`)

5. **🔵 Cloudflare R2 migration** (post-launch, après mesure consommation)
   - Voir @docs/TRAKALOG_STORAGE_MIGRATION.md
   - 3 buckets : trakalog-tracks, trakalog-stems, trakalog-watermarked
   - Helper `_shared/r2.ts` (AWS v4 signing pure-JS no deps)
   - DB path convention : `r2://bucket/key`

6. **🔵 Admin Dashboard** (post-Stripe)
   - 9 pages, KPIs MRR/ARR/MAU, impersonation read-only, email digest 6h
   - Voir @docs/TRAKALOG_ADMIN_DASHBOARD.md

7. **🟣 Genesis MVP** (Phase 3, 12 semaines après launch)
   - Origin Print (SHA-256 + Chromaprint + CLAP embedding + Sonic DNA + OpenTimestamps + Ed25519)
   - AI Training License standard (NO-AI/PAID-AI/ATTR-AI/OPEN-AI)
   - Public Registry trakalog.com/genesis/{id}
   - Budget audit légal : 10-20K€
   - Voir @docs/TRAKALOG_GENESIS.md

8. **🟣 SIGNAL marketplace** (Phase 4, 6-9 mois après beta)
   - Briefs superviseurs → matching pgvector + Claude → submissions → Stripe escrow
   - Nécessite Genesis MVP + 1000 tracks Genesis-certified + 100 artistes payants + 15-25 superviseurs recrutés
   - Voir @docs/TRAKALOG_SIGNAL.md

9. **🟣 Autres agents IA** (Phase 5+)
   - Sonic DNA Profiler ✅ existant
   - Catalog Awakener, Ghost Revenue Hunter, Split Mediator, etc.
   - Voir @docs/TRAKALOG_AI_AGENTS_VISION.md

10. **🟣 Trakalog Desktop** (post-launch, repo séparé)
    - Electron + React + TypeScript + Tailwind
    - Watched local folder, auto-read ID3, Supabase Storage upload
    - Réutilise auth Trakalog existante

---

## RÈGLES SPÉCIFIQUES DROP

Quand on travaillera sur DROP, garder en tête :

### DROP n'est PAS une plateforme séparée
- Code base unique, DB unique, abonnement unique
- DROP réutilise 100% de l'infra existante (shared links, watermarking, branding, gate screen)
- Branding : "Trakalog DROP" reste suffisamment "Trakalog"
- Landing page dédiée `trakalog.com/drop` mais accessible via menu principal Trakalog

### Stripe Connect = 0% commission gravée dans le marbre
- `application_fee_amount: 0` toujours
- Argument marketing #1 : *"100% goes to the artist. Trakalog takes 0%."*
- Trakalog monétise via abonnements, pas via les tips
- Stripe fees standards (~2.9% + $0.30) sont à charge du fan (option "cover the fees")

### Aspect juridique
- Les tips sont des **dons volontaires**, pas des achats
- Trakalog n'est **jamais intermédiaire de paiement** (Stripe Connect direct entre fan et artiste)
- Wording explicite sur la page de checkout et dans les CGU
- Refunds à discrétion de l'artiste (pas obligatoires sauf law locale)
- Chaque artiste responsable de sa déclaration fiscale (Trakalog génère rapport annuel)

### Plans et accès
- **Free** : 1 DROP à vie, max 25 fans (acquisition viral funnel)
- **Starter** : illimité DROPs, max 100 fans
- **Pro** : illimité DROPs, max 500 fans, Fan Pages avancées
- **Business** : tout illimité, multi-artist analytics

### Tables DB DROP
- `drops` (config + state + slot tracking + tip aggregation)
- `drop_supporters` (fans inscrits avec watermark_hash, slot_number, behavior tracking)
- `drop_tips` (paiements Stripe Connect avec stripe_fee_cents et trakalog_fee_cents=0)
- Extension `shared_links.drop_id`

### Honor Wall = viralité gratuite
- Page publique post-release `trakalog.com/d/{slug}/wall`
- Affiche les Early Fans (display_name + slot_number + tip badge)
- SEO + Open Graph image pour partage social
- CTA "Follow Yannick on Trakalog" en bas

---

## NOTES IMPORTANTES

- `password_hash` dans shared_links → bcrypt côté Edge Function, JAMAIS côté client
- `track_ids uuid[]` dans pitches → créer table `pitch_tracks` quand 10k+ tracks
- Google OAuth mode TEST → soumettre à Google pour validation production avant beta launch
- Lovable Cloud activé mais impossible à déconnecter → solution : déployer sur Vercel et abandonner Lovable hosting (en cours)
- Supabase native key (`sb-xhmeitivkclbeziqavxw-auth-token`) **JAMAIS écraser manuellement**
- Test accounts à ne pas casser : yannick.rastogi@gmail.com, kny.factory@gmail.com, petitjean.montaufray@gmail.com

---

## INFRASTRUCTURE EXTERNE

### Supabase (trakalog-production)
- URL : https://iejmrufqtqdwdsywbnsm.supabase.co
- Project ref : xhmeitivkclbeziqavxw
- Plan : Free actuellement (à upgrade vers Pro avant beta)
- Région : East US (North Virginia)

### Railway services
- **Watermarking** : `trakalo-muse-palette-production.up.railway.app` (port 8080, audiowmark)
- **Sonic DNA Profiler** : `sonic-dna-profiler-production.up.railway.app` (Python/Flask, Essentia)

### Vercel
- Production : app.trakalog.com
- Plan : Personal (à upgrade vers Pro pour fonctionnalités beta launch)

### Cloudflare
- DNS : trakalog.com
- Migration future : R2 storage + Workers (post-beta)

### Stripe
- Mode test actuellement
- Stripe Connect Express pour DROP (artistes onboarding KYC direct chez Stripe)

### Resend
- Email noreply@trakalog.com avec reply-to vers Yannick
- Templates premium dans `_shared/email-template.ts`

---

*Ce document est la source de vérité pour Claude Code lors du développement Trakalog. À mettre à jour à chaque décision architecturale majeure.*
