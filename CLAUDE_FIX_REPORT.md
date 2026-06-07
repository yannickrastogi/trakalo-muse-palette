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

### Migration 3 — CRIT-03 `track_comments` token-bound RPCs

```sql
-- Drop broad anon write policies
DROP POLICY IF EXISTS "track_comments_anon_update" ON public.track_comments;
DROP POLICY IF EXISTS "track_comments_anon_delete" ON public.track_comments;

CREATE OR REPLACE FUNCTION public.update_track_comment_via_token(
  _comment_id uuid, _shared_link_token text, _new_content text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_link_id uuid;
BEGIN
  SELECT id INTO v_link_id
  FROM public.shared_links
  WHERE link_slug = _shared_link_token AND status = 'active'
  LIMIT 1;

  IF v_link_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
  END IF;

  UPDATE public.track_comments
  SET content = _new_content, updated_at = now()
  WHERE id = _comment_id AND shared_link_id = v_link_id;

  RETURN jsonb_build_object('success', FOUND);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.update_track_comment_via_token(uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_track_comment_via_token(
  _comment_id uuid, _shared_link_token text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_link_id uuid;
BEGIN
  SELECT id INTO v_link_id
  FROM public.shared_links
  WHERE link_slug = _shared_link_token AND status = 'active'
  LIMIT 1;

  IF v_link_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
  END IF;

  UPDATE public.track_comments
  SET deleted_at = now()
  WHERE id = _comment_id AND shared_link_id = v_link_id;

  RETURN jsonb_build_object('success', FOUND);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.delete_track_comment_via_token(uuid, text) TO anon, authenticated;
```

### Migration 4 — P0-04 tracks cross-workspace via RPCs

> **Note:** the user-supplied snippet defined `get_track_for_shared_link` with 18 columns; expanded below to cover every column the front actually consumes (`featuring`, `mood`, `lyrics_segments`, `splits`, `labels`, `publishers`, `language`, `gender`). Add the playlist sibling.

```sql
-- Drop the cross-workspace authenticated policy
DROP POLICY IF EXISTS "Authenticated users can view tracks via shared links" ON public.tracks;

-- Single-track RPC (covers share_type IN ('track','stems','pack'))
CREATE OR REPLACE FUNCTION public.get_track_for_shared_link(_slug text)
RETURNS TABLE (
  id uuid, title text, artist text, featuring text,
  bpm numeric, key text, genre text, mood text[],
  cover_url text, duration_sec numeric, audio_url text,
  waveform_data jsonb, sonic_dna jsonb, credits jsonb,
  lyrics text, lyrics_segments jsonb,
  splits jsonb, isrc text, album text, labels text[], publishers text[],
  language text, gender text,
  released_at date, copyright text, explicit boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  RETURN QUERY
  SELECT t.id, t.title, t.artist, t.featuring,
    t.bpm, t.key, t.genre, t.mood,
    t.cover_url, t.duration_sec, t.audio_url,
    t.waveform_data, t.sonic_dna, t.credits,
    t.lyrics, t.lyrics_segments,
    t.splits, t.isrc, t.album, t.labels, t.publishers,
    t.language, t.gender,
    t.released_at, t.copyright, t.explicit
  FROM public.tracks t
  JOIN public.shared_links sl ON sl.track_id = t.id
  WHERE sl.link_slug = _slug AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_track_for_shared_link(text) TO anon, authenticated;

-- Playlist tracks RPC (ordered by playlist position)
CREATE OR REPLACE FUNCTION public.get_playlist_tracks_for_shared_link(_slug text)
RETURNS TABLE (
  id uuid, title text, artist text, featuring text,
  bpm numeric, key text, genre text, mood text[],
  cover_url text, duration_sec numeric, audio_url text,
  waveform_data jsonb, lyrics text, lyrics_segments jsonb,
  position integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  RETURN QUERY
  SELECT t.id, t.title, t.artist, t.featuring,
    t.bpm, t.key, t.genre, t.mood,
    t.cover_url, t.duration_sec, t.audio_url,
    t.waveform_data, t.lyrics, t.lyrics_segments,
    pt.position
  FROM public.tracks t
  JOIN public.playlist_tracks pt ON pt.track_id = t.id
  JOIN public.shared_links sl ON sl.playlist_id = pt.playlist_id
  WHERE sl.link_slug = _slug AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now())
  ORDER BY pt.position ASC;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_playlist_tracks_for_shared_link(text) TO anon, authenticated;
```

**Residual:** if an anon-side broad policy on `tracks` exists (e.g. `anon_read_tracks_via_shared_links`), it should also be dropped — the audit only flagged the `authenticated` variant. Confirm via `SELECT polname, roles FROM pg_policies WHERE tablename = 'tracks'` before/after.

(other migrations populated per fix below)

---

## Edge Functions to deploy (Yannick runs these)

> From repo root with the Supabase CLI logged in to project ref `xhmeitivkclbeziqavxw`.

### Deploy 1 — P0-05 `add-to-waitlist`

```bash
supabase functions deploy add-to-waitlist --project-ref xhmeitivkclbeziqavxw
```

- Service role write (waitlist has no anon INSERT policy).
- Rate limit: **5 req / 15 min / IP** via `check_rate_limit` RPC.
- Email regex + 254-char cap + lowercase trim.
- Duplicate `email` (23505) returns `{success:true, duplicate:true}` so the UX stays positive.
- DB errors masked, `console.error` keeps server-side trace.

### Deploy 2 — P1-07 `accept-invitation`

(populated by the P1-07 section below)

---

## Per-fix detail

(populated as fixes land)

---

## Runtime test checklist (post-push)

(populated at the end)
