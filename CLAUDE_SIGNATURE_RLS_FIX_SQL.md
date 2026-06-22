# SQL — Fermer la fuite PII `signature_requests`

> ⚠️ **NE PAS auto-exécuter.** À copier-coller dans **Supabase SQL Editor** (projet `xhmeitivkclbeziqavxw`) **APRÈS** le déploiement du code (push + `supabase functions deploy get-shared-link-asset`).
>
> Exécuter dans l'ordre : **Bloc 1** (créer la RPC) → **Bloc 2** (fermer la policy). La RPC doit exister avant de fermer la policy, sinon `SignAgreement.tsx` casse entre les deux étapes.

---

## Contexte

La table `signature_requests` avait une policy anon ouverte :

```sql
CREATE POLICY "signature_requests_anon_select"
  ON public.signature_requests FOR SELECT TO anon
  USING (token IS NOT NULL);
```

Comme **toutes** les lignes ont un `token`, le prédicat `token IS NOT NULL` est vrai pour tout le monde → n'importe quel anon pouvait lire **tous les emails de collaborateurs + images de signature de tous les workspaces** (`/rest/v1/signature_requests?select=collaborator_email`). RLS ne peut pas forcer un filtre `WHERE token=...`, donc la seule vraie correction est de **retirer le SELECT anon** et de router toutes les lectures anon par des fonctions validées par token/slug.

**Deux chemins anon lisaient cette table — les deux sont maintenant migrés côté code :**

| Chemin | Avant | Après |
|--------|-------|-------|
| `SharedLinkPage.tsx` (pack download) | `fetch` REST anon direct | EF `get-shared-link-asset` (`action=signatures`, service role, validé par slug) |
| `SignAgreement.tsx` (page signature publique) | `anonClient.from("signature_requests").select(...)` ×2 | RPC `get_signature_agreement_by_token` (SECURITY DEFINER, validé par token, masque la PII des autres) |

Les lecteurs **authentifiés** (`TrackDetail.tsx`, `DownloadTrackModal.tsx`) utilisent le rôle `authenticated`, pas `anon` → **non affectés** par le retrait de la policy `TO anon`.

La policy anon **UPDATE** (`signature_requests_anon_update_signing`) reste **intacte** — hors scope de cette fuite (lecture). Le write de signature passe déjà par `sign_agreement_via_token`.

---

## Bloc 1 — Créer la RPC `get_signature_agreement_by_token`

```sql
-- RPC validée par token : retourne la ligne du signataire + les splits du track
-- avec PRO/IPI/publisher/email des AUTRES collaborateurs masqués.
-- SECURITY DEFINER → bypasse RLS ; la sécurité repose sur l'unguessability du token.
DROP FUNCTION IF EXISTS public.get_signature_agreement_by_token(text);

CREATE FUNCTION public.get_signature_agreement_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  _req public.signature_requests%ROWTYPE;
  _splits jsonb;
BEGIN
  IF _token IS NULL OR length(_token) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _req
  FROM public.signature_requests
  WHERE token = _token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Splits du même track : données complètes uniquement pour la ligne du
  -- signataire courant (même email) ; masquées pour les autres.
  SELECT jsonb_agg(row_obj ORDER BY share DESC) INTO _splits
  FROM (
    SELECT
      s.split_share AS share,
      jsonb_build_object(
        'collaborator_name', s.collaborator_name,
        'role', s.role,
        'split_share', s.split_share,
        'pro',       CASE WHEN s.collaborator_email = _req.collaborator_email THEN s.pro ELSE '' END,
        'ipi',       CASE WHEN s.collaborator_email = _req.collaborator_email THEN s.ipi ELSE '' END,
        'publisher', CASE WHEN s.collaborator_email = _req.collaborator_email THEN s.publisher ELSE '' END,
        'collaborator_email', CASE WHEN s.collaborator_email = _req.collaborator_email THEN s.collaborator_email ELSE '' END
      ) AS row_obj
    FROM public.signature_requests s
    WHERE s.track_id = _req.track_id
  ) sub;

  RETURN jsonb_build_object(
    'request', jsonb_build_object(
      'id', _req.id,
      'track_id', _req.track_id,
      'collaborator_name', _req.collaborator_name,
      'collaborator_email', _req.collaborator_email,
      'role', _req.role,
      'split_share', _req.split_share,
      'pro', _req.pro,
      'ipi', _req.ipi,
      'publisher', _req.publisher,
      'status', _req.status,
      'signature_data', _req.signature_data,
      'signed_at', _req.signed_at
    ),
    'splits', COALESCE(_splits, '[]'::jsonb)
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_signature_agreement_by_token(text) TO anon, authenticated;
```

### Vérification Bloc 1 (remplacer `<UN_TOKEN_VALIDE>`)

```sql
SELECT public.get_signature_agreement_by_token('<UN_TOKEN_VALIDE>');
-- Attendu : { "request": {...}, "splits": [...] }
SELECT public.get_signature_agreement_by_token('inexistant');
-- Attendu : NULL
```

---

## Bloc 2 — Fermer la policy anon SELECT (À EXÉCUTER APRÈS validation du Bloc 1 + déploiement code)

```sql
-- Inspecter d'abord les policies existantes :
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'signature_requests';

-- Retirer le SELECT anon (couvre le nom actuel + les noms historiques) :
DROP POLICY IF EXISTS "signature_requests_anon_select" ON public.signature_requests;
DROP POLICY IF EXISTS "anon_select_signature_requests" ON public.signature_requests;
DROP POLICY IF EXISTS "anon_select_by_token"           ON public.signature_requests; -- nom mentionné dans le plan (probablement inexistant)

-- NE PAS toucher à "signature_requests_anon_update_signing" (UPDATE anon, requis pour le flux de signature).
-- Plus aucune policy anon SELECT : la lecture passe désormais par
--   • EF get-shared-link-asset (service role, validé par slug)  → SharedLinkPage
--   • RPC get_signature_agreement_by_token (validé par token)   → SignAgreement
-- Les policies authentifiées existantes restent intactes.
```

### Vérification Bloc 2

```sql
-- Doit ne plus retourner AUCUNE ligne avec cmd='SELECT' et roles contenant 'anon' :
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'signature_requests';
```

Test côté anon (doit échouer / retourner 0 ligne maintenant) :

```
GET https://xhmeitivkclbeziqavxw.supabase.co/rest/v1/signature_requests?select=collaborator_email
Headers: apikey: <ANON_KEY>
→ Attendu : [] (RLS bloque) au lieu de la liste de tous les emails.
```
