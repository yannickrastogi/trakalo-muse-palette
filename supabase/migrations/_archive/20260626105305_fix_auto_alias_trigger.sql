CREATE OR REPLACE FUNCTION public.auto_create_alias_from_stage_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN
  IF NEW.stage_name IS NOT NULL AND NEW.stage_name != ''
     AND lower(NEW.stage_name) != lower(concat_ws(' ', NEW.first_name, NEW.last_name)) THEN
    BEGIN
      INSERT INTO artist_aliases (workspace_id, alias_name, contact_ids, created_by)
      VALUES (NEW.workspace_id, NEW.stage_name, ARRAY[NEW.id]::uuid[], NEW.created_by)
      ON CONFLICT (workspace_id, alias_name) DO UPDATE
        SET contact_ids = (SELECT array_agg(DISTINCT c)
          FROM unnest(artist_aliases.contact_ids || ARRAY[NEW.id]::uuid[]) AS c);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_auto_alias_on_contact ON contacts;
CREATE TRIGGER trg_auto_alias_on_contact
  AFTER INSERT OR UPDATE OF stage_name
  ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_alias_from_stage_name();
