import { useState, useRef, useEffect } from "react";
import { X, Plus, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  INSTRUMENTS,
  LYRIC_THEMES,
  MOOD_FEEL,
  TEMPO_DESCRIPTORS,
  SYNC_TAGS,
  type TrackTags,
} from "@/lib/tagsVocabulary";

interface TagsSectionProps {
  tags: TrackTags;
  onChange?: (tags: TrackTags) => void;
  readOnly?: boolean;
}

const categoryConfig = [
  { key: "instruments" as const, label: "Instruments", vocabulary: INSTRUMENTS, color: "pink" },
  { key: "lyric_themes" as const, label: "Lyric Themes", vocabulary: LYRIC_THEMES, color: "purple" },
  { key: "mood_feel" as const, label: "Mood & Feel", vocabulary: MOOD_FEEL, color: "orange" },
  { key: "sync_tags" as const, label: "Sync Tags", vocabulary: SYNC_TAGS, color: "green" },
];

const colorClasses: Record<string, { chip: string; chipHover: string; add: string; addHover: string; dot: string }> = {
  pink: {
    chip: "bg-pink-500/10 border-pink-500/20 text-pink-400",
    chipHover: "hover:bg-pink-500/20",
    add: "text-pink-400 border-pink-500/20",
    addHover: "hover:bg-pink-500/10",
    dot: "bg-pink-500",
  },
  purple: {
    chip: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    chipHover: "hover:bg-purple-500/20",
    add: "text-purple-400 border-purple-500/20",
    addHover: "hover:bg-purple-500/10",
    dot: "bg-purple-500",
  },
  orange: {
    chip: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    chipHover: "hover:bg-orange-500/20",
    add: "text-orange-400 border-orange-500/20",
    addHover: "hover:bg-orange-500/10",
    dot: "bg-orange-500",
  },
  blue: {
    chip: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    chipHover: "hover:bg-blue-500/20",
    add: "text-blue-400 border-blue-500/20",
    addHover: "hover:bg-blue-500/10",
    dot: "bg-blue-500",
  },
  green: {
    chip: "bg-green-500/10 border-green-500/20 text-green-400",
    chipHover: "hover:bg-green-500/20",
    add: "text-green-400 border-green-500/20",
    addHover: "hover:bg-green-500/10",
    dot: "bg-green-500",
  },
  gray: {
    chip: "bg-gray-500/10 border-gray-500/20 text-gray-400",
    chipHover: "hover:bg-gray-500/20",
    add: "text-gray-400 border-gray-500/20",
    addHover: "hover:bg-gray-500/10",
    dot: "bg-gray-500",
  },
};

function findDisplayLabel(value: string, vocabulary: string[]): string {
  return vocabulary.find((v) => v.toLowerCase() === value) || value;
}

function MultiSelectCategory({
  label,
  vocabulary,
  selected,
  color,
  readOnly,
  onAdd,
  onRemove,
}: {
  label: string;
  vocabulary: string[];
  selected: string[];
  color: string;
  readOnly?: boolean;
  onAdd: (val: string) => void;
  onRemove: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const colors = colorClasses[color];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const available = vocabulary.filter(
    (v) => !selected.includes(v.toLowerCase()) && v.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${colors.dot} shrink-0`} />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {selected.map((val) => (
          <span
            key={val}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${colors.chip} transition-colors`}
          >
            {findDisplayLabel(val, vocabulary)}
            {!readOnly && (
              <button type="button" onClick={() => onRemove(val)} className="hover:opacity-70 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {!readOnly && (
          <div className="relative" ref={ref}>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed ${colors.add} ${colors.addHover} transition-colors`}
            >
              <Plus className="w-3 h-3" />
              Add
              <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="absolute z-50 mt-1 left-0 w-56 max-h-48 overflow-auto rounded-lg border border-border bg-card shadow-xl">
                <div className="sticky top-0 bg-card p-1.5 border-b border-border">
                  <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full px-2 py-1 text-xs bg-secondary/50 rounded border-none outline-none text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                {available.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No options</div>
                ) : (
                  available.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { onAdd(v.toLowerCase()); setSearch(""); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      {v}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TagsSection({ tags, onChange, readOnly }: TagsSectionProps) {
  const { t } = useTranslation();

  const handleAddMulti = (key: "instruments" | "lyric_themes" | "mood_feel" | "sync_tags", val: string) => {
    if (!onChange) return;
    const current = tags[key] || [];
    if (!current.includes(val)) {
      onChange({ ...tags, [key]: [...current, val] });
    }
  };

  const handleRemoveMulti = (key: "instruments" | "lyric_themes" | "mood_feel" | "sync_tags", val: string) => {
    if (!onChange) return;
    onChange({ ...tags, [key]: (tags[key] || []).filter((v) => v !== val) });
  };

  const handleTempoClick = (val: string) => {
    if (!onChange) return;
    const lower = val.toLowerCase();
    onChange({ ...tags, tempo_descriptor: tags.tempo_descriptor === lower ? null : lower });
  };

  const [customInput, setCustomInput] = useState("");
  const handleAddCustom = () => {
    if (!onChange || !customInput.trim()) return;
    const val = customInput.trim().toLowerCase();
    const current = tags.custom || [];
    if (!current.includes(val)) {
      onChange({ ...tags, custom: [...current, val] });
    }
    setCustomInput("");
  };

  const handleRemoveCustom = (val: string) => {
    if (!onChange) return;
    onChange({ ...tags, custom: (tags.custom || []).filter((v) => v !== val) });
  };

  const hasAnyTags =
    (tags.instruments?.length || 0) > 0 ||
    (tags.lyric_themes?.length || 0) > 0 ||
    (tags.mood_feel?.length || 0) > 0 ||
    tags.tempo_descriptor ||
    (tags.sync_tags?.length || 0) > 0 ||
    (tags.custom?.length || 0) > 0;

  if (readOnly && !hasAnyTags) {
    return <p className="text-sm text-muted-foreground italic">{t("trackDetail.noTagsYet", "No tags yet")}</p>;
  }

  const blueColors = colorClasses.blue;
  const grayColors = colorClasses.gray;

  return (
    <div className="space-y-4">
      {categoryConfig.map((cat) => {
        const selected = tags[cat.key] || [];
        if (readOnly && selected.length === 0) return null;
        return (
          <MultiSelectCategory
            key={cat.key}
            label={cat.label}
            vocabulary={cat.vocabulary}
            selected={selected}
            color={cat.color}
            readOnly={readOnly}
            onAdd={(val) => handleAddMulti(cat.key, val)}
            onRemove={(val) => handleRemoveMulti(cat.key, val)}
          />
        );
      })}

      {/* Tempo — single select */}
      {(readOnly && !tags.tempo_descriptor) ? null : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${blueColors.dot} shrink-0`} />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tempo</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPO_DESCRIPTORS.map((val) => {
              const isActive = tags.tempo_descriptor === val.toLowerCase();
              return (
                <button
                  key={val}
                  type="button"
                  disabled={readOnly}
                  onClick={() => handleTempoClick(val)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    isActive
                      ? `${blueColors.chip} ring-1 ring-blue-500/40`
                      : readOnly
                        ? "border-border text-muted-foreground"
                        : `border-dashed border-border text-muted-foreground hover:border-blue-500/30 hover:text-blue-400`
                  } ${readOnly ? "cursor-default" : "cursor-pointer"}`}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom tags */}
      {(readOnly && (!tags.custom || tags.custom.length === 0)) ? null : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${grayColors.dot} shrink-0`} />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Custom</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(tags.custom || []).map((val) => (
              <span
                key={val}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${grayColors.chip} transition-colors`}
              >
                {val}
                {!readOnly && (
                  <button type="button" onClick={() => handleRemoveCustom(val)} className="hover:opacity-70 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
            {!readOnly && (
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustom(); } }}
                placeholder="Add custom tag..."
                className="px-2.5 py-1 rounded-full text-xs bg-secondary/30 border border-dashed border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-gray-400 w-36"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
