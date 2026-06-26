# CONTACTS — Dédup + verrouillage + bulk delete (SQL manuel)

> ⚠️ **À exécuter MANUELLEMENT dans Supabase SQL Editor, dans l'ordre.**
> Ne rien auto-exécuter. Valider chaque étape avant la suivante.
> Projet : `xhmeitivkclbeziqavxw`

---

## ÉTAPE 1 — Prévisualisation (SELECT only — rien supprimé)

Compte les doublons **sans email** (même first/last name, insensible casse) par workspace.

```sql
WITH grp AS (
  SELECT
    id, workspace_id,
    lower(btrim(coalesce(first_name,''))) || '|' || lower(btrim(coalesce(last_name,''))) AS name_key,
    row_number() OVER (
      PARTITION BY workspace_id,
        lower(btrim(coalesce(first_name,''))),
        lower(btrim(coalesce(last_name,'')))
      ORDER BY created_at ASC
    ) AS rn
  FROM contacts
  WHERE coalesce(btrim(email),'') = ''
),
losers AS (SELECT id AS loser_id FROM grp WHERE rn > 1)
SELECT COUNT(*) AS rows_to_delete FROM losers;
-- Attendu : ~111
```

> ℹ️ Optionnel — prévisualiser aussi les doublons **avec email** (même workspace + même email lowercased) :
> ```sql
> SELECT workspace_id, lower(btrim(email)) AS email_key, COUNT(*) AS n
> FROM contacts
> WHERE coalesce(btrim(email),'') <> ''
> GROUP BY workspace_id, lower(btrim(email))
> HAVING COUNT(*) > 1
> ORDER BY n DESC;
> ```
> Si des doublons email existent, dédupliquer aussi avant ÉTAPE 4 (sinon l'index unique email échoue). Adapter le pattern des étapes 2/3 avec `name_key` → `lower(btrim(email))` et `WHERE coalesce(btrim(email),'') <> ''`.

---

## ÉTAPE 2 — Remap `artist_aliases.contact_ids` (loser → survivor)

Avant suppression, repointer les références des doublons vers le contact conservé (le plus ancien).

```sql
WITH grp AS (
  SELECT
    id, workspace_id,
    lower(btrim(coalesce(first_name,''))) || '|' || lower(btrim(coalesce(last_name,''))) AS name_key,
    row_number() OVER (
      PARTITION BY workspace_id,
        lower(btrim(coalesce(first_name,''))),
        lower(btrim(coalesce(last_name,'')))
      ORDER BY created_at ASC
    ) AS rn
  FROM contacts
  WHERE coalesce(btrim(email),'') = ''
),
survivor AS (SELECT workspace_id, name_key, id AS keep_id FROM grp WHERE rn = 1),
losers AS (
  SELECT g.id AS loser_id, s.keep_id
  FROM grp g
  JOIN survivor s ON s.workspace_id = g.workspace_id AND s.name_key = g.name_key
  WHERE g.rn > 1
)
UPDATE artist_aliases aa
SET contact_ids = (
  SELECT array_agg(CASE WHEN cid = l.loser_id THEN l.keep_id ELSE cid END)
  FROM unnest(aa.contact_ids) AS cid
  LEFT JOIN losers l ON l.loser_id = cid
)
FROM losers l
WHERE l.loser_id = ANY(aa.contact_ids);
```

---

## ÉTAPE 3 — Supprimer les doublons

```sql
WITH grp AS (
  SELECT
    id, workspace_id,
    lower(btrim(coalesce(first_name,''))) || '|' || lower(btrim(coalesce(last_name,''))) AS name_key,
    row_number() OVER (
      PARTITION BY workspace_id,
        lower(btrim(coalesce(first_name,''))),
        lower(btrim(coalesce(last_name,'')))
      ORDER BY created_at ASC
    ) AS rn
  FROM contacts
  WHERE coalesce(btrim(email),'') = ''
)
DELETE FROM contacts WHERE id IN (SELECT id FROM grp WHERE rn > 1);
```

---

## ÉTAPE 4 — Index uniques (après nettoyage)

```sql
-- Unicité par email (insensible casse), uniquement quand email non vide
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_ws_email
  ON public.contacts (workspace_id, lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';

-- Unicité par nom (insensible casse), uniquement quand email vide
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_ws_name_noemail
  ON public.contacts (workspace_id, lower(first_name), lower(coalesce(last_name,'')))
  WHERE email IS NULL OR btrim(email) = '';
```

> Si l'une des deux créations échoue → c'est qu'il reste des doublons. Revenir à l'ÉTAPE 1 (et la variante email) pour les nettoyer, puis relancer.

---

## ÉTAPE 5 — `upsert_contact` atomique (INSERT ... ON CONFLICT)

> ⚠️ `CREATE OR REPLACE` avec une signature différente crée un **doublon** de fonction.
> On DROP d'abord toutes les surcharges connues, puis on recrée.

```sql
-- Drop des surcharges existantes (ajouter/retirer selon ce que `\df upsert_contact` retourne)
DROP FUNCTION IF EXISTS public.upsert_contact(uuid, uuid, text, text, text, text, text, text, text[], text, text);
DROP FUNCTION IF EXISTS public.upsert_contact(uuid, uuid, text, text, text, text, text, text, text, text, text[], text, text);
DROP FUNCTION IF EXISTS public.upsert_contact(uuid, uuid, text, text, text, text, text, text, text, text, text, text[], text, text);
-- Vérifier qu'il ne reste aucune surcharge avant de recréer :
--   SELECT oid::regprocedure FROM pg_proc WHERE proname = 'upsert_contact';

CREATE OR REPLACE FUNCTION upsert_contact(
  _user_id uuid,
  _workspace_id uuid,
  _first_name text,
  _last_name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _stage_name text DEFAULT NULL,
  _role text DEFAULT NULL,
  _company text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _city text DEFAULT NULL,
  _country text DEFAULT NULL,
  _pro text[] DEFAULT NULL,
  _ipi text DEFAULT NULL,
  _publisher text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $func$
DECLARE
  _id uuid;
  _norm_email text := NULLIF(lower(btrim(coalesce(_email,''))), '');
BEGIN
  -- Autorisation : membre du workspace
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF _norm_email IS NOT NULL THEN
    -- Upsert par email (atomique)
    INSERT INTO contacts (
      workspace_id, first_name, last_name, email, stage_name,
      role, company, phone, city, country, pro, ipi, publisher, created_by
    ) VALUES (
      _workspace_id, _first_name, _last_name, _norm_email, _stage_name,
      _role, _company, _phone, _city, _country, _pro, _ipi, _publisher, _user_id
    )
    ON CONFLICT (workspace_id, lower(email))
    WHERE email IS NOT NULL AND btrim(email) <> ''
    DO UPDATE SET
      first_name = CASE WHEN EXCLUDED.first_name IS NOT NULL AND EXCLUDED.first_name <> '' THEN EXCLUDED.first_name ELSE contacts.first_name END,
      last_name  = COALESCE(EXCLUDED.last_name, contacts.last_name),
      stage_name = COALESCE(EXCLUDED.stage_name, contacts.stage_name),
      role       = COALESCE(EXCLUDED.role, contacts.role),
      company    = COALESCE(EXCLUDED.company, contacts.company),
      phone      = COALESCE(EXCLUDED.phone, contacts.phone),
      city       = COALESCE(EXCLUDED.city, contacts.city),
      country    = COALESCE(EXCLUDED.country, contacts.country),
      pro        = COALESCE(EXCLUDED.pro, contacts.pro),
      ipi        = COALESCE(EXCLUDED.ipi, contacts.ipi),
      publisher  = COALESCE(EXCLUDED.publisher, contacts.publisher),
      updated_at = now()
    RETURNING id INTO _id;
  ELSE
    -- Upsert par nom (sans email, atomique)
    INSERT INTO contacts (
      workspace_id, first_name, last_name, stage_name,
      role, company, phone, city, country, pro, ipi, publisher, created_by
    ) VALUES (
      _workspace_id, _first_name, _last_name, _stage_name,
      _role, _company, _phone, _city, _country, _pro, _ipi, _publisher, _user_id
    )
    ON CONFLICT (workspace_id, lower(first_name), lower(coalesce(last_name,'')))
    WHERE email IS NULL OR btrim(email) = ''
    DO UPDATE SET
      stage_name = COALESCE(EXCLUDED.stage_name, contacts.stage_name),
      role       = COALESCE(EXCLUDED.role, contacts.role),
      company    = COALESCE(EXCLUDED.company, contacts.company),
      phone      = COALESCE(EXCLUDED.phone, contacts.phone),
      city       = COALESCE(EXCLUDED.city, contacts.city),
      country    = COALESCE(EXCLUDED.country, contacts.country),
      pro        = COALESCE(EXCLUDED.pro, contacts.pro),
      ipi        = COALESCE(EXCLUDED.ipi, contacts.ipi),
      publisher  = COALESCE(EXCLUDED.publisher, contacts.publisher),
      updated_at = now()
    RETURNING id INTO _id;
  END IF;

  RETURN _id;
END;
$func$;
```

> ⚠️ Le front (`ContactsContext.tsx`) appelle `upsert_contact` avec les paramètres **nommés** :
> `_user_id, _workspace_id, _first_name, _last_name, _email, _role, _company, _phone, _pro, _ipi, _publisher`.
> Tous les autres (`_stage_name, _city, _country`) ont un DEFAULT → l'appel reste compatible.

---

## ÉTAPE 6 — RPC `delete_contacts` (bulk delete)

```sql
CREATE OR REPLACE FUNCTION delete_contacts(
  _user_id uuid,
  _workspace_id uuid,
  _ids uuid[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $func$
BEGIN
  -- Autorisation : editor ou admin du workspace
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND access_level IN ('editor', 'admin')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  DELETE FROM contacts
  WHERE id = ANY(_ids)
    AND workspace_id = _workspace_id;
END;
$func$;
```

> Le front (`Contacts.tsx`) appelle :
> ```
> supabase.rpc('delete_contacts', { _user_id, _workspace_id, _ids })
> ```

---

## Récapitulatif d'exécution

1. **ÉTAPE 1** — preview (vérifier ~111) ✅
2. **ÉTAPE 2** — remap artist_aliases ✅
3. **ÉTAPE 3** — DELETE doublons ✅
4. **ÉTAPE 4** — index uniques ✅
5. **ÉTAPE 5** — `upsert_contact` atomique (DROP puis CREATE) ✅
6. **ÉTAPE 6** — `delete_contacts` bulk ✅

Après SQL → l'UI multi-select et la dédup atomique sont opérationnelles.
