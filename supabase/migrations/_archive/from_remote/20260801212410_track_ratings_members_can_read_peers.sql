-- Les membres d'un workspace peuvent LIRE toutes les notes de ce workspace
-- (nécessaire pour calculer la moyenne d'équipe).
-- L'écriture reste strictement limitée à ses propres lignes via la policy
-- existante "workspace members can manage own ratings" (FOR ALL).
CREATE POLICY "workspace members can read all ratings"
  ON public.track_ratings
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member((SELECT auth.uid()), workspace_id));;
