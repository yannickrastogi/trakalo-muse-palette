import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { useContactSuggestions, type ContactSuggestion } from "@/hooks/useContactSuggestions";

interface ContactSuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when a suggestion is picked — the caller fills its form fields. */
  onSelect: (suggestion: ContactSuggestion) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  id?: string;
  required?: boolean;
  /**
   * Query override. Defaults to `value`. Pass a derived query (e.g. the last
   * comma-separated segment) when the field holds multiple entries.
   */
  query?: string;
}

/**
 * A text/email input backed by cross-workspace contact suggestions. On select it
 * hands the full contact to `onSelect` so the parent can autofill every field.
 * Purely a suggestion surface — it never writes contacts itself.
 */
export function ContactSuggestInput({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  type = "text",
  id,
  required,
  query,
}: ContactSuggestInputProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { suggestions } = useContactSuggestions(query ?? value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback(
    (s: ContactSuggestion) => {
      onSelect(s);
      setOpen(false);
    },
    [onSelect],
  );

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg bg-card border border-border shadow-lg max-h-56 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-secondary/60 transition-colors"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">
                  {s.fullName || s.email || s.stageName}
                </span>
                {s.source === "mine" && (
                  <span className="shrink-0 text-[10px] font-medium text-muted-foreground rounded-full border border-border px-1.5 py-0.5">
                    {t("contacts.fromYourContacts")}
                  </span>
                )}
              </div>
              {(s.stageName || s.email) && (
                <div className="text-xs text-muted-foreground truncate">
                  {[s.stageName, s.email].filter(Boolean).join(" · ")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
