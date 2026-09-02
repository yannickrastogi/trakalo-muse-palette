# Auth Patterns — Trakalog

> **Status:** Stable — verified against the code, September 2, 2026
> **Last Updated:** September 2, 2026
> **Owner:** Ishan
> **Related:** [06 - Security Architecture](06-SECURITY_ARCHITECTURE.md), [RPCS.md](../DEVELOPMENT/RPCS.md)

## The underlying problem

Supabase does not persist the session to `localStorage` reliably for every user. The
consequence that matters is server-side: **`auth.uid()` can return NULL even while the user is
signed in as far as React is concerned.** Any RLS policy that depends on `auth.uid()` therefore
fails unpredictably, which is why every sensitive write goes through a `SECURITY DEFINER` RPC
taking an explicit `_user_id` instead — see [RPCS.md](../DEVELOPMENT/RPCS.md).

## Session backup

Two layers cooperate, and it is worth knowing which does what.

**Layer 1 — the client's custom storage adapter** (`src/integrations/supabase/client.ts`).
The Supabase client is built with a `customStorage` object that mirrors every auth-token write
into a second key:

```typescript
setItem: (key, value) => {
  localStorage.setItem(key, value);
  if (key.startsWith('sb-') && key.endsWith('-auth-token') && value) {
    localStorage.setItem('trakalog_session_backup', value);
  }
},
```

and, on read, falls back to that backup when the native key is missing. The mirror is
transparent to the rest of the app.

```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: customStorage,
    persistSession: true,
    autoRefreshToken: false,   // started manually, only once a session is known valid
  }
});
```

> **Never write the native `sb-*-auth-token` key yourself.** `persistSession: true` means
> Supabase owns it. Write only `trakalog_session_backup`, and only through the adapter.

**Layer 2 — `AuthContext.tsx`.** On each valid session it stamps `trakalog_was_auth = "1"` and
stores the full session JSON in `trakalog_session_backup`; on sign-out it clears both.
Recovery order when `getSession()` comes back empty: read the backup → try `refreshSession()`
with its refresh token → on success re-store the refreshed session → on failure fall back to
using the backup session directly in React state.

`ensureSession()` (refreshSession → getSession → localStorage backup) must run **before** any
code reads `user.id`.

## ProtectedRoute

`src/components/ProtectedRoute.tsx` guards the authenticated routes. Its current shape:

- Reads `session`, `loading` and `needsMfaVerification` from `useAuth()`.
- **Safety timeout:** if `loading` stays true for more than 5 seconds it sets `timedOut` and
  stops waiting, rather than spinning forever on a stalled auth call.
- A session with `needsMfaVerification` is sent to `/auth` for verification.
- With a session, it renders `children` immediately.
- With no session and either `loading === false` or the timeout elapsed, it redirects to
  `/auth`.

> **Note:** this component no longer uses the `useRef(hasEverRendered)` +
> `localStorage.trakalog_was_auth` double-guard that earlier revisions of this document
> described. That pattern is gone; the 5-second timeout replaced it. `trakalog_was_auth` is
> still written by `AuthContext`, but `ProtectedRoute` does not read it.

## Public pages — isolated anonymous client

Four pages create their own throwaway client: **`StudioSession`, `SignAgreement`,
`AcceptInvitation`, `SharedStemAccess`**.

```typescript
var anonClient = useRef(createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
})).current;
```

**Never at module level. Always inside a `useRef` within the component** — a module-level
`createClient()` produces competing `GoTrueClient` instances that fight over the same storage
key and corrupt the real session.

**`SharedLinkPage` is the exception and goes further:** it creates no client at all. Every call
is a direct REST `fetch` against `SUPABASE_URL` with `SUPABASE_PUBLISHABLE_KEY` in the `apikey`
and `Authorization` headers, importing both from `constants.ts`. Zero GoTrueClient. This is the
preferred shape for new public pages — the sanitizing `SECURITY DEFINER` RPCs
(`get_shared_link_by_slug`, `get_track_for_shared_link`, …) exist precisely so no raw table
read ever reaches an anonymous browser.

## localStorage keys

Auth and session:

| Key | Type | Purpose |
|---|---|---|
| `trakalog_was_auth` | boolean string | The user has had a valid session at some point |
| `trakalog_session_backup` | JSON | Mirror of the last Supabase session |
| `trakalog_active_workspace` | uuid | Last active workspace |
| `trakalog_just_logged_in` | boolean string | Transient post-login flag → open the personal workspace |
| `trakalog_auto_save` | slug string | Shared link to auto-save after signup |
| `trakalog_auth_redirect` | path string | Written by `Auth.tsx` from a `redirect` query param; consumed by `HomeRoute` |
| `trakalog_link_session_<linkId>` | token | *(sessionStorage)* shared-link password session |
| `trakalog_admin_dev_mode` | boolean string | Dev-only admin mode, set by `?admin=1` |

All access goes through `safeLocalStorage` / `safeSessionStorage` (`src/lib/safeStorage.ts`) —
storage throws in private mode and in some embedded browsers, and an uncaught throw during auth
bootstrap blanks the app.

## Google OAuth

- `queryParams: { prompt: "select_account" }` — forces the account picker
- `redirectTo: window.location.origin + "/auth"` — post-OAuth landing
- Client ID: `186139495931-vf74ntbatgtig8g10o0b8ee0vi0ug4fk.apps.googleusercontent.com`
- Production mode enabled

> The client ID appears **nowhere in this repository** — it is configured in the Supabase
> dashboard (Auth → Providers → Google), so this document is its only written record. A Google
> OAuth client ID is public by design (it is sent to the browser in every flow); the client
> *secret* is not, and is not recorded here.

## Pitfalls

1. ❌ **`window.location.href = "/..."` for in-app navigation** — a full page load destroys the
   in-memory session and forces the whole recovery path to re-run. Use `<Navigate>` or
   `useNavigate()`.
   *Exception:* `ProtectedRoute` deliberately uses `window.location.href` when redirecting to
   `/auth`, because at that point there is no session left to preserve and a hard load
   guarantees a clean auth bootstrap.
2. ❌ **`createClient()` at module level** — spawns competing `GoTrueClient` instances.
3. ❌ **Relying on `auth.uid()` in a policy for a sensitive write** — it returns NULL
   unpredictably. Route the write through a `SECURITY DEFINER` RPC with an explicit `_user_id`.
4. ❌ **Auto-creating a workspace inside `Auth.tsx`** — races with the `<Navigate>` that
   follows.
5. ❌ **`createSignedUrl()` from the browser for audio** — fails without a session. Use the
   storage Edge Functions (`get-audio-url`, `get-storage-url`, `get-watermarked-audio`) through
   the helpers in `src/lib/audio.ts`.
6. ❌ **Writing the native `sb-*-auth-token` key directly** — Supabase owns it under
   `persistSession: true`.
