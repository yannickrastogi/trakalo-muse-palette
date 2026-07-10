import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown, Loader2, X, Check } from "lucide-react";
import type { TrackData } from "@/contexts/TrackContext";
import { GenreMultiSelect } from "@/components/GenreMultiSelect";
import { ArtistsInput } from "@/components/ArtistsInput";

const STATUSES = ["Available", "On Hold", "Released"];

type FieldId = "status" | "genre" | "mood" | "artist";

// A reusable multi-select bulk-edit bar. Each field is applied independently with
// SET semantics (replaces the value on every selected track). The caller wires
// `onApply` to bulk_update_tracks and shows the toast + clears the selection.
export function BulkEditBar({
  count,
  onApply,
  onClear,
  extra,
}: {
  count: number;
  onApply: (updates: Partial<TrackData>) => Promise<number>;
  onClear: () => void;
  /** Optional extra actions (e.g. "Remove from playlist") rendered inline. */
  extra?: ReactNode;
}) {
  const [openField, setOpenField] = useState<FieldId | null>(null);
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState("Available");
  const [genre, setGenre] = useState<string[]>([]);
  const [mood, setMood] = useState("");
  const [artist, setArtist] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openField) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpenField(null); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openField]);

  const apply = async (updates: Partial<TrackData>) => {
    setApplying(true);
    await onApply(updates);
    setApplying(false);
    setOpenField(null);
  };

  // NOTE: these are plain functions returning JSX (NOT nested components) so the
  // inputs inside them keep their identity across re-renders (no focus loss).
  const applyButton = (onClick: () => void, disabled?: boolean) => (
    <button
      onClick={onClick}
      disabled={applying || disabled}
      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Apply to {count}
    </button>
  );

  const field = (id: FieldId, label: string, panel: ReactNode) => (
    <div className="relative">
      <button
        onClick={() => setOpenField(openField === id ? null : id)}
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          openField === id ? "bg-brand-orange/15 border-brand-orange/30 text-brand-orange" : "bg-card border-border text-foreground hover:bg-secondary/60"
        }`}
      >
        {label} <ChevronDown className={"w-3 h-3 transition-transform " + (openField === id ? "rotate-180" : "")} />
      </button>
      {openField === id && (
        <div className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-border/40 bg-card shadow-xl z-30 p-3 space-y-3">
          {panel}
        </div>
      )}
    </div>
  );

  return (
    <div ref={ref} className="sticky top-0 z-20 flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-orange/30 bg-brand-orange/5 mb-3">
      <span className="text-xs font-semibold text-foreground">{count} selected</span>
      <span className="w-px h-4 bg-border" />

      {field("status", "Set status", (
        <>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full h-9 px-2 rounded-lg bg-secondary border border-border/50 text-xs text-foreground outline-none">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {applyButton(() => apply({ status }))}
        </>
      ))}

      {field("genre", "Set genre", (
        <>
          <GenreMultiSelect value={genre} onChange={setGenre} placeholder="Add genres…" />
          {applyButton(() => apply({ genre }), genre.length === 0)}
        </>
      ))}

      {field("mood", "Set mood", (
        <>
          <input
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="e.g. Chill, Dark, Uplifting"
            className="w-full h-9 px-2 rounded-lg bg-secondary border border-border/50 text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
          />
          {applyButton(() => apply({ mood: mood.split(",").map((m) => m.trim()).filter(Boolean) }), !mood.trim())}
        </>
      ))}

      {field("artist", "Set artist", (
        <>
          <ArtistsInput value={artist} onChange={setArtist} placeholder="Primary artist…" />
          {applyButton(() => apply({ artist: artist.join(", ") }), artist.length === 0)}
        </>
      ))}

      {extra}

      <button onClick={onClear} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <X className="w-3.5 h-3.5" /> Clear
      </button>
    </div>
  );
}
