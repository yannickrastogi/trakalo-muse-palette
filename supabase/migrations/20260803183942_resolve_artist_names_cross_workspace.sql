-- Résolution d'un ou plusieurs noms d'artistes (lus dans un titre de fichier) vers des
-- contacts, pour pré-remplir splits et crédits à l'upload.
-- Même règle de portée que get_contact_suggestions :
--   (A) mes alias/contacts, dans tous les workspaces où je suis ENCORE membre
--   (B) + ceux du workspace COURANT, quel qu'en soit le créateur
-- Ordre de résolution : alias d'abord, puis repli direct sur les contacts
-- (stage_name ou nom complet) si aucun alias ne correspond.
CREATE OR REPLACE FUNCTION public.resolve_artist_names(
  _user_id uuid,
  _workspace_id uuid,
  _names text[]
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
  -- (A) alias visibles : ceux du workspace courant + les miens ailleurs
  alias_visibles AS (
    SELECT a.* FROM artist_aliases a
    WHERE a.workspace_id = _workspace_id
       OR (a.created_by = _user_id AND a.workspace_id IN (SELECT workspace_id FROM ws_visibles))
  ),
  par_alias AS (
    SELECT d.nom AS matched_name, 'alias'::text AS match_source, cid AS contact_id,
           (a.workspace_id = _workspace_id) AS local
    FROM demandes d
    JOIN alias_visibles a ON lower(a.alias_name) = lower(d.nom)
    CROSS JOIN LATERAL unnest(a.contact_ids) cid
  ),
  -- (B) repli : contacts visibles dont le stage_name ou le nom complet correspond
  contacts_visibles AS (
    SELECT c.* FROM contacts c
    WHERE c.workspace_id = _workspace_id
       OR (c.created_by = _user_id AND c.workspace_id IN (SELECT workspace_id FROM ws_visibles))
  ),
  par_contact AS (
    SELECT d.nom AS matched_name, 'contact'::text AS match_source, c.id AS contact_id,
           (c.workspace_id = _workspace_id) AS local
    FROM demandes d
    JOIN contacts_visibles c
      ON lower(btrim(coalesce(c.stage_name,''))) = lower(d.nom)
      OR lower(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,''))) = lower(d.nom)
    WHERE NOT EXISTS (SELECT 1 FROM par_alias pa WHERE pa.matched_name = d.nom)
  ),
  tout AS (
    SELECT * FROM par_alias UNION ALL SELECT * FROM par_contact
  ),
  dedoublonne AS (
    SELECT DISTINCT ON (t.matched_name, t.contact_id) t.*
    FROM tout t ORDER BY t.matched_name, t.contact_id, t.local DESC
  )
  SELECT dd.matched_name, dd.match_source,
         c.id, c.workspace_id,
         c.first_name, c.last_name, c.stage_name,
         c.email, c.phone, c.company, c.role,
         c.pro, c.ipi, c.publisher, c.city, c.country
  FROM dedoublonne dd
  JOIN contacts c ON c.id = dd.contact_id
  ORDER BY dd.matched_name, c.last_name NULLS LAST, c.first_name NULLS LAST;
END;
$func$;

REVOKE ALL ON FUNCTION public.resolve_artist_names(uuid, uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_artist_names(uuid, uuid, text[])
  TO authenticated, service_role;;
