# COWORK_VALIDATION_REPORT — Validation P1-07 (invitations) + P0-05 (waitlist)

**Date** : 2026-06-07 · **Main** : `4af495d` · **Projet** : `xhmeitivkclbeziqavxw` · **Mode** : test + diagnostic, aucun fix appliqué

---

## Verdicts

| Fix | Verdict | Résumé |
|---|---|---|
| **P0-05 waitlist** | ❌ **KO — P0 cassé en prod** | Tout signup retourne 500 : la fonction insère une colonne `source` qui n'existe pas dans la table `waitlist`. |
| **P1-07 invitations** | 🟡 **Code validé, e2e non testé** | Revue code + Edge Function : logique correcte (auto-whitelist auth email + session live). Test e2e bloqué : nécessite login Yannick. |

---

## P0-05 — Waitlist signup ❌ CASSÉ

### Cause racine
La table `waitlist` a pour colonnes : `id, email, created_at, invited_at, invitation_sent_by`. **Il n'y a pas de colonne `source`.**
La Edge Function `add-to-waitlist` fait toujours :
```js
const source = typeof body.source === "string" ? body.source.slice(0, 64) : "landing";
const insertPayload = { email };
if (source) insertPayload.source = source;   // ← source vaut TOUJOURS "landing"
await supabaseAdmin.from("waitlist").insert(insertPayload);
```
`source` est toujours truthy (défaut `"landing"`) → l'insert porte une colonne inexistante → PostgREST rejette → catché et masqué en `500 {"error":"Could not save your email"}`. Côté front, `LandingPage.tsx` affiche le toast "Something went wrong". **Aucun visiteur ne peut s'inscrire à la waitlist.**

### Preuves (test end-to-end, IP Cowork, depuis www.trakalog.com)

Requête identique à `LandingPage.tsx` (POST `/functions/v1/add-to-waitlist`, apikey + Bearer anon) :

| Test | Payload | Status | Body |
|---|---|---|---|
| Email valide | `cowork-test-002@trakalog.com` | **500** | `{"error":"Could not save your email"}` |
| Même email (devrait être doublon→200) | idem | **500** | `{"error":"Could not save your email"}` (jamais inséré, donc jamais "doublon") |
| Email invalide | `not-an-email` | 400 | `{"error":"Invalid email"}` ✅ validation OK |

Edge Function logs (verbatim) confirment : `POST | 500 | .../add-to-waitlist` (×2) + `POST | 400` + `OPTIONS | 200`.
Vérif DB : `SELECT count(*) FROM waitlist WHERE email LIKE 'cowork-%'` → **0** (rien inséré, aucune donnée de test à nettoyer).

### Ce qui marche dans P0-05
- ✅ **CORS** : `OPTIONS` → 200, origins allowlistés (`getCorsHeaders` / `rejectInvalidOrigin`).
- ✅ **Validation email** : email malformé → 400.
- ✅ **Rate limit** : burst de 6 requêtes depuis la même IP → 5 passent la barrière puis **429** (`check_rate_limit` `add-to-waitlist:<ip>`, 5/900s). Observé : `[500,500,500,429,429,429]` (3 requêtes antérieures dans la fenêtre + 3 nouvelles = bascule au 6e).
- ❌ **Insert** : c'est la seule étape cassée — mais elle casse 100 % des signups réels.

### Fix recommandé (NON appliqué — à valider avec toi)
Deux options, **option A recommandée** (la moins risquée, pas de DDL) :

- **Option A — retirer `source` du payload Edge Function** (`add-to-waitlist/index.ts`). `source` n'est de toute façon stocké nulle part :
  ```diff
  -    const source = typeof body.source === "string" ? body.source.slice(0, 64) : "landing";
       ...
  -    const insertPayload: Record<string, unknown> = { email };
  -    if (source) insertPayload.source = source;
  +    const insertPayload: Record<string, unknown> = { email };
       const { error: insertErr } = await supabaseAdmin.from("waitlist").insert(insertPayload);
  ```
  Redéploiement Edge Function uniquement, zéro migration.

- **Option B — ajouter la colonne** si tu veux tracer la provenance :
  ```sql
  ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS source text DEFAULT 'landing';
  ```
  (à exécuter dans le SQL Editor ; le code actuel marcherait tel quel ensuite).

Recommandation : **Option A** maintenant pour débloquer le launch, Option B plus tard si l'analytics de provenance devient utile.

---

## P1-07 — Invitation login loop 🟡 Code validé, e2e à finir

### État DB (avant test)
- `whitelisted_emails` : 10 entrées (comptes test + beta connus).
- `invitations` workspace Banx & Ranx Test : 0 (table globale : 3 invitations, toutes anciennes).

### Revue code + Edge Function (déployée v19)
La logique du fix est **correcte** :

1. **`AcceptInvitation.tsx`** utilise `useAuth().session` live (l.55, `var { session: authSession } = useAuth()`) — plus de parsing manuel de `localStorage.trakalog_session_backup` (source de l'ancienne loop). `handleAccept` envoie `{ token, user_id: session.user.id }` à la fonction. "Sign up" redirige vers `/auth?invite=<token>`.
2. **Edge Function `accept-invitation`** (étape 6, le cœur du fix P1-07/BUG-02) :
   ```js
   const { data: authUser } = await supabase.auth.admin.getUserById(userId);
   const authEmail = authUser?.user?.email?.toLowerCase().trim();
   if (authEmail) {
     await supabase.from("whitelisted_emails").upsert({ email: authEmail }, { onConflict: "email" });
   }
   ```
   → whitelist l'email **réel** du compte auth (et non `invitation.email`), ce qui casse la loop quand l'utilisateur s'inscrit avec un email différent de celui invité. Plus : checks status `pending`, expiration, upsert `workspace_members`, marquage `accepted`, rate limit 10/h, CORS/origin.

### Pourquoi e2e non complété
Le test bout-en-bout (inviter → accepter avec un 2e compte Google → vérifier pas de loop) **nécessite ton login** sur app.trakalog.com et un 2e compte Google de test. Conformément aux règles (aucun credential côté Cowork), je n'ai pas pu le jouer. La revue statique ne révèle aucun défaut, mais ne remplace pas la validation runtime de l'absence de loop.

### Pour finaliser (toi, 5 min)
1. Login app.trakalog.com → Settings → Members → inviter un email de test.
2. Récupérer le token : `SELECT token, email, status FROM invitations WHERE workspace_id='38007e8a-605b-4852-8c5a-73f3bc5c827c' ORDER BY created_at DESC LIMIT 1;`
3. Ouvrir `/invite/<token>` en navigation privée, "Accept", login avec un compte différent.
4. Vérifier : `SELECT * FROM whitelisted_emails WHERE email='<email_du_compte_auth>'` (doit apparaître) ; invitation `status='accepted'` ; logout/login du même compte → pas de loop.

---

## Bugs trouvés

| # | Sévérité | Bug | Statut |
|---|---|---|---|
| 1 | **P0** | `add-to-waitlist` insère `source` (colonne inexistante) → tous les signups waitlist échouent en 500 | Documenté, **fix proposé non appliqué** (Option A) |

## Recommandations
1. **Appliquer le fix waitlist (Option A) en priorité** — c'est bloquant pour le pré-launch : la landing publique ne capture aucun lead actuellement.
2. **Smoke test post-déploiement Edge Functions** : un simple POST valide + assert 200 aurait attrapé ce bug (3e incident du même type : RPC/fonction qui passe le déploiement mais casse à l'exécution). À ajouter au workflow de déploiement.
3. **Démasquer partiellement les erreurs en staging** : le `console.error("[add-to-waitlist] insert failed:", insertErr)` est bien présent côté serveur — vérifier que ces logs sont surveillés (ils auraient montré l'erreur colonne `source`).
4. **Finaliser le test e2e P1-07** côté Yannick (procédure ci-dessus) avant de cocher le fix comme validé.
