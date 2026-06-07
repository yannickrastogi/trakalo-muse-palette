# COWORK SESSION REPORT — Trakalog

> Session démarrée : 2026-06-04 23:49 (heure locale)
> Opérateur : Claude (Cowork mode) · Fondateur : Yannick Rastogi
> Workspace de test : **Banx & Ranx Test** (`38007e8a-605b-4852-8c5a-73f3bc5c827c`)

---

## 🔴 INSTRUCTIONS ROLLBACK (à lire en premier)

**Tag de sécurité pré-session :** `pre-cowork-20260604-234913` (pointe sur `d20cee6`)

### Rollback complet de la session (option nucléaire)
Annule TOUS les commits de la session et restaure l'état pré-session. Vercel redéploie automatiquement en 1-2 min.

```bash
cd ~/Desktop/DEV/trakalog-app
git reset --hard pre-cowork-20260604-234913
git push --force origin main
```

### Rollback chirurgical d'un seul fix
Si un commit précis casse quelque chose mais que les autres sont bons :

```bash
git revert <commit_hash>
git push origin main
```

### Vérifier l'état
```bash
git log --oneline pre-cowork-20260604-234913..HEAD   # liste les commits de la session
git diff pre-cowork-20260604-234913..HEAD --stat       # fichiers touchés
```

---

## ÉTAT SETUP

| Élément | État |
|---|---|
| Dossier repo connecté | ✅ `~/Desktop/DEV/trakalog-app` |
| Branche | `main` (clean, sync origin) |
| HEAD au démarrage | `d20cee6` (fix PDF contacts) |
| Tag rollback | ✅ `pre-cowork-20260604-234913` |
| Chrome connector | ✅ Browser 1 (macOS, local) |
| Node / npm | v22.22.0 / 10.9.4 |
| Workspace actif vérifié | ✅ ID `38007e8a-605b-4852-8c5a-73f3bc5c827c` (= "Banx & Ranx Test", affiché "Banx & Ranx", 17 tracks) |

> ⚠️ Note : le workspace de test est **affiché "Banx & Ranx"** dans l'UI (sans suffixe "Test"), mais l'ID `trakalog_active_workspace` en localStorage confirme `38007e8a-…` = le workspace de test mandaté. Aucun autre "Banx & Ranx" n'existe dans le compte. ✅ Safe.

---

## PHASE 1 — SCAN BUGS

### 1A — Validation fix PDF contacts (commit d20cee6)

**Méthode :** export PDF réel intercepté en live (blob capturé sans download disque), re-rendu via PDF.js sur canvas pour inspection visuelle. Workspace "Banx & Ranx", 11 contacts.

| Check | Résultat |
|---|---|
| Titre "Banx & Ranx — Contacts" (em-dash `—`) | ✅ OK |
| Phone complet sur 1 ligne (`+447891981491`) | ✅ OK |
| Locations longues entières ("London, United Kingdom of Great Britain and Northern Ireland (the)" = 5 lignes) | ✅ OK |
| Roles longs entiers ("Songwriter, Producer, Musician, Recording Engineer, Mix Engineer") | ✅ OK |
| Pagination (2 pages) + header de table redessiné p.2 + footer | ✅ OK |
| **IPI complet sur 1 ligne** | ⚠️ **PARTIEL** |

**🐛 BUG-01 (mineur) — IPI 10+ chiffres wrap sur 2 lignes.**
La colonne IPI (largeur `contentW * 0.07` ≈ 45pt utiles à fontSize 8.5) tient un IPI 9 chiffres (`577018827` ✅) mais déborde un IPI 10 chiffres (`1202732896` → "120273289" + "6"). Le contenu est **complet** (plus de troncature ellipsis, le fix principal marche) mais pas sur **1 ligne** comme visé par d20cee6. Les IPI Name Number standards font jusqu'à 11 chiffres → la colonne doit être élargie à ~0.085 (en reprenant la largeur sur PRO/ORGANIZATION qui ont du contenu court).
- Fichier : `src/lib/pdf-generators.ts` (~ligne 692, `cols[] IPI width`)
- Priorité : basse. Fix candidat Phase 2.

**Observation (pas un bug PDF) :** doublons de contacts dans le workspace test — "Chukwuma Chinaza Ferdinand (Shine TTW)" ×2 et "Yannick Rastogi (KNY Factory)" ×2. À investiguer côté dedupe `upsert_contact` en Phase 1E (peut être de la vraie donnée dupliquée).


### 1B — Login loop (invités Quentin Mosimann / Maud Brooke) — PRIORITÉ HAUTE

**Méthode :** analyse code (AuthContext, ProtectedRoute, Auth.tsx, AcceptInvitation.tsx, Edge Functions create-invitation/accept-invitation) + diagnostic **read-only** sur la prod (SELECT, aucun write).

#### Données prod réelles (read-only)
| Email invité | Statut invit. | Whitelisté | Compte auth existe ? | Memberships |
|---|---|---|---|---|
| `quentin@quentinmosimann.com` | **pending** | ✅ oui | ❌ **non** | 0 |
| `maudbrooke@quentinmosimann.com` | **pending** | ✅ oui | ❌ **non** | 0 |

- `whitelisted_emails` contient 10 emails (la RPC `is_email_whitelisted` lit cette table — la doc RPCS.md dit `whitelist`, **faux nom**, à corriger).
- Aucun compte `auth.users` n'existe pour ces 2 personnes sous AUCUN email (`%mosimann%`, `%maud%`, `%quentin%` → 0 résultat). Seuls comptes récents : yannick + pro.eliots (tous deux OK).
- Donc : **ils ne sont jamais parvenus à créer un compte**, leurs invitations restent `pending`.

#### 🐛 BUG-02 — Login/invite loop (root cause identifiée, fix NON appliqué)

Le flux invité est fragile sur **plusieurs points** qui produisent une boucle de redirection vers `/auth` :

**Mécanisme A — boucle de redirection `/auth` ↔ `/invite/{token}` (cause la plus probable du symptôme rapporté) :**
`AcceptInvitation.tsx` détecte la session **uniquement** via `localStorage.trakalog_session_backup` (ligne 63), alors que `Auth.tsx` se base sur la session live d'`AuthContext`. Quand les deux divergent (session Supabase valide mais backup absent/périmé) :
`/invite/{token}` (pas de backup → "Sign up to accept") → `/auth?invite={token}` → Auth voit une session → `Navigate to /invite/{token}` (Auth.tsx L34-35) → … **boucle infinie**.

**Mécanisme B — `checkWhitelist` force `signOut()` à chaque `onAuthStateChange` (AuthContext L50-59, L68) :**
Le gate whitelist s'applique à l'email **d'authentification**, pas à l'email **invité**. Google OAuth n'a aucun gate au pré-signup → un invité qui se connecte avec un email différent de celui invité (ex. Gmail perso non whitelisté) est immédiatement `signOut` → renvoyé à `/auth`. L'invité ne peut jamais atteindre la page d'accept. (Les emails de Quentin/Maud sont sur domaine custom `@quentinmosimann.com` — probablement pas l'email avec lequel ils se loguent réellement.)

#### Pourquoi je n'ai PAS fixé (et stoppé) — conforme aux règles non-négociables
1. Le vrai fix correct vit côté **Edge Function** (`accept-invitation`/`create-invitation` doivent réconcilier l'email d'auth ↔ invitation, ou whitelister) → **deploy Edge Function interdit** par tes règles.
2. Débloquer Quentin/Maud = **ajouter un email à `whitelisted_emails`** = modification d'accès/whitelist (write DB) → interdit sans ton aval.
3. Un patch purement front (`AcceptInvitation` + `checkWhitelist`) toucherait l'**auth** (CLAUDE.md exige `/security-review`) et **ne peut pas être vérifié en live** sans reproduire un flux multi-comptes OAuth réel. Push d'un changement auth non vérifiable sur prod = risque non acceptable.

#### Fix recommandé (à faire par toi, hors session YOLO)
- **Front (AcceptInvitation.tsx) :** détecter la session via la même source qu'`AuthContext` (live Supabase session) au lieu du seul `localStorage.trakalog_session_backup` → tue le Mécanisme A. + garde anti-boucle dans `Auth.tsx` (ne pas `Navigate` vers `/invite` si on en vient déjà).
- **Edge Function (accept-invitation) :** permettre d'accepter une invitation quel que soit l'email d'auth, et whitelister l'email d'auth réel à l'acceptation → tue le Mécanisme B.
- **Doc :** corriger RPCS.md (`whitelist` → `whitelisted_emails`).
- **Unblock immédiat Quentin/Maud :** identifier l'email réel avec lequel ils se loguent, l'ajouter à `whitelisted_emails`, et leur renvoyer l'invitation. (À faire par toi.)

---

### 1C — Upload metadata ne persiste pas (commit 839b2de) — PRIORITÉ HAUTE

**Méthode :** analyse code (UploadTrackModal, TrackContext) + inspection read-only de la RPC `update_track` et du schéma `tracks` sur la prod.

#### 🐛 BUG-03 — Root cause : 4 clés de payload ne correspondent à aucune colonne → rollback total

`update_track(_user_id, _track_id, _updates jsonb)` est **générique** : elle construit un `UPDATE tracks SET %I = …` pour **chaque** clé de `_updates`, via `EXECUTE format(...)`. Pas de whitelist.

Le schéma réel de `tracks` ne contient **PAS** les colonnes : `written_by`, `produced_by`, `mixed_by`, `mastered_by` (vérifié via `information_schema`). Ces credits doivent vivre dans le jsonb `credits`.

Or **3 endroits** envoient ces 4 clés en top-level dans `_updates` :
1. `src/components/UploadTrackModal.tsx` — `extendedPayload` (L~795-820, le bulk détaillé = bug rapporté)
2. `src/contexts/TrackContext.tsx` `addTrack` — `metaPayload` (L663-666, upload simple)
3. `src/contexts/TrackContext.tsx` `updateTrack` — `payload` (L756-759, édition track)

Résultat : `UPDATE tracks SET written_by = …` → **`ERROR: column "written_by" does not exist`** → exception → **tout l'UPDATE rollback** → AUCUN des 16 champs ne persiste (album, upc, tags, credits, featuring, labels, publishers, isrc, copyright, explicit, notes, released_at…). Le user voit le toast "Some metadata could not be saved".
→ Bug déclenché dès qu'un des 4 champs writer/producer/mixer/masterer est présent dans le payload.

**Read path mort :** `mapRowToTrack` L171-174 lit `row.written_by` etc. (colonnes inexistantes → toujours vide). Ces 4 champs n'ont donc **jamais** persisté/affiché nulle part.

#### ⚠️ Mise à jour importante après audit du HEAD déployé
Le path **bulk détaillé reporté (UploadTrackModal) est DÉJÀ corrigé et déployé** (commit `965a323`) : son `extendedPayload` ne met plus les 4 clés en top-level, il les nest désormais dans `credits` jsonb, et tous ses top-level mappent à des colonnes réelles. → Le bug rapporté sur l'upload détaillé devrait déjà être résolu en prod ; le report initial précède probablement ce déploiement.

**Défauts résiduels confirmés dans le code (NON auto-fixés — voir décision) :**
1. `TrackContext.addTrack` L662-666 et `updateTrack` L756-759 envoient encore `written_by/produced_by/mixed_by/mastered_by` en **top-level** → rollback total de `update_track` dès qu'un champ writer est présent (impacte l'upload simple/quick path L1374 et l'édition de track via EditTrackModal/TrackDetail).
2. **Read path incohérent :** `mapRowToTrack` L171-174 lit ces credits depuis `row.written_by` (colonnes inexistantes) alors qu'UploadTrackModal les écrit maintenant dans `credits` jsonb → les credits writer/producer/mixer/masterer ne s'affichent **jamais**, même pour les tracks uploadés via le path corrigé.

#### Décision : NON auto-fixé en YOLO (documenté) — raisons
- Le fix correct de `updateTrack` doit **merger** dans le `credits` existant (update partiel) sinon il **écrase tout le jsonb credits** (perte de customPerformers/customProduction) → risque de perte de données.
- Impossible de vérifier en live sans **compléter de vrais uploads/éditions** (pollue le workspace test, et "pas de delete" m'interdit de nettoyer).
- Le headline bug étant déjà corrigé+déployé, le risque d'un push auth-adjacent non vérifié sur prod n'est pas justifié.

#### Fix recommandé (à appliquer par toi, avec test réel)
- `addTrack`/`updateTrack` : nest `writtenBy/producedBy/mixedBy/masteredBy` dans `credits` (mirror du pattern UploadTrackModal déjà déployé). Pour `updateTrack`, **merger** avec `track.credits` existant, ne pas remplacer.
- `mapRowToTrack` : lire ces 4 credits depuis `row.credits` (avec fallback) au lieu des colonnes inexistantes.
- Alternative propre : migration ajoutant les 4 colonnes `text` (SQL Option A ci-dessous) + garder les écritures top-level. Cohérent avec le read path actuel, mais nécessite de réécrire UploadTrackModal pour repasser en top-level.

#### Décision schéma (à toi) pour réactiver les credits writer/producer/mixer/masterer
Deux options — **ton choix d'architecture** :
- **Option A (migration, recommandée si tu veux ces colonnes) :** ajouter 4 colonnes `text` à `tracks` puis ré-ajouter les 4 lignes d'écriture. SQL à coller manuellement (je ne lance pas de migration) :
  ```sql
  ALTER TABLE public.tracks
    ADD COLUMN IF NOT EXISTS written_by  text,
    ADD COLUMN IF NOT EXISTS produced_by text,
    ADD COLUMN IF NOT EXISTS mixed_by    text,
    ADD COLUMN IF NOT EXISTS mastered_by text;
  ```
- **Option B (jsonb) :** stocker ces 4 dans `credits` + adapter le read path (`mapRowToTrack`) + auditer les consommateurs de `credits`. Plus de surface, je ne l'applique pas en YOLO.

### 1E — Sweep pages (partiel)
Couvert : Contacts (Phase 1A), Dashboard/Tracks/Playlists (navigation + workspace switch OK, aucune erreur bloquante observée). **Non complété** : sweep console systématique des pages restantes (Track Detail, Stems, Pitch, Shared Links, Approvals, Workspace Settings, Smart A&R, Radio, Notifications, Settings) — l'extension Chrome s'est déconnectée en fin de session. À reprendre. Comme le push est de toute façon impossible depuis cet environnement (voir Phase 2), aucun fix issu d'un sweep n'aurait pu être déployé dans cette session.

**Observation data (Phase 1A) :** doublons de contacts dans le workspace test (Chukwuma Chinaza Ferdinand ×2, Yannick Rastogi ×2) → vérifier le dédoublonnage `upsert_contact`.

---

## PHASE 2 — FIXES

### 🚧 Blocages d'infrastructure (critiques)
1. **Push GitHub impossible depuis l'environnement Cowork** : `git push` → `could not read Username for 'https://github.com'`. Le sandbox n'a pas tes credentials GitHub. → le loop *fix → push → Vercel deploy → retest prod* ne peut pas être exécuté ici. Tout fix doit être poussé par toi depuis ta machine.
2. **Lock files git résiduels** : les commits sandbox laissent des `.git/*.lock` non supprimables (permission). Ils bloqueront tes prochaines opérations git tant que tu ne les retires pas (commande plus bas).

### BUG-01 — Fix appliqué (commité localement, NON poussé)
- **Fichier :** `src/lib/pdf-generators.ts` — colonne IPI `contentW*0.07 → 0.085`, ORGANIZATION `0.10 → 0.085` (somme des largeurs inchangée = 1.00).
- **Effet :** un IPI de 10-11 chiffres tient désormais sur 1 ligne (largeur utile ~56.8pt vs ~45.3pt avant, à fontSize 8.5).
- **TypeScript :** `npx tsc --noEmit` → **EXIT 0** ✅
- **Commit :** `423181c` sur `main` (local, ahead origin/main de 1).
- **Statut :** ⏳ **non poussé / non vérifié en prod** (blocage push). Vérif géométrique + tsc OK ; vérif visuelle prod à faire après ton push.

### BUG-02 (login loop) — NON fixé (documenté, voir section 1B)
Nécessite deploy Edge Function et/ou modification whitelist (accès) → interdits par tes règles. Fix recommandé fourni.

### BUG-03 (upload metadata) — headline déjà déployé ; résiduels NON fixés (voir section 1C)
Path bulk détaillé déjà corrigé (commit `965a323`). Défauts résiduels (`addTrack`/`updateTrack` top-level keys + read path) non fixés : risque de perte de données sur merge `credits` partiel + impossible à vérifier en live sans polluer le workspace test. Fix recommandé fourni.

---

## PHASE 3 — VÉRIFICATION FINALE

**Non exécutée comme prévu** : le retest prod après déploiement est impossible sans push (voir Phase 2). 
- BUG-01 : vérifié au niveau code (tsc EXIT 0) + raisonnement géométrique. Vérif prod en attente de ton push.
- Aucune régression introduite : un seul fichier touché (`pdf-generators.ts`), changement purement cosmétique de largeurs de colonnes PDF, sommes préservées.
- Le tag `pre-cowork-20260604-234913` permet un rollback complet si besoin.

---

## PHASE 4 — BILAN

### Résumé
| Bug | Sévérité | Statut | Commit |
|---|---|---|---|
| BUG-01 — IPI PDF wrap 2 lignes | Mineur | ✅ Fix commité local, ⏳ à pousser | `423181c` |
| BUG-02 — Login/invite loop | **Haute** | 📋 Root-cause documentée, fix à faire par toi (Edge/whitelist) | — |
| BUG-03 — Upload metadata persistence | **Haute** | ✅ Headline déjà déployé (`965a323`) ; 📋 résiduels documentés | — |

### Comptage
- **Bugs trouvés : 3** (+ observations : doublons contacts, doc RPCS.md erronée `whitelist`→`whitelisted_emails`).
- **Fixés (commité) : 1** (BUG-01, en attente de push).
- **Non fixés : 2** (BUG-02 bloqué par règles ; BUG-03 résiduels = risque/vérif).

### ⚠️ ACTIONS MANUELLES REQUISES DE TON CÔTÉ
```bash
cd ~/Desktop/DEV/trakalog-app
# 1. Retirer les lock files résiduels laissés par le sandbox
rm -f .git/HEAD.lock .git/index.lock .git/objects/maintenance.lock
# 2. Vérifier le commit du fix BUG-01
git log --oneline pre-cowork-20260604-234913..HEAD   # -> 423181c
# 3. Pousser (déclenche le deploy Vercel)
git push origin main
# 4. (optionnel) Commiter ce rapport
git add COWORK_REPORT.md && git commit -m "Cowork session report 2026-06-04" && git push origin main
```
Puis vérifier sur app.trakalog.com : Contacts → Export → PDF → IPI 10+ chiffres sur 1 ligne.

### Range commits
`pre-cowork-20260604-234913 .. 423181c` (1 commit fix).

### Rollback
Voir section en haut. Tag : `pre-cowork-20260604-234913`.
