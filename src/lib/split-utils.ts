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

/**
 * Extract candidate artist names from one or more free-text fields (artist,
 * featuring, credit fields…) for name resolution. Emits the WHOLE field first
 * (so a full multi-name alias resolves as one unit) and then each top-level
 * comma segment (so "Banx & Ranx" stays intact and matches as a duo). It NEVER
 * splits on "&" (nor "x"/"+"): those belong to a name too often to be reliable
 * separators — the alias/contact resolution decides how to break a name, so
 * splitting here would only fabricate wrong fragments (e.g. "Banx", "Ranx").
 * Surrounding brackets are stripped and candidates with fewer than 3
 * alphanumerics are dropped as noise.
 *
 * Pure & framework-agnostic — the caller feeds the returned list to the
 * `resolve_artist_names` RPC, which does the alias/contact matching + dedup.
 * Comma segments that don't resolve simply stay in the artist field untouched.
 */
export function extractArtistNameCandidates(...texts: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  const add = (raw: string) => {
    const cleaned = (raw || "").trim().replace(/^[([{]+|[)\]}]+$/g, "").trim();
    if (cleaned.replace(/[^\p{L}\p{N}]/gu, "").length >= 3) out.add(cleaned);
  };
  for (const text of texts) {
    if (!text) continue;
    add(text); // whole field first — lets a full multi-name alias match as one unit
    for (const seg of text.split(",")) {
      add(seg); // commas ONLY — never split on "&"/"x"/"+", which belong to names
    }
  }
  return Array.from(out);
}
