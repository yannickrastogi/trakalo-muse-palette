import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Contact } from "@/contexts/ContactsContext";
import { useContactSuggestions } from "@/hooks/useContactSuggestions";

export interface CollaboratorSuggestion {
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  stage_name?: string;
  role?: string;
  pro?: string;
  ipi?: string;
  publisher?: string;
  source: "contact" | "split";
  /** True when the contact comes from the caller's own cross-workspace pool. */
  mine?: boolean;
}

interface CollaboratorAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: CollaboratorSuggestion) => void;
  /** @deprecated Suggestions now come from the cross-workspace RPC; kept for call-site compat. */
  contacts?: Contact[];
  existingSplitNames?: string[];
  placeholder?: string;
  className?: string;
}

export function CollaboratorAutocomplete({
  value,
  onChange,
  onSelect,
  existingSplitNames = [],
  placeholder,
  className,
}: CollaboratorAutocompleteProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Cross-workspace suggestions: the caller's own contacts everywhere + this
  // workspace's contacts, deduped server-side. Replaces the old workspace-only pool.
  const { suggestions: contactSuggestions } = useContactSuggestions(value);

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

    // From cross-workspace contacts (already query-filtered by the RPC).
    for (var i = 0; i < contactSuggestions.length; i++) {
      var c = contactSuggestions[i];
      var full = c.fullName;
      if (!full) continue;
      var key = full.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        firstName: c.firstName,
        lastName: c.lastName,
        fullName: full,
        email: c.email || undefined,
        stage_name: c.stageName || undefined,
        role: c.role || undefined,
        pro: c.pro.length ? c.pro.join(", ") : undefined,
        ipi: c.ipi || undefined,
        publisher: c.publisher || undefined,
        source: "contact",
        mine: c.source === "mine",
      });
    }

    // From existing split names (session-local, instant — not a contacts read).
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
  }, [value, contactSuggestions, existingSplitNames]);

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
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground truncate">{s.fullName}{s.stage_name ? " (" + s.stage_name + ")" : ""}</span>
                  {s.mine && (
                    <span className="shrink-0 text-[9px] font-medium text-muted-foreground rounded-full border border-border px-1.5 py-0.5">
                      {t("contacts.fromYourContacts")}
                    </span>
                  )}
                </div>
                {(s.role || s.pro || s.ipi) && (
                  <div className="text-[10px] text-muted-foreground">
                    {[s.role, s.pro, s.ipi ? "IPI: " + s.ipi : ""].filter(Boolean).join(" · ")}
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
