# RLS Phase 3 — Storage scoping + anon policy hardening

> **Date** : 2026-05-10
> **Script** : `supabase/migrations/rls_phase3_storage_anon_fixes.sql`
> **Pré-requis** : Phase 1 + Phase 2 exécutées
> **Objectif** : refermer les 2 dernières vulnérabilités P0 du rapport d'audit
> 1. Storage bucket `documents` — cross-workspace leak (P0 #3)
> 2. Pages publiques avec writes anonymes (P0 #5) — `track_comments`, `signature_requests`, `studio_submissions`

---

## TL;DR

1. **Étape OBLIGATOIRE** : audit des paths storage existants (cf. dry-run plus bas) — si des objets en prod n'ont pas un UUID en premier segment, ils deviendront **inaccessibles** après S1.
2. Snapshot des policies actuelles (storage + 3 tables anon).
3. Exécute S0 → S5 dans l'ordre.
4. Tests : un user du workspace A ne peut pas accéder au bucket de B ; un anon ne peut pas spammer un track sans QR actif.
5. Si quelque chose casse : rollback section par section avec les blocs SQL fournis.

Aucun code applicatif modifié.

---

## Contexte

L'audit `docs/_archive/rls-phases/RLS_AUDIT_2026-05-10.md` listait 5 P0. Phase 1 + Phase 2 ont traité :

- ✅ P0 #1 — Drift `user_roles` → `access_level` (Phase 1)
- ✅ P0 #2 — `track_documents` permissions (Phase 1)
- ✅ P0 #4 — `notifications` INSERT (Phase 1)
- ✅ Sécurisation systématique des RPCs (Phase 2)

Phase 3 traite les 2 derniers :

- 🔴 P0 #3 — Storage bucket `documents` totalement ouvert (any auth user can read/write all docs).
- 🔴 P0 #5 — Pages publiques (SharedStemAccess, SignAgreement, StudioSession) avec writes anon non scopés.

---

## Étape 1 — Pre-flight obligatoire

### A. Audit des paths storage existants

L'application uploade dans `documents` avec le format `{workspace_id}/{track_id}/{uuid}.{ext}` (vérifié dans `src/pages/TrackDetail.tsx:3159`). Mais s'il existe des objets historiques avec un autre format, ils deviendront **inaccessibles** après S1.

Dry-run dans le SQL Editor Supabase :

```sql
-- Compte les objets dont le premier segment n'est PAS un UUID
SELECT count(*) AS non_uuid_paths
FROM storage.objects
WHERE bucket_id = 'documents'
  AND (
    storage.foldername(name) IS NULL
    OR array_length(storage.foldername(name), 1) IS NULL
    OR (storage.foldername(name))[1] !~ '^[0-9a-f-]{36}$'
  );

-- Si > 0, liste-les pour décider :
SELECT name, created_at, owner
FROM storage.objects
WHERE bucket_id = 'documents'
  AND (
    storage.foldername(name) IS NULL
    OR array_length(storage.foldername(name), 1) IS NULL
    OR (storage.foldername(name))[1] !~ '^[0-9a-f-]{36}$'
  )
ORDER BY created_at DESC
LIMIT 100;
```

**Verdicts possibles** :
- 0 ligne → safe, exécute S1 directement.
- Quelques lignes (< 10) → migrer manuellement (renommer ou supprimer si obsolètes).
- Beaucoup de lignes → soit le pattern de path est différent en prod (réécrire S1 avec le vrai pattern), soit ajouter une policy de fallback temporaire pour ces objets le temps de les migrer.

### B. Vérifier que les tables anon existent

```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('track_comments', 'signature_requests', 'studio_submissions');
-- Attendu : 3 lignes
```

Si une table manque, le `DO $body$` correspondant skipe avec un `RAISE NOTICE`. Pas de crash. Mais la vulnérabilité reste ouverte.

### C. Vérifier les colonnes des tables anon

Le script suppose certaines colonnes (cf. inférence dans le rapport explorer) :

```sql
\d public.track_comments
\d public.signature_requests
\d public.studio_submissions
```

Colonnes attendues :

**track_comments** : `id, track_id, shared_link_id, author_name, author_email, author_type, timestamp_sec, content, created_at, updated_at, deleted_at`

**signature_requests** : `id, track_id, collaborator_name, collaborator_email, role, split_share, token, status, signature_data, signed_at` (+ optionnel : `pro, ipi, publisher`)

**studio_submissions** : `id, track_id, email, full_name, artist_name, roles, pro_name, ipi_number, publisher_name, proposed_split, justification, status, created_at`

Si une colonne référencée par les triggers d'immutabilité (S2/S3) n'existe pas, le trigger crashera au premier UPDATE. Adapter les triggers en conséquence.

### D. Snapshot

```sql
CREATE TEMP TABLE _phase3_pre_snapshot AS
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'storage' AND tablename = 'objects')
   OR (schemaname = 'public' AND tablename IN (
     'track_comments', 'signature_requests', 'studio_submissions'
   ));

SELECT count(*) FROM _phase3_pre_snapshot;
-- Note ce nombre.
```

---

## Étape 2 — Exécution

Le script est divisé en 5 sections idempotentes. Tu peux exécuter tout d'un coup ou section par section.

| Section | Périmètre | Risque feature |
|---|---|---|
| S0 | Helper `storage_path_workspace_id` | Nul |
| S1 | Storage `documents` policies | Doc upload/download/delete |
| S2 | track_comments anon (INSERT/UPDATE + trigger) | Commentaires sur shared link |
| S3 | signature_requests anon (UPDATE + trigger) | Signature de splits |
| S4 | studio_submissions anon (INSERT) | QR studio submission |
| S5 | Vérifications | — |

---

## Tests par scénario (à effectuer après application)

### Scénario A — Cross-workspace document leak (P0 #3)

**Setup** : 2 workspaces A et B, user authentifié dans A seulement.

- [ ] Login dans workspace A → ouvrir un track avec un doc → télécharger ✅
- [ ] Manuellement (URL forgée), demander le download d'un doc de workspace B :
  - Soit via signed URL : `supabase.storage.from('documents').createSignedUrl('<workspace_B_id>/<track>/<file>', 60)` → erreur "object not found" (fail-closed)
  - Soit via REST API : appel direct → 403/404
- [ ] Tenter d'uploader avec `path = '<workspace_B_id>/...'` depuis le workspace A → erreur "new row violates row-level security policy"
- [ ] Tenter de delete un doc avec un path `<workspace_B_id>/...` → 403

### Scénario B — Track comment ownership (P0 #5 ②③)

**Setup** : ouvrir un shared link en navigation privée, laisser un commentaire avec email "alice@example.com".

- [ ] Laisser un commentaire normal → succès ✅
- [ ] Tenter de modifier le commentaire d'un autre visiteur (ouvrir un autre nav privée, prendre l'id d'un autre commentaire, faire `update().eq('id', otherCommentId)`) → la policy permet l'UPDATE mais le trigger d'immutabilité bloque toute modif autre que `content`/`updated_at`/`deleted_at` ⚠️
- [ ] Tenter de modifier `track_id` ou `author_email` → erreur "X is immutable for anon updates"
- [ ] Tenter d'insérer un commentaire avec un `shared_link_id` actif mais un `track_id` qui n'est pas dans ce lien → erreur RLS (track_id ne match pas le shared_link)
- [ ] Désactiver le shared_link (admin) → tenter d'ajouter un commentaire → erreur RLS
- [ ] Tenter d'insérer avec `author_type = 'admin'` → erreur RLS (only `recipient` allowed)

**Limitation connue** : sans token de session anon, la RLS ne peut pas garantir qu'un visiteur ne modifie QUE ses propres commentaires. Le trigger limite les dégâts (il ne peut pas changer l'auteur), mais il peut quand même réécrire le `content` d'un commentaire d'autrui. Fix complet en Phase 4 via une RPC qui prend un token de commentaire.

### Scénario C — Signature request hardening (P0 #5 ④)

**Setup** : créer un signature_request avec token `abc123`. Ouvrir l'URL `/sign/abc123` en nav privée.

- [ ] Signer normalement (canvas + submit) → status passe à 'signed', signature_data écrit ✅
- [ ] Tenter de re-signer (status déjà = 'signed') → erreur RLS (USING `status = 'pending'`)
- [ ] Tenter via un client anon de modifier `collaborator_email` → erreur trigger "collaborator_email is immutable"
- [ ] Tenter via anon de modifier `role` ou `split_share` → idem
- [ ] Tenter d'UPDATE une row sans token (`token IS NULL`) → erreur RLS

### Scénario D — Studio submission gating (P0 #5 ⑤)

**Setup** : un track avec `qr_token = 'xyz789'`, un autre track avec `qr_token = NULL`.

- [ ] Ouvrir `/studio/xyz789` → soumettre un track → succès ✅
- [ ] Tenter manuellement (anon REST API) `INSERT INTO studio_submissions (track_id, email, full_name)` avec un `track_id` qui n'a pas de `qr_token` → erreur RLS
- [ ] Tenter avec `email = ''` → erreur RLS (email vide bloqué)
- [ ] Désactiver le QR (admin) → set `qr_token = NULL` sur le track → tenter de soumettre → erreur RLS

### Scénario E — Régression documents (Phase 1 a déjà durci les policies sur la table)

- [ ] Editor : upload un doc → policy table OK + storage OK → succès ✅
- [ ] Pitcher : tenter d'uploader → policy table refuse (Phase 1)
- [ ] Viewer : tenter de download → policy table autorise SELECT, storage autorise lecture si member ✅

---

## Risques de régression connus

### 1. Path non-UUID dans `documents` bucket

**Symptôme** : objets existants avec un path comme `legacy/foo.pdf` deviennent inaccessibles. UI affiche "file not found".

**Détection** : dry-run de l'étape 1.A. Si > 0 lignes : migrer les paths AVANT S1.

**Fix de secours** : ajouter une policy temporaire qui autorise les paths legacy le temps de la migration :

```sql
CREATE POLICY "documents_legacy_paths_grace"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.storage_path_workspace_id(name) IS NULL
    AND owner = auth.uid()
  );
```

### 2. Bucket `tracks` ou `stems` similaire mais non couvert

L'audit confirme que `tracks`, `stems`, `covers`, `branding` ont un risque cross-workspace identique. **Ce script ne les traite pas** (hors P0). Si tu veux les durcir avant le launch Mosimann, copier le bloc S1 et remplacer `'documents'` par chaque bucket.

⚠️ **Le path de `stems` est plus profond** (`{workspace_id}/{track_id}/{stem_id}/{filename}`) — la fonction `storage_path_workspace_id` marche pareil (premier segment).

⚠️ **`avatars` est scopé par `user_id`, pas `workspace_id`** — pattern différent, ne pas réutiliser S1 tel quel.

### 3. signature_requests : colonnes `pro`, `ipi`, `publisher` mutables

Le trigger d'immutabilité de S3 ne bloque pas `pro`, `ipi`, `publisher`. Si la prod stocke ces données dans `signature_requests` et le frontend les écrit lors de la signature, c'est OK. Sinon, ajouter des `IF NEW.pro IS DISTINCT FROM OLD.pro THEN RAISE EXCEPTION ...` dans la fonction `signature_requests_anon_immutable_cols`.

### 4. studio_submissions sans UNIQUE(track_id, email)

L'audit a noté que le frontend gère les doublons via le code 23505 (unique constraint violation). Si la prod n'a pas ce constraint, S4 ne le crée pas. À ajouter manuellement si manquant :

```sql
ALTER TABLE public.studio_submissions
  ADD CONSTRAINT studio_submissions_track_email_unique
  UNIQUE (track_id, lower(email));
-- Note : index unique sur expression nécessite peut-être ALTER TABLE ... ADD CONSTRAINT
-- ou CREATE UNIQUE INDEX selon les contraintes de Postgres.
```

### 5. Trigger d'immutabilité authentifié → ignoré

Les triggers de S2/S3 contiennent `IF auth.uid() IS NOT NULL THEN RETURN NEW;`. Cela évite de bloquer les RPCs SECURITY DEFINER appelées par les admins. Effet de bord : si un user authentifié fait un UPDATE direct sur la table (sans RPC), le trigger ne le bloque pas — c'est normal car la RLS authentifiée est déjà gérée par les policies dédiées.

---

## Plan de rollback

### Rollback S1 (storage documents)

```sql
DROP POLICY IF EXISTS "documents_storage_insert_editor" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_select_members" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_update_editor" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_delete_uploader_or_admin" ON storage.objects;

CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Authenticated users can read documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');
CREATE POLICY "Authenticated users can delete own documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents');
```

### Rollback S2 (track_comments)

```sql
DROP TRIGGER IF EXISTS track_comments_anon_immutability ON public.track_comments;
DROP FUNCTION IF EXISTS public.track_comments_anon_immutable_cols();

DROP POLICY IF EXISTS "track_comments_anon_select" ON public.track_comments;
DROP POLICY IF EXISTS "track_comments_anon_insert" ON public.track_comments;
DROP POLICY IF EXISTS "track_comments_anon_update" ON public.track_comments;

-- Restaure les anciennes policies (de 20260315_shared_link_anon_rls.sql) :
CREATE POLICY "anon_read_comments_via_shared_link"
  ON public.track_comments FOR SELECT TO anon
  USING (shared_link_id IN (SELECT id FROM shared_links WHERE status = 'active'));
CREATE POLICY "anon_insert_comments_via_shared_link"
  ON public.track_comments FOR INSERT TO anon
  WITH CHECK (shared_link_id IN (SELECT id FROM shared_links WHERE status = 'active'));
```

### Rollback S3 (signature_requests)

```sql
DROP TRIGGER IF EXISTS signature_requests_anon_immutability ON public.signature_requests;
DROP FUNCTION IF EXISTS public.signature_requests_anon_immutable_cols();

DROP POLICY IF EXISTS "signature_requests_anon_select" ON public.signature_requests;
DROP POLICY IF EXISTS "signature_requests_anon_update_signing" ON public.signature_requests;

-- Note : aucune policy d'origine versionnée pour signature_requests.
-- Si rollback nécessaire, dump l'état pré-Phase 3 avec _phase3_pre_snapshot.
```

### Rollback S4 (studio_submissions)

```sql
DROP POLICY IF EXISTS "studio_submissions_anon_select" ON public.studio_submissions;
DROP POLICY IF EXISTS "studio_submissions_anon_insert" ON public.studio_submissions;
```

### Rollback S0 (helper)

```sql
DROP FUNCTION IF EXISTS public.storage_path_workspace_id(text);
```

---

## Hors périmètre Phase 3

À traiter en Phase 4 :

- **Storage policies pour `tracks`, `stems`, `covers`, `branding`** — risque cross-workspace identique, à évaluer si critical pour Mosimann.
- **RPC `add_track_comment_anon(_token, _content, _timestamp_sec)`** — vraie sécurité d'ownership des commentaires anon via token de session.
- **RPC `sign_signature_request(_token, _signature_data, _signer_name)`** — équivalent pour signature_requests.
- **RPC `submit_studio_session(_qr_token, ...)`** — équivalent pour studio_submissions.
- **Versionner les CREATE TABLE** de `track_comments`, `signature_requests`, `studio_submissions` dans le repo.

---

## Suivi d'exécution

- [ ] Étape 1.A — Dry-run paths storage `documents` (0 lignes non-UUID OU plan de migration prêt)
- [ ] Étape 1.B — Tables `track_comments`, `signature_requests`, `studio_submissions` confirmées présentes
- [ ] Étape 1.C — Colonnes vérifiées (\d sur les 3 tables)
- [ ] Étape 1.D — Snapshot `_phase3_pre_snapshot` créé
- [ ] S0 helper appliqué + tests safe-cast OK
- [ ] S1 storage policies appliquées
- [ ] S2 track_comments policies + trigger appliqués
- [ ] S3 signature_requests policies + trigger appliqués
- [ ] S4 studio_submissions policies appliquées
- [ ] Vérifications S5 (a)(b)(c)(d) OK
- [ ] Test scénario A — cross-workspace doc leak bloqué
- [ ] Test scénario B — track_comments hardening OK (avec limitation acceptée)
- [ ] Test scénario C — signature_requests hardening OK
- [ ] Test scénario D — studio_submissions gating OK
- [ ] Test scénario E — régression docs Phase 1 OK
- [ ] 24h sans bug remonté → migration considérée stable
- [ ] Communication à Mosimann que la prod est ready
