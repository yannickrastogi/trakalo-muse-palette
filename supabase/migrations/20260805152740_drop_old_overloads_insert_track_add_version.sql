-- L'ajout de _file_size_bytes a créé une SURCHARGE : l'ancienne signature coexistait avec la
-- nouvelle, ce qui rend la résolution ambiguë côté PostgREST (erreur PGRST203).
-- On supprime les anciennes signatures ; les nouvelles les remplacent à l'identique,
-- le paramètre ajouté ayant DEFAULT NULL.
DROP FUNCTION IF EXISTS public.insert_track(
  uuid, uuid, text, text, text, text, text, numeric, text, numeric,
  text[], text[], text, text, text[], text[], text, text, text, text,
  text, jsonb, text, jsonb, timestamp with time zone);

DROP FUNCTION IF EXISTS public.add_track_version(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, numeric, text);;
