import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useContacts, type Contact } from "@/contexts/ContactsContext";

interface NameSuggestion {
  fullName: string;
  stageName?: string;
}

interface NameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  extraSuggestions?: { name: string; stage_name?: string }[];
  /** When true, skip the contacts pool and only suggest from extraSuggestions (used by studio fields). */
  excludeContacts?: boolean;
  /**
   * When true, a free-typed name that doesn't match any existing contact/alias
   * can be committed via a "Create '<name>'" row, which also registers it as an
   * artist_alias so it's reusable later. Opt-in (credits bulk upload) — other
   * usages keep the plain select-only behaviour. Existing aliases are also
   * added to the suggestion pool so previously-created names surface.
   */
  allowCreate?: boolean;
}

export function NameAutocomplete({
  value,
  onChange,
  placeholder,
  className,
  extraSuggestions = [],
  excludeContacts = false,
  allowCreate = false,
}: NameAutocompleteProps) {
  const { contacts, aliases, upsertAlias } = useContacts();
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Get the last segment after the last comma
  const lastSegment = useMemo(() => {
    const parts = value.split(",");
    return parts[parts.length - 1].trim();
  }, [value]);

  // Debounce the query
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(lastSegment);
    }, 150);
    return () => clearTimeout(debounceRef.current);
  }, [lastSegment]);

  const suggestions = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const query = debouncedQuery.toLowerCase();
    const results: NameSuggestion[] = [];
    const seen = new Set<string>();

    // From contacts (skipped for studio fields so we never suggest people as venues)
    if (!excludeContacts) {
      for (const c of contacts) {
        const full = ((c.firstName || "") + " " + (c.lastName || "")).trim();
        if (!full) continue;
        const key = full.toLowerCase();
        if (seen.has(key)) continue;
        const firstName = (c.firstName || "").toLowerCase();
        const lastName = (c.lastName || "").toLowerCase();
        const stageLower = (c.stageName || "").toLowerCase();
        if (firstName.startsWith(query) || lastName.startsWith(query) || key.indexOf(query) >= 0 || (stageLower && stageLower.indexOf(query) >= 0)) {
          seen.add(key);
          results.push({ fullName: full, stageName: c.stageName || undefined });
        }
      }
    }

    // From existing artist aliases (only when create is enabled, so previously-
    // created free names resurface). Never suggested for studio-only fields.
    if (allowCreate && !excludeContacts) {
      for (const a of aliases) {
        const name = (a.alias_name || "").trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        if (key.indexOf(query) >= 0) {
          seen.add(key);
          results.push({ fullName: name });
        }
      }
    }

    // From extra suggestions (splits collaborators)
    for (const s of extraSuggestions) {
      if (!s.name) continue;
      const key = s.name.toLowerCase();
      if (seen.has(key)) continue;
      const stageLower = (s.stage_name || "").toLowerCase();
      if (key.indexOf(query) >= 0 || (stageLower && stageLower.indexOf(query) >= 0)) {
        seen.add(key);
        results.push({ fullName: s.name, stageName: s.stage_name || undefined });
      }
    }

    return results.slice(0, 8);
  }, [debouncedQuery, contacts, aliases, extraSuggestions, excludeContacts, allowCreate]);

  // Show a "Create '<name>'" affordance when the typed name doesn't already
  // match a suggestion. This never blocks the credit — the value is already the
  // free text; creating just registers the alias for reuse.
  const showCreate = useMemo(() => {
    if (!allowCreate) return false;
    const name = lastSegment;
    if (name.length < 2) return false;
    const key = name.toLowerCase();
    return !suggestions.some((s) => s.fullName.toLowerCase() === key);
  }, [allowCreate, lastSegment, suggestions]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback((s: NameSuggestion) => {
    // Replace the last segment with the selected name
    const parts = value.split(",");
    parts[parts.length - 1] = (parts.length > 1 ? " " : "") + s.fullName;
    onChange(parts.join(","));
    setOpen(false);
    setHighlightIdx(-1);
  }, [value, onChange]);

  // Register the free-typed last-segment name as an artist_alias so it becomes a
  // first-class, reusable credit. The credit value itself is already the typed
  // text, so this never blocks or alters the credit — it just persists the name.
  // (No email is captured in the credits flow, so per spec this takes the alias
  // branch rather than auto-add-contact.)
  const handleCreate = useCallback(() => {
    const name = lastSegment;
    if (!name || creating) return;
    setOpen(false);
    setHighlightIdx(-1);
    setCreating(true);
    upsertAlias(null, name, [])
      .then((ok) => { if (ok) toast.success("“" + name + "” added"); })
      .catch(() => { /* upsertAlias already surfaces its own error toast */ })
      .finally(() => setCreating(false));
  }, [lastSegment, creating, upsertAlias]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setHighlightIdx((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setHighlightIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Enter") {
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlightIdx]);
      } else if (showCreate) {
        // Nothing highlighted but a new name is typed → create it.
        e.preventDefault();
        handleCreate();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }, [open, suggestions, highlightIdx, handleSelect, showCreate, handleCreate]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlightIdx(-1);
        }}
        onFocus={() => {
          if (lastSegment.length >= 2) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {open && (suggestions.length > 0 || showCreate) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg bg-card border border-white/10 shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.fullName + i}
              type="button"
              className={`w-full text-left px-3 py-2 cursor-pointer transition-colors ${i === highlightIdx ? "bg-white/10" : "hover:bg-white/5"}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
            >
              <div className="text-sm text-white">{s.fullName}</div>
              {s.stageName && (
                <div className="text-xs text-muted-foreground">{s.stageName}</div>
              )}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 cursor-pointer transition-colors hover:bg-white/5 border-t border-white/5 flex items-center gap-2 disabled:opacity-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
              disabled={creating}
            >
              <UserPlus className="w-3.5 h-3.5 text-brand-orange shrink-0" />
              <span className="text-sm text-white/90 truncate">Create “{lastSegment}”</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
