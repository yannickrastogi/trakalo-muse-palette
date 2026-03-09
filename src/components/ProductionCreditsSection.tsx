import { X, Plus } from "lucide-react";

interface ProductionCreditsSectionProps {
  details: Record<string, string[]>;
  updateDetail: (key: string, index: number, value: string) => void;
  addDetailEntry: (key: string) => void;
  removeDetailEntry: (key: string, index: number) => void;
}

const PRODUCTION_FIELDS = [
  { key: "producers", label: "Producer(s)" },
  { key: "songwriters", label: "Songwriter(s)" },
  { key: "recordingEngineer", label: "Recording Engineer" },
  { key: "mixingEngineer", label: "Mixing Engineer" },
  { key: "masteringEngineer", label: "Mastering Engineer" },
  { key: "programmingBy", label: "Programming By" },
  { key: "mixingStudio", label: "Mixing Studio" },
  { key: "recordingStudio", label: "Recording Studio" },
  { key: "recordingDate", label: "Recording Date" },
];

export function ProductionCreditsSection({
  details,
  updateDetail,
  addDetailEntry,
  removeDetailEntry,
}: ProductionCreditsSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-foreground border-b border-border pb-1 mt-2">Production & Other Credits</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PRODUCTION_FIELDS.map((f) => {
          const raw = details[f.key];
          const entries = Array.isArray(raw) ? raw : raw ? [raw] : [""];
          const isDate = f.key === "recordingDate";
          return (
            <div key={f.key} className="space-y-1">
              <label className="text-2xs text-muted-foreground font-medium">{f.label}</label>
              {entries.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <input
                    type={isDate ? "date" : "text"}
                    value={entry}
                    onChange={(e) => updateDetail(f.key, idx, e.target.value)}
                    placeholder={isDate ? "" : `Enter ${f.label.toLowerCase()}`}
                    className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
                  />
                  {entries.length > 1 && (
                    <button
                      onClick={() => removeDetailEntry(f.key, idx)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {!isDate && entries[0]?.trim() && (
                <button
                  onClick={() => addDetailEntry(f.key)}
                  className="flex items-center gap-1 text-2xs text-brand-orange hover:text-brand-orange/80 font-semibold transition-colors mt-0.5"
                >
                  <Plus className="w-3 h-3" /> Add another
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
