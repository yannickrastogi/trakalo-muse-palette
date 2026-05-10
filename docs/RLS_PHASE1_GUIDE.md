# RLS Phase 1 — Guide d'exécution

> **Date** : 2026-05-10
> **Script** : `supabase/migrations/rls_phase1_drift_fix.sql`
> **Audit source** : `docs/RLS_AUDIT_2026-05-10.md`
> **Objectif** : éliminer le drift entre les RLS policies (`user_roles` legacy) et le frontend (`workspace_members.access_level`) sur 11 tables, plus le hardening P0 de `track_documents` et `notifications`.

---

## TL;DR

1. Lis ce guide **complètement** avant de toucher au SQL Editor.
2. Exécute le helper (`S0`) → teste-le → puis chaque section S1 → S13 dans l'ordre.
3. Après chaque section, lance les vérifications SQL de la fin de section.
4. Une fois tout exécuté, fais le **plan de tests frontend** (section "Tests applicatifs" plus bas).
5. Si quelque chose casse, copie-colle le bloc rollback de la section concernée.

Aucune modification de code applicatif n'est requise.

---

## Pré-requis avant exécution

### 1. Snapshot de l'état actuel (à conserver pour comparaison + rollback)

Dans le SQL Editor Supabase, exécute :

```sql
-- Snapshot des policies actuelles
CREATE TEMP TABLE _phase1_pre_snapshot AS
SELECT schemaname, tablename, policyname, cmd, qual, with_check, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT count(*) AS policies_before FROM _phase1_pre_snapshot;
-- Note ce nombre.

-- Export en CSV via le bouton "Download as CSV" de l'UI Supabase pour archive.
SELECT * FROM _phase1_pre_snapshot;
```

### 2. Vérifier la structure de la table `notifications`

Le repo n'a pas le `CREATE TABLE notifications` versionné — la S12 fait des `INSERT` qui supposent les colonnes `(id, user_id, workspace_id, kind, payload, created_at)`. Vérifie la vraie structure :

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;
```

Si la table a des colonnes supplémentaires obligatoires (NOT NULL sans default), **ajuste l'INSERT de la RPC `create_notification`** dans le SQL avant exécution.

### 3. Identifier un user de test + un workspace de test

Tu auras besoin de ces UID pour tester le helper. Idéalement, un user qui n'est PAS owner du workspace, et qui a `access_level = 'editor'` (pour tester la hiérarchie).

```sql
-- Trouver un test member non-owner
SELECT wm.user_id, wm.workspace_id, wm.access_level, w.owner_id
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id != w.owner_id
LIMIT 5;
```

---

## Ordre d'exécution recommandé

| Section | Table | Risque si on saute | Tester avec |
|---|---|---|---|
| **S0** | helper | Bloque tout le reste | SQL helper test (ci-dessous) |
| **S1** | workspaces | UPDATE workspace KO pour tout le monde | Settings → renommer workspace |
| **S2** | workspace_members | Inviter/retirer membre KO | Team page → inviter |
| **S3** | tracks | Upload/edit track KO | Upload modal |
| **S4** | stems | Stems upload KO | Stems tab |
| **S5** | contacts | Carnet de contacts KO | Contacts page |
| **S6** | pitches | Envoi de pitch KO | Pitch composer |
| **S7** | playlists | Création playlist KO | Playlists page |
| **S8** | playlist_tracks | Reorder/add tracks KO | Playlist detail |
| **S9** | shared_links | Création de lien partagé KO | Share modal |
| **S10** | approvals | Demande d'approbation KO | Approval flow |
| **S11** | track_documents | Upload document KO | Documents tab |
| **S12** | notifications | Création de notif KO | (rien côté UI directement) |
| **S13** | user_roles | (notice only) | — |

**Règle d'or :** ne saute jamais la S0. Tout le reste en dépend.

**Tu peux exécuter tout le fichier d'un coup**, mais une exécution section par section te donne un point de rollback granulaire en cas de souci.

---

## Tests SQL après chaque section

### Test du helper (après S0)

```sql
-- 1. Doit renvoyer TRUE (owner = admin de facto)
SELECT public.has_workspace_access_level(
  '<owner-uid>'::uuid,
  '<workspace-uid>'::uuid,
  'admin'
);

-- 2. Doit renvoyer TRUE (owner ≥ viewer)
SELECT public.has_workspace_access_level(
  '<owner-uid>'::uuid,
  '<workspace-uid>'::uuid,
  'viewer'
);

-- 3. Doit renvoyer TRUE (editor ≥ pitcher)
SELECT public.has_workspace_access_level(
  '<editor-member-uid>'::uuid,
  '<workspace-uid>'::uuid,
  'pitcher'
);

-- 4. Doit renvoyer FALSE (editor < admin)
SELECT public.has_workspace_access_level(
  '<editor-member-uid>'::uuid,
  '<workspace-uid>'::uuid,
  'admin'
);

-- 5. Doit renvoyer FALSE (user non-member)
SELECT public.has_workspace_access_level(
  '<random-uid>'::uuid,
  '<workspace-uid>'::uuid,
  'viewer'
);
```

Si l'un de ces tests ne renvoie pas le résultat attendu, **NE PAS continuer** avec les autres sections — investiguer.

### Test après chaque table (S1 → S11)

Liste les policies actives sur la table, vérifie que les nouvelles existent et que les anciennes sont supprimées :

```sql
-- Pour S3 (tracks) par exemple
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tracks'
ORDER BY cmd, policyname;
```

Tu dois voir :
- `Members can view tracks` (SELECT, inchangé)
- `anon_read_tracks_via_shared_link` (SELECT anon, inchangé)
- `tracks_insert_pitcher` (INSERT, **nouveau**)
- `tracks_update_editor_all` (UPDATE, **nouveau**)
- `tracks_update_pitcher_own` (UPDATE, **nouveau**)
- `tracks_delete_admin` (DELETE, **nouveau**)

Et NE PAS voir :
- `Creators can upload tracks` (anciennement INSERT)
- `Write roles can edit all tracks` (anciennement UPDATE)
- `Creators can edit own tracks` (anciennement UPDATE)
- `Admins can delete tracks` (anciennement DELETE)

### Vérification finale (après tout)

```sql
-- (a) Aucune policy ne doit plus utiliser has_workspace_role
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ILIKE '%has_workspace_role%'
       OR qual ILIKE '%has_any_workspace_role%'
       OR with_check ILIKE '%has_workspace_role%'
       OR with_check ILIKE '%has_any_workspace_role%');
-- Attendu : 0 ligne.

-- (b) Le helper existe et est SECURITY DEFINER
SELECT proname, prosecdef
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('has_workspace_access_level', 'create_notification');
-- Attendu : 2 lignes, prosecdef = true pour les deux.

-- (c) Compter les policies au total (pour comparaison avec snapshot pré)
SELECT count(*) AS policies_after FROM pg_policies WHERE schemaname = 'public';
-- Le delta doit être ≈ 0 (on en a supprimé ~25 et créé ~34, soit +9
-- net car on a rajouté tracks_update_pitcher_own, shared_links_delete_pitcher_own,
-- track_documents_select_members, et autres).
```

---

## Tests applicatifs frontend (à effectuer après application complète)

### Préparation

1. Identifie 4 comptes de test (peut être le même user dans 4 workspaces différents) avec `access_level` :
   - `admin` (idéal : owner)
   - `editor`
   - `pitcher`
   - `viewer`

2. Connecte-toi successivement avec chacun et exécute les tests ci-dessous.

### Test Admin

- [ ] Dashboard : voir tous les tracks ✅
- [ ] Settings → renommer workspace ✅
- [ ] Settings → branding ✅
- [ ] Team → inviter un nouveau membre ✅
- [ ] Team → changer le `access_level` d'un membre ✅
- [ ] Upload track ✅
- [ ] Edit track de quelqu'un d'autre ✅
- [ ] Delete track ✅
- [ ] Upload stem ✅
- [ ] Upload track_document ✅
- [ ] Approuver une demande d'approbation ✅
- [ ] Delete shared link ✅

### Test Editor

- [ ] Dashboard : voir tous les tracks ✅
- [ ] Upload track ✅
- [ ] Edit track de quelqu'un d'autre ✅ (différence vs Pitcher)
- [ ] Delete track ❌ (refus attendu)
- [ ] Upload stem ✅
- [ ] Upload/replace track_document ✅
- [ ] Settings ❌ (refus attendu côté UI)
- [ ] Inviter membre ❌ (refus attendu côté UI)

### Test Pitcher

- [ ] Dashboard : voir tous les tracks ✅
- [ ] Upload track (uploaded_by = self) ✅
- [ ] Edit son own track ✅
- [ ] Edit track d'un autre ❌ (refus attendu — `tracks_update_pitcher_own` exige `uploaded_by = auth.uid()`)
- [ ] Créer playlist ✅
- [ ] Add tracks à playlist ✅
- [ ] Reorder playlist (replace_playlist_tracks RPC) ✅ — **point sensible** : si la RPC n'est pas SECURITY DEFINER en prod, le DELETE échouera (cf. note S8)
- [ ] Créer pitch ✅
- [ ] Créer shared link ✅
- [ ] Delete son own shared link ✅ (policy `shared_links_delete_pitcher_own`)
- [ ] Delete shared link d'un autre ❌ (refus attendu)
- [ ] Upload track_document ❌ (refus attendu — Pitcher pas Editor)
- [ ] Add/edit contact ✅
- [ ] Delete contact ❌ (refus attendu)

### Test Viewer

- [ ] Dashboard : voir tous les tracks ✅
- [ ] Play track ✅
- [ ] Tout INSERT/UPDATE/DELETE ❌ (refus attendu partout)
- [ ] Upload track ❌
- [ ] Créer playlist ❌
- [ ] Créer shared link ❌
- [ ] Add contact ❌
- [ ] Upload document ❌

### Tests pages publiques (vérifier qu'on n'a rien cassé)

- [ ] Ouvrir un shared link en navigation privée → tracks/playlist visibles ✅
- [ ] Laisser un commentaire timecodé → écrit en base ✅ (utilise RPC `add_track_comment`)
- [ ] Sign agreement (token) → signature enregistrée ✅
- [ ] Studio QR → soumettre un track ✅
- [ ] SharedStemAccess → écouter stems ✅

### Cas spéciaux à tester

- [ ] **Promotion d'un Pitcher en Editor** (admin change le `access_level`) → l'editor doit immédiatement pouvoir éditer les tracks des autres.
- [ ] **Rétrogradation Editor → Viewer** → l'éditeur ne peut plus rien faire à part lire/écouter (mais les contributions passées restent).
- [ ] **Owner du workspace** : doit toujours pouvoir tout faire, même sans entrée explicite dans `workspace_members` (cas couvert par le helper).
- [ ] **Mosimann scenario** : créer un workspace en tant qu'owner, inviter Karim avec `access_level = 'editor'` + `professional_title = 'Mix Engineer'`, Karim upload un nouveau mix → succès (alors qu'avec l'ancienne policy il aurait été bloqué).

---

## Plan de rollback

Si quelque chose casse en prod, exécute le bloc correspondant à la section qui pose problème. Le rollback restaure les policies legacy **dans leur état avant Phase 1**.

> **Note :** rollback partiel (une section seulement) → les autres sections restent migrées, ce qui est OK car elles sont indépendantes.

### Rollback complet — à exécuter dans l'ordre inverse (S13 → S0)

```sql
-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK PHASE 1
-- ═══════════════════════════════════════════════════════════════════════

-- ──────── ROLLBACK S12 — notifications + RPC ────────
DROP FUNCTION IF EXISTS public.create_notification(uuid, uuid, uuid, text, jsonb);

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- ──────── ROLLBACK S11 — track_documents ────────
DROP POLICY IF EXISTS "track_documents_select_members" ON public.track_documents;
DROP POLICY IF EXISTS "track_documents_insert_editor" ON public.track_documents;
DROP POLICY IF EXISTS "track_documents_update_editor" ON public.track_documents;
DROP POLICY IF EXISTS "track_documents_delete_uploader_or_admin" ON public.track_documents;

CREATE POLICY "Workspace members can view documents"
  ON public.track_documents FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Workspace members can insert documents"
  ON public.track_documents FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Workspace members can update documents"
  ON public.track_documents FOR UPDATE
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Uploader or admin can delete documents"
  ON public.track_documents FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR public.has_workspace_role(auth.uid(), workspace_id, 'admin')
  );

-- ──────── ROLLBACK S10 — approvals ────────
DROP POLICY IF EXISTS "approvals_insert_member" ON public.approvals;
DROP POLICY IF EXISTS "approvals_update_admin" ON public.approvals;
DROP POLICY IF EXISTS "approvals_delete_admin" ON public.approvals;

CREATE POLICY "Members can request approvals"
  ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND requested_by = auth.uid()
  );
CREATE POLICY "Admins can update approvals"
  ON public.approvals FOR UPDATE TO authenticated
  USING (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager']::app_role[])
  );
CREATE POLICY "Admins can delete approvals"
  ON public.approvals FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ──────── ROLLBACK S9 — shared_links ────────
DROP POLICY IF EXISTS "shared_links_insert_pitcher" ON public.shared_links;
DROP POLICY IF EXISTS "shared_links_update_pitcher" ON public.shared_links;
DROP POLICY IF EXISTS "shared_links_delete_admin" ON public.shared_links;
DROP POLICY IF EXISTS "shared_links_delete_pitcher_own" ON public.shared_links;

CREATE POLICY "Write roles can create shared links"
  ON public.shared_links FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
    AND created_by = auth.uid()
  );
CREATE POLICY "Write roles can update shared links"
  ON public.shared_links FOR UPDATE TO authenticated
  USING (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );
CREATE POLICY "Admins can delete shared links"
  ON public.shared_links FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
CREATE POLICY "Creators can delete own shared links"
  ON public.shared_links FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    AND public.is_workspace_member(auth.uid(), workspace_id)
  );

-- ──────── ROLLBACK S8 — playlist_tracks ────────
DROP POLICY IF EXISTS "playlist_tracks_insert_pitcher" ON public.playlist_tracks;
DROP POLICY IF EXISTS "playlist_tracks_update_pitcher" ON public.playlist_tracks;
DROP POLICY IF EXISTS "playlist_tracks_delete_admin" ON public.playlist_tracks;

CREATE POLICY "Write roles can add playlist tracks"
  ON public.playlist_tracks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id
        AND public.has_any_workspace_role(auth.uid(), p.workspace_id,
          array['admin','manager','a_r','assistant','publisher']::app_role[]))
  );
CREATE POLICY "Write roles can update playlist tracks"
  ON public.playlist_tracks FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id
        AND public.has_any_workspace_role(auth.uid(), p.workspace_id,
          array['admin','manager','a_r','assistant','publisher']::app_role[]))
  );
CREATE POLICY "Admins can delete playlist tracks"
  ON public.playlist_tracks FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id
        AND public.has_workspace_role(auth.uid(), p.workspace_id, 'admin'))
  );

-- ──────── ROLLBACK S7 — playlists ────────
DROP POLICY IF EXISTS "playlists_insert_pitcher" ON public.playlists;
DROP POLICY IF EXISTS "playlists_update_pitcher" ON public.playlists;
DROP POLICY IF EXISTS "playlists_delete_admin" ON public.playlists;

CREATE POLICY "Write roles can create playlists"
  ON public.playlists FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
    AND created_by = auth.uid()
  );
CREATE POLICY "Write roles can edit playlists"
  ON public.playlists FOR UPDATE TO authenticated
  USING (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );
CREATE POLICY "Admins can delete playlists"
  ON public.playlists FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ──────── ROLLBACK S6 — pitches ────────
DROP POLICY IF EXISTS "pitches_insert_pitcher" ON public.pitches;
DROP POLICY IF EXISTS "pitches_update_pitcher" ON public.pitches;
DROP POLICY IF EXISTS "pitches_delete_admin" ON public.pitches;

CREATE POLICY "Write roles can create pitches"
  ON public.pitches FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
    AND sent_by = auth.uid()
  );
CREATE POLICY "Write roles can update pitches"
  ON public.pitches FOR UPDATE TO authenticated
  USING (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );
CREATE POLICY "Admins can delete pitches"
  ON public.pitches FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ──────── ROLLBACK S5 — contacts ────────
DROP POLICY IF EXISTS "contacts_insert_pitcher" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_pitcher" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_admin" ON public.contacts;

CREATE POLICY "Write roles can create contacts"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );
CREATE POLICY "Write roles can edit contacts"
  ON public.contacts FOR UPDATE TO authenticated
  USING (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );
CREATE POLICY "Admins can delete contacts"
  ON public.contacts FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ──────── ROLLBACK S4 — stems ────────
DROP POLICY IF EXISTS "stems_insert_pitcher" ON public.stems;
DROP POLICY IF EXISTS "stems_update_editor" ON public.stems;
DROP POLICY IF EXISTS "stems_delete_editor" ON public.stems;

CREATE POLICY "Creators can upload stems"
  ON public.stems FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','producer','songwriter',
            'musician','mix_engineer','mastering_engineer','publisher']::app_role[])
    AND uploaded_by = auth.uid()
  );
CREATE POLICY "Write roles can edit stems"
  ON public.stems FOR UPDATE TO authenticated
  USING (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );
CREATE POLICY "Creators can edit own stems"
  ON public.stems FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins can delete stems"
  ON public.stems FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ──────── ROLLBACK S3 — tracks ────────
DROP POLICY IF EXISTS "tracks_insert_pitcher" ON public.tracks;
DROP POLICY IF EXISTS "tracks_update_editor_all" ON public.tracks;
DROP POLICY IF EXISTS "tracks_update_pitcher_own" ON public.tracks;
DROP POLICY IF EXISTS "tracks_delete_admin" ON public.tracks;

CREATE POLICY "Creators can upload tracks"
  ON public.tracks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','producer','songwriter',
            'musician','mix_engineer','mastering_engineer','publisher']::app_role[])
    AND uploaded_by = auth.uid()
  );
CREATE POLICY "Write roles can edit all tracks"
  ON public.tracks FOR UPDATE TO authenticated
  USING (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );
CREATE POLICY "Creators can edit own tracks"
  ON public.tracks FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins can delete tracks"
  ON public.tracks FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ──────── ROLLBACK S2 — workspace_members ────────
DROP POLICY IF EXISTS "workspace_members_insert_admin" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_admin" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_admin" ON public.workspace_members;

CREATE POLICY "Admins can invite members"
  ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
CREATE POLICY "Admins can update members"
  ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
CREATE POLICY "Admins can remove members"
  ON public.workspace_members FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ──────── ROLLBACK S1 — workspaces ────────
DROP POLICY IF EXISTS "workspaces_update_admin" ON public.workspaces;

CREATE POLICY "Admins can update workspace"
  ON public.workspaces FOR UPDATE TO authenticated
  USING (public.has_workspace_role(auth.uid(), id, 'admin'))
  WITH CHECK (public.has_workspace_role(auth.uid(), id, 'admin'));

-- ──────── ROLLBACK S0 — helper ────────
-- Le helper has_workspace_access_level peut rester en place sans risque
-- (il n'est plus appelé par aucune policy après rollback).
-- Si tu veux vraiment le supprimer :
--   DROP FUNCTION IF EXISTS public.has_workspace_access_level(uuid, uuid, text);
--   DROP INDEX IF EXISTS idx_workspace_members_user_ws_level;

-- Vérifier le rollback :
SELECT count(*) AS total_policies FROM pg_policies WHERE schemaname = 'public';
-- Doit être très proche du nombre noté au début (policies_before).
```

---

## Si la migration introduit un bug en prod

1. **Si l'erreur est "permission denied" sur une table spécifique** → exécute uniquement le bloc rollback de cette section.
2. **Si l'erreur est plus large** (plusieurs tables affectées) → exécute le rollback complet.
3. **Si le helper a un bug** → corrige-le avec `CREATE OR REPLACE FUNCTION` (les nouvelles policies l'utiliseront automatiquement).
4. **Toujours après rollback** : refais le snapshot et compare avec `_phase1_pre_snapshot` pour vérifier que tout est revenu à l'identique.

---

## Liste des INSERT directs frontend sur `notifications`

Audit confirmé via grep `\.from\(['"](notifications)['"]\)\.insert` sur `src/` : **0 occurrence**. La migration S12 (drop "System can create notifications") n'a donc **aucun impact UI**.

Si dans le futur du code applicatif crée des notifications, il devra appeler la RPC :

```typescript
const { data: notifId, error } = await supabase.rpc('create_notification', {
  _actor_user_id: user.id,
  _target_user_id: targetUserId,
  _workspace_id: activeWorkspace.id,
  _kind: 'comment_added',
  _payload: { track_id: trackId, comment_id: commentId },
});
```

---

## Hors périmètre Phase 1 (à traiter en Phase 2 ou 3)

- **Storage policies bucket `documents`** : cross-workspace leak — voir `rls_audit_fixes.sql` section 7.
- **41 RPCs documentées non versionnées** : à dump depuis Supabase puis auditer une par une (template : `update_workspace_member.sql`, `insert_track`, `update_track`).
- **Tables non versionnées** : `catalog_shares`, `invitations`, `audit_logs`, `link_events`, `signature_requests`, `studio_submissions`, `profiles`, `notification_preferences` — à versionner.
- **Triggers `handle_new_user` et `create_workspace_with_member`** : insèrent encore dans `user_roles` — à migrer en Phase 2.
- **TeamContext.tsx:104-115** : SELECT direct sur `user_roles` (lecture seule, display only) — à supprimer en Phase 2 quand le UI affichera `professional_title` à la place.
- **DROP TABLE `user_roles`** + `DROP FUNCTION has_workspace_role` + `DROP TYPE app_role` : Phase 2 final, après ~2 semaines de stabilité.

---

## Suivi

Coche au fur et à mesure de l'exécution :

- [ ] Snapshot pré-migration sauvegardé
- [ ] Structure `notifications` vérifiée (et S12 ajustée si besoin)
- [ ] S0 helper exécuté + 5 tests SQL OK
- [ ] S1 → S13 exécutées
- [ ] Vérifications finales (a)(b)(c) OK
- [ ] Tests applicatifs Admin OK
- [ ] Tests applicatifs Editor OK
- [ ] Tests applicatifs Pitcher OK (incl. reorder playlist)
- [ ] Tests applicatifs Viewer OK
- [ ] Tests pages publiques OK
- [ ] Mosimann scenario validé
- [ ] Aucun bug remonté pendant 24h → migration considérée stable
