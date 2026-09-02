# TRAKALOG — ISRC Generation (Feature Spec)

> **Created:** May 17, 2026
> **Last Updated:** September 2, 2026 (translated to English)
> **Goal:** One-click automatic ISRC generation for every track, conforming to ISO 3901.
> **Status:** 📋 **Specification — not implemented.** Verified September 2, 2026: `tracks.isrc`
> exists as a manually-entered text column, but there is no `isrc_counters` table, no
> `isrc_country_code` / `isrc_registrant_code` on `workspaces`, and no `generate_isrc` or
> `set_track_isrc_manual` RPC. Everything below is a design, not a description.
> **Priority:** Before public launch — a critical gap against Sound Credit for serious
> labels and producers.

---

## Vision

The ISRC (International Standard Recording Code) is the universal identifier for a sound
recording. Without one, a track cannot be properly tracked by PROs, SoundExchange, the DSPs
(Spotify, Apple Music) or neighbouring-rights services. It is a non-negotiable requirement for
anyone who expects to be paid professionally.

Sound Credit offers it from their $6/month Essential Unlimited plan. **This is industry
table-stakes.**

Trakalog needs to provide:

1. **One-click generation** from TrackDetail
2. **Bulk generation** for existing catalogs
3. **Manual override** — entering an ISRC already assigned elsewhere
4. **Validation** of format and uniqueness

---

## ISRC format (ISO 3901)

```
CC-XXX-YY-NNNNN  (with hyphens, for display)
CCXXXYYNNNNN     (12 characters, no hyphens — storage format)
```

| Segment | Chars | Description | Example |
|---|---|---|---|
| **CC** | 2 | Country code (ISO 3166-1 alpha-2) | `CA` (Canada), `US`, `FR`, `GB` |
| **XXX** | 3 | Registrant code (alphanumeric) | `ABC`, assigned by the national agency |
| **YY** | 2 | Year of reference (last two digits) | `26` for 2026 |
| **NNNNN** | 5 | Designation code (sequential) | `00001`, `00002`, … |

**Full example:** `CA-ABC-26-00001` → the first track registered in 2026 by registrant ABC in
Canada.

---

## Obtaining a registrant code

This is **the main obstacle**. Registrant codes are issued by national agencies:

| Country | Agency | Cost | URL |
|---|---|---|---|
| Canada | Connect Music Licensing | Free | connectmusic.com |
| USA | RIAA / USISRC | Free | usisrc.org |
| France | SCPP | Free for members | scpp.fr |
| UK | PPL | Free for members | ppluk.com |
| Germany | IFPI Germany | Free for members | ifpi.de |
| International | IFPI | Varies | ifpi.org |

### Trakalog's strategy: a hybrid model

**Option A — Trakalog Managed (default, for most users):**
- Trakalog obtains its own registrant code through its Canadian entity → `CA-XXX`
- Trakalog allocates ISRCs sequentially to users
- Every track generated on Free/Starter draws from this pool
- Upside: the user does nothing
- Downside: every track carries the same Trakalog registrant code

**Option B — Bring Your Own Registrant (pros and labels):**
- The user enters their own registrant code in Workspace Settings
- Trakalog uses it to generate that workspace's ISRCs
- Upside: the label keeps its identity in the ISRC
- Downside: requires the user to already hold a code

**Recommended decision — hybrid:**
- Free/Starter → Option A (Trakalog registrant)
- Pro/Business → Option A by default, with the option to add their own registrant code

---

## Database schema

### New columns on `workspaces`

```sql
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS isrc_country_code text DEFAULT 'CA';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS isrc_registrant_code text;
-- NULL = use the default Trakalog registrant code
-- text = the workspace's own registrant code (Pro/Business)
```

### New columns on `tracks`

```sql
-- tracks.isrc (text) already exists — confirmed present.
-- Auxiliary columns for traceability:
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS isrc_generated boolean DEFAULT false;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS isrc_generated_at timestamptz;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS isrc_year integer;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS isrc_designation integer;

-- Index for finding already-assigned ISRCs
CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc) WHERE isrc IS NOT NULL;

-- Global uniqueness constraint
ALTER TABLE tracks ADD CONSTRAINT unique_isrc UNIQUE (isrc);
```

### New table: `isrc_counters`

Tracks the sequential counter per (country, registrant, year) to avoid collisions:

```sql
CREATE TABLE IF NOT EXISTS isrc_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  registrant_code text NOT NULL,
  year integer NOT NULL,
  last_designation integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT unique_counter_per_year UNIQUE (country_code, registrant_code, year)
);

CREATE INDEX idx_isrc_counters_lookup ON isrc_counters(country_code, registrant_code, year);
```

### Supabase environment variables

```
TRAKALOG_ISRC_COUNTRY_CODE=CA
TRAKALOG_ISRC_REGISTRANT_CODE=XXX  # to obtain via Connect Music Licensing
```

---

## RPC — `generate_isrc`

```sql
CREATE OR REPLACE FUNCTION generate_isrc(
  _user_id uuid,
  _track_id uuid,
  _workspace_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_country_code text;
  v_registrant_code text;
  v_year integer;
  v_designation integer;
  v_isrc text;
  v_existing_isrc text;
BEGIN
  -- 1. Check the user has access to the workspace
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND access_level IN ('editor', 'admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 2. Check the track does not already have an ISRC
  SELECT isrc INTO v_existing_isrc FROM tracks WHERE id = _track_id;
  IF v_existing_isrc IS NOT NULL AND v_existing_isrc != '' THEN
    RAISE EXCEPTION 'Track already has an ISRC: %', v_existing_isrc;
  END IF;

  -- 3. Resolve country + registrant (workspace override, else Trakalog default)
  SELECT
    COALESCE(NULLIF(isrc_country_code, ''), 'CA'),
    COALESCE(NULLIF(isrc_registrant_code, ''), current_setting('app.trakalog_isrc_registrant', true))
  INTO v_country_code, v_registrant_code
  FROM workspaces WHERE id = _workspace_id;

  IF v_registrant_code IS NULL THEN
    RAISE EXCEPTION 'No registrant code configured';
  END IF;

  -- 4. Fetch/increment this year's counter
  v_year := EXTRACT(YEAR FROM now())::integer;

  INSERT INTO isrc_counters (country_code, registrant_code, year, last_designation)
  VALUES (v_country_code, v_registrant_code, v_year, 1)
  ON CONFLICT (country_code, registrant_code, year)
  DO UPDATE SET
    last_designation = isrc_counters.last_designation + 1,
    updated_at = now()
  RETURNING last_designation INTO v_designation;

  -- 5. Build the ISRC (no hyphens, 12 chars)
  v_isrc := v_country_code
         || v_registrant_code
         || LPAD((v_year % 100)::text, 2, '0')
         || LPAD(v_designation::text, 5, '0');

  -- 6. Persist on the track
  UPDATE tracks
  SET isrc = v_isrc,
      isrc_generated = true,
      isrc_generated_at = now(),
      isrc_year = v_year,
      isrc_designation = v_designation
  WHERE id = _track_id;

  -- 7. Audit log
  PERFORM write_audit_log(_user_id, _workspace_id, 'track.isrc_generated', 'track', _track_id::text,
    jsonb_build_object('isrc', v_isrc), NULL);

  RETURN v_isrc;
END;
$func$;
```

> **Note when implementing:** the guard block above should be replaced with the project's
> standard helpers — `PERFORM assert_caller(_user_id)` followed by
> `PERFORM require_workspace_access_level(_user_id, _workspace_id, 'editor')` — rather than the
> hand-rolled `EXISTS` checks written here. The `$$` delimiters have also been changed to
> `$func$` per the SQL conventions in CLAUDE.md.

### RPC — `set_track_isrc_manual`

Lets the user enter an existing ISRC by hand:

```sql
CREATE OR REPLACE FUNCTION set_track_isrc_manual(
  _user_id uuid,
  _track_id uuid,
  _workspace_id uuid,
  _isrc text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Format validation (12 chars, alphanumeric)
  IF NOT _isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}$' THEN
    RAISE EXCEPTION 'Invalid ISRC format. Expected: CCXXXYYNNNNN (12 chars)';
  END IF;

  -- Workspace access (Editor/Admin)
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
      AND access_level IN ('editor', 'admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Global uniqueness
  IF EXISTS (SELECT 1 FROM tracks WHERE isrc = _isrc AND id != _track_id) THEN
    RAISE EXCEPTION 'ISRC already used on another track';
  END IF;

  UPDATE tracks
  SET isrc = _isrc,
      isrc_generated = false  -- manual, not generated
  WHERE id = _track_id;
END;
$func$;
```

---

## UX

### TrackDetail — track without an ISRC

```
┌─────────────────────────────────────────────┐
│ Track Metadata                              │
│ ──────────────────────────────              │
│ ISRC: [empty]                               │
│                                             │
│ ┌─────────────────────┐ ┌────────────────┐ │
│ │ ⚡ Generate ISRC    │ │ ✏️ Enter Manual│ │
│ └─────────────────────┘ └────────────────┘ │
└─────────────────────────────────────────────┘
```

### TrackDetail — track with an ISRC

```
┌─────────────────────────────────────────────┐
│ ISRC: CA-TRK-26-00042  ✓ Generated          │
│ 📋 Copy                                      │
└─────────────────────────────────────────────┘
```

### "Enter Manual ISRC" modal

- Input masked as `CC-XXX-YY-NNNNN`
- Real-time format validation
- Tooltip: "If your track already has an ISRC from your label or distributor, enter it here."

### Bulk generation (Workspace Settings)

- Page: Settings → Catalog → Generate ISRCs
- List of tracks without an ISRC, with checkboxes
- "Generate ISRCs for X selected tracks" button
- Progress bar during generation
- Toast: "X ISRCs generated"

### Settings → Workspace → ISRC Configuration (Pro/Business only)

```
ISRC Configuration

Country Code: [CA ▼]
Registrant Code: [_____] (optional)

ℹ️ Leave empty to use Trakalog's default registrant code.
   To use your own, obtain a code from Connect Music Licensing
   (Canada) or your national agency.

[ Save ]
```

---

## Validation and edge cases

### Pre-generation validation
- The track exists and belongs to the workspace
- The user has Editor or Admin permission
- The track has no ISRC yet (or the user confirms an override)
- The workspace has a registrant code configured

### Edge cases
- **Track deleted after generation:** the ISRC stays reserved in `isrc_counters` and is never
  reused — that is the ISO rule.
- **Duplicate ISRC:** the UNIQUE constraint blocks the insert; surface a clear message.
- **Year rollover:** the counter resets automatically each new year.
- **Invalid format on import:** reject, and explain the expected format.

### Policy: no reuse

Once an ISRC is assigned it must **never** be reused on another track, even if the original
track is deleted. That is the ISO 3901 rule. `last_designation` is never decremented.

> ⚠️ **This matters more than the original spec assumed.** `tracks` has **no soft delete** —
> no `is_deleted`, no `deleted_at`. `delete_track` is a hard `DELETE`. So a deleted track takes
> its ISRC row with it, and the only thing preventing reuse is that `isrc_counters` is never
> decremented. That counter is therefore the single source of truth for what has been issued,
> and it must never be reset or "cleaned up".

---

## Displaying the ISRC

### Where it must appear
- TrackDetail (Metadata section)
- Edit Track modal
- Metadata PDF (Trakalog Pack)
- Shared Link Page (Credits section, when visible)
- DDEX/PRO exports — see [DDEX_PRO_EXPORTS.md](DDEX_PRO_EXPORTS.md)
- Stems Pack metadata

### Display format
- **With hyphens** in the UI for readability: `CA-TRK-26-00042`
- **Without hyphens** in storage and exports: `CATRK2600042`
- Helpers: `formatIsrcWithDashes(isrc)`, `stripIsrcDashes(isrc)`

---

## Implementation phases

### Phase 1 — Setup (~1 session)
1. Obtain the Trakalog registrant code via Connect Music Licensing (Canada)
2. Create the DB columns and the `isrc_counters` table
3. Configure the Supabase environment variables
4. `generate_isrc` and `set_track_isrc_manual` RPCs

### Phase 2 — TrackDetail UX (~1 session)
5. "Generate ISRC" button on TrackDetail
6. "Enter Manual ISRC" modal
7. Hyphenated display + Copy button
8. Frontend format validation

### Phase 3 — Bulk + configuration (~1 session)
9. Bulk generation in Workspace Settings
10. Custom registrant code configuration (Pro/Business)
11. ISRC display in the Metadata PDF, exports and shared links

### Phase 4 — Polish (~0.5 session)
12. Detailed audit logs
13. Unit tests on the format
14. User documentation (Trakalog Guide)

**Estimated total: 3-4 Claude Code sessions.**

---

## Costs

| Item | Cost |
|---|---|
| Obtaining the registrant code (Connect Music Licensing) | Free |
| Annual maintenance | Free (Canada) |
| DB counter (one row per registrant/year) | Negligible |
| **Total** | **$0** |

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Registrant code not obtained in time | Approach Connect Music Licensing **before** launch — the process takes ~2-4 weeks |
| User assigns an ISRC already used elsewhere | UNIQUE constraint in the DB + validation before insert |
| Confusion over the format (with/without hyphens) | Consistent formatting helpers everywhere |
| A Pro user wants their own registrant code but has none | Explicit UI: "Leave empty to use Trakalog's default" |
| Track deleted, then its ISRC accidentally reused | The counter is never decremented. Note this is the *only* protection — tracks are hard-deleted, so the `tracks` row is gone |

---

## Integration with DDEX/PRO exports

An ISRC is **mandatory** for most exports:

- **SoundExchange:** required
- **The MLC:** strongly recommended
- **DDEX ERN:** required
- **DDEX RIN:** required
- **BMI/ASCAP/SOCAN:** ISRC for recordings (ISWC for compositions)

**Consequence:** before exporting to these services, verify every selected track has an ISRC.
Otherwise offer "Generate ISRCs for X tracks now?".

---

## Dependencies

- **Canadian corporate entity** ✅ exists
- **Connect Music Licensing account** ⏳ to create
- **Trakalog registrant code** ⏳ to obtain, ~2-4 weeks
- **Tracks table & RPCs** ✅ in place

---

## Reference standards

- **ISO 3901:2019** — Information and documentation — International Standard Recording Code (ISRC)
- **IFPI ISRC Handbook 2021** — ifpi.org/wp-content/uploads/2021/02/ISRC_Handbook.pdf

---

*This document is living, and will be updated as development proceeds.*
