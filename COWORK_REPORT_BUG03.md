# COWORK BUG-03 FIX — Report

> Mission : nest credits writer/producer/mixer/masterer dans jsonb `credits` (TrackContext.tsx)
> Date : 2026-06-05

## Branche
`cowork/fix-bug03-credits-jsonb-20260605-0031` (basée sur `main` = `423181c`)

> Note infra : `git pull origin main` a bien **fetch** (origin = github.com/yannickrastogi/trakalo-muse-palette) mais main local est en avance (commit BUG-01 `423181c` jamais poussé). La branche est donc basée sur `423181c` et inclut le fix BUG-01. Les `.git/*.lock` résiduels ne bloquent pas les opérations (commit/checkout fonctionnent), ils restent juste non supprimables par le sandbox.

## Phase 1 — Exploration (line numbers confirmés)

### `src/contexts/TrackContext.tsx`
- **Interface TrackData** L66-69 :
  - `writtenBy: string[]` · `producedBy: string[]` · `mixedBy: string` · `masteredBy: string`
- **mapRowToTrack (READ)** L171-174 : lit `row.written_by/produced_by` (split → array), `row.mixed_by/mastered_by` (string). `credits` lu L185 : `(row.credits as Record<string, string[]>) || {}`.
- **addTrack (WRITE simple)** L663-666 : `metaPayload.written_by = trackInput.writtenBy.join(", ")`, etc. (top-level, colonnes inexistantes → rollback). `metaPayload.credits` set L670, `metaPayload.tags` L671.
- **updateTrack (WRITE merge)** L756-759 : `payload.written_by = updates.writtenBy.join(", ")`, etc. (top-level). `payload.credits` set L762, `payload.tags` L763. Var existante : `track = tracks.find(...)` (ancien état), `updates: Partial<TrackData>` (nouveau).

### `src/components/UploadTrackModal.tsx` (déjà fixé, commit 965a323) — pattern de référence
extendedPayload L837-845 stocke dans `credits` :
```js
credits: {
  ...(currentTrack.details || {}),
  written_by: writtenByJoined || null,   // snake_case, STRING joint par ", "
  produced_by: producedByJoined || null, // snake_case, STRING joint
  mixed_by: currentTrack.mixedBy || null,
  mastered_by: currentTrack.masteredBy || null,
  customPerformers: [...],
  customProduction: [...],
},
```
→ Convention déployée = **clés snake_case** (`written_by`…) + **valeurs = strings jointes par ", "**.

## ⚠️ BLOCAGE — ambiguïté structure credits (décision requise)

Ton snippet de mission utilise des clés **camelCase** (`writtenBy`) avec valeurs brutes (`track.writtenBy`, un `string[]`), et un read fallback `row.credits?.writtenBy ?? row.written_by`.

**Problème :** c'est incohérent avec UploadTrackModal (déjà déployé) qui écrit `credits.written_by` (snake) en string jointe. Conséquences si on suit le snippet littéral :
1. Les tracks uploadés via UploadTrackModal stockent `credits.written_by` (snake) → le read `row.credits?.writtenBy` (camel) ne les voit pas → credits writer invisibles pour ces tracks. **L'incohérence même que la mission veut éliminer.**
2. Format divergent : `string[]` (snippet) vs string jointe (déployé).
3. Type : `credits` est `Record<string, string[]>` et le read existant (L171) attend une string jointe à splitter → mismatch.

Ta décision écrite dit « cohérent avec UploadTrackModal » → ça impliquerait snake_case + strings jointes, ce qui **contredit le snippet camelCase**. Je ne devine pas (ta règle). → Question posée dans le chat.

**✅ Décision prise (toi, dans le chat) : snake_case (match UploadTrackModal).** Implémentation faite en conséquence — clés snake_case + valeurs strings jointes par ", ", déviation assumée du snippet camelCase littéral.

---

## Phase 2 — Fix appliqué (3 modifications, `src/contexts/TrackContext.tsx` uniquement)

### A. `addTrack` (L662-671 avant)
Retiré les 4 clés top-level `metaPayload.written_by/produced_by/mixed_by/mastered_by`. Ajouté un objet `writerCredits` (snake_case, `writtenBy.join(", ")`) **mergé** dans `metaPayload.credits` avec `trackInput.credits` existant :
```js
const mergedCredits = { ...(trackInput.credits || {}), ...writerCredits };
if (Object.keys(mergedCredits).length > 0) metaPayload.credits = mergedCredits;
```

### B. `updateTrack` (L756-763 avant) — MERGE critique
Retiré les 4 clés top-level. Construit `mergedCredits` = `track.credits` (état existant) + `updates.credits` + overrides writer, appliqué seulement si une de ces clés change → **ne clobber jamais** customPerformers/customProduction :
```js
const hasWriterEdit = updates.writtenBy!==undefined || updates.producedBy!==undefined || updates.mixedBy!==undefined || updates.masteredBy!==undefined;
if (updates.credits !== undefined || hasWriterEdit) {
  const mergedCredits = { ...(track.credits||{}), ...(updates.credits||{}) };
  if (updates.writtenBy !== undefined) mergedCredits.written_by = updates.writtenBy.length ? updates.writtenBy.join(", ") : null;
  // ...produced_by / mixed_by / mastered_by idem
  payload.credits = mergedCredits;
}
```

### C. `mapRowToTrack` (L171-174 avant) — read double-fallback
Ajouté `const rowCredits = (row.credits as Record<string,unknown>|null) || {}`. Lecture depuis `rowCredits.written_by` (snake, comme UploadTrackModal) avec fallback colonne legacy `row.written_by` :
```js
writtenBy: ((rowCredits.written_by ?? row.written_by) as string) ? String(rowCredits.written_by ?? row.written_by).split(",").map(s=>s.trim()).filter(Boolean) : [],
// producedBy idem ; mixedBy/masteredBy = ((rowCredits.mixed_by ?? row.mixed_by) as string) || ""
```

## Phase 3 — Vérification locale
- `npx tsc --noEmit` → **EXIT 0** ✅
- `git diff --stat` → **uniquement `src/contexts/TrackContext.tsx`** (36 insertions, 14 deletions) ✅
- Sanity check manuel des 3 zones : OK (snake_case, strings jointes, merge non destructif).

## Fichiers touchés
- `src/contexts/TrackContext.tsx` (fix)
- `COWORK_REPORT_BUG03.md` (ce rapport)

## Risques résiduels (NON testés en live)
1. **Pas de test d'upload/édition réel** : impossible sans compléter de vrais uploads (pollue le workspace test, "pas de delete" interdit le nettoyage). Vérif = tsc + revue statique + cohérence avec le pattern UploadTrackModal déjà déployé.
2. **`track.credits` contient désormais les clés `written_by`… (strings) en plus de customPerformers (arrays)** côté `mapRowToTrack` ligne ~189 (`credits: (row.credits) || {}`). C'était **déjà le cas** pour les tracks uploadés via UploadTrackModal (déployé) → aucun risque nouveau, mais à garder en tête si un composant itère `track.credits` en supposant uniquement des rôles→string[].
3. **Tracks existants** (uploadés avant ce fix avec writer credits perdus) : ne récupèrent rien rétroactivement — seuls les nouveaux uploads/éditions persisteront. Le fallback `row.written_by` reste inerte (colonnes inexistantes).
4. **Branche basée sur `423181c`** (inclut le fix BUG-01 non poussé) — voir note infra en haut.

## À faire côté Yannick
```bash
git push -u origin cowork/fix-bug03-credits-jsonb-20260605-0031
# Test sur preview Vercel : Quick Upload (et édition) avec credits writer → vérifier persistance + affichage
# Si OK : merge sur main
```
