/**
 * Smart split rebalancing with lock/unlock support.
 *
 * - locked splits keep their value
 * - unlocked splits share the remainder equally
 * - the last unlocked split absorbs rounding difference
 */

interface SplitLike {
  id: string;
  locked?: boolean;
  [key: string]: unknown;
}

export function smartRedistribute<T extends SplitLike>(
  splits: T[],
  shareKey: "share" | "percentage",
  changedId?: string,
): T[] {
  if (splits.length === 0) return splits;

  // When adding a new collaborator (no changedId): unlock all, equal split
  if (!changedId) {
    const equal = parseFloat((100 / splits.length).toFixed(2));
    const total = parseFloat((equal * splits.length).toFixed(2));
    const diff = parseFloat((100 - total).toFixed(2));
    return splits.map((s, i) => ({
      ...s,
      [shareKey]: i === 0 ? parseFloat((equal + diff).toFixed(2)) : equal,
      locked: false,
    }));
  }

  // When a specific split was changed: mark it locked, rebalance unlocked
  const result = splits.map((s) =>
    s.id === changedId ? { ...s, locked: true } : s
  );

  const locked = result.filter((s) => s.locked);
  const unlocked = result.filter((s) => !s.locked);

  const lockedSum = parseFloat(
    locked.reduce((sum, s) => sum + (Number((s as Record<string, unknown>)[shareKey]) || 0), 0).toFixed(2)
  );
  const remaining = parseFloat(Math.max(0, 100 - lockedSum).toFixed(2));

  if (unlocked.length === 0) return result;

  const each = parseFloat((remaining / unlocked.length).toFixed(2));
  const total = parseFloat((each * unlocked.length).toFixed(2));
  const diff = parseFloat((remaining - total).toFixed(2));

  let unlockedIdx = 0;
  return result.map((s) => {
    if (s.locked) return s;
    const isLast = unlockedIdx === unlocked.length - 1;
    const val = isLast ? parseFloat((each + diff).toFixed(2)) : each;
    unlockedIdx++;
    return { ...s, [shareKey]: val };
  });
}

/** Rebalance after removing a split — redistribute among unlocked */
export function redistributeAfterRemove<T extends SplitLike>(
  splits: T[],
  shareKey: "share" | "percentage",
): T[] {
  if (splits.length === 0) return splits;

  const locked = splits.filter((s) => s.locked);
  const unlocked = splits.filter((s) => !s.locked);

  // If no unlocked splits, just return as-is (total will be off, warning shown)
  if (unlocked.length === 0) return splits;

  const lockedSum = parseFloat(
    locked.reduce((sum, s) => sum + (Number((s as Record<string, unknown>)[shareKey]) || 0), 0).toFixed(2)
  );
  const remaining = parseFloat(Math.max(0, 100 - lockedSum).toFixed(2));

  const each = parseFloat((remaining / unlocked.length).toFixed(2));
  const total = parseFloat((each * unlocked.length).toFixed(2));
  const diff = parseFloat((remaining - total).toFixed(2));

  let idx = 0;
  return splits.map((s) => {
    if (s.locked) return s;
    const isLast = idx === unlocked.length - 1;
    const val = isLast ? parseFloat((each + diff).toFixed(2)) : each;
    idx++;
    return { ...s, [shareKey]: val };
  });
}

/** Toggle lock on a specific split, then rebalance unlocked */
export function toggleLock<T extends SplitLike>(
  splits: T[],
  splitId: string,
  shareKey: "share" | "percentage",
): T[] {
  const toggled = splits.map((s) =>
    s.id === splitId ? { ...s, locked: !s.locked } : s
  );
  // If we just unlocked it, rebalance
  const target = toggled.find((s) => s.id === splitId);
  if (target && !target.locked) {
    return redistributeAfterRemove(toggled, shareKey);
  }
  return toggled;
}
