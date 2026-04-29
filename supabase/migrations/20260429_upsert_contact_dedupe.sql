-- Fix: upsert_contact creates duplicates when called multiple times for the
-- same person from the splits flow. The previous version unconditionally
-- inserted a new row when no email was supplied (NULL ≠ NULL in unique
-- constraints), so each save produced a fresh "Yannick Rastogi" contact.
--
-- This rewrite:
--   1. Looks up an existing contact by (workspace_id, lower(email)) when an
--      email is provided.
--   2. Falls back to (workspace_id, lower(first_name), lower(coalesce(last_name,'')))
--      when no email is given — the only identity available from the splits
--      flow today.
--   3. UPDATES the existing row using COALESCE/NULLIF so non-empty new values
--      win but blank inputs never wipe out previously stored data.
--   4. Only INSERTs when no match is found.

CREATE OR REPLACE FUNCTION public.upsert_contact(
  _user_id uuid,
  _workspace_id uuid,
  _first_name text,
  _last_name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _role text DEFAULT NULL,
  _stage_name text DEFAULT NULL,
  _company text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _pro text[] DEFAULT NULL,
  _ipi text DEFAULT NULL,
  _publisher text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_email_norm  text := NULLIF(btrim(lower(_email)), '');
  v_first_norm  text := lower(coalesce(btrim(_first_name), ''));
  v_last_norm   text := lower(coalesce(btrim(_last_name), ''));
BEGIN
  -- Permission check: caller must belong to the workspace
  IF NOT EXISTS (
    SELECT 1
    FROM workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'User % is not a member of workspace %', _user_id, _workspace_id;
  END IF;

  IF v_first_norm = '' AND v_email_norm IS NULL THEN
    RAISE EXCEPTION 'Either first_name or email is required';
  END IF;

  -- 1. Try matching by email first (case-insensitive)
  IF v_email_norm IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM contacts
    WHERE workspace_id = _workspace_id
      AND email IS NOT NULL
      AND lower(btrim(email)) = v_email_norm
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- 2. Fallback: match by name when no email match was found
  IF v_existing_id IS NULL THEN
    SELECT id INTO v_existing_id
    FROM contacts
    WHERE workspace_id = _workspace_id
      AND lower(coalesce(btrim(first_name), '')) = v_first_norm
      AND lower(coalesce(btrim(last_name), ''))  = v_last_norm
      AND (
        -- if input has no email, only match rows that also have no email
        v_email_norm IS NOT NULL
        OR email IS NULL
        OR btrim(email) = ''
      )
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    -- UPDATE: never overwrite an existing value with NULL/empty
    UPDATE contacts
    SET
      first_name = COALESCE(NULLIF(btrim(_first_name), ''), first_name),
      last_name  = COALESCE(NULLIF(btrim(_last_name), ''),  last_name),
      email      = COALESCE(NULLIF(btrim(_email), ''),      email),
      phone      = COALESCE(NULLIF(btrim(_phone), ''),      phone),
      role       = COALESCE(NULLIF(btrim(_role), ''),       role),
      stage_name = COALESCE(NULLIF(btrim(_stage_name), ''), stage_name),
      company    = COALESCE(NULLIF(btrim(_company), ''),    company),
      pro        = COALESCE(
                     CASE WHEN _pro IS NULL OR array_length(_pro, 1) IS NULL THEN NULL ELSE _pro END,
                     pro
                   ),
      ipi        = COALESCE(NULLIF(btrim(_ipi), ''),        ipi),
      publisher  = COALESCE(NULLIF(btrim(_publisher), ''),  publisher),
      updated_at = now()
    WHERE id = v_existing_id;

    RETURN v_existing_id;
  END IF;

  -- 3. INSERT new contact
  INSERT INTO contacts (
    workspace_id, first_name, last_name, email, phone,
    role, stage_name, company, pro, ipi, publisher,
    created_by, created_at, updated_at
  )
  VALUES (
    _workspace_id,
    NULLIF(btrim(_first_name), ''),
    NULLIF(btrim(_last_name), ''),
    NULLIF(btrim(_email), ''),
    NULLIF(btrim(_phone), ''),
    NULLIF(btrim(_role), ''),
    NULLIF(btrim(_stage_name), ''),
    NULLIF(btrim(_company), ''),
    CASE WHEN _pro IS NULL OR array_length(_pro, 1) IS NULL THEN NULL ELSE _pro END,
    NULLIF(btrim(_ipi), ''),
    NULLIF(btrim(_publisher), ''),
    _user_id,
    now(),
    now()
  )
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_contact(
  uuid, uuid, text, text, text, text, text, text, text, text[], text, text
) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- One-off cleanup: merge existing duplicates by (workspace_id, lower(email))
-- Keeps the oldest contact, deletes the rest. Skips rows without an email
-- (different people may share a name — manual review required for those).
-- ─────────────────────────────────────────────────────────────────────

WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, lower(btrim(email))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM contacts
  WHERE email IS NOT NULL AND btrim(email) <> ''
)
DELETE FROM contacts
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
