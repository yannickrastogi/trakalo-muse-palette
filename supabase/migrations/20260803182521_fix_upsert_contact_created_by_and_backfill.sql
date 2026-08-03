-- BUG 1 : upsert_contact insérait dans une colonne `added_by` QUI N'EXISTE PAS
--         -> toute création de contact via cette RPC échouait (42703).
--         La colonne réelle est `created_by`.
-- BUG 2 : conséquence, created_by était NULL sur 31 des 46 contacts (créés par insertion
--         directe côté client), ce qui rendait inopérante la branche « mes contacts »
--         de get_contact_suggestions.
-- Correctif : la RPC renseigne created_by à la création, ne l'écrase JAMAIS à la mise à
-- jour (le créateur reste le créateur), et backfill des lignes existantes avec le
-- propriétaire du workspace — tous les workspaces concernés appartiennent à Yannick ou Eliot.

CREATE OR REPLACE FUNCTION public.upsert_contact(
  _user_id uuid, _workspace_id uuid, _first_name text, _last_name text,
  _email text DEFAULT NULL, _stage_name text DEFAULT NULL, _role text DEFAULT NULL,
  _company text DEFAULT NULL, _phone text DEFAULT NULL, _city text DEFAULT NULL,
  _country text DEFAULT NULL, _pro text[] DEFAULT NULL, _ipi text DEFAULT NULL,
  _publisher text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
DECLARE v_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  IF _email IS NOT NULL AND _email != '' THEN
    SELECT id INTO v_id FROM contacts
     WHERE workspace_id = _workspace_id AND lower(email) = lower(_email) LIMIT 1;
    IF v_id IS NOT NULL THEN
      DELETE FROM contacts
       WHERE workspace_id = _workspace_id AND id != v_id AND email IS NULL
         AND lower(first_name) = lower(_first_name)
         AND lower(coalesce(last_name,'')) = lower(coalesce(_last_name,''));
    END IF;
  END IF;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM contacts
     WHERE workspace_id = _workspace_id
       AND lower(first_name) = lower(_first_name)
       AND lower(coalesce(last_name,'')) = lower(coalesce(_last_name,'')) LIMIT 1;
  END IF;

  IF v_id IS NOT NULL THEN
    UPDATE contacts SET
      email      = CASE WHEN _email      IS NOT NULL AND _email      != '' THEN _email      ELSE email      END,
      stage_name = CASE WHEN _stage_name IS NOT NULL AND _stage_name != '' THEN _stage_name ELSE stage_name END,
      role       = CASE WHEN _role       IS NOT NULL AND _role       != '' THEN _role       ELSE role       END,
      company    = CASE WHEN _company    IS NOT NULL AND _company    != '' THEN _company    ELSE company    END,
      phone      = CASE WHEN _phone      IS NOT NULL AND _phone      != '' THEN _phone      ELSE phone      END,
      city       = CASE WHEN _city       IS NOT NULL AND _city       != '' THEN _city       ELSE city       END,
      country    = CASE WHEN _country    IS NOT NULL AND _country    != '' THEN _country    ELSE country    END,
      pro        = CASE WHEN _pro        IS NOT NULL                       THEN _pro        ELSE pro        END,
      ipi        = CASE WHEN _ipi        IS NOT NULL AND _ipi        != '' THEN _ipi        ELSE ipi        END,
      publisher  = CASE WHEN _publisher  IS NOT NULL AND _publisher  != '' THEN _publisher  ELSE publisher  END,
      -- si le créateur est inconnu (ligne historique), on l'attribue ; sinon on n'y touche pas
      created_by = coalesce(created_by, _user_id),
      updated_at = now()
    WHERE id = v_id;
  ELSE
    INSERT INTO contacts (workspace_id, created_by, first_name, last_name, email,
                          stage_name, role, company, phone, city, country, pro, ipi, publisher)
    VALUES (_workspace_id, _user_id, _first_name, _last_name, _email,
            _stage_name, _role, _company, _phone, _city, _country, _pro, _ipi, _publisher)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$func$;

-- Backfill : les contacts sans créateur sont attribués au propriétaire du workspace.
UPDATE contacts c
SET created_by = w.owner_id
FROM workspaces w
WHERE w.id = c.workspace_id AND c.created_by IS NULL AND w.owner_id IS NOT NULL;;
