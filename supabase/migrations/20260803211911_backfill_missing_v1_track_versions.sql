-- CONTEXTE : quand on ajoute une version à une track qui n'a AUCUNE ligne dans
-- track_versions, le flux client crée V1 avec le NOUVEAU fichier au lieu de créer d'abord
-- V1 = le master d'origine. Résultat : le master n'est plus référencé par aucune version
-- et « revenir à V1 » ne rejoue plus l'original.
-- 34 tracks étaient dans ce cas (créées après l'arrêt de la création auto de V1 le 24 juin).
-- On leur crée leur V1 manquante, pointant vers leur propre master. Le bug devient impossible
-- sur ces tracks, indépendamment du correctif client.
INSERT INTO track_versions (track_id, version_number, version_name, audio_url,
                            audio_preview_url, waveform_data, sonic_dna,
                            duration_sec, is_active, created_by, created_at)
SELECT t.id, 1, 'V1', t.audio_url,
       t.audio_preview_url, t.waveform_data, t.sonic_dna,
       t.duration_sec, true, t.uploaded_by, coalesce(t.created_at, now())
FROM tracks t
WHERE NOT EXISTS (SELECT 1 FROM track_versions v WHERE v.track_id = t.id)
  AND t.audio_url IS NOT NULL;

-- Recalage du compteur affiché sur la track.
UPDATE tracks t
SET version_count = sub.n
FROM (SELECT track_id, count(*) AS n FROM track_versions GROUP BY track_id) sub
WHERE sub.track_id = t.id AND coalesce(t.version_count,0) IS DISTINCT FROM sub.n;;
