-- Autofill de contacts (3 août 2026) — règle générale, valable pour tout utilisateur :
--   (A) mes propres contacts (created_by = moi), dans TOUS les workspaces où je suis
--       ENCORE membre -> je retrouve mon carnet partout ;
--   (B) + les contacts du workspace COURANT, quel qu'en soit le créateur -> ce qu'un
--       membre ajoute dans un workspace y reste et profite à tous ses membres.
-- Un invité ne voit donc JAMAIS le carnet privé d'un autre : seulement le sien et ce qui
-- a réellement été ajouté dans le workspace où il se trouve.
-- Si je quitte un workspace, je n'en lis plus rien ; les contacts que j'y ai créés y restent.
CREATE OR REPLACE FUNCTION public.get_contact_suggestions(
  _user_id uuid,
  _workspace_id uuid,
  _query text DEFAULT NULL,
  _limit int DEFAULT 20
)
RETURNS TABLE(
  id uuid, workspace_id uuid, created_by uuid,
  first_name text, last_name text, stage_name text,
  email text, phone text, company text, role text,
  pro text[], ipi text, publisher text,
  city text, country text, notes text, tags text[],
  source text, updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE v_q text;
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT public.is_workspace_member(_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  v_q := nullif(btrim(coalesce(_query,'')), '');

  RETURN QUERY
  WITH visibles AS (
    SELECT c.*,
           CASE WHEN c.workspace_id = _workspace_id THEN 'workspace' ELSE 'mine' END AS src
    FROM contacts c
    WHERE
      -- (B) contacts du workspace courant, tout créateur confondu
      c.workspace_id = _workspace_id
      OR
      -- (A) mes contacts, uniquement dans les workspaces où je suis encore membre
      ( c.created_by = _user_id
        AND EXISTS (SELECT 1 FROM workspace_members wm
                     WHERE wm.workspace_id = c.workspace_id
                       AND wm.user_id = _user_id) )
  ),
  filtres AS (
    SELECT * FROM visibles v
    WHERE v_q IS NULL
       OR v.first_name  ILIKE '%'||v_q||'%'
       OR v.last_name   ILIKE '%'||v_q||'%'
       OR v.stage_name  ILIKE '%'||v_q||'%'
       OR v.email       ILIKE '%'||v_q||'%'
       OR v.company     ILIKE '%'||v_q||'%'
       OR btrim(coalesce(v.first_name,'')||' '||coalesce(v.last_name,'')) ILIKE '%'||v_q||'%'
  ),
  dedoublonne AS (
    SELECT DISTINCT ON (
      coalesce(
        nullif(lower(btrim(f.email)),''),
        lower(btrim(coalesce(f.first_name,'')||'|'||coalesce(f.last_name,'')||'|'||coalesce(f.stage_name,'')))
      )
    ) f.*
    FROM filtres f
    ORDER BY
      coalesce(
        nullif(lower(btrim(f.email)),''),
        lower(btrim(coalesce(f.first_name,'')||'|'||coalesce(f.last_name,'')||'|'||coalesce(f.stage_name,'')))
      ),
      -- la version du workspace courant prime, puis la plus récemment mise à jour
      (f.workspace_id = _workspace_id) DESC,
      f.updated_at DESC NULLS LAST
  )
  SELECT d.id, d.workspace_id, d.created_by,
         d.first_name, d.last_name, d.stage_name,
         d.email, d.phone, d.company, d.role,
         d.pro, d.ipi, d.publisher,
         d.city, d.country, d.notes, d.tags,
         d.src, d.updated_at
  FROM dedoublonne d
  ORDER BY (d.workspace_id = _workspace_id) DESC,
           lower(coalesce(nullif(d.stage_name,''), d.last_name, d.first_name, d.email)) ASC
  LIMIT greatest(coalesce(_limit,20), 1);
END;
$func$;

REVOKE ALL ON FUNCTION public.get_contact_suggestions(uuid, uuid, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contact_suggestions(uuid, uuid, text, int)
  TO authenticated, service_role;;
