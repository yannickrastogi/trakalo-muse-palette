// Detect KNOWN workspace collaborators mentioned in a track's title/artist/featuring
// text. This only ever produces SUGGESTIONS — the caller decides whether to add a
// split. Matching is deliberately conservative to avoid false positives:
//   - case-insensitive
//   - whole word/segment matching only (separators: space, - _ / . , & + ( ) [ ]),
//     never an arbitrary substring
//   - candidates shorter than MIN_LEN alphanumerics are ignored
//   - de-duplicated by contact id
//
// Pure & framework-agnostic: takes minimal contact/alias shapes so it can be unit
// tested and reused. The caller resolves the full Contact (role/pro/ipi/…) by id.

export interface DetectContact {
  id: string;
  firstName: string;
  lastName: string;
  stageName: string;
}

export interface DetectAlias {
  alias_name: string;
  contact_ids: string[];
}

export interface DetectedCollaborator {
  contactId: string;
  reason: "alias" | "name" | "stage_name";
  matchedText: string; // the alias / name / stage_name that matched (for the chip label)
}

const SEP_RE = /[\s\-_/.,&+()[\]]+/g;
const MIN_LEN = 3; // ignore names/aliases with fewer than 3 alphanumerics

// Lowercase, turn every separator into a single space, and pad with spaces so a
// candidate wrapped in spaces only matches on segment boundaries.
function norm(s: string): string {
  const cleaned = (s || "").toLowerCase().replace(SEP_RE, " ").replace(/\s+/g, " ").trim();
  return " " + cleaned + " ";
}

function alnumLen(s: string): number {
  return (s || "").replace(/[^\p{L}\p{N}]/gu, "").length;
}

export function detectCollaboratorsFromText(
  text: string,
  contacts: DetectContact[],
  aliases: DetectAlias[],
): DetectedCollaborator[] {
  const hay = norm(text);
  if (hay.trim().length === 0) return [];

  // Whole-segment containment: ` candidate ` inside ` text `.
  const contains = (candidate: string): boolean => {
    if (alnumLen(candidate) < MIN_LEN) return false;
    const needle = norm(candidate);
    if (needle.trim().length === 0) return false;
    return hay.includes(needle);
  };

  const byId = new Map<string, DetectContact>();
  for (const c of contacts) byId.set(c.id, c);

  const found = new Map<string, DetectedCollaborator>(); // dedupe by contactId

  // 1) Aliases first — an explicit workspace mapping is the strongest signal.
  for (const a of aliases || []) {
    if (!a?.alias_name || !Array.isArray(a.contact_ids)) continue;
    if (!contains(a.alias_name)) continue;
    for (const cid of a.contact_ids) {
      if (byId.has(cid) && !found.has(cid)) {
        found.set(cid, { contactId: cid, reason: "alias", matchedText: a.alias_name.trim() });
      }
    }
  }

  // 2) Full name, then stage name.
  for (const c of contacts || []) {
    if (found.has(c.id)) continue;
    const full = ((c.firstName || "") + " " + (c.lastName || "")).trim();
    if (full && contains(full)) {
      found.set(c.id, { contactId: c.id, reason: "name", matchedText: full });
      continue;
    }
    const stage = (c.stageName || "").trim();
    if (stage && contains(stage)) {
      found.set(c.id, { contactId: c.id, reason: "stage_name", matchedText: stage });
    }
  }

  return Array.from(found.values());
}
