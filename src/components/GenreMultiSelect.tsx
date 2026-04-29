import { useState, useRef, useEffect } from "react";
import { X, Plus, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GENRES } from "@/lib/constants";

const MAX_GENRES = 5;

interface GenreMultiSelectProps {
  value: string[];
  onChange: (genres: string[]) => void;
  placeholder?: string;
}

export function GenreMultiSelect({ value, onChange, placeholder }: GenreMultiSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open && !customMode) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCustomMode(false);
        setSearch("");
        setCustomInput("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, customMode]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (customMode && customInputRef.current) customInputRef.current.focus();
  }, [customMode]);

  const selected = value || [];
  const reachedMax = selected.length >= MAX_GENRES;

  const available = GENRES.filter(
    (g) => !selected.some((s) => s.toLowerCase() === g.toLowerCase()) &&
           g.toLowerCase().includes(search.toLowerCase())
  );

  const add = (genre: string) => {
    const trimmed = genre.trim();
    if (!trimmed || reachedMax) return;
    if (selected.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...selected, trimmed]);
    setSearch("");
    setCustomInput("");
  };

  const remove = (genre: string) => {
    onChange(selected.filter((g) => g !== genre));
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (customInput.trim()) {
        add(customInput);
        setCustomMode(false);
      }
    }
    if (e.key === "Escape") {
      setCustomMode(false);
      setCustomInput("");
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex flex-wrap gap-1.5 min-h-[36px] px-2 py-1.5 rounded-lg bg-secondary border border-border focus-within:border-brand-orange/30 transition-all">
        {selected.map((g) => (
          <span
            key={g}
            className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full text-2xs font-semibold bg-brand-orange/10 text-brand-orange border border-brand-orange/20"
          >
            {g}
            <button
              type="button"
              onClick={() => remove(g)}
              className="p-0.5 rounded hover:bg-brand-orange/20 transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        {!reachedMax && !customMode && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-brand-orange/30 transition-colors"
          >
            <Plus className="w-2.5 h-2.5" />
            {selected.length === 0 ? (placeholder || t("uploadTrack.selectGenre")) : t("common.add", "Add")}
            <ChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
        {customMode && (
          <input
            ref={customInputRef}
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            onBlur={() => {
              if (customInput.trim()) add(customInput);
              setCustomMode(false);
            }}
            placeholder={t("uploadTrack.enterCustomGenre", "Type and press Enter")}
            className="bg-transparent text-2xs font-semibold text-foreground placeholder:text-muted-foreground/60 outline-none flex-1 min-w-[120px] py-0.5"
          />
        )}
      </div>

      {open && !reachedMax && (
        <div className="absolute z-50 mt-1 left-0 w-full max-w-[280px] max-h-56 overflow-auto rounded-lg border border-border bg-popover shadow-xl">
          <div className="sticky top-0 bg-popover p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search", "Search...")}
              className="w-full px-2 py-1 text-xs bg-secondary/50 rounded border-none outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          {available.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">
              {t("common.noOptions", "No matching genres")}
            </div>
          ) : (
            available.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => add(g)}
                className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-secondary/50 transition-colors"
              >
                {g}
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => { setOpen(false); setCustomMode(true); setSearch(""); }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-brand-orange hover:bg-brand-orange/5 transition-colors border-t border-border sticky bottom-0 bg-popover"
          >
            + {t("uploadTrack.addCustomGenre", "Add custom genre")}
          </button>
        </div>
      )}

      {reachedMax && (
        <p className="mt-1 text-2xs text-muted-foreground/60">
          {t("uploadTrack.maxGenresReached", `Max ${MAX_GENRES} genres`).replace("{{count}}", String(MAX_GENRES))}
        </p>
      )}
    </div>
  );
}

