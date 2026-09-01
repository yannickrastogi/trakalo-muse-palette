# SQL — Close the PII leak on `signature_requests`

> ⚠️ **DO NOT auto-execute.** Copy-paste into **Supabase SQL Editor** (project `xhmeitivkclbeziqavxw`) **AFTER** deploying the code (push + `supabase functions deploy get-shared-link-asset`).
>
> Execute in order: **Block 1** (create the RPC) → **Block 2** (close the policy). The RPC must exist before closing the policy, otherwise `SignAgreement.tsx` breaks between the two steps.

---

## Context

The `signature_requests` table had an open anon policy:

```sql
CREATE POLICY "signature_requests_anon_select"
  ON public.signature_requests FOR SELECT TO anon
  USING (token IS NOT NULL);
```

Since **all** rows have a `token`, the predicate `token IS NOT NULL` is true for everyone → anyone anonymous could read **all collaborators' emails + signature images from all workspaces** (`/rest/v1/signature_requests?select=collaborator_email`). RLS cannot force a `WHERE token=...` filter, so the only real fix is to **remove anon SELECT** and route all anonymous reads through token/slug-validated functions.

**Two anonymous paths read this table — both are now migrated on the code side:**

| Path | Before | After |
|--------|-------|-------|
| `SharedLinkPage.tsx` (pack download) | `fetch` direct anon REST | EF `get-shared-link-asset` (`action=signatures`, service role, validated by slug) |
| `SignAgreement.tsx` (public signature page) | `anonClient.from("signature_requests").select(...)` ×2 | RPC `get_signature_agreement_by_token` (SECURITY DEFINER, validated by token, masks PII from others) |

**Authenticated** readers (`TrackDetail.tsx`, `DownloadTrackModal.tsx`) use the `authenticated` role, not `anon` → **unaffected** by removing the `TO anon` policy.

The anon **UPDATE** policy (`signature_requests_anon_update_signing`) remains **intact** — out of scope of this leak (read-only). The signature write already goes through `sign_agreement_via_token`.

---

## Block 1 — Create the RPC `get_signature_agreement_by_token`

```sql
-- Token-validated RPC: returns the signer's row + the track's splits
-- with PRO/IPI/publisher/email of OTHER collaborators masked.
-- SECURITY DEFINER → bypasses RLS; security relies on the token's unguessability.
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

  -- Splits from the same track: full data only for the current
  -- signer's row (same email); masked for others.
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

### Block 1 verification (replace `<A_VALID_TOKEN>`)

```sql
SELECT public.get_signature_agreement_by_token('<A_VALID_TOKEN>');
-- Expected: { "request": {...}, "splits": [...] }
SELECT public.get_signature_agreement_by_token('nonexistent');
-- Expected: NULL
```

---

## Block 2 — Close the anon SELECT policy (TO BE EXECUTED AFTER Block 1 validation + code deploy)

```sql
-- First inspect existing policies:
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'signature_requests';

-- Remove the anon SELECT (covers current + historical names):
DROP POLICY IF EXISTS "signature_requests_anon_select" ON public.signature_requests;
DROP POLICY IF EXISTS "anon_select_signature_requests" ON public.signature_requests;
DROP POLICY IF EXISTS "anon_select_by_token"           ON public.signature_requests; -- name mentioned in the plan (probably nonexistent)

-- DO NOT touch "signature_requests_anon_update_signing" (anon UPDATE, required for the signing flow).
-- No more anon SELECT policies: reads now go through
--   • EF get-shared-link-asset (service role, validated by slug)  → SharedLinkPage
--   • RPC get_signature_agreement_by_token (validated by token)   → SignAgreement
-- Existing authenticated policies remain intact.
```

### Block 2 verification

```sql
-- Should return NO rows with cmd='SELECT' and roles containing 'anon':
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'signature_requests';
```

Test from anonymous (should fail / return 0 rows now):

```
GET https://xhmeitivkclbeziqavxw.supabase.co/rest/v1/signature_requests?select=collaborator_email
Headers: apikey: <ANON_KEY>
→ Expected: [] (RLS blocks) instead of the list of all emails.
```