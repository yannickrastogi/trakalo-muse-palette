-- Correctif du backfill : tracks.file_size_bytes vaut 0 par défaut (pas NULL),
-- la condition « IS NULL » de la migration précédente n'a donc rien mis à jour.
UPDATE tracks t
SET file_size_bytes = (o.metadata->>'size')::bigint
FROM storage.objects o
WHERE o.bucket_id = 'tracks'
  AND o.name = t.audio_url
  AND coalesce(t.file_size_bytes, 0) = 0
  AND (o.metadata->>'size') IS NOT NULL
  AND (o.metadata->>'size')::bigint > 0;

UPDATE track_versions v
SET file_size_bytes = (o.metadata->>'size')::bigint
FROM storage.objects o
WHERE o.bucket_id = 'tracks'
  AND o.name = v.audio_url
  AND coalesce(v.file_size_bytes, 0) = 0
  AND (o.metadata->>'size') IS NOT NULL
  AND (o.metadata->>'size')::bigint > 0;;
