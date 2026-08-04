-- B3 : l'écriture anonyme directe passe désormais par l'EF submit-signature (service_role).
-- On ferme définitivement l'UPDATE anonyme direct sur signature_requests.
ALTER POLICY anon_sign ON public.signature_requests USING (false) WITH CHECK (false);;
