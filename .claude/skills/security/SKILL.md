# Security Patterns — Trakalog

---
name: trakalog-security
description: Quand on écrit ou modifie du code qui touche à l'authentification, aux passwords, aux shared links, aux Edge Functions, aux queries DB, aux uploads de fichiers, aux tokens, ou à toute logique d'accès et de permissions
---

## Principe

Trakalog gère du contenu musical confidentiel (tracks non-sortis, contrats, splits financiers). Chaque faille de sécurité = perte de confiance des labels et artistes. Appliquer ces règles sans exception.

## 1. Authentification & Sessions

### OBLIGATOIRE
- JAMAIS faire confiance à `auth.uid()` côté serveur — il retourne NULL de façon imprévisible
- Toujours passer `_user_id` en paramètre aux RPCs et vérifier les permissions DANS la fonction SQL
- Session backup dans localStorage — mais JAMAIS stocker de tokens sensibles en clair côté client en dehors du flow Supabase natif
- Google OAuth : toujours `prompt: "select_account"` pour éviter le login automatique sur le mauvais compte

### INTERDIT
- ❌ `window.location.href` pour naviguer (détruit la session)
- ❌ Stocker des secrets (API keys, service role key) côté client
- ❌ Exposer le `SUPABASE_SERVICE_ROLE_KEY` — seulement dans les Edge Functions (env vars Supabase)

## 2. Shared Links & Accès public

### Passwords
- Hash via Edge Function `hash-link-password` (PBKDF2 100k itérations) — JAMAIS côté client
- Vérification via Edge Function `verify-link-password` — JAMAIS de comparaison côté client
- JAMAIS stocker le password en clair dans la DB — seulement le hash

### Tokens
- Utiliser `crypto.randomUUID()` ou `crypto.getRandomValues()` pour les tokens de shared links
- JAMAIS de UUID v4 prévisible pour les tokens de sécurité
- Les tokens de signature (/sign/:token) doivent être à usage unique

### Gate Screen
- Valider les inputs (email format, longueur des champs) côté client ET côté serveur
- Sanitizer les données du gate screen avant insertion en DB (pas de XSS via nom/company)

## 3. Edge Functions

### OBLIGATOIRE
- CORS restreint via `_shared/cors.ts` — JAMAIS de wildcard `*`
- Valider TOUS les inputs (types, longueurs, formats) au début de chaque fonction
- Utiliser `SUPABASE_SERVICE_ROLE_KEY` uniquement pour les opérations qui le nécessitent
- Rate limiting sur les endpoints sensibles (verify-link-password notamment)
- Retourner des messages d'erreur génériques à l'utilisateur — pas de stack traces

### INTERDIT
- ❌ `Access-Control-Allow-Origin: *`
- ❌ Exposer des détails d'erreur internes au client
- ❌ Accepter des inputs sans validation

## 4. Base de données

### RPCs SECURITY DEFINER
- Toujours vérifier que `_user_id` a le droit d'accéder à la ressource demandée
- Pattern : vérifier membership du workspace DANS la fonction SQL
- Soft deletes uniquement — JAMAIS de DELETE (intégrité légale des contrats et splits)

### Injection SQL
- JAMAIS de concaténation de strings dans les queries SQL
- Utiliser des paramètres bindés ($1, $2) dans les RPCs
- Valider les UUIDs avant de les passer aux queries

## 5. Fichiers & Storage

### Uploads
- Valider le type MIME côté serveur (pas seulement l'extension)
- Limiter la taille des fichiers (audio : 200MB max, images : 10MB max, documents : 50MB max)
- Watermarker les documents PDF avec TRAKALOG via pdf-lib au download

### Audio
- Utiliser l'Edge Function `get-audio-url` pour servir l'audio (URLs signées temporaires)
- JAMAIS d'URL permanente vers un fichier audio — toujours des signed URLs avec expiration
- Preview MP3 128kbps seulement — ne pas exposer le WAV original via les shared links

## 6. Permissions & Accès

### Catalog Shares
- Vérifier le `access_level` (viewer/pitcher/editor/admin) avant CHAQUE opération
- Un viewer ne peut PAS : éditer, supprimer, re-partager, voir les stems
- Le re-partage de tracks sauvegardés est INTERDIT

### Workspace Isolation
- Toutes les queries doivent filtrer par `workspace_id` — jamais de données cross-workspace involontaires
- Le dashboard ne doit montrer que les events du workspace actif

## 7. Headers & Transport

### À implémenter (roadmap sécurité)
- CSP headers pour prévenir les injections de scripts
- Rate limiting global (Cloudflare ou Edge Function middleware)
- IP logging sur les accès aux shared links
- Audit logs pour les actions sensibles (delete, share, sign)

## Checklist avant chaque push

1. ✅ Pas de secret/API key dans le code client
2. ✅ Inputs validés côté serveur
3. ✅ Permissions vérifiées dans les RPCs
4. ✅ CORS restreint sur les Edge Functions
5. ✅ Pas de données cross-workspace exposées
6. ✅ Soft delete, pas de hard delete
7. ✅ Tokens crypto (pas UUID v4) pour les liens sécurisés
