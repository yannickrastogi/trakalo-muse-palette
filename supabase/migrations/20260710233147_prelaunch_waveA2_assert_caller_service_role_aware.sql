-- assert_caller devient service_role-aware :
-- les Edge Functions (service_role, sans session user) passent sans lever.
-- Comportement INCHANGÉ pour les appelants authenticated (ils ont auth.uid()).
-- Prépare l'ajout contrôlé de assert_caller aux ~11 RPC sans casser les EF.
CREATE OR REPLACE FUNCTION public.assert_caller(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  -- Edge Functions appellent en service_role : pas d'identité user à vérifier ici.
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: caller identity mismatch'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$func$;;
