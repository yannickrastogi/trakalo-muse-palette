# TRAKALOG

SaaS premium de gestion de catalogue musical pré-release.
Stack : React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion + Supabase (PostgreSQL + Auth + Storage + Edge Functions).

## Commandes

- Dev : `npm run dev`
- Build : `npm run build`
- Type-check : `npx tsc --noEmit`
- Lint : `npx eslint src/`
- Preview : `npm run preview`

## Règles CRITIQUES

### React
- JAMAIS de hook après un early return. Toujours utiliser du conditional rendering. (Anti-React-#310)
- UN SEUL client Supabase global : `src/integrations/supabase/client.ts`. JAMAIS de `createClient()` au niveau module ailleurs.
- Pages publiques (SharedLinkPage, StudioSession, SignAgreement, AcceptInvitation, SharedStemAccess) : client anonyme dans un `useRef` avec `{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }`.
- Fallback DB loading via `useRef` pour toutes les pages détail.
- UN SEUL `Audio()` global via `AudioPlayerContext` — jamais de nouvelle instance.
- Toujours utiliser `i18next t()` pour tout texte visible par l'utilisateur.
- Mobile-first : tester sur 375px minimum.

### Supabase / Auth
- `auth.uid()` est INSTABLE. Toutes les queries DB protégées par RLS DOIVENT utiliser des RPCs `SECURITY DEFINER` avec `_user_id` en paramètre. Voir @docs/RPCS.md pour la liste complète.
- `ProtectedRoute` ne doit JAMAIS démonter les children une fois qu'une session a été vue. Utilise `useRef` + localStorage `trakalog_was_auth`.
- JAMAIS de `window.location.href` pour naviguer — ça détruit la session en mémoire. Utiliser `navigate()` de react-router.
- Session backup dans `localStorage.trakalog_session_backup`. Guard contre les faux événements SIGNED_OUT.
- Auto-création workspace dans `WorkspaceContext.tsx` (PAS dans Auth.tsx — race condition).
- Workspace personnel = le plus ancien avec `owner_id === user.id`. Toujours premier dans le switcher.
- Audio player : utiliser l'Edge Function `get-audio-url` (pas `createSignedUrl` qui échoue sans session).

### Edge Functions
- Toujours importer CORS depuis `_shared/cors.ts`.
- CORS restreint, PAS open.
- Fonctionnent avec l'anon key, pas besoin de session auth.

### SQL
- TOUJOURS fournir le SQL à Yannick pour exécution manuelle dans le Supabase SQL Editor. JAMAIS exécuter automatiquement.
- Nouvelles queries → toujours créer une RPC `SECURITY DEFINER` (pas de query directe avec RLS).

### Storage (transition Supabase → Cloudflare R2)
- Pendant la migration : les paths storage commencent par `r2://bucket/key` (R2) ou directement par le chemin (Supabase Storage legacy).
- L'Edge Function `get-audio-url` détecte automatiquement le backend selon le préfixe.
- Nouveaux uploads → toujours vers R2 via signed URL générée par `get-upload-url`.
- Voir @docs/TRAKALOG_STORAGE_MIGRATION.md pour les détails.

## Workflow

- Chaque modification se termine par : `git add . && git commit -m "descriptif concis" && git push`
- Ne modifie PAS le code qui fonctionne déjà sauf si c'est strictement nécessaire.
- Ne refactore rien, ne nettoie rien, ne simplifie rien qui n'est pas demandé.
- Soft deletes au lieu de hard deletes (intégrité légale).
- Tokens crypto pour les liens partagés (pas uuid v4).

## Vision stratégique en trois couches

Trakalog se construit en **trois couches qui se renforcent mutuellement** :

1. **Trakalog (le SaaS)** — gestion catalogue premium, watermarking, splits, Smart A&R, branding. Revenue : abonnements Stripe.
2. **GENESIS (l'infrastructure)** — preuve cryptographique de paternité humaine + AI Training License + registre mondial. Revenue : badge premium + API enterprise + AI training royalties.
3. **SIGNAL (la marketplace)** — marketplace inversée pour le sync licensing : les supervisors postent des briefs, l'IA matche les catalogues Genesis-certified. Revenue : posting fees + commissions sur deals.

Chaque couche débloque la suivante. Aucune ne peut être copiée par un concurrent sans repartir de zéro sur 2-3 ans de produit.

## Architecture — Références

Pour les détails d'architecture et de produit, consulter ces fichiers :

### Documents fondamentaux
- **Architecture & vision produit** : @docs/TRAKALOG_ARCHITECTURE.md
- **RPCs et patterns DB** : @docs/RPCS.md
- **Session auth et localStorage** : @docs/AUTH_PATTERNS.md

### Infrastructure stratégique
- **GENESIS — Infrastructure de provenance créative + droits d'entraînement IA** : @docs/TRAKALOG_GENESIS.md
  (Couche fondamentale transverse — toute feature touchant à la création, signature, ou distribution de tracks doit éventuellement intégrer le Genesis ID. Lancement : Phase 3 de la roadmap, après le beta public)
- **SIGNAL — Marketplace inversée pour le sync licensing** : @docs/TRAKALOG_SIGNAL.md
  (Phase 4 de la roadmap — nécessite Genesis MVP + 1000 tracks Genesis-certified + 100 artistes actifs. Combine Sonic DNA + Genesis pour permettre aux supervisors de poster des briefs et matcher automatiquement les catalogues. Le coup de grâce stratégique.)
- **Migration storage Supabase → Cloudflare R2** : @docs/TRAKALOG_STORAGE_MIGRATION.md
  (À faire après Stripe/Billing — réduit les coûts storage de 85-90% et offre un egress illimité gratuit)

### Business & onboarding
- **Billing & Stripe** : @docs/TRAKALOG_BILLING.md
- **Onboarding** : @docs/ONBOARDING.md
- **Admin Dashboard** : @docs/TRAKALOG_ADMIN_DASHBOARD.md

### Features produit
- **Track Versioning** : @docs/TRACK_VERSIONING.md
- **Agents IA (roadmap)** : @docs/TRAKALOG_AI_AGENTS_VISION.md
- **Artist Seeker** : @docs/ARTIST_SEEKER.md
- **Brief Seeker** : @docs/BRIEF_SEEKER.md

## Ordre de priorité actuel

1. Stripe / Billing (en cours — bloquant beta launch)
2. Onboarding
3. Beta public launch
4. Migration storage R2 (optionnel mais recommandé avant scale)
5. Genesis MVP
6. Atteindre 1000 tracks Genesis-certified + 100 artistes payants actifs
7. Recrutement 50 supervisors (founder mode, Yannick en solo)
8. SIGNAL beta privée invite-only
9. SIGNAL public launch
10. Scale + internationalisation

## Bugs connus

1. Settings page : `supabase.auth.updateUser()` nécessite session persistée — utiliser RPC `update_user_profile` à la place
2. Debug logs (`[WS-DEBUG]`, `[WS-RENDER]`, `[AUTH]`) encore dans le codebase — à nettoyer
3. Save-to-Trakalog flow (`trakalog_auto_save`) partiellement implémenté — pas testé end-to-end
4. Waveform double-click pour timecoded comments ne fonctionne pas en mode viewer
