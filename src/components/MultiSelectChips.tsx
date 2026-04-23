import { useState, useRef, useEffect, useMemo } from "react";
import { X } from "lucide-react";

interface MultiSelectChipsProps {
  options: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  filterable?: boolean;
  className?: string;
}

export function MultiSelectChips({
  options,
  selected,
  onChange,
  placeholder = "Select...",
  maxItems,
  filterable = false,
  className = "",
}: MultiSelectChipsProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(function () {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return function () { document.removeEventListener("mousedown", handleClick); };
  }, []);

  var filtered = useMemo(function () {
    if (!filterable || !search.trim()) return options;
    var q = search.toLowerCase();
    return options.filter(function (o) { return o.toLowerCase().indexOf(q) >= 0; });
  }, [options, search, filterable]);

  function toggle(value: string) {
    if (selected.indexOf(value) >= 0) {
      onChange(selected.filter(function (s) { return s !== value; }));
    } else {
      if (maxItems && selected.length >= maxItems) return;
      onChange(selected.concat([value]));
    }
  }

  function remove(value: string) {
    onChange(selected.filter(function (s) { return s !== value; }));
  }

  return (
    <div ref={containerRef} className={"relative " + className}>
      <button
        type="button"
        onClick={function () { setOpen(!open); }}
        className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium text-left flex items-center gap-1 overflow-hidden"
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground/40 truncate">{placeholder}</span>
        ) : (
          <span className="flex items-center gap-1 overflow-hidden flex-1 min-w-0">
            {selected.map(function (s) {
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-brand-orange/10 text-brand-orange text-[10px] font-semibold shrink-0 max-w-[120px] truncate"
                >
                  <span className="truncate">{s}</span>
                  <button
                    type="button"
                    onClick={function (e) { e.stopPropagation(); remove(s); }}
                    className="hover:text-foreground"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg bg-card border border-border shadow-lg max-h-48 overflow-y-auto">
          {filterable && (
            <div className="p-1.5 border-b border-border sticky top-0 bg-card">
              <input
                autoFocus
                value={search}
                onChange={function (e) { setSearch(e.target.value); }}
                placeholder="Search..."
                className="h-7 w-full px-2 rounded bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 placeholder:text-muted-foreground/40"
              />
            </div>
          )}
          {filtered.map(function (opt) {
            var isSelected = selected.indexOf(opt) >= 0;
            var isDisabled = !isSelected && maxItems != null && selected.length >= maxItems;
            return (
              <button
                key={opt}
                type="button"
                disabled={isDisabled}
                onMouseDown={function (e) { e.preventDefault(); }}
                onClick={function () { toggle(opt); }}
                className={
                  "w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 " +
                  (isSelected ? "bg-brand-orange/8 text-brand-orange font-semibold" : "text-foreground hover:bg-secondary/60") +
                  (isDisabled ? " opacity-40 cursor-not-allowed" : "")
                }
              >
                <span className={"w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 " + (isSelected ? "border-brand-orange bg-brand-orange/20" : "border-border")}>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-sm bg-brand-orange" />}
                </span>
                {opt}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>
          )}
        </div>
      )}
    </div>
  );
}
