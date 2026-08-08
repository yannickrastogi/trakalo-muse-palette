# CONTACTS — Dedup + locking + bulk delete (manual SQL)

> ⚠️ **Execute MANUALLY in Supabase SQL Editor, in order.**
> Do not auto-execute. Validate each step before proceeding.
> Project: `xhmeitivkclbeziqavxw`

---

## STEP 1 — Preview (SELECT only — nothing deleted)

Counts duplicates **without email** (same first/last name, case-insensitive) per workspace.

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
-- Expected: ~111
```

> ℹ️ Optional — also preview duplicates **with email** (same workspace + same email lowercased):
> ```sql
> SELECT workspace_id, lower(btrim(email)) AS email_key, COUNT(*) AS n
> FROM contacts
> WHERE coalesce(btrim(email),'') <> ''
> GROUP BY workspace_id, lower(btrim(email))
> HAVING COUNT(*) > 1
> ORDER BY n DESC;
> ```
> If email duplicates exist, deduplicate before STEP 4 (otherwise the unique email index fails). Adapt the pattern from steps 2/3 with `name_key` → `lower(btrim(email))` and `WHERE coalesce(btrim(email),'') <> ''`.

---

## STEP 2 — Remap `artist_aliases.contact_ids` (loser → survivor)

Before deletion, repoint references from duplicates to the contact kept (the oldest).

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

## STEP 3 — Delete duplicates

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

## STEP 4 — Unique indexes (after cleanup)

```sql
-- Uniqueness by email (case-insensitive), only when email is not empty
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_ws_email
  ON public.contacts (workspace_id, lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';

-- Uniqueness by name (case-insensitive), only when email is empty
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_ws_name_noemail
  ON public.contacts (workspace_id, lower(first_name), lower(coalesce(last_name,'')))
  WHERE email IS NULL OR btrim(email) = '';
```

> If either creation fails → there are still duplicates. Go back to STEP 1 (and the email variant) to clean them, then retry.

---

## STEP 5 — `upsert_contact` atomic (INSERT ... ON CONFLICT)

> ⚠️ `CREATE OR REPLACE` with a different signature creates a **duplicate** function.
> We DROP first all known overloads, then recreate.

```sql
-- Drop existing overloads (add/remove based on what `\df upsert_contact` returns)
DROP FUNCTION IF EXISTS public.upsert_contact(uuid, uuid, text, text, text, text, text, text, text[], text, text);
DROP FUNCTION IF EXISTS public.upsert_contact(uuid, uuid, text, text, text, text, text, text, text, text, text[], text, text);
DROP FUNCTION IF EXISTS public.upsert_contact(uuid, uuid, text, text, text, text, text, text, text, text, text, text[], text, text);
-- Verify no overloads remain before recreating:
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
  -- Authorization: workspace member
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF _norm_email IS NOT NULL THEN
    -- Upsert by email (atomic)
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
    -- Upsert by name (no email, atomic)
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

> ⚠️ The frontend (`ContactsContext.tsx`) calls `upsert_contact` with **named** parameters:
> `_user_id, _workspace_id, _first_name, _last_name, _email, _role, _company, _phone, _pro, _ipi, _publisher`.
> All others (`_stage_name, _city, _country`) have a DEFAULT → the call remains compatible.

---

## STEP 6 — RPC `delete_contacts` (bulk delete)

```sql
CREATE OR REPLACE FUNCTION delete_contacts(
  _user_id uuid,
  _workspace_id uuid,
  _ids uuid[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $func$
BEGIN
  -- Authorization: editor or admin of the workspace
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

> The frontend (`Contacts.tsx`) calls:
> ```
> supabase.rpc('delete_contacts', { _user_id, _workspace_id, _ids })
> ```

---

## Execution Summary

1. **STEP 1** — preview (verify ~111) ✅
2. **STEP 2** — remap artist_aliases ✅
3. **STEP 3** — DELETE duplicates ✅
4. **STEP 4** — unique indexes ✅
5. **STEP 5** — `upsert_contact` atomic (DROP then CREATE) ✅
6. **STEP 6** — `delete_contacts` bulk ✅

After SQL → the UI multi-select and atomic dedup are operational.