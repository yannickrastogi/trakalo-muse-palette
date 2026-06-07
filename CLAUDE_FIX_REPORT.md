# CLAUDE — Fix P0/P1 from COWORK_AUDIT_REPORT

> Session opened 2026-06-07 · CTO workflow
> Baseline : `b21646f` (Cowork full audit report)
> Feature branch : `claude/fix-audit-p0-p1-20260607-1518`
> Rollback tag : `pre-audit-fix-20260607-151805`

## Rollback procedure

If anything goes wrong post-push, on the local machine :
```bash
cd ~/Desktop/DEV/trakalog-app
git fetch --tags
git reset --hard pre-audit-fix-20260607-151805
# (only if remote was pushed and needs reverting)
git push --force-with-lease origin claude/fix-audit-p0-p1-20260607-1518
```

The tag `pre-audit-fix-20260607-151805` points to commit `b21646f` (state immediately before the audit fixes session). Any rollback restores the repo to that exact state.

---

## Fix manifest

| ID | Status | Files | SQL migration | Edge Function deploy |
|---|---|---|---|---|
| CRIT-01 | (pending) | — | — | — |
| CRIT-02 | (pending) | — | — | — |
| CRIT-03 | (pending) | — | — | — |
| P0-04 | (pending) | — | — | — |
| P0-05 | (pending) | — | — | — |
| P1-06 | (pending) | — | — | — |
| P1-07 | (pending) | — | — | — |
| P1-08 | (pending) | — | — | — |
| P2-09 covers public | **SKIPPED** | — | — | — |

P2-09 (covers bucket public) deliberately deferred per scope. Risk/benefit marginal — covers are mid-fidelity art assets, exposure cost is reputational only and reversible. Plan: separate session with audit of all places generating cover URLs (signed vs public) before flipping the bucket policy.

---

## SQL migrations to execute (Yannick runs these)

> Run in order in the Supabase SQL Editor on the **production** project (`xhmeitivkclbeziqavxw`). Each block is independent and idempotent.

### Migration 1 — CRIT-01 `shared_links` RLS + RPCs

```sql
-- Drop the broad anon/authenticated read policies
DROP POLICY IF EXISTS "anon_read_shared_links" ON public.shared_links;
DROP POLICY IF EXISTS "Authenticated users can view active shared links" ON public.shared_links;

-- Scope authenticated reads to workspace members only
CREATE POLICY "Workspace members can view shared links"
ON public.shared_links FOR SELECT TO authenticated
USING (is_workspace_member(auth.uid(), workspace_id));

-- Public read by slug (no password_hash exposure — has_password boolean instead)
CREATE OR REPLACE FUNCTION public.get_shared_link_by_slug(_slug text)
RETURNS TABLE (
  id uuid, workspace_id uuid, track_id uuid, playlist_id uuid,
  share_type text, status text, message text, allow_download boolean,
  allow_save boolean, download_quality text,
  expires_at timestamptz, watermarking_enabled boolean,
  gate_screen_enabled boolean, has_password boolean,
  link_name text, link_slug text, link_type text,
  pack_items text[], created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  RETURN QUERY
  SELECT sl.id, sl.workspace_id, sl.track_id, sl.playlist_id,
    sl.share_type::text, sl.status::text, sl.message, sl.allow_download,
    sl.allow_save, sl.download_quality,
    sl.expires_at, sl.watermarking_enabled, sl.gate_screen_enabled,
    (sl.password_hash IS NOT NULL) AS has_password,
    sl.link_name, sl.link_slug, sl.link_type::text,
    sl.pack_items, sl.created_at
  FROM public.shared_links sl
  WHERE sl.link_slug = _slug AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_shared_link_by_slug(text) TO anon, authenticated;

-- Public read by id (used by /shared/:linkId stems route in SharedStemAccess)
CREATE OR REPLACE FUNCTION public.get_shared_link_by_id(_link_id uuid)
RETURNS TABLE (
  id uuid, workspace_id uuid, track_id uuid, playlist_id uuid,
  share_type text, status text, message text, allow_download boolean,
  allow_save boolean, download_quality text,
  expires_at timestamptz, watermarking_enabled boolean,
  gate_screen_enabled boolean, has_password boolean,
  link_name text, link_slug text, link_type text,
  pack_items text[], created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  RETURN QUERY
  SELECT sl.id, sl.workspace_id, sl.track_id, sl.playlist_id,
    sl.share_type::text, sl.status::text, sl.message, sl.allow_download,
    sl.allow_save, sl.download_quality,
    sl.expires_at, sl.watermarking_enabled, sl.gate_screen_enabled,
    (sl.password_hash IS NOT NULL) AS has_password,
    sl.link_name, sl.link_slug, sl.link_type::text,
    sl.pack_items, sl.created_at
  FROM public.shared_links sl
  WHERE sl.id = _link_id AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_shared_link_by_id(uuid) TO anon, authenticated;
```

### Migration 2 — CRIT-02 `signature_requests` UPDATE token-bound

```sql
-- Drop the broken anon-update policy that allowed PATCH by id alone
DROP POLICY IF EXISTS "signature_requests_anon_update_signing" ON public.signature_requests;

-- Server-side token validation + atomic update
CREATE OR REPLACE FUNCTION public.sign_agreement_via_token(
  _token text, _signature_data text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_request_id uuid;
BEGIN
  SELECT id INTO v_request_id
  FROM public.signature_requests
  WHERE token = _token AND status = 'pending'
  LIMIT 1;

  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;

  UPDATE public.signature_requests
  SET status = 'signed',
      signature_data = _signature_data,
      signed_at = now()
  WHERE id = v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.sign_agreement_via_token(text, text) TO anon, authenticated;
```

(other migrations populated per fix below)

---

## Edge Functions to deploy (Yannick runs these)

> From repo root with the Supabase CLI logged in to project ref `xhmeitivkclbeziqavxw`.

(populated per fix below)

---

## Per-fix detail

(populated as fixes land)

---

## Runtime test checklist (post-push)

(populated at the end)
