-- SUIVI DU STOCKAGE (4 août 2026)
-- Constat : subscriptions.storage_bytes_used valait 0 pour TOUS les utilisateurs alors que
-- plan_limits.storage_bytes_max définit des limites (1,5 Go en Free, 40 Go en Starter…).
-- Rien ne l'alimentait ni ne le vérifiait. C'est la ressource la plus chère (R2 facture au Go).
-- tracks.file_size_bytes était NULL sur les 191 tracks ; stems et track_documents l'avaient.

-- 1. Colonne de taille sur les versions de tracks (chaque version = un fichier réel).
ALTER TABLE track_versions
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint;

-- 2. Backfill des tracks encore hébergées dans Supabase Storage (143 sur 191).
--    Les 48 restantes sont dans R2 : leur taille devra être récupérée par une Edge Function.
UPDATE tracks t
SET file_size_bytes = (o.metadata->>'size')::bigint
FROM storage.objects o
WHERE o.bucket_id = 'tracks'
  AND o.name = t.audio_url
  AND t.file_size_bytes IS NULL
  AND (o.metadata->>'size') IS NOT NULL;

-- 3. Idem pour les versions dont le fichier vit dans Supabase Storage.
UPDATE track_versions v
SET file_size_bytes = (o.metadata->>'size')::bigint
FROM storage.objects o
WHERE o.bucket_id = 'tracks'
  AND o.name = v.audio_url
  AND v.file_size_bytes IS NULL
  AND (o.metadata->>'size') IS NOT NULL;

-- 4. Fonction de calcul : le stockage suit le PROPRIÉTAIRE du workspace (modèle user-based).
--    Compte les masters, les versions supplémentaires, les stems et les documents.
--    EXCLUT le cache watermarké (régénérable, coût Trakalog) et les pochettes/branding.
CREATE OR REPLACE FUNCTION public.compute_user_storage_bytes(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
  SELECT
    coalesce((SELECT sum(t.file_size_bytes) FROM tracks t
              JOIN workspaces w ON w.id = t.workspace_id
              WHERE w.owner_id = _user_id), 0)
  + coalesce((SELECT sum(v.file_size_bytes) FROM track_versions v
              JOIN tracks t ON t.id = v.track_id
              JOIN workspaces w ON w.id = t.workspace_id
              WHERE w.owner_id = _user_id
                AND v.audio_url IS DISTINCT FROM t.audio_url), 0)
  + coalesce((SELECT sum(s.file_size_bytes) FROM stems s
              JOIN tracks t ON t.id = s.track_id
              JOIN workspaces w ON w.id = t.workspace_id
              WHERE w.owner_id = _user_id), 0)
  + coalesce((SELECT sum(d.file_size) FROM track_documents d
              JOIN tracks t ON t.id = d.track_id
              JOIN workspaces w ON w.id = t.workspace_id
              WHERE w.owner_id = _user_id), 0);
$func$;

-- 5. Recalcul complet, réutilisable (backfill initial + correction périodique).
CREATE OR REPLACE FUNCTION public.recompute_all_storage_usage()
RETURNS TABLE(user_id uuid, storage_bytes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  UPDATE subscriptions s
  SET storage_bytes_used = public.compute_user_storage_bytes(s.user_id),
      updated_at = now();

  RETURN QUERY
  SELECT s.user_id, s.storage_bytes_used FROM subscriptions s
  ORDER BY s.storage_bytes_used DESC;
END;
$func$;

REVOKE ALL ON FUNCTION public.recompute_all_storage_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_all_storage_usage() TO service_role;;
