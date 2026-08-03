-- Correctif : une même personne présente dans plusieurs workspaces produisait plusieurs
-- lignes (un contact_id par workspace). On dédoublonne par IDENTITÉ (email, à défaut
-- nom complet + stage_name), en privilégiant la fiche du workspace courant.
CREATE OR REPLACE FUNCTION public.resolve_artist_names(
  _user_id uuid, _workspace_id uuid, _names text[]
)
RETURNS TABLE(
  matched_name text, match_source text,
  contact_id uuid, contact_workspace_id uuid,
  first_name text, last_name text, stage_name text,
  email text, phone text, company text, role text,
  pro text[], ipi text, publisher text, city text, country text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_workspace_member(_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  RETURN QUERY
  WITH demandes AS (
    SELECT DISTINCT btrim(n) AS nom
    FROM unnest(coalesce(_names, ARRAY[]::text[])) n
    WHERE btrim(coalesce(n,'')) <> ''
  ),
  ws_visibles AS (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = _user_id
  ),
  alias_visibles AS (
    SELECT a.* FROM artist_aliases a
    WHERE a.workspace_id = _workspace_id
       OR (a.created_by = _user_id AND a.workspace_id IN (SELECT workspace_id FROM ws_visibles))
  ),
  par_alias AS (
    SELECT d.nom AS matched_name, 'alias'::text AS match_source, cid AS contact_id
    FROM demandes d
    JOIN alias_visibles a ON lower(a.alias_name) = lower(d.nom)
    CROSS JOIN LATERAL unnest(a.contact_ids) cid
  ),
  contacts_visibles AS (
    SELECT c.* FROM contacts c
    WHERE c.workspace_id = _workspace_id
       OR (c.created_by = _user_id AND c.workspace_id IN (SELECT workspace_id FROM ws_visibles))
  ),
  par_contact AS (
    SELECT d.nom AS matched_name, 'contact'::text AS match_source, c.id AS contact_id
    FROM demandes d
    JOIN contacts_visibles c
      ON lower(btrim(coalesce(c.stage_name,''))) = lower(d.nom)
      OR lower(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,''))) = lower(d.nom)
    WHERE NOT EXISTS (SELECT 1 FROM par_alias pa WHERE pa.matched_name = d.nom)
  ),
  tout AS (SELECT * FROM par_alias UNION ALL SELECT * FROM par_contact),
  enrichi AS (
    SELECT t.matched_name, t.match_source, c.*,
           (c.workspace_id = _workspace_id) AS local,
           coalesce(
             nullif(lower(btrim(c.email)),''),
             lower(btrim(coalesce(c.first_name,'')||'|'||coalesce(c.last_name,'')||'|'||coalesce(c.stage_name,'')))
           ) AS identite
    FROM tout t JOIN contacts c ON c.id = t.contact_id
  ),
  dedoublonne AS (
    SELECT DISTINCT ON (e.matched_name, e.identite) e.*
    FROM enrichi e
    ORDER BY e.matched_name, e.identite, e.local DESC, e.updated_at DESC NULLS LAST
  )
  SELECT dd.matched_name, dd.match_source,
         dd.id, dd.workspace_id,
         dd.first_name, dd.last_name, dd.stage_name,
         dd.email, dd.phone, dd.company, dd.role,
         dd.pro, dd.ipi, dd.publisher, dd.city, dd.country
  FROM dedoublonne dd
  ORDER BY dd.matched_name, dd.last_name NULLS LAST, dd.first_name NULLS LAST;
END;
$func$;;
