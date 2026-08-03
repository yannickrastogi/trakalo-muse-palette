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

// ─── Artist string → collaborator parsing ────────────────────────────
//
// Used at upload time to pre-fill splits when the artist field is something
// like "Banx & Ranx, Hadar Adora" — aliases are consulted first so we don't
// accidentally split "Banx & Ranx" on the ampersand.

export interface AliasInput {
  alias_name: string;
  contact_ids: string[];
}

export interface ContactInput {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  stageName: string;
}

export interface ParsedCollaborator {
  /** Display name to show in the banner and pre-fill in the split row. */
  name: string;
  /** Optional resolved contact (when the name matched an existing contact). */
  contact?: ContactInput;
  /** Set when the resolution came from expanding an alias. */
  fromAlias?: string;
}

function contactFullName(c: ContactInput): string {
  return ((c.firstName || "") + " " + (c.lastName || "")).trim();
}

/**
 * Parse a free-text "artist" field into a list of collaborators, resolving any
 * known aliases first so multi-name aliases ("Banx & Ranx") aren't blown apart.
 *
 * Steps:
 *  1. Split on commas (top level).
 *  2. For each segment, look up case-insensitive against the alias list and
 *     expand to the linked contacts.
 *  3. If no alias matches, split on " & ", " x ", " X ", " + " (common
 *     multi-artist separators) and attempt to map each name to an existing
 *     contact (full name OR stage name, case-insensitive).
 *  4. Dedupe by contact id (or by name when no contact matched).
 */
export function parseArtistsToCollaborators(
  artist: string,
  aliases: AliasInput[],
  contacts: ContactInput[],
): ParsedCollaborator[] {
  if (!artist || !artist.trim()) return [];

  const aliasMap = new Map<string, AliasInput>();
  for (const a of aliases) aliasMap.set(a.alias_name.trim().toLowerCase(), a);

  const contactById = new Map<string, ContactInput>();
  const contactByName = new Map<string, ContactInput>();
  for (const c of contacts) {
    contactById.set(c.id, c);
    const full = contactFullName(c).toLowerCase();
    if (full) contactByName.set(full, c);
    const stage = (c.stageName || "").trim().toLowerCase();
    if (stage) contactByName.set(stage, c);
  }

  const out: ParsedCollaborator[] = [];
  const seenContactIds = new Set<string>();
  const seenNames = new Set<string>();

  const push = (entry: ParsedCollaborator) => {
    if (entry.contact) {
      if (seenContactIds.has(entry.contact.id)) return;
      seenContactIds.add(entry.contact.id);
    } else {
      const key = entry.name.toLowerCase();
      if (seenNames.has(key)) return;
      seenNames.add(key);
    }
    out.push(entry);
  };

  const expandAlias = (a: AliasInput, fallbackName: string) => {
    for (const cid of a.contact_ids) {
      const c = contactById.get(cid);
      if (c) push({ name: contactFullName(c) || c.email || fallbackName, contact: c, fromAlias: a.alias_name });
    }
  };

  const segments = artist.split(",").map((s) => s.trim()).filter(Boolean);

  for (const segment of segments) {
    const aliasHit = aliasMap.get(segment.toLowerCase());
    if (aliasHit) {
      expandAlias(aliasHit, segment);
      continue;
    }

    // Split on collab separators x / X / + ONLY — NOT "&", which is often part
    // of an alias ("Banx & Ranx"). Each fragment is re-tested as an alias before
    // we fall back to splitting it on "&".
    const fragments = segment.split(/\s+(?:x|X|\+)\s+/).map((n) => n.trim()).filter(Boolean);

    for (const frag of fragments) {
      const fragAlias = aliasMap.get(frag.toLowerCase());
      if (fragAlias) {
        expandAlias(fragAlias, frag);
        continue;
      }

      // Not an alias → split plain "A & B" groups and map each name. Unknown
      // names (no contact match) are still included as name-only collaborators.
      const names = frag.split(/\s+&\s+/).map((n) => n.trim()).filter(Boolean);
      for (const name of names) {
        const c = contactByName.get(name.toLowerCase());
        push(c ? { name: contactFullName(c) || name, contact: c } : { name });
      }
    }
  }

  return out;
}
