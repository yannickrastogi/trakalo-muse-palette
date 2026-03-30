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

## Workflow

- Chaque modification se termine par : `git add . && git commit -m "descriptif concis" && git push`
- Ne modifie PAS le code qui fonctionne déjà sauf si c'est strictement nécessaire.
- Ne refactore rien, ne nettoie rien, ne simplifie rien qui n'est pas demandé.
- Soft deletes au lieu de hard deletes (intégrité légale).
- Tokens crypto pour les liens partagés (pas uuid v4).

## Architecture — Références

Pour les détails d'architecture, consulter ces fichiers :
- Architecture complète : @docs/ARCHITECTURE.md
- RPCs et patterns DB : @docs/RPCS.md
- Session auth et localStorage : @docs/AUTH_PATTERNS.md
- Agents IA (roadmap) : @TRAKALOG_AI_AGENTS_VISION.md

## Bugs connus

1. Settings page : `supabase.auth.updateUser()` nécessite session persistée — utiliser RPC `update_user_profile` à la place
2. Debug logs (`[WS-DEBUG]`, `[WS-RENDER]`, `[AUTH]`) encore dans le codebase — à nettoyer
3. Save-to-Trakalog flow (`trakalog_auto_save`) partiellement implémenté — pas testé end-to-end
4. Waveform double-click pour timecoded comments ne fonctionne pas en mode viewer
