# COWORK — AUDIT COMPLET TRAKALOG

> Mode **read-only** — aucun fix, aucun write DB, aucun push. Audit actionnable.
> Démarré : 2026-06-05 · Branche `main` @ `aff9c1e` · Workspace test `38007e8a-…` (Banx & Ranx Test)
> Baseline : COWORK_REPORT.md (BUG-01/02/03 déjà diagnostiqués — non re-diagnostiqués)

---

## 🚨 CRITICAL SECURITY

### 🔴 CRIT-01 — `shared_links` lisible par TOUT anon/authed (fuite cross-workspace + password_hash)
**Policies RLS** sur `public.shared_links` :
- `anon_read_shared_links` → role **`anon`**, `USING (status = 'active')`
- `Authenticated users can view active shared links` → role **`authenticated`**, `USING (status = 'active')`

Aucune restriction de workspace/ownership. La clé publishable (`anon`) est **embarquée dans le JS frontend** → n'importe qui peut faire `SELECT * FROM shared_links WHERE status='active'` et **dumper TOUS les liens partagés actifs de la plateforme**, tous workspaces/clients confondus.

Colonnes exposées : `link_slug` (→ ouvrir n'importe quel lien partagé directement), **`password_hash`** (bcrypt → crackable offline + révèle quels liens sont protégés), `track_id`, `playlist_id`, `workspace_id`, `message`, `allow_download`, `expires_at`, `watermarking_enabled`, `gate_screen_enabled`.

**Impact :** rupture du modèle de confidentialité des liens partagés (catalogue pré-release = cœur de valeur Trakalog). Énumération de tous les slugs → accès à tout le contenu partagé non protégé par mot de passe ; exposition des hash pour brute-force offline des liens protégés ; leak métadonnées cross-client.

**Atténuation existante (limite le blast radius) :** les buckets `tracks/stems/documents/watermarked` sont **privés** et n'ont **aucune policy SELECT `anon`** → l'audio brut n'est PAS téléchargeable en masse via l'API storage (servi via Edge Functions + signed URLs). Donc fuite = **métadonnées + énumération d'accès**, pas dump audio direct. Reste **P0** vu la nature pré-release.

**Fix recommandé :** supprimer les policies anon/authenticated « read all active ». Servir la page publique via une **RPC SECURITY DEFINER `get_shared_link_by_slug(_slug)`** qui (a) filtre sur le slug exact, (b) ne renvoie JAMAIS `password_hash`, (c) délègue la vérif mot de passe à l'Edge Function `verify-link-password` déjà existante. Idem restreindre `authenticated` aux membres du workspace.

### 🟠 CRIT-02 — `signature_requests` : UPDATE anon non scopé par token (risque de forge de signature)
Policy `signature_requests_anon_update_signing` → role `anon`, `USING ((token IS NOT NULL) AND (status='pending'))`, `WITH CHECK (token IS NOT NULL AND status IN ('signed','pending'))`. Le `token IS NOT NULL` est vrai pour **toutes** les lignes → un anon (clé publique) peut PATCH n'importe quelle `signature_request` en `pending` **sans connaître le token** (il suffit de cibler la ligne par id via REST) → **signer des accords à la place d'autrui**. À vérifier en exploitation (non testé), mais la policy ne lie pas le token fourni à la ligne. **Fix :** vérifier l'égalité du token via une RPC SECURITY DEFINER, ou `USING (token = current_setting(...))`.

### 🟠 CRIT-03 — `track_comments` : UPDATE/DELETE anon cross-lien
Policy `track_comments_anon_update` → role `anon`, `USING (shared_link_id IN (SELECT id FROM shared_links WHERE status='active'))`. Non scopé au lien réellement consulté ni à l'auteur → un anon sur le lien X peut éditer/soft-delete les commentaires de **n'importe quel lien actif Y**. (L'INSERT est correctement scopé via EXISTS, seul UPDATE/DELETE est trop large.) **Fix :** scoper au `shared_link_id` du token courant + author.

---

## Résumé exécutif

Légende sévérité : 🔴 P0 (bloquant beta) · 🟠 P1 (important) · 🟡 P2 (mineur) · ⚪ Nice-to-have

> ⚠️ **Audit PARTIEL.** Axes couverts cette session : **3 (DB/RLS), 4 (storage/code-sécu), 6 (code), 8 (specs)** + section CRITICAL. **Non couverts : Axes 1 (UI/UX), 2 (flows), 5 (perf), 7 (console/network)** — l'extension Chrome est restée déconnectée toute la session malgré plusieurs tentatives. Point de reprise : reconnecter Chrome → login → workspace Banx & Ranx Test → dérouler Axes 1/2/5/7.

### Score global de santé : **6 / 10**
Ingénierie backend solide (RLS activé partout, storage privé scopé par membership, signed URLs, hygiène Edge Functions correcte, dette RLS legacy `user_roles` **résolue**, onboarding complet). **MAIS** : une **fuite RLS critique** (`shared_links` lisible par anon, `password_hash` exposé) qui casse le cœur de valeur (confidentialité pré-release), 2 policies anon-write trop larges (forge de signature, tampering commentaires), et plusieurs features **bloquantes beta non démarrées** (Billing #1, DDEX/PRO, ISRC génération). À ne pas lancer en beta publique avant fix CRIT-01/02 + Billing.

### Top 5 P0 (à régler avant beta publique)
1. 🔴 **CRIT-01** — `shared_links` lisible par tout anon (clé publique) → énumération de tous les liens partagés + exposition `password_hash`. Fuite cross-workspace du catalogue pré-release.
2. 🔴 **CRIT-02** — `signature_requests` : UPDATE anon non lié au token → risque de **forge de signature** sur les accords de splits.
3. 🔴 **Billing non démarré** (TRAKALOG_BILLING.md) — déclaré #1 bloquant beta, zéro code Stripe (tables `subscriptions`/`credit_purchases` existent mais inutilisées).
4. 🔴 **BUG-02 login loop** (baseline COWORK_REPORT.md) — les invités ne peuvent pas se connecter (whitelist sur email d'auth ≠ email invité).
5. 🔴 **`tracks` policy cross-workspace** — tout authentifié peut lire la metadata de toute track ayant un lien actif, hors membership.

### Top 10 P1
1. 🟠 CRIT-03 — `track_comments` UPDATE/DELETE anon cross-lien (tampering).
2. 🟠 `update_track` RPC générique sans whitelist de colonnes (classe BUG-03 — fragilité persistance).
3. 🟠 `LandingPage.tsx:104` — write `waitlist` via le **client authed natif** sur page publique (viole le pattern).
4. 🟠 Fichiers géants : `TrackDetail.tsx` (4200), `UploadTrackModal.tsx` (3890) → risque React-#310/stale-closure.
5. 🟠 18 fichiers en `localStorage` brut au lieu de `safeLocalStorage`.
6. 🟠 Admin Dashboard partiel (4/9 pages) — manque KPIs/impersonation/digest.
7. 🟠 ISRC = champ manuel only (génération/validation/bulk absents).
8. 🟠 DDEX/PRO Exports + Track Versioning non démarrés (chaîne ISRC→DDEX entièrement vide).
9. 🟡 `covers` bucket public → cover art pré-release exposé à anon.
10. 🟡 `user_roles` legacy orphelin + tables billing sans code → nettoyer/réconcilier ; Edge Functions sensibles (`trace-leak`, `verify-link-password`) sans `console.error`.

### Inventaire (session partielle)
- **Pages auditées via browser : 0** (Chrome down) — Axes 1/2/5/7 à faire.
- **Tables auditées : 31** (RLS) + **7 buckets** storage + **20 Edge Functions** + **9 specs**.
- **Issues trouvées : ~25** — dont **3 CRITICAL sécurité**, ~6 P0, ~10 P1, reste P2/⚪.
- **Issues sécu : 5+** (CRIT-01/02/03, tracks cross-ws, covers public). **Perf : non mesuré** (browser).

---

## 1. UI/UX cohérence
🚫 **NON COUVERT cette session** — extension Chrome déconnectée (plusieurs retries échoués). À reprendre : reconnecter Chrome, login manuel, switch Banx & Ranx Test, puis dérouler les 28 pages listées (empty/loading/error states, responsive 375px, cohérence brand, modals, sidebar permissions) avec screenshots.

## 2. Flows utilisateur
🚫 **NON COUVERT cette session** (Chrome down). Flows A→I à reproduire en sandbox (Quick/Bulk upload + bouton « Skip Review » récent, shared link + gate screen, pitch cancel-avant-send, playlist reorder, splits/signatures, Smart A&R matching, workspace switch, branding→shared link). NB : le bug Skip Review et le workflow review individuel sont à valider en priorité (commit récent `aff9c1e`).

## 3. Backend / DB / RLS
_(Axe 3 — Supabase SELECT, read-only)_

### 3.1 RLS — état global ✅ bon
- **Toutes les 31 tables `public` ont RLS activé.** Aucune table exposée sans RLS.
- 5 tables ont RLS **sans aucune policy** = deny-all aux clients (`audit_logs`, `beta_passes`, `rate_limits`, `watermark_payloads`, `whitelisted_emails`). ⚪ Sécurisé tant que l'accès se fait via RPC SECURITY DEFINER uniquement (confirmer qu'aucun code front ne les lit en direct → renverrait vide).

### 3.2 ✅ Dette « legacy user_roles » — RÉSOLUE pour les tables critiques
La mémoire signalait une incohérence RLS legacy `user_roles` (11 rôles) vs `workspace_members.access_level`. **Vérifié : aucune policy des 14 tables critiques (tracks, playlists, pitches, shared_links, contacts, stems, approvals, …) ne référence `user_roles`.** Tous les writes passent par `workspace_members` / `has_workspace_access_level(...,'editor'|'pitcher'|'admin')`. 
- 🟡 La table `user_roles` **existe encore** (5 policies propres) mais semble **orpheline** → candidat nettoyage (confirmer qu'aucun code ne la lit).

### 3.3 Policies anon/larges à risque
Voir 🚨 CRITICAL ci-dessus : CRIT-01 (`shared_links` read-all), CRIT-02 (`signature_requests` anon update), CRIT-03 (`track_comments` anon update cross-lien).
- 🟠 `tracks` policy `Authenticated users can view tracks via shared links` : `USING (id IN (SELECT track_id FROM shared_links WHERE active))` → **tout utilisateur authentifié peut lire n'importe quelle track ayant un lien actif, sans être membre du workspace** (leak catalogue cross-workspace : metadata + `audio_url`). L'audio reste gated par storage privé, mais la metadata fuit.

### 3.4 RPCs SECURITY DEFINER
- 🟠 **`update_track(_user_id, _track_id, _updates jsonb)` = générique sans whitelist de colonnes** (cf. BUG-03, COWORK_REPORT.md). Construit un `UPDATE … SET %I` pour chaque clé du jsonb → une clé ne correspondant pas à une colonne fait rollback tout l'UPDATE. Robustesse fragile : toute évolution du payload front peut casser silencieusement la persistance. **Recommandation :** whitelister les colonnes autorisées dans la RPC (ignorer les clés inconnues au lieu de throw).
- Pattern `_user_id` explicite : globalement respecté (cf. RPCS.md). À auditer exhaustivement : RPCs sans vérif membership workspace (non complété cette session — voir « non couvert »).

### 3.5 Tables billing présentes sans code
🟡 Les tables **`subscriptions` et `credit_purchases` existent** (RLS + 1 policy chacune) alors que l'Axe 8 confirme **zéro code Stripe**. Schéma en avance sur le code (groundwork billing) — à réconcilier avec TRAKALOG_BILLING.md.

## 4. Sécurité
_(Axe 4)_

### 4.1 Storage buckets — ✅ globalement sain
| Bucket | Public | Policies |
|---|---|---|
| `avatars` | 🌐 public | anon read (OK, non sensible) |
| `branding` | 🌐 public | anon read (OK, logos) |
| `covers` | 🌐 public | 🟡 anon read **toutes** les covers (cover art pré-release exposé — mineur, souvent partagé) |
| `tracks` | 🔒 privé | SELECT = `authenticated` + `is_workspace_member` ✅ ; write = editor+ ✅ |
| `stems` | 🔒 privé | idem ✅ |
| `documents` | 🔒 privé | idem ✅ |
| `watermarked` | 🔒 privé | (à confirmer — pas de policy listée pour ce bucket → deny-all clients, servi via Edge Function) |

✅ **Aucune policy `anon` sur tracks/stems/documents** → l'audio brut n'est pas téléchargeable directement par anon (bonne défense en profondeur). Les writes storage sont correctement scopés `editor`/`uploader` via `has_workspace_access_level`.

### 4.2 Signed URLs / getPublicUrl — à finir (browser/code)
- ✅ **Vérifié (grep) : tous les `getPublicUrl` sont sur des buckets publics** (`covers`, `avatars`, `branding`). Aucun `getPublicUrl` sur `tracks/stems/documents/watermarked`.
- ✅ **Audio = `createSignedUrl`** : `TrackDetail.tsx:322` (tracks, **300s** = 5 min ✅), `crossfadePlayer.ts:155` (tracks, 3600s), `Stems.tsx:162/207` (stems, 3600s). Le pattern signed-URL est en place. 🟡 Note : 3600s (1h) sur crossfade/stems vs 300s annoncé — durée plus longue, à confirmer si voulu.
- Confirmer côté runtime que les liens partagés servent bien des signed URLs (Network tab) → **non couvert** (browser).

### 4.3 Watermarking — non vérifié (browser)
Badge « Protected », appel `get-watermarked-audio` sur les liens partagés, absence de fallback non-watermarked silencieux → **nécessite test runtime** sur un lien partagé. **Non couvert cette session** (Chrome instable).

### 4.4 Auth flows — partiellement couvert (cf. COWORK_REPORT.md BUG-02)
Le login loop (BUG-02) reste documenté dans le rapport précédent (whitelist sur email d'auth ≠ email invité, double mécanisme de boucle). Tests runtime (session persistence, logout cleanup, ProtectedRoute redirect) → **non couverts cette session** (browser).

### 4.5 Input validation / XSS
Pattern Trakalog : `htmlEscape()` côté Edge Functions (confirmé présent dans plusieurs functions), React échappe nativement côté front. ⚪ Pas de `dangerouslySetInnerHTML` audité cette session → **à vérifier** : `grep dangerouslySetInnerHTML src/`.

## 5. Performance
🚫 **NON COUVERT cette session** (Chrome down — DevTools requis). À mesurer : TTI Dashboard/Tracks/TrackDetail, taille des chunks JS au login, candidats lazy-load connus (`pdfjs-dist`, `pdf-lib`, `lamejs`, `jspdf`, `jszip`), N+1 queries sur Tracks/TrackDetail (Network tab), memory leak après navigation répétée.
> 🟡 Indice statique (Axe 6) : `TrackDetail.tsx` (4200 lignes) et `UploadTrackModal.tsx` (3890) sont des candidats forts à problème de rendu/mémoire — à confirmer au profiling.

## 6. Cohérence code
_(Axe 6 — lecture repo)_

### 6.1 Writes DB directs depuis le frontend (anti-pattern RPC SECURITY DEFINER)
🟠 **P1 — 6 writes directs trouvés** (devraient passer par RPC) :
- 🔴 `src/pages/LandingPage.tsx:104` — `insert` dans `waitlist` via le **client authed natif** (`@/integrations/supabase/client`), pas un anonClient REST. Page publique qui touche le client natif = viole la règle pages publiques. **À corriger.**
- 🟠 `src/pages/StudioSession.tsx:104` — insert `studio_submissions` (anonClient isolé, acceptable infra mais pas RPC).
- 🟠 `src/pages/SignAgreement.tsx:169` — update `signature_requests` (anonClient, table de signature sensible).
- 🟠 `src/pages/SharedStemAccess.tsx:881/905/923` — insert + 2 update sur `track_comments` (anonClient).

Ces writes anon dépendent à 100% de RLS airtight sur ces tables → à corréler avec l'Axe 3 (RLS).

### 6.2 localStorage direct vs safeLocalStorage
🟠 **P1 — 19 fichiers** utilisent `localStorage` brut malgré le wrapper `src/lib/safeStorage.ts`. Pires : `DashboardContent.tsx` (13), `lib/theme.ts` (10), `SharedLinkPage.tsx` (6). ⚪ `integrations/supabase/client.ts` (5) = **légitime** (couche session-backup). Les 18 autres devraient migrer vers `safeLocalStorage` (sécurité private-mode/SSR).

### 6.3 TypeScript escape hatches
🟡 **P2** — `as any` = **46**, `: any` = **38**, `@ts-ignore` = **0** ✅, `@ts-expect-error` = **0** ✅, `eslint-disable` = 7. Concentration : `TrackContext.tsx` (19 — pire), `WorkspaceSwitcher.tsx` (10).

### 6.4 Fichiers géants (refactor candidates)
🔴/🟠 **P1** — risque React-#310 / stale-closure (vos propres anti-patterns) :
1. `pages/TrackDetail.tsx` — **4200 lignes** 🔴
2. `components/UploadTrackModal.tsx` — **3890** 🔴 (gonflé par Skip Review)
3. `pages/SharedLinkPage.tsx` — 2160 · 4. `DashboardContent.tsx` — 1308 · 5. `WorkspaceSettings.tsx` — 1252 · 6. `lib/pdf-generators.ts` — 1181 · 7. `SharedStemAccess.tsx` — 1173 · 8. `SettingsPage.tsx` — 1133 · 9. `Contacts.tsx` — 1052. (`types.ts` 1026 = généré, ignorer.)

### 6.5 Dead code
⚪ Aucun dead code réel. Seuls non-importés = primitives shadcn/ui stock (à garder).

### 6.6 Edge Functions — hygiène
⚪ **Plutôt sain** — 20 functions, **toutes ont CORS + rate limiting** (`create-invitation` = throttling inline custom L65, pas la RPC mais fonctionnel). `verify-link-password` rate-limité (5 req/300s/IP). 
- 🟡 `console.error` (logging serveur) absent dans : `create-invitation`, `get-audio-url`, `send-invitation-email`, `send-pitch-email`, `trace-leak`, `verify-link-password`. **`trace-leak` et `verify-link-password` sont sensibles** → vérifier que les échecs sont loggés serveur et pas leakés au client.
- 🟡 `isValidUUID` absent de `hash-link-password`, `log-link-access`, `send-waitlist-invite`, `verify-link-password` (clés slug/IP/email → possiblement N/A, mais confirmer la validation d'input).

## 7. Console / Network errors
🚫 **NON COUVERT cette session** (Chrome down). À faire : DevTools Console + Network pendant la navigation de toutes les pages (Axe 1), lister erreurs/warnings (page, message, sévérité) + 4xx/5xx/timeouts.

## 8. Specs vs implémentation
_(Axe 8 — docs/)_

| Spec | État | Évidence / Gap |
|---|---|---|
| **ONBOARDING.md** | ✅ Implémenté | 4 couches présentes : `Onboarding.tsx`, `onboarding/GuidedTour.tsx`, `OnboardingChecklist.tsx`, `OnboardingContext.tsx`, `Guide.tsx`. Checklist = 6 steps. Fonctionnellement complet. |
| **TRAKALOG_ADMIN_DASHBOARD.md** | 🟡 Partiel (4/9 pages) | `admin/AdminDashboard.tsx` + RPC `is_platform_admin`. Tabs : Overview/Waitlist/Contacts/Users. **Manque** : KPIs MRR/churn, impersonation, email digest, audit-log/billing/storage. KPIs revenus bloqués par Billing. |
| **ISRC_GENERATION.md** | 🟡 Partiel (champ manuel) | ISRC = simple input texte libre (`TrackDetail.tsx:1484`), colonne `isrc` existante. **Manque** : génération 1-clic, registrant code, compteur séquentiel, validation format ISO 3901, bulk. |
| **TRAKALOG_BILLING.md** | ❌ Non démarré | **Zéro code Stripe** dans `src/`, aucune edge function billing, aucune table plan/subscription. ⚠️ C'est pourtant le **#1 bloquant beta** déclaré. |
| **DDEX_PRO_EXPORTS.md** | ❌ Non démarré | Aucun export BMI/ASCAP/SOCAN/SoundExchange/MLC ni DDEX XML. Dépend d'ISRC (non fait) + ISWC par track (champ absent). |
| **TRACK_VERSIONING.md** | ❌ Non démarré | Table `track_versions` **absente des migrations SQL** (uniquement dans prose docs/architecture). Pas d'UI versioning. 1 track = 1 audio. |
| **ARTIST_SEEKER.md** | ❌ Non démarré (Phase 4, attendu) | Aucun code. Correctement différé. Dépend du Smart Brief Matching. |
| **BRIEF_SEEKER.md** | ❌ Non démarré (Phase 4, attendu) | Pas de scan auto. NB : `smart-ar` edge function existe (Smart A&R manuel = précurseur MVP). Correctement différé. |
| **TRAKALOG_MAESTRO.md** | ⚠️ **Doc introuvable** | Aucun fichier `docs/TRAKALOG_MAESTRO.md`, aucune ref `maestro` dans le repo. Renommé ou jamais créé → la mission le liste pourtant. |

**Dépendances critiques :** Billing (non fait) gate les KPIs revenus de l'Admin Dashboard. Chaîne ISRC → DDEX entièrement non démarrée. Track Versioning référencé en archi mais sans migration DB.

---

## Annexes

### SQL queries exécutées (read-only, aucune écriture)
1. Liste tables + `relrowsecurity` + count policies (`pg_class`/`pg_policies`).
2. Policies des 14 tables critiques + flags refs `user_roles` / `workspace_members`.
3. `qual`/`with_check` détaillés des policies suspectes (`shared_links`, `signature_requests`, `track_comments`, `tracks` anon/authenticated).
4. Colonnes de `shared_links` (`information_schema.columns`).
5. `storage.buckets` (public flag) + `storage.objects` policies.
6. (sessions précédentes, baseline) schéma `tracks`, def `update_track`, `is_email_whitelisted`, invitations/whitelist.

### Commandes terminal (read-only)
- `git status/log/pull` (setup), `grep` : writes DB directs, `localStorage`, `as any`, `getPublicUrl`+bucket, `dangerouslySetInnerHTML`, line counts.

### Screenshots
- Aucun (Axes browser non couverts — Chrome déconnecté).

### Méthode
- 2 sous-agents read-only (Axe 6 code, Axe 8 specs), Supabase MCP (SELECT only), lecture repo. Aucun write DB, aucun fix, aucun push.

---
## ⏭️ Pour reprendre l'audit (session suivante)
1. Reconnecter l'extension Chrome (cause du blocage des axes browser).
2. Login manuel + switch « Banx & Ranx Test ».
3. Dérouler Axes 1, 2, 5, 7 (UI/UX, flows, perf, console) — tout le backend (3/4/6/8) est déjà fait ici.
4. Compléter Axe 3.4 : audit exhaustif des RPCs SECURITY DEFINER sans vérif membership.
