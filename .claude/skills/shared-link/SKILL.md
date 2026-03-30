# Shared Link & Pages Publiques — Trakalog

---
name: shared-link
description: Quand on travaille sur SharedLinkPage, les shared links, le gate screen, le Save to Trakalog, ou toute page accessible sans authentification
---

## Principe fondamental

SharedLinkPage est **100% autonome**. Aucun provider authentifié (AuthContext, WorkspaceContext) ne doit wrapper cette page.

## Client Supabase pour pages publiques

```typescript
// DANS le composant, pas au niveau module
const anonClient = useRef(createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
}));
```

## Pages concernées
- `SharedLinkPage.tsx` — page de partage de track/playlist
- `StudioSession.tsx` — QR code studio
- `SignAgreement.tsx` — signature de splits
- `AcceptInvitation.tsx` — accepter une invitation workspace
- `SharedStemAccess.tsx` — accès aux stems

## Save to Trakalog — Flow

### Utilisateur connecté
1. Détection via `localStorage.trakalog_session_backup`
2. RPC `save_track_to_trakalog(_track_id, _source_ws, _target_ws, _user_id)`
3. Track apparaît dans le workspace personnel (viewer only)

### Utilisateur non connecté
1. `localStorage.setItem("trakalog_auto_save", slug)`
2. Redirect vers `/auth`
3. Post-login : Dashboard check `trakalog_auto_save` → redirect → auto-save

## Shared Links — Protection
- Public : pas de password
- Secured : password hashé via Edge Function `hash-link-password` (PBKDF2 100k)
- Vérification via Edge Function `verify-link-password`
- JAMAIS de hash côté client

## Branding
- Le branding appliqué = celui du **workspace qui envoie** le shared link
- Hero image, logo, brand color viennent du workspace source

## Restrictions pour les tracks sauvegardés (viewer)
- Masqué : Edit, Menu "...", onglets Stems/Activity, boutons d'édition
- Visible : Player, Metadata (lecture seule), Splits (lecture seule), Lyrics, Download, Review
- "Remove from my Trakalog" via RPC `remove_track_from_trakalog`
