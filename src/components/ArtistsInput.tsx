import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useTrack } from "@/contexts/TrackContext";
import { useContactSuggestions } from "@/hooks/useContactSuggestions";

interface ArtistsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Multi-input for artists with chip rendering and contact-based autocomplete.
 * Mirrors the comma-separated text pattern of `NameAutocomplete` but commits
 * each entry as a chip so the parent state stays a clean `string[]`.
 */
export function ArtistsInput({ value, onChange, placeholder, className }: ArtistsInputProps) {
  const { t } = useTranslation();
  const { tracks } = useTrack();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedQuery(draft.trim()), 120);
    return () => clearTimeout(debounceRef.current);
  }, [draft]);

  const existing = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  // Distinct artist names already used on tracks of the active workspace
  // (TrackContext already filters by workspace + RLS). Bands/aliases that aren't
  // contacts still surface here, which is the whole point of this source.
  const workspaceArtists = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const t of tracks) {
      const raw = (t.artist || "").trim();
      if (!raw) continue;
      for (const part of raw.split(",")) {
        const name = part.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(name);
      }
    }
    return out;
  }, [tracks]);

  // Cross-workspace contacts (own everywhere + this workspace), deduped server-side.
  const { suggestions: contactSuggestions } = useContactSuggestions(debouncedQuery);

  const suggestions = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const q = debouncedQuery.toLowerCase();
    const out: { fullName: string; stageName?: string; mine?: boolean }[] = [];
    const seen = new Set<string>();
    // Workspace artists first — most relevant context for an artist field.
    for (const name of workspaceArtists) {
      const key = name.toLowerCase();
      if (seen.has(key) || existing.has(key)) continue;
      if (key.startsWith(q) || key.indexOf(q) >= 0) {
        seen.add(key);
        out.push({ fullName: name });
      }
      if (out.length >= 8) break;
    }
    for (const c of contactSuggestions) {
      if (out.length >= 8) break;
      const full = c.fullName;
      if (!full) continue;
      const key = full.toLowerCase();
      if (seen.has(key) || existing.has(key)) continue;
      seen.add(key);
      out.push({ fullName: full, stageName: c.stageName || undefined, mine: c.source === "mine" });
    }
    return out;
  }, [debouncedQuery, contactSuggestions, workspaceArtists, existing]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const commit = useCallback((raw: string) => {
    const name = raw.trim();
    if (!name) return;
    if (existing.has(name.toLowerCase())) {
      setDraft("");
      setOpen(false);
      return;
    }
    onChange([...value, name]);
    setDraft("");
    setOpen(false);
    setHighlightIdx(-1);
  }, [value, onChange, existing]);

  /** Commit every fully-typed/pasted segment in `raw` (split on , and newlines)
   *  except a trailing un-terminated segment which becomes the new draft. */
  const commitBatch = useCallback((raw: string) => {
    const parts = raw.split(/[,\n]/);
    const tail = parts.pop() ?? "";
    const seenLower = new Set(value.map((v) => v.toLowerCase()));
    const additions: string[] = [];
    for (const part of parts) {
      const name = part.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seenLower.has(key)) continue;
      seenLower.add(key);
      additions.push(name);
    }
    if (additions.length > 0) onChange([...value, ...additions]);
    const trailing = tail.trimStart();
    setDraft(trailing);
    if (!trailing) {
      setOpen(false);
      setHighlightIdx(-1);
    }
  }, [value, onChange]);

  const removeAt = useCallback((idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
    inputRef.current?.focus();
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setHighlightIdx((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setHighlightIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlightIdx >= 0 && suggestions[highlightIdx]) {
        commit(suggestions[highlightIdx].fullName);
      } else if (draft.trim()) {
        commit(draft);
      }
    } else if (e.key === "," ) {
      e.preventDefault();
      if (draft.trim()) commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }, [open, highlightIdx, suggestions, draft, value.length, commit, removeAt]);

  return (
    <div ref={containerRef} className="relative">
      <div className={(className || "") + " flex flex-wrap items-center gap-1.5 min-h-9 px-2 py-1.5 cursor-text"} onClick={() => inputRef.current?.focus()}>
        {value.map((name, idx) => (
          <span
            key={name + ":" + idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-brand-orange/10 text-brand-orange max-w-full"
          >
            <span className="truncate">{name}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeAt(idx); }}
              className="hover:text-foreground transition-colors shrink-0"
              aria-label={"Remove " + name}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            // Typed input that contains a comma or newline → split into chips so
            // an auto-parsed filename like "Foo, Bar - Title" or a paste of
            // "Foo, Bar, Baz" doesn't end up as a single chip.
            if (/[,\n]/.test(next)) {
              commitBatch(next);
              return;
            }
            setDraft(next);
            setOpen(true);
            setHighlightIdx(-1);
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (/[,\n]/.test(pasted)) {
              e.preventDefault();
              commitBatch(draft + pasted);
            }
          }}
          onFocus={() => { if (draft.trim().length >= 2) setOpen(true); }}
          onBlur={() => { if (draft.trim()) commit(draft); }}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground/40 font-medium"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg bg-card border border-white/10 shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.fullName + ":" + i}
              type="button"
              className={"w-full text-left px-3 py-2 cursor-pointer transition-colors " + (i === highlightIdx ? "bg-white/10" : "hover:bg-white/5")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(s.fullName)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground truncate">{s.fullName}</span>
                {s.mine && (
                  <span className="shrink-0 text-[9px] font-medium text-muted-foreground rounded-full border border-white/15 px-1.5 py-0.5">
                    {t("contacts.fromYourContacts")}
                  </span>
                )}
              </div>
              {s.stageName && <div className="text-xs text-muted-foreground">{s.stageName}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
