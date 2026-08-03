-- ============================================================
-- VAGUE A1 — durcissement pré-launch (réversible, DB-only)
-- ============================================================

-- 1. RLS profiles : self + co-membres (au lieu de USING true)
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "profiles_select_self_or_comember" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members me
    JOIN public.workspace_members them ON them.workspace_id = me.workspace_id
    WHERE me.user_id = (SELECT auth.uid())
      AND them.user_id = profiles.id
  )
);

-- 2. RLS link_events : membre du workspace du lien (au lieu de USING true)
DROP POLICY IF EXISTS "Authenticated users can read link events" ON public.link_events;
CREATE POLICY "link_events_select_workspace_member" ON public.link_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.shared_links sl
    JOIN public.workspace_members wm ON wm.workspace_id = sl.workspace_id
    WHERE sl.id = link_events.link_id
      AND wm.user_id = (SELECT auth.uid())
  )
);

-- 3. signature_requests : interim — anon ne peut cibler QUE des lignes pending
--    (les signatures déjà 'signed' deviennent immuables pour anon).
--    WITH CHECK laissé permissif pour ne pas bloquer le passage pending->signed.
ALTER POLICY anon_sign ON public.signature_requests USING (status = 'pending');

-- 4. Storage : retirer l'INSERT permissif sur avatars
--    (la policy scopée "Users can manage their own avatar" couvre l'upload propre-dossier)
DROP POLICY IF EXISTS "Allow authenticated uploads to avatars" ON storage.objects;

-- 5. Storage : limites de taille (n'affecte que les nouveaux uploads)
UPDATE storage.buckets SET file_size_limit = 5242880    WHERE id = 'avatars';
UPDATE storage.buckets SET file_size_limit = 10485760   WHERE id IN ('branding','covers');
UPDATE storage.buckets SET file_size_limit = 52428800   WHERE id = 'documents';
UPDATE storage.buckets SET file_size_limit = 524288000  WHERE id = 'stems';

-- 6. Perf : index sur FK filtrées (tables minuscules -> lock négligeable)
CREATE INDEX IF NOT EXISTS idx_invitations_workspace_id        ON public.invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_track_comments_workspace_id     ON public.track_comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_track_ratings_workspace_id      ON public.track_ratings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_track_ratings_user_id           ON public.track_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_track_id     ON public.signature_requests(track_id);
CREATE INDEX IF NOT EXISTS idx_notifications_track_id          ON public.notifications(track_id);
CREATE INDEX IF NOT EXISTS idx_notifications_pitch_id          ON public.notifications(pitch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_approval_id       ON public.notifications(approval_id);
CREATE INDEX IF NOT EXISTS idx_notifications_link_id           ON public.notifications(link_id);
CREATE INDEX IF NOT EXISTS idx_catalog_shares_playlist_id      ON public.catalog_shares(playlist_id);
CREATE INDEX IF NOT EXISTS idx_mkt_requests_owner_ws           ON public.marketplace_requests(owner_workspace_id);
CREATE INDEX IF NOT EXISTS idx_mkt_requests_requester_ws       ON public.marketplace_requests(requester_workspace_id);
CREATE INDEX IF NOT EXISTS idx_mkt_requests_requester_user     ON public.marketplace_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_pitches_share_link_id           ON public.pitches(share_link_id);
CREATE INDEX IF NOT EXISTS idx_shared_links_created_by         ON public.shared_links(created_by);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_added_by        ON public.playlist_tracks(added_by);
CREATE INDEX IF NOT EXISTS idx_stems_uploaded_by               ON public.stems(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_track_documents_uploaded_by     ON public.track_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_track_versions_created_by       ON public.track_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by             ON public.contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_approvals_reviewed_by           ON public.approvals(reviewed_by);

-- 7. Verrou anti-tampering du plan : seul service_role peut changer workspaces.plan
CREATE OR REPLACE FUNCTION public.prevent_client_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'plan can only be changed by the billing system'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_prevent_client_plan_change ON public.workspaces;
CREATE TRIGGER trg_prevent_client_plan_change
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.prevent_client_plan_change();;
