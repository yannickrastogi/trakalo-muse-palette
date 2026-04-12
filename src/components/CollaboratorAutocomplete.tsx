import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { Contact } from "@/contexts/ContactsContext";

export interface CollaboratorSuggestion {
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  pro?: string;
  ipi?: string;
  publisher?: string;
  source: "contact" | "split";
}

interface CollaboratorAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: CollaboratorSuggestion) => void;
  contacts: Contact[];
  existingSplitNames?: string[];
  placeholder?: string;
  className?: string;
}

export function CollaboratorAutocomplete({
  value,
  onChange,
  onSelect,
  contacts,
  existingSplitNames = [],
  placeholder,
  className,
}: CollaboratorAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(function () {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return function () {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  const suggestions = useMemo(function () {
    if (!value || value.trim().length < 2) return [];
    var query = value.toLowerCase().trim();
    var results: CollaboratorSuggestion[] = [];
    var seen = new Set<string>();

    // From contacts
    for (var i = 0; i < contacts.length; i++) {
      var c = contacts[i];
      var full = ((c.firstName || "") + " " + (c.lastName || "")).trim();
      if (!full) continue;
      var key = full.toLowerCase();
      if (key.indexOf(query) >= 0 && !seen.has(key)) {
        seen.add(key);
        results.push({
          firstName: c.firstName,
          lastName: c.lastName,
          fullName: full,
          email: c.email || undefined,
          pro: (c as any).pro || undefined,
          ipi: (c as any).ipi || undefined,
          publisher: (c as any).publisher || undefined,
          source: "contact",
        });
      }
    }

    // From existing split names
    for (var j = 0; j < existingSplitNames.length; j++) {
      var name = existingSplitNames[j];
      if (!name) continue;
      var nameKey = name.toLowerCase();
      if (nameKey.indexOf(query) >= 0 && !seen.has(nameKey)) {
        seen.add(nameKey);
        var parts = name.split(" ");
        results.push({
          firstName: parts[0] || "",
          lastName: parts.slice(1).join(" ") || "",
          fullName: name,
          source: "split",
        });
      }
    }

    return results.slice(0, 8);
  }, [value, contacts, existingSplitNames]);

  var handleSelect = useCallback(function (s: CollaboratorSuggestion) {
    onSelect(s);
    setOpen(false);
  }, [onSelect]);

  return (
    <div ref={containerRef} className="relative">
      <input
        value={value}
        onChange={function (e) {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={function () {
          if (value.trim().length >= 2) setOpen(true);
        }}
        placeholder={placeholder}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg bg-card border border-border shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(function (s, i) {
            return (
              <button
                key={s.fullName + i}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-secondary/60 transition-colors"
                onMouseDown={function (e) { e.preventDefault(); }}
                onClick={function () { handleSelect(s); }}
              >
                <div className="text-xs font-medium text-foreground">{s.fullName}</div>
                {(s.pro || s.ipi) && (
                  <div className="text-[10px] text-muted-foreground">
                    {[s.pro, s.ipi ? "IPI: " + s.ipi : ""].filter(Boolean).join(" · ")}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
