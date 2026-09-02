# TRAKALOG — DDEX & PRO Exports (Feature Spec)

> **Created:** May 17, 2026
> **Last Updated:** September 2, 2026 (translated to English)
> **Goal:** Export Trakalog metadata to industry-standard formats (PROs, neighbouring rights,
> mechanical, DDEX) so royalties can be declared and collected.
> **Status:** 📋 **Specification — not implemented.** Verified September 2, 2026: no
> `export_history` or `iswc_counters` table, no `export-pro-format` Edge Function, and none of
> the proposed `tracks` columns beyond `iswc` exist.
> **Priority:** Before public launch — at minimum Priority 1.
> **Depends on:** [ISRC_GENERATION.md](ISRC_GENERATION.md)

---

## Vision

Without industry export, Trakalog stays a storage and pitching tool. To become **the nervous
system of the catalog**, Trakalog's data has to feed the organisations that actually collect
the money:

- **PROs** (BMI, ASCAP, SOCAN, SACEM…) for performance rights → **songwriters and composers**
- **Neighbouring Rights** (SoundExchange, PPL, ADAMI…) for performers and master owners
- **Mechanical** (The MLC, MRP…) for mechanical rights (streaming, downloads)
- **DDEX** for technical exchange with distributors and DSPs

Sound Credit supports 28 formats. Trakalog must cover at least the **5 priority formats** to
avoid losing serious labels and producers.

---

## The three rights families

| Family | Covers | Identifier | Key societies |
|---|---|---|---|
| **Performing Rights** | Songwriters & composers (the song) | ISWC | BMI, ASCAP, SOCAN, SACEM, PRS |
| **Neighbouring Rights** | Performers & master owners (the recording) | ISRC | SoundExchange, PPL, ADAMI, SCPP |
| **Mechanical Rights** | Reproduction (streaming + downloads) | ISWC + ISRC | The MLC (US), MRP, MCPS |

**Consequence for Trakalog:** every track needs both an ISRC (recording) and an ISWC
(composition) to be fully declarable.

---

## Formats — prioritisation

### Priority 1 — Launch (must have)

| Format | Type | Coverage | File format |
|---|---|---|---|
| **BMI Works Registration** | Performing | USA | CSV or XML |
| **ASCAP Works Registration (ACE)** | Performing | USA | CSV |
| **SOCAN Works Registration** | Performing | Canada | CSV |
| **SoundExchange ISRC Repertoire** | Neighbouring | USA | CSV |
| **The MLC Bulk Upload** | Mechanical | USA | CSV |

These five cover **80% of US/Canadian users' needs** — the bulk of the target market.

### Priority 2 — Post-launch (3 months later)

| Format | Type | Coverage |
|---|---|---|
| **DDEX RIN** | Session data | International (DDEX standard) |
| **PPL Repertoire** | Neighbouring | UK |
| **SACEM Declaration** | Performing | France |
| **SESAC Works** | Performing | USA |
| **Generic Split Sheet PDF** | Legal | International |

### Priority 3 — Enterprise (6 months+, Business plan)

| Format | Type | Coverage |
|---|---|---|
| **DDEX ERN** | Distribution | International (Spotify/Apple deliveries) |
| **GEMA** | Performing | Germany |
| **JASRAC** | Performing | Japan |
| **SUISA** | Performing | Switzerland |
| **Warner Music Label Copy** | Label | Custom |
| **The Orchard Metadata** | Distribution | Custom |
| **AllMusic Metadata** | Discovery | Custom |

---

## Required data, and Trakalog's current state

### Identifiers

| Field | Description | Trakalog status |
|---|---|---|
| **ISRC** | Recording ID | ⚠️ `tracks.isrc` exists but is **manual entry only** — generation is specified, not built ([ISRC_GENERATION.md](ISRC_GENERATION.md)) |
| **ISWC** | Composition ID | ✅ `tracks.iswc` column **already exists** in the baseline — manual entry, no generation |
| **IPI/CAE** | Composer/publisher ID | ✅ in the `splits` jsonb entries, and `contacts.ipi` |
| **IPN** | Performer ID | ❌ to add (rare, optional) |
| **ISNI** | Creator ID | ❌ to add (future) |

### Track metadata (already in the database)

| Field | Trakalog source |
|---|---|
| Title | `tracks.title` |
| Artist | `tracks.artist` |
| Featured artists | `tracks.featuring` |
| Duration | `tracks.duration_sec` |
| Genre | `tracks.genre` (**`text[]`** — flatten before writing to a single CSV cell) |
| Language | `tracks.language` |
| Release date | **`tracks.released_at`** (not `release_date`) |
| Album | `tracks.album` |
| Label | `tracks.labels[]` |
| Publisher | `tracks.publishers[]` |
| Explicit | `tracks.explicit` |
| Copyright | `tracks.copyright` |

### Credits and splits (already in the database)

`tracks.splits` is a **jsonb array**, not a table. Each entry carries a `roles[]` array — with a
retro-compatible `role` comma-string — and a `pros[]` array, likewise retro-compatible.

| Field | Source |
|---|---|
| Songwriter | a `splits` entry with role `Songwriter` |
| Producer | a `splits` entry with role `Producer` |
| Performer | a `splits` entry with role `Artist` |
| Musician | a `splits` entry with role `Musician` |
| PRO membership | `splits[].pros[]` |
| IPI | `splits[].ipi` |
| Publisher | `splits[].publisher` |
| Share % | `splits[].share` |
| Stage name | `splits[].stage_name` |

> **Export builders must handle both shapes** — the `roles[]` array *and* the legacy `role`
> comma-string, and within `roles`, both plain strings and `{ role: "..." }` objects. A builder
> that reads only one shape will silently drop credits on older tracks.

### What is missing

- **Master ownership** — who owns the master, often not the songwriter
- **Release territory** — for geo-specific exports
- **Recording date & studio** — for DDEX RIN
- **Recording engineer** — for DDEX RIN; partially available through Mix/Mastering Engineer
  splits

---

## Database additions

### Columns on `tracks`

```sql
-- tracks.iswc ALREADY EXISTS in the baseline — do not re-add it.
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS recording_date date;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS recording_location text;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS master_owner text;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS p_line text;  -- ℗ 2026 …
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS c_line text;  -- © 2026 …
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS release_territory text DEFAULT 'WW';

CREATE INDEX IF NOT EXISTS idx_tracks_iswc ON tracks(iswc) WHERE iswc IS NOT NULL;
```

### New table: `export_history`

Tracks every export, for audit and to avoid duplicate submissions:

```sql
CREATE TABLE IF NOT EXISTS export_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id),
  user_id uuid REFERENCES auth.users(id),
  export_type text NOT NULL,  -- 'bmi_works', 'ascap_ace', 'socan', 'soundexchange', 'mlc', 'ddex_rin'
  track_ids uuid[] NOT NULL,
  file_path text,             -- storage path, if the file is retained
  file_format text,           -- 'csv', 'xml', 'xlsx'
  track_count integer NOT NULL,
  status text DEFAULT 'completed',  -- completed, failed
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_export_history_workspace ON export_history(workspace_id, created_at DESC);
```

### New table: `iswc_counters`

Only if Trakalog ever generates ISWCs:

```sql
-- ISWC format: T-XXX.XXX.XXX-C
-- T   = constant
-- XXX.XXX.XXX = 9-digit sequence
-- C   = check digit (modulo 10)

CREATE TABLE IF NOT EXISTS iswc_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_code text NOT NULL,  -- assigned by CISAC
  last_sequence bigint NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
```

**ISWC note:** unlike the ISRC, an ISWC is assigned by the PRO (BMI, ASCAP, SOCAN) when the work
is registered — not by the rights holder. **Trakalog cannot generate ISWCs on its own.** The
user enters it after registration, or Trakalog facilitates registration and retrieves the ISWC.

**Recommended decision:** Phase 1 = manual ISWC storage, using the `tracks.iswc` column that
already exists. Phase 2 (future) = ASCAP/BMI API integration for automatic retrieval.

---

## Export format specifications (Priority 1)

### 1. BMI Works Registration

**Format:** CSV · **Encoding:** UTF-8 · **Delimiter:** comma · **Quoting:** double quotes for
fields containing commas

```csv
Work Title,Alternate Title,ISWC,Duration,Performer,Writer Name,Writer IPI,Writer Role,Writer Share %,Publisher Name,Publisher IPI,Publisher Share %,Recording Artist,ISRC,Release Date
```

Example:

```csv
"Naughty Gyal","","",212,"Arjun K.","Writer Name","00123456789","Composer/Author",50.00,"Publishing Co","00987654321",50.00,"Arjun K. x Ayu Shy","CATRK2600042","2026-06-01"
```

**Rules:**
- One row per writer — several rows per track when there are several writers
- Writer Share % must total 100 per track
- ISWC optional on first registration
- IPI mandatory for each writer
- Writer Role: "Composer/Author" for a songwriter, "Composer" for an instrumental composer

### 2. ASCAP Works Registration (ACE)

**Format:** CSV · **Encoding:** UTF-8

```csv
Title,Duration,Writers,Writer IPIs,Writer Shares,Publishers,Publisher IPIs,Publisher Shares,ISWC,ISRC,Performer,Album,Release Date
```

**Difference from BMI:** one row per track, with writers separated by a pipe `|`.

```csv
"Naughty Gyal",212,"Writer A|Writer B","00123456789|00111222333",50.00|50.00,"Publishing Co","00987654321",100.00,,"CATRK2600042","Arjun K.","Album Name","2026-06-01"
```

### 3. SOCAN Works Registration

**Format:** CSV · **Encoding:** UTF-8

```csv
Title,Duration,Writer Name,Writer IPI,Writer Affiliation,Writer Share,Publisher Name,Publisher IPI,Publisher Affiliation,Publisher Share,ISWC,Performer
```

**Rules:**
- Affiliation = SOCAN, BMI, ASCAP, etc., per each writer's membership — read from
  `splits[].pros[]`
- Multi-writer = multiple rows
- For Canadians: Affiliation = "SOCAN"

### 4. SoundExchange ISRC Repertoire

**Format:** CSV · **Encoding:** UTF-8

Covers performers and master owners for digital performance revenue (Pandora, SiriusXM,
webcasts).

```csv
ISRC,Title,Featured Artist,Label,P-Line,Release Year,Master Owner,Master Owner IPN,Performer Name,Performer Role,Performer Share %
```

**Rules:**
- ISRC **mandatory** — submissions without one are rejected
- Performer Role: "Featured Artist" or "Non-Featured Artist" (background vocals, session
  musicians)
- Featured artists: 45% of the master by default
- Non-featured: 5%
- Master Owner: 50%, usually the label or the lead artist

### 5. The MLC Bulk Upload

**Format:** CSV (DDEX-aligned) · **Encoding:** UTF-8

Covers US mechanical royalties (streaming + downloads).

```csv
Musical Work Title,Alternative Title,ISWC,Songwriter Name,Songwriter IPI,Songwriter Role,Songwriter Share,Publisher Name,Publisher IPI,Publisher Share,Sound Recording Title,ISRC,Recording Artist,Duration,Album,Release Date,P-Line,Label
```

**Note:** The MLC also accepts the DDEX Musical Works Portfolio Notification (MWPN) — a fuller
XML standard.

---

## Edge Function: `export-pro-format`

```typescript
// supabase/functions/export-pro-format/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ExportRequest {
  workspace_id: string;
  track_ids: string[];
  format: 'bmi' | 'ascap' | 'socan' | 'soundexchange' | 'mlc';
  user_id: string;
}

serve(async (req) => {
  // ... CORS, origin check, auth, rate limiting, UUID validation

  const { workspace_id, track_ids, format, user_id } = await req.json();

  // 1. Fetch tracks + splits through a SECURITY DEFINER RPC
  const tracks = await fetchTracksWithSplits(workspace_id, track_ids, user_id);

  // 2. Validate before export (ISRC, IPI, share totals…)
  const validation = validateForFormat(tracks, format);
  if (validation.errors.length > 0) {
    return new Response(JSON.stringify({
      success: false,
      errors: validation.errors
    }), { status: 400 });
  }

  // 3. Build the CSV/XML
  let content: string;
  switch (format) {
    case 'bmi':           content = buildBmiCsv(tracks); break;
    case 'ascap':         content = buildAscapCsv(tracks); break;
    case 'socan':         content = buildSocanCsv(tracks); break;
    case 'soundexchange': content = buildSoundExchangeCsv(tracks); break;
    case 'mlc':           content = buildMlcCsv(tracks); break;
  }

  // 4. Record in export_history
  await logExport(workspace_id, user_id, format, track_ids, content);

  // 5. Return the CSV as a download
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trakalog_${format}_${new Date().toISOString().split('T')[0]}.csv"`
    }
  });
});
```

> **When implementing:** follow the existing Edge Function conventions — `handleCors`,
> `rejectInvalidOrigin`, and a `check_rate_limit` call before doing any work. Export builds a
> full catalog dump, so it deserves a tighter limit than the 60/min used for signing.

---

## Pre-export validation

| Field | BMI | ASCAP | SOCAN | SoundExchange | MLC |
|---|---|---|---|---|---|
| Title | ✅ | ✅ | ✅ | ✅ | ✅ |
| Duration | ✅ | ✅ | ✅ | ✅ | ✅ |
| ISRC | optional | optional | optional | **REQUIRED** | ✅ |
| ISWC | optional | optional | optional | — | optional |
| Writer + IPI | **REQUIRED** | **REQUIRED** | **REQUIRED** | — | **REQUIRED** |
| Writer shares total 100% | ✅ | ✅ | ✅ | — | ✅ |
| Publisher info | optional | optional | optional | — | recommended |
| Performer | recommended | recommended | — | **REQUIRED** | recommended |
| Release date | recommended | recommended | — | **REQUIRED** | recommended |
| P-Line | — | — | — | **REQUIRED** | **REQUIRED** |

**UI behaviour:**
- Invalid tracks shown in red with a ⚠️ icon
- Explicit tooltip: "Missing IPI for [name]"
- "Fix missing fields" button → opens a quick-completion modal
- The Export button stays disabled while invalid tracks remain — or offers partial export of
  the valid ones

---

## UX

### New page: Workspace Settings → Exports

```
┌────────────────────────────────────────────────────────────────┐
│ Exports                                                          │
│ ────────────────────────────────────────                        │
│                                                                  │
│ Export your catalog to industry-standard formats for PROs,      │
│ neighbouring rights organizations, and mechanical licensing.    │
│                                                                  │
│ ┌──── Performing Rights ──────────────────────────────────┐    │
│ │ 🎼 BMI Works Registration         [Export]              │    │
│ │ 🎼 ASCAP ACE Works                [Export]              │    │
│ │ 🎼 SOCAN Works Registration       [Export]              │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│ ┌──── Neighbouring Rights ────────────────────────────────┐    │
│ │ 📻 SoundExchange ISRC Repertoire  [Export]              │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│ ┌──── Mechanical Rights ──────────────────────────────────┐    │
│ │ 💿 The MLC Bulk Upload            [Export]              │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│ ┌──── Export History ─────────────────────────────────────┐    │
│ │ May 17, 2026 — BMI Works (12 tracks)         [Download] │    │
│ │ May 10, 2026 — SoundExchange (8 tracks)      [Download] │    │
│ └──────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
```

### Export modal (e.g. BMI)

```
┌─────────────────────────────────────────────────────────┐
│ Export to BMI Works Registration                         │
│ ─────────────────────────────────                       │
│                                                          │
│ Select tracks to export:                                 │
│                                                          │
│ [✓] All tracks (24)                                      │
│ [ ] Recent tracks (last 30 days)                         │
│ [ ] Custom selection                                     │
│                                                          │
│ ⚠️  3 tracks have missing data:                          │
│    • "Track A" — Missing writer IPI                      │
│    • "Track B" — Missing duration                        │
│    • "Track C" — Writer shares ≠ 100%                    │
│                                                          │
│ [ Fix missing fields ] [ Export valid tracks only (21) ] │
│                                                          │
│                       [ Cancel ]    [ Export 24 tracks ] │
└─────────────────────────────────────────────────────────┘
```

### "Export" button on TrackDetail

On an individual track, an "Export → [Format]" dropdown to export that track alone.

---

## Permissions by plan

| Feature | Free | Starter | Pro | Business |
|---|:---:|:---:|:---:|:---:|
| ISRC generation (one click) | ❌ | ✅ | ✅ | ✅ |
| ISWC storage | ❌ | ✅ | ✅ | ✅ |
| BMI/ASCAP/SOCAN export | ❌ | 5/month | ✅ unlimited | ✅ unlimited |
| SoundExchange export | ❌ | 5/month | ✅ unlimited | ✅ unlimited |
| The MLC export | ❌ | ❌ | ✅ | ✅ |
| DDEX RIN/ERN export | ❌ | ❌ | ❌ | ✅ |
| PPL/SACEM/SESAC export | ❌ | ❌ | ❌ | ✅ |
| Custom registrant code | ❌ | ❌ | ✅ | ✅ |
| Export history | — | 30 days | 1 year | Unlimited |

> Enforcing these needs new columns in `plan_limits` — it currently has no export-related
> limits. See [TRAKALOG_BILLING.md](TRAKALOG_BILLING.md) §8.

---

## Implementation phases

### Phase 1 — Foundations (~2 sessions)
1. DB columns: `recording_date`, `master_owner`, `p_line`, `c_line`, `release_territory`
   (`iswc` already exists)
2. The `export_history` table
3. Workspace Settings → Exports UI (empty shell first)
4. Pre-export validation helper (shared TypeScript module)
5. Generic "Fix missing fields" modal

### Phase 2 — Performing rights (~2 sessions)
6. `export-pro-format` Edge Function skeleton
7. BMI CSV builder
8. ASCAP CSV builder
9. SOCAN CSV builder
10. Test against a real catalog

### Phase 3 — Neighbouring + mechanical (~1-2 sessions)
11. SoundExchange CSV builder
12. The MLC CSV builder
13. ISRC-required validation for SoundExchange and MLC

### Phase 4 — Polish + history (~1 session)
14. Export History UI (list + re-download)
15. Audit logging on every export
16. Quick export button on TrackDetail
17. User documentation

### Phase 5 — Post-launch (3-6 months)
18. DDEX RIN (XML, more complex — use xmlbuilder2 or fast-xml-parser)
19. PPL, SACEM, SESAC
20. DDEX ERN (Business plan only)

**Priority 1 total: 6-8 Claude Code sessions.**

---

## Costs

| Item | Cost |
|---|---|
| No external API (generated locally) | Free |
| Storing historical exports (~10 KB CSV each) | Negligible |
| Edge Function compute | Included in the Supabase plan |
| **Total** | **$0** |

**Competitive advantage:** Sound Credit charges for these exports in premium plans. Trakalog can
offer them from Starter with a quota (5/month), then unlimited on Pro — a strong differentiator.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| CSV rejected by the PRO (wrong headers) | Test each format against a real BMI/ASCAP/SOCAN account before launch |
| User submits the same track twice | Export history flags duplicates: "Already exported on [date]" |
| Invalid splits (total ≠ 100%) | Pre-export validation blocks and routes to correction |
| Missing IPI | The Fix Missing Fields modal offers auto-completion from Contacts |
| PROs change their formats | Version the templates, review annually |
| UK/Europe not covered in Priority 1 | Clear documentation: "Priority 1 covers US + Canada. International coming soon." |

---

## Format references

- **BMI Works Registration Guide** — bmi.com/creators/registration
- **ASCAP ACE Submission** — ascap.com/help/ace-title-search
- **SOCAN Works Notification** — socan.com/works/notification
- **SoundExchange ISRC Repertoire** — soundexchange.com/performer-rights
- **The MLC Bulk Upload Guide** — themlc.com/bulk-upload
- **DDEX Standards** — ddex.net/standards

---

## Dependencies

- **ISRC Generation** ⏳ prerequisite for SoundExchange + MLC — see
  [ISRC_GENERATION.md](ISRC_GENERATION.md)
- **Multi-role, multi-PRO splits system** ✅ implemented (jsonb on `tracks.splits`)
- **`contacts.ipi`** ✅ implemented
- **Edge Function infrastructure** ✅ in place
- **Plan-based enforcement** ⚠️ partially in place — tracks, pitches, seats and workspaces are
  enforced, but `plan_limits` has no export-related columns yet

---

## Strategic notes

1. **Target independents first.** Most established labels already have their tooling
   (Songspace, RoyaltyShare). Trakalog's market is growing producers and labels who are not
   equipped. For them, **BMI/ASCAP/SOCAN + SoundExchange + MLC covers 95% of their needs** in a
   single tool.

2. **Marketing:** "Send your catalog to BMI, ASCAP, SOCAN, SoundExchange, and The MLC — in one
   click. From the same place you manage your tracks." Direct, and a killer feature for pricing.

3. **Trust building:** show the BMI/ASCAP/SOCAN/SoundExchange/MLC logos on the landing page, as
   Sound Credit does. Even without an official partnership, these are public standards.

4. **Future moat:** once Priority 1 exports exist, the next step is **direct API integration**
   rather than CSV export. ASCAP has an ACE API; BMI has a portal. Submitting directly and
   retrieving confirmations would be a step beyond Sound Credit.

---

*This document is living, and will be updated as development proceeds.*
