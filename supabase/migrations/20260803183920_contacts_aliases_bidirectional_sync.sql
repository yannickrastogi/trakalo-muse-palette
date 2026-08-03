-- (1) Un contact crée/alimente automatiquement ses alias.
--     Clés d'alias : le stage_name ET le nom complet (prénom + nom), s'ils diffèrent.
--     Raison : le nom écrit dans un titre de fichier peut être l'un ou l'autre
--     (ex. "lucatheproducer" ou "Lucas Liberatore" pour le même contact).
CREATE OR REPLACE FUNCTION public.sync_contact_aliases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_names text[];
  v_name  text;
BEGIN
  v_names := ARRAY[]::text[];

  IF coalesce(btrim(NEW.stage_name),'') <> '' THEN
    v_names := v_names || btrim(NEW.stage_name);
  END IF;

  IF coalesce(btrim(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,'')),'') <> '' THEN
    v_names := v_names || btrim(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,''));
  END IF;

  FOREACH v_name IN ARRAY (SELECT array_agg(DISTINCT x) FROM unnest(v_names) x)
  LOOP
    INSERT INTO artist_aliases (workspace_id, alias_name, contact_ids, created_by)
    VALUES (NEW.workspace_id, v_name, ARRAY[NEW.id], NEW.created_by)
    ON CONFLICT (workspace_id, alias_name) DO UPDATE
      SET contact_ids = CASE
            WHEN artist_aliases.contact_ids @> ARRAY[NEW.id]
              THEN artist_aliases.contact_ids
            ELSE artist_aliases.contact_ids || NEW.id
          END,
          created_by = coalesce(artist_aliases.created_by, NEW.created_by),
          updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_sync_contact_aliases ON contacts;
CREATE TRIGGER trg_sync_contact_aliases
AFTER INSERT OR UPDATE OF first_name, last_name, stage_name ON contacts
FOR EACH ROW EXECUTE FUNCTION public.sync_contact_aliases();

-- (2) Backfill : générer les alias manquants pour les contacts existants.
DO $backfill$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM contacts LOOP
    IF coalesce(btrim(r.stage_name),'') <> '' THEN
      INSERT INTO artist_aliases (workspace_id, alias_name, contact_ids, created_by)
      VALUES (r.workspace_id, btrim(r.stage_name), ARRAY[r.id], r.created_by)
      ON CONFLICT (workspace_id, alias_name) DO UPDATE
        SET contact_ids = CASE WHEN artist_aliases.contact_ids @> ARRAY[r.id]
                               THEN artist_aliases.contact_ids
                               ELSE artist_aliases.contact_ids || r.id END,
            updated_at = now();
    END IF;
    IF coalesce(btrim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,'')),'') <> '' THEN
      INSERT INTO artist_aliases (workspace_id, alias_name, contact_ids, created_by)
      VALUES (r.workspace_id, btrim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,'')),
              ARRAY[r.id], r.created_by)
      ON CONFLICT (workspace_id, alias_name) DO UPDATE
        SET contact_ids = CASE WHEN artist_aliases.contact_ids @> ARRAY[r.id]
                               THEN artist_aliases.contact_ids
                               ELSE artist_aliases.contact_ids || r.id END,
            updated_at = now();
    END IF;
  END LOOP;
END
$backfill$;;
