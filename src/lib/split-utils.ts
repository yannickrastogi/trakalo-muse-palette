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

  const segments = artist.split(",").map((s) => s.trim()).filter(Boolean);

  for (const segment of segments) {
    const aliasHit = aliasMap.get(segment.toLowerCase());
    if (aliasHit) {
      for (const cid of aliasHit.contact_ids) {
        const c = contactById.get(cid);
        if (c) {
          push({ name: contactFullName(c) || c.email || segment, contact: c, fromAlias: aliasHit.alias_name });
        }
      }
      continue;
    }

    // Split on common multi-artist separators (case-insensitive).
    const subNames = segment
      .split(/\s+(?:&|x|X|\+)\s+/)
      .map((n) => n.trim())
      .filter(Boolean);

    for (const sub of subNames) {
      const c = contactByName.get(sub.toLowerCase());
      push(c ? { name: contactFullName(c) || sub, contact: c } : { name: sub });
    }
  }

  return out;
}
