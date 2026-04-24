import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
}

export function NameAutocomplete({
  value,
  onChange,
  placeholder,
  className,
  extraSuggestions = [],
}: NameAutocompleteProps) {
  const { contacts } = useContacts();
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
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
    if (!debouncedQuery || debouncedQuery.length < 3) return [];
    const query = debouncedQuery.toLowerCase();
    const results: NameSuggestion[] = [];
    const seen = new Set<string>();

    // From contacts
    for (const c of contacts) {
      const full = ((c.firstName || "") + " " + (c.lastName || "")).trim();
      if (!full) continue;
      const key = full.toLowerCase();
      if (seen.has(key)) continue;
      const firstName = (c.firstName || "").toLowerCase();
      const lastName = (c.lastName || "").toLowerCase();
      if (firstName.startsWith(query) || lastName.startsWith(query) || key.indexOf(query) >= 0) {
        seen.add(key);
        results.push({ fullName: full });
      }
    }

    // From extra suggestions (splits collaborators)
    for (const s of extraSuggestions) {
      if (!s.name) continue;
      const key = s.name.toLowerCase();
      if (seen.has(key)) continue;
      const stageLower = (s.stage_name || "").toLowerCase();
      if (key.indexOf(query) >= 0 || stageLower.startsWith(query)) {
        seen.add(key);
        results.push({ fullName: s.name, stageName: s.stage_name || undefined });
      }
    }

    return results.slice(0, 8);
  }, [debouncedQuery, contacts, extraSuggestions]);

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }, [open, suggestions, highlightIdx, handleSelect]);

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
          if (lastSegment.length >= 3) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {open && suggestions.length > 0 && (
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
        </div>
      )}
    </div>
  );
}
