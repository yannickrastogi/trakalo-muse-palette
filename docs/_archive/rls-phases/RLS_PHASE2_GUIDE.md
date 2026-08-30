# RLS Phase 2 — Guide d'exécution (RPC access_level checks)

> **Date** : 2026-05-10
> **Script** : `supabase/migrations/rls_phase2_rpc_access_level.sql`
> **Pré-requis** : Phase 1 exécutée (helper `has_workspace_access_level` existe)
> **Objectif** : ajouter une vérification `access_level` au début de chaque RPC SECURITY DEFINER critique, conformément à la matrice de permissions (cf. `RoleContext.tsx:56-133`).

---

## TL;DR

1. Lis ce guide **complètement** avant d'exécuter.
2. **Étape obligatoire** : dump les signatures prod des ~26 RPCs non versionnées (cf. requête plus bas).
3. Pour chaque RPC dont la signature prod ne match pas le script, **adapte le script** avant exécution.
4. Exécute le script section par section. Chaque section est idempotente.
5. Lance les tests applicatifs par rôle.

Aucune modification de code applicatif requise.

---

## Stratégie utilisée

Le script combine deux approches :

### Approche A — CREATE OR REPLACE complet (3 RPCs versionnées)

Pour `insert_track`, `update_track`, `upsert_contact`, le body est dans le repo. Le script écrit la fonction complète : check `access_level` au début + body original verbatim.

### Approche B — Rename + Wrap (~26 RPCs non versionnées)

Pour les RPCs qui n'existent qu'en prod, on ne peut pas réécrire le body sans risque. Le script utilise donc :

1. **Rename** la fonction prod en `<name>_legacy_v0` (idempotent : si déjà fait, skip).
2. **Create** un wrapper avec la même signature qui :
   - Vérifie le `access_level` via `require_workspace_access_level`
   - Délègue à `<name>_legacy_v0` avec les mêmes paramètres
   - Retourne ce que le legacy retourne

**Avantage** : 100% du body prod préservé. Aucun risque de régression métier.
**Inconvénient** : si la signature prod ne match pas exactement le script, `ALTER FUNCTION ... RENAME` échoue avec une erreur claire (`function does not exist`). C'est un fail-safe — le script abort sans rien casser.

### Cas spécial : team RPCs

Pour `update_member_role` et `remove_workspace_member`, le user a explicitement demandé de **supprimer la sync legacy `user_roles`** qui crash sur les nouvelles valeurs `editor`/`pitcher`. Le wrapper court-circuite donc le legacy et fait l'UPDATE/DELETE direct sur `workspace_members`. Voir S11 du SQL.

---

## Étape 1 — Dump les signatures prod (OBLIGATOIRE)

Dans le SQL Editor Supabase :

```sql
SELECT
  proname,
  pg_get_function_arguments(oid) AS args,
  pg_get_function_result(oid) AS returns,
  prosecdef AS is_security_definer
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'delete_track', 'save_track_to_trakalog', 'remove_track_from_trakalog',
    'insert_stem', 'delete_stem', 'update_stem_type',
    'insert_track_document', 'delete_track_document', 'update_track_document_status',
    'create_playlist', 'update_playlist', 'delete_playlist',
    'add_playlist_tracks', 'replace_playlist_tracks',
    'create_pitch', 'add_contact_manual',
    'create_shared_link', 'update_shared_link_status',
    'insert_catalog_share', 'revoke_catalog_share',
    'add_track_comment', 'insert_approval', 'update_approval_status',
    'remove_workspace_member', 'update_member_role',
    'update_studio_submission_status',
    'update_workspace_name', 'update_workspace_slug', 'update_workspace_settings'
  )
ORDER BY proname;
```

**Compare ligne par ligne avec le script.** Pour chaque RPC, vérifie :
- Le nom des paramètres (peut différer — Postgres autorise CREATE OR REPLACE avec noms différents si types matchent)
- Les **types** des paramètres (DOIT matcher exactement)
- L'**ordre** des paramètres (DOIT matcher exactement)
- Les **defaults** (optionnels mais préférables à matcher)
- Le **return type** (DOIT matcher)

Si ça ne match pas → adapte le `ALTER FUNCTION ... RENAME` du DO block correspondant dans le script avec la vraie signature.

### Risque le plus probable

Les RPCs avec beaucoup de paramètres (`create_pitch` 11, `create_shared_link` 15) sont les plus susceptibles d'avoir une signature prod légèrement différente (un param ajouté/renommé après la doc). À vérifier en priorité.

### Si une RPC n'existe PAS du tout en prod

Le `ALTER FUNCTION` échouera avec `undefined_function`. Le script attrape ça avec `EXCEPTION WHEN undefined_function THEN RAISE NOTICE` — l'exécution continue. Mais le wrapper créé après essaiera d'appeler une fonction `_legacy_v0` qui n'existe pas. Pour ces cas-là (RPC documentée mais non implémentée en prod), commente le bloc entier de la RPC dans le script.

---

## Étape 2 — Snapshot pré-migration

```sql
CREATE TEMP TABLE _phase2_pre_snapshot AS
SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND prosecdef = true
ORDER BY proname;

SELECT count(*) AS rpcs_before FROM _phase2_pre_snapshot;
```

Note ce nombre. Après exécution, tu dois avoir :
- **Mêmes RPCs publiques** (les wrappers remplacent la version prod)
- **+1** pour le helper `require_workspace_access_level`
- **+~26** versions `_legacy_v0` (les fonctions renommées)

---

## Étape 3 — Exécution

Le script est divisé en 13 sections (S0 à S13). Tu peux :

- **Tout exécuter d'un coup** dans le SQL Editor (recommandé si dump pré-flight clean).
- **Section par section** pour rollback granulaire.

Ordre logique :

| Section | Périmètre | Permission | Risque feature |
|---|---|---|---|
| S0 | helper require_workspace_access_level | — | Aucun |
| S1 | tracks (4 RPCs) | pitcher / editor / admin | Upload, edit, delete, save-to-trakalog |
| S2 | stems (3) | pitcher / editor / own | Stems upload/delete/relabel |
| S3 | documents (3) | editor / admin / own | Doc upload, status, delete |
| S4 | playlists (5) | pitcher / admin / own | Playlist CRUD |
| S5 | pitches (1) | pitcher | Pitch send |
| S6 | contacts (2) | pitcher | Contact CRUD |
| S7 | shared_links (2) | pitcher / own / admin | Link create + disable |
| S8 | catalog shares (2) | admin (source) | Cross-workspace share |
| S9 | comments (1) | member | Track comments authenticated |
| S10 | approvals (2) | member / admin | Approval flow |
| S11 | team (2) | admin + supprime sync user_roles | Member role / remove |
| S12 | studio (1) | admin | Studio submission status |
| S13 | workspace metadata (3) | admin | Rename / settings / slug |

---

## Tests par rôle (à exécuter après migration)

### Test 1 — Owner / Admin

L'owner du workspace doit pouvoir tout faire (le helper traite owner = admin de facto).

- [ ] Upload track ✅
- [ ] Edit any track ✅
- [ ] Delete track ✅
- [ ] Upload stem ✅
- [ ] Delete stem ✅
- [ ] Upload track_document ✅
- [ ] Update document status (signature) ✅
- [ ] Delete document ✅
- [ ] Create / edit / delete playlist ✅
- [ ] Send pitch ✅
- [ ] Add / edit contact ✅
- [ ] Create / disable shared link ✅
- [ ] Insert catalog share ✅
- [ ] Revoke catalog share ✅
- [ ] Approve / reject approval ✅
- [ ] Remove team member ✅
- [ ] Change member access_level ✅
- [ ] Accept / reject studio submission ✅
- [ ] Rename workspace ✅
- [ ] Change workspace slug ✅
- [ ] Update workspace settings ✅

### Test 2 — Editor (member, access_level = 'editor')

- [ ] Upload track ✅
- [ ] Edit any track ✅ (différence vs Pitcher)
- [ ] Delete track ❌ → erreur "Insufficient access level: admin required, you have editor"
- [ ] Upload stem ✅
- [ ] Update stem type ✅
- [ ] Delete stem (any) ✅
- [ ] Upload doc ✅
- [ ] Update doc status ❌ (admin required)
- [ ] Delete doc d'autrui ❌ (admin or own)
- [ ] Delete son own doc ✅
- [ ] Create playlist ✅
- [ ] Delete playlist d'autrui ❌
- [ ] Delete son own playlist ✅
- [ ] Add contact ✅
- [ ] Send pitch ✅
- [ ] Insert catalog share ❌ (admin source)
- [ ] Update workspace name ❌
- [ ] Change member access_level ❌

### Test 3 — Pitcher

- [ ] Upload track ✅ (uploaded_by = self)
- [ ] Edit son own track ✅
- [ ] Edit track d'autrui ❌ → erreur "editor required, you have pitcher"
- [ ] Upload stem ✅
- [ ] Update stem type ❌ (editor required)
- [ ] Delete son own stem ✅
- [ ] Delete stem d'autrui ❌
- [ ] Upload doc ❌ (editor required)
- [ ] Create playlist ✅
- [ ] Add tracks à playlist ✅
- [ ] Reorder playlist (replace_playlist_tracks) ✅
- [ ] Add contact ✅
- [ ] Send pitch ✅
- [ ] Create shared link ✅
- [ ] Disable son own shared link ✅
- [ ] Disable shared link d'autrui ❌ (created_by mismatch)
- [ ] Insert catalog share ❌
- [ ] Update doc status ❌

### Test 4 — Viewer

- [ ] Tous les writes → ❌ partout
- [ ] Upload track ❌
- [ ] Create playlist ❌
- [ ] Send pitch ❌
- [ ] Add contact ❌
- [ ] Create shared link ❌

### Test 5 — Anon (via shared link)

- [ ] Add track comment via shared link ✅ (path anon, RLS gère)
- [ ] Save track to trakalog → erreur "Not a member of target workspace" si user pas membre

### Test 6 — Cas spécial team (sync user_roles)

Avant Phase 2, un admin qui essayait de promouvoir Karim en `editor` via `update_member_role` faisait crasher la prod (sync `user_roles` plantait sur `editor` inconnu de l'enum `app_role`). Test :

- [ ] Avec un admin, change `access_level` d'un membre vers `editor` → succès ✅
- [ ] Vérifie dans `workspace_members` que la valeur est bien `editor`
- [ ] Vérifie dans `user_roles` qu'aucune nouvelle ligne `editor` n'a été tentée (devrait être inchangée par rapport à avant)

---

## Risques de régression connus

### 1. Signature prod différente du script

**Symptôme :** `ALTER FUNCTION ... RENAME` échoue silencieusement (`RAISE NOTICE` mais pas d'erreur), puis le wrapper créé essaie d'appeler `<name>_legacy_v0` qui n'existe pas. Première invocation de la RPC depuis le frontend → "function public.<name>_legacy_v0(...) does not exist".

**Détection :** check post-exécution :

```sql
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('insert_stem_legacy_v0', 'create_pitch_legacy_v0', /* etc. */);
```

Si une RPC manque dans la liste mais existe sans `_legacy_v0` → le rename a échoué silencieusement.

**Fix :** dump la vraie signature prod, adapte le `ALTER FUNCTION` du script, réexécute la section.

### 2. Body prod plus riche que documenté

**Symptôme :** une feature secondaire dépend d'un effet de bord du legacy (ex: création d'audit_log, cache invalidation). Le wrapper appelle bien le legacy via `_legacy_v0`, donc l'effet de bord est préservé. **Pas de risque** avec l'approche wrap.

**Sauf pour `update_member_role` et `remove_workspace_member`** où on COURT-CIRCUITE intentionnellement le legacy (sync `user_roles`). Si la prod legacy faisait aussi un `audit_log` de la modification, l'audit est perdu. Voir Phase 3 pour ré-implémentation propre.

### 3. RPC documentée mais inexistante en prod

**Symptôme :** `ALTER FUNCTION ... RENAME` lève `undefined_function`. Le `EXCEPTION WHEN undefined_function THEN RAISE NOTICE` du script intercepte et continue. Le wrapper est créé mais appelle `_legacy_v0` inexistant.

**Fix :** identifier ces RPCs (via le check post-exécution ci-dessus) et **commenter complètement** leur bloc dans le script (le frontend ne les appelle probablement pas en prod si elles n'existent pas).

### 4. RPC avec auth.uid() dans le body legacy

Si la RPC legacy utilise `auth.uid()` au lieu de `_user_id`, le wrap ne change rien (auth.uid() reste dispo). Aucun risque.

### 5. Frontend qui passe `null` à `_user_id` (bug)

Le helper `require_workspace_access_level` raise immédiatement "Not a member of workspace null" — le crash est plus visible mais pas plus dangereux qu'avant.

---

## Plan de rollback

### Rollback global

Pour annuler complètement la Phase 2 (revenir aux RPCs prod originales) :

```sql
-- ════════════════════════════════════════════════════════════════════
-- ROLLBACK PHASE 2 — restaure les RPCs prod en supprimant les wrappers
-- et en renommant <name>_legacy_v0 → <name>
-- ════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r record;
  legacy_name text;
  current_name text;
BEGIN
  FOR r IN
    SELECT proname, oid
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname LIKE '%_legacy_v0'
  LOOP
    legacy_name := r.proname;
    current_name := substring(legacy_name from 1 for length(legacy_name) - length('_legacy_v0'));

    -- Drop le wrapper actuel (nom sans _legacy_v0)
    EXECUTE format(
      'DROP FUNCTION IF EXISTS public.%I(%s) CASCADE',
      current_name,
      pg_get_function_identity_arguments(r.oid)
    );

    -- Rename _legacy_v0 → original
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) RENAME TO %I',
      legacy_name,
      pg_get_function_identity_arguments(r.oid),
      current_name
    );
  END LOOP;
END $$;

-- Pour les RPCs versionnées repo (insert_track, update_track, upsert_contact),
-- il faut réexécuter leur version pre-Phase 2 manuellement. Voir le repo :
--   supabase/migrations/20260430_genre_text_array.sql (insert_track, update_track)
--   supabase/migrations/20260429_upsert_contact_dedupe.sql (upsert_contact)

-- Helper require_workspace_access_level peut rester en place sans risque
-- (plus appelé après rollback). Pour le supprimer :
--   DROP FUNCTION IF EXISTS public.require_workspace_access_level(uuid, uuid, text);
```

### Rollback granulaire (une seule RPC)

Pour annuler la Phase 2 uniquement sur `delete_track` (par exemple) :

```sql
DROP FUNCTION public.delete_track(uuid, uuid);
ALTER FUNCTION public.delete_track_legacy_v0(uuid, uuid) RENAME TO delete_track;
```

---

## Liste des RPCs traitées (synthèse)

| RPC | Permission appliquée | Stratégie | Risque |
|---|---|---|---|
| insert_track | pitcher+ | CREATE OR REPLACE (repo) | Bas |
| update_track | editor+ OR (pitcher+ AND own) | CREATE OR REPLACE (repo) | Bas |
| delete_track | admin | wrap | Bas |
| save_track_to_trakalog | target ws member | wrap | Moyen (sémantique target) |
| remove_track_from_trakalog | pitcher+ on target | wrap | Moyen |
| insert_stem | pitcher+ | wrap | Bas |
| delete_stem | editor+ OR own | wrap | Bas |
| update_stem_type | editor+ | wrap | Bas |
| insert_track_document | editor+ | wrap | Bas |
| update_track_document_status | admin | wrap | Bas |
| delete_track_document | admin OR own | wrap | Bas |
| create_playlist | pitcher+ | wrap | Bas |
| update_playlist | pitcher+ | wrap | Bas |
| delete_playlist | admin OR own | wrap | Bas |
| add_playlist_tracks | pitcher+ | wrap | Bas |
| replace_playlist_tracks | pitcher+ | wrap | Bas |
| create_pitch | pitcher+ | wrap | Moyen (15 params) |
| upsert_contact | pitcher+ | CREATE OR REPLACE (repo) | Bas |
| add_contact_manual | pitcher+ | wrap | Bas |
| create_shared_link | pitcher+ | wrap | Moyen (15 params) |
| update_shared_link_status | pitcher+ AND (own OR admin) | wrap | Bas |
| insert_catalog_share | admin (source) | wrap | Haut (CRITIQUE — sécurité partage) |
| revoke_catalog_share | admin (source) | wrap | Bas |
| add_track_comment | member if auth, sinon RLS anon | wrap | Bas |
| insert_approval | member | wrap | Bas |
| update_approval_status | admin | wrap | Bas |
| remove_workspace_member | admin + drop user_roles row | wrap (court-circuit legacy) | Moyen (perte audit) |
| update_member_role | admin + skip user_roles sync | wrap (court-circuit legacy) | Moyen (perte audit) |
| update_studio_submission_status | admin | wrap | Bas |
| update_workspace_name | admin | wrap | Bas |
| update_workspace_slug | admin | wrap | Bas |
| update_workspace_settings | admin | wrap | Bas |

**Non modifiées (déjà OK) :**
- `update_workspace_branding` (admin via existant)
- `delete_workspace` (owner only via owner_id check)
- `delete_track_comment` (auteur du commentaire only)
- `add_contact_manual` à doublon ⚠️ — vérifier que `add_contact_manual` et `upsert_contact` ne sont pas redondants en prod.

---

## Suivi d'exécution

- [ ] Dump pré-migration des signatures prod fait + comparé avec le script
- [ ] Adaptations éventuelles du script appliquées (signatures qui diffèrent)
- [ ] Snapshot `_phase2_pre_snapshot` créé
- [ ] S0 helper `require_workspace_access_level` créé
- [ ] S1 → S13 exécutées sans erreur
- [ ] Vérification (a)(b)(c) post-exécution OK
- [ ] Tests Owner/Admin OK
- [ ] Tests Editor OK
- [ ] Tests Pitcher OK
- [ ] Tests Viewer OK
- [ ] Test cas spécial team (promotion vers editor sans crash) OK
- [ ] 24h de monitoring sans bug remonté → migration considérée stable

---

## Hors périmètre Phase 2 (Phase 3 à venir)

- Storage policies bucket `documents` (cross-workspace leak)
- Tables non versionnées : CREATE TABLE explicite + RLS dans le repo
  (`catalog_shares`, `invitations`, `audit_logs`, `link_events`, `signature_requests`, `studio_submissions`, `profiles`, `notification_preferences`)
- Migration des triggers `handle_new_user` et `create_workspace_with_member` pour insérer dans `workspace_members.access_level` au lieu de `user_roles`
- Suppression du SELECT direct sur `user_roles` dans `TeamContext.tsx:104-115`
- DROP TABLE `user_roles` + DROP des helpers `has_workspace_role` / `has_any_workspace_role` + DROP TYPE `app_role`
- Re-implémentation propre de l'audit log pour `update_member_role` et `remove_workspace_member` (perdu lors du court-circuit legacy)
