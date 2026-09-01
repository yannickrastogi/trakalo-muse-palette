# COWOK BUG-03 FIX — Report

> Mission: nest credits writer/producer/mixer/masterer in jsonb `credits` (TrackContext.tsx)
> Date: 2026-06-05

## Branch
`cowork/fix-bug03-credits-jsonb-20260605-0031` (based on `main` = `423181c`)

> Infra note: `git pull origin main` did **fetch** (origin = github.com/yannickrastogi/trakalo-muse-palette) but local main is ahead (BUG-01 commit `423181c` never pushed). The branch is therefore based on `423181c` and includes the BUG-01 fix. Residual `.git/*.lock` files don't block operations (commit/checkout work), they're just non-removable by the sandbox.

## Phase 1 — Exploration (line numbers confirmed)

### `src/contexts/TrackContext.tsx`
- **Interface TrackData** L66-69:
  - `writtenBy: string[]` · `producedBy: string[]` · `mixedBy: string` · `masteredBy: string`
- **mapRowToTrack (READ)** L171-174: reads `row.written_by/produced_by` (split → array), `row.mixed_by/mastered_by` (string). `credits` read L185: `(row.credits as Record<string, string[]>) || {}`.
- **addTrack (WRITE simple)** L663-666: `metaPayload.written_by = trackInput.writtenBy.join(", ")`, etc. (top-level, non-existent columns → rollback). `metaPayload.credits` set L670, `metaPayload.tags` L671.
- **updateTrack (WRITE merge)** L756-759: `payload.written_by = updates.writtenBy.join(", ")`, etc. (top-level). `payload.credits` set L762, `payload.tags` L763. Existing var: `track = tracks.find(...)` (old state), `updates: Partial<TrackData>` (new).

### `src/components/UploadTrackModal.tsx` (already fixed, commit 965a323) — reference pattern
extendedPayload L837-845 stores in `credits`:
```js
credits: {
  ...(currentTrack.details || {}),
  written_by: writtenByJoined || null,   // snake_case, STRING joined by ", "
  produced_by: producedByJoined || null, // snake_case, STRING joined
  mixed_by: currentTrack.mixedBy || null,
  mastered_by: currentTrack.masteredBy || null,
  customPerformers: [...],
  customProduction: [...],
},
```
→ Convention deployed = **snake_case keys** (`written_by`…) + **values = strings joined by ", "**.

## ⚠️ BLOCKING — credits structure ambiguity (decision required)

Your mission snippet uses **camelCase** keys (`writtenBy`) with raw values (`track.writtenBy`, a `string[]`), and a read fallback `row.credits?.writtenBy ?? row.written_by`.

**Problem:** this is inconsistent with UploadTrackModal (already deployed) which writes `credits.written_by` (snake) as a joined string. Consequences if following the snippet literally:
1. Tracks uploaded via UploadTrackModal store `credits.written_by` (snake) → the read `row.credits?.writtenBy` (camel) doesn't see them → writer credits invisible for those tracks. **The very inconsistency the mission aims to eliminate.**
2. Format divergent: `string[]` (snippet) vs joined string (deployed).
3. Type: `credits` is `Record<string, string[]>` and the existing read (L171) expects a joined string to split → mismatch.

Your written decision says "consistent with UploadTrackModal" → that implies snake_case + joined strings, which **contradicts the literal snippet camelCase**. I don't guess (your rule). → Question asked in chat.

**✅ Decision made (you, in chat): snake_case (match UploadTrackModal).** Implementation done accordingly — snake_case keys + joined string values, assumed deviation from literal snippet camelCase.

---

## Phase 2 — Fix applied (3 modifications, `src/contexts/TrackContext.tsx` only)

### A. `addTrack` (L662-671 before)
Removed the 4 top-level keys `metaPayload.written_by/produced_by/mixed_by/mastered_by`. Added a `writerCredits` object (snake_case, `writtenBy.join(", ")`) **merged** into `metaPayload.credits` with existing `trackInput.credits`:
```js
const mergedCredits = { ...(trackInput.credits || {}), ...writerCredits };
if (Object.keys(mergedCredits).length > 0) metaPayload.credits = mergedCredits;
```

### B. `updateTrack` (L756-763 before) — CRITICAL MERGE
Removed the 4 top-level keys. Built `mergedCredits` = `track.credits` (existing state) + `updates.credits` + writer overrides, applied only if one of these keys changes → **never clobbers** customPerformers/customProduction:
```js
const hasWriterEdit = updates.writtenBy!==undefined || updates.producedBy!==undefined || updates.mixedBy!==undefined || updates.masteredBy!==undefined;
if (updates.credits !== undefined || hasWriterEdit) {
  const mergedCredits = { ...(track.credits||{}), ...(updates.credits||{}) };
  if (updates.writtenBy !== undefined) mergedCredits.written_by = updates.writtenBy.length ? updates.writtenBy.join(", ") : null;
  // ...produced_by / mixed_by / mastered_by same
  payload.credits = mergedCredits;
}
```

### C. `mapRowToTrack` (L171-174 before) — read double-fallback
Added `const rowCredits = (row.credits as Record<string,unknown>|null) || {}`. Read from `rowCredits.written_by` (snake, as UploadTrackModal) with fallback legacy column `row.written_by`:
```js
writtenBy: ((rowCredits.written_by ?? row.written_by) as string) ? String(rowCredits.written_by ?? row.written_by).split(",").map(s=>s.trim()).filter(Boolean) : [],
// producedBy same ; mixedBy/masteredBy = ((rowCredits.mixed_by ?? row.mixed_by) as string) || ""
```

## Phase 3 — Local verification
- `npx tsc --noEmit` → **EXIT 0** ✅
- `git diff --stat` → **only `src/contexts/TrackContext.tsx`** (36 insertions, 14 deletions) ✅
- Manual sanity check of the 3 zones: OK (snake_case, joined strings, non-destructive merge).

## Files touched
- `src/contexts/TrackContext.tsx` (fix)
- `COWOK_REPORT_BUG03.md` (this report)

## Residual risks (NOT tested live)
1. **No real upload/edit test**: impossible without completing real uploads (pollutes test workspace, "no delete" prevents cleaning). Verify = tsc + static review + consistency with already-deployed UploadTrackModal pattern.
2. **`track.credits` now contains keys `written_by`… (strings) alongside customPerformers (arrays)** at `mapRowToTrack` line ~189 (`credits: (row.credits) || {}`). This was **already the case** for tracks uploaded via UploadTrackModal (deployed) → no new risk, but keep in mind if a component iterates `track.credits` assuming only roles→string[].
3. **Existing tracks** (uploaded before this fix with writer credits lost): recover nothing retroactively — only new uploads/edits will persist. The fallback `row.written_by` remains inert (non-existent columns).
4. **Branch based on `423181c`** (includes BUG-01 fix not pushed) — see infra note at top.

## To do by Yannick
```bash
git push -u origin cowork/fix-bug03-credits-jsonb-20260605-0031
# Test on Vercel preview: Quick Upload (and edit) with writer credits → verify persistence + display
# If OK: merge on main
```
