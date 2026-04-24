/**
 * Simple equal split distribution.
 * Distributes 100% equally among all splits.
 * The last split absorbs rounding difference.
 */
export function equalSplit<T extends { id: string }>(
  splits: T[],
  shareKey: "share" | "percentage",
): T[] {
  if (splits.length === 0) return splits;
  const equal = parseFloat((100 / splits.length).toFixed(2));
  const total = parseFloat((equal * splits.length).toFixed(2));
  const diff = parseFloat((100 - total).toFixed(2));
  return splits.map((s, i) => ({
    ...s,
    [shareKey]: i === splits.length - 1 ? parseFloat((equal + diff).toFixed(2)) : equal,
  }));
}
