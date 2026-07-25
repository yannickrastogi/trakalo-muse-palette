import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { Contact, ArtistAlias } from "@/contexts/ContactsContext";
import { detectCollaboratorsFromText } from "@/lib/detectCollaboratorsFromText";

interface Props {
  // title + " " + artist + " " + featuring of the current track.
  text: string;
  contacts: Contact[];
  aliases: ArtistAlias[];
  // Newline-joined, lowercased names + stage_names already present in the splits.
  // A string (not an array) so it stays a stable memo dep when unchanged.
  existingNamesKey: string;
  // Adds a prefilled split for the picked collaborator (percentage stays 0).
  onAdd: (contact: Contact) => void;
}

// A conservative, click-to-add suggestion band. It NEVER adds a split on its own:
// it only surfaces KNOWN workspace collaborators whose name/stage_name/alias appears
// in the track title or artist and who are not already in the splits.
export function CollaboratorSuggestions({ text, contacts, aliases, existingNamesKey, onAdd }: Props) {
  const { t } = useTranslation();

  const suggestions = useMemo(() => {
    const detectContacts = contacts.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, stageName: c.stageName }));
    const detectAliases = aliases.map((a) => ({ alias_name: a.alias_name, contact_ids: a.contact_ids }));
    const detected = detectCollaboratorsFromText(text, detectContacts, detectAliases);

    const byId = new Map(contacts.map((c) => [c.id, c]));
    const present = new Set(existingNamesKey.split("\n").filter(Boolean));

    const out: Array<{ contact: Contact; matchedText: string }> = [];
    for (const d of detected) {
      const c = byId.get(d.contactId);
      if (!c) continue;
      const full = ((c.firstName || "") + " " + (c.lastName || "")).trim().toLowerCase();
      const stage = (c.stageName || "").trim().toLowerCase();
      // Already in the splits → don't re-suggest.
      if ((full && present.has(full)) || (stage && present.has(stage))) continue;
      out.push({ contact: c, matchedText: d.matchedText });
    }
    return out;
  }, [text, contacts, aliases, existingNamesKey]);

  if (suggestions.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-brand-orange/25 bg-brand-orange/5 p-3">
      <p className="text-xs font-semibold text-muted-foreground mb-2">
        {t("uploadTrack.suggestedCollaborators", "Detected in title / artist — tap to add (share stays 0%)")}
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map(({ contact, matchedText }) => {
          const full = ((contact.firstName || "") + " " + (contact.lastName || "")).trim();
          const showFull = full && matchedText.toLowerCase() !== full.toLowerCase();
          return (
            <button
              key={contact.id}
              type="button"
              onClick={() => onAdd(contact)}
              className="inline-flex items-center gap-1.5 text-xs bg-secondary hover:bg-brand-orange/10 border border-border hover:border-brand-orange/30 text-foreground px-2.5 py-1.5 rounded-full font-medium transition-colors"
            >
              <Plus className="w-3 h-3 text-brand-orange shrink-0" />
              <span className="truncate max-w-[220px]">{matchedText}{showFull ? " (" + full + ")" : ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
