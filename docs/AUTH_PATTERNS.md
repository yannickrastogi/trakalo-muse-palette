# Auth Patterns — Trakalog

## Le problème fondamental
Supabase ne persiste pas la session dans localStorage de manière fiable pour tous les utilisateurs. `auth.uid()` retourne NULL côté serveur même quand l'utilisateur est connecté côté React.

## Session Backup (AuthContext.tsx)
- Chaque session valide → sauvegardée dans `localStorage.trakalog_session_backup`
- Events déclencheurs : INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED
- Si `getSession()` retourne null → tenter `refreshSession()` avec le refresh_token du backup
- Si refresh échoue → utiliser la session backup directement dans le React state
- Événement SIGNED_OUT + backup existe → ignorer, re-établir via `setSession()`

## ProtectedRoute (ProtectedRoute.tsx)
- `useRef(hasEverRendered)` + `localStorage.trakalog_was_auth` = double protection
- Une fois les children rendus → JAMAIS les remplacer par un spinner
- Redirect vers /auth UNIQUEMENT si jamais eu de session

## Pages publiques — client anonyme isolé
Pages : SharedLinkPage, StudioSession, SignAgreement, AcceptInvitation, SharedStemAccess
```typescript
const anonClient = useRef(createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
}));
```
JAMAIS au niveau module. Toujours dans un useRef à l'intérieur du composant.

## localStorage Keys
| Clé | Type | Usage |
|-----|------|-------|
| `trakalog_was_auth` | boolean string | L'utilisateur a déjà eu une session valide |
| `trakalog_session_backup` | JSON | Backup complète de la dernière session Supabase |
| `trakalog_active_workspace` | uuid | Dernier workspace actif |
| `trakalog_just_logged_in` | boolean string | Flag temporaire post-login → ouvrir workspace personnel |
| `trakalog_auto_save` | slug string | Shared link à auto-sauvegarder après signup |

## Google OAuth
- `queryParams: { prompt: "select_account" }` → force sélecteur de compte
- `redirectTo: window.location.origin + "/auth"` → redirect post-OAuth
- Client ID : `186139495931-vf74ntbatgtig8g10o0b8ee0vi0ug4fk.apps.googleusercontent.com`
- Mode production activé

## Pièges à éviter
1. ❌ `window.location.href = "/..."` → détruit la session en mémoire
2. ❌ `createClient()` au niveau module → crée des instances GoTrueClient concurrentes
3. ❌ `auth.uid()` dans les queries RLS → retourne NULL de façon imprévisible
4. ❌ Auto-création workspace dans Auth.tsx → race condition avec Navigate
5. ❌ `createSignedUrl()` pour l'audio → échoue sans session, utiliser Edge Function
