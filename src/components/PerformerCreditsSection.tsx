import { X, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NameAutocomplete } from "@/components/NameAutocomplete";

export interface CustomCreditEntry {
  id: string;
  role: string;
  values: string[];
}

interface PerformerCreditsSectionProps {
  details: Record<string, string[]>;
  updateDetail: (key: string, index: number, value: string) => void;
  addDetailEntry: (key: string) => void;
  removeDetailEntry: (key: string, index: number) => void;
  extraSuggestions?: { name: string; stage_name?: string }[];
  customPerformers?: CustomCreditEntry[];
  onAddCustomPerformer?: () => void;
  onUpdateCustomPerformer?: (id: string, field: "role" | "values", value: string | string[]) => void;
  onRemoveCustomPerformer?: (id: string) => void;
  onAddCustomPerformerValue?: (id: string) => void;
  onRemoveCustomPerformerValue?: (id: string, index: number) => void;
}

const PERFORMER_FIELDS = [
  { key: "vocalsBy", labelKey: "performerCredits.leadVocals" },
  { key: "backgroundVocalsBy", labelKey: "performerCredits.backgroundVocals" },
  { key: "drumsBy", labelKey: "performerCredits.drums" },
  { key: "synthsBy", labelKey: "performerCredits.synths" },
  { key: "keysBy", labelKey: "performerCredits.keys" },
  { key: "guitarsBy", labelKey: "performerCredits.guitars" },
  { key: "bassBy", labelKey: "performerCredits.bass" },
];

export function PerformerCreditsSection({
  details,
  updateDetail,
  addDetailEntry,
  removeDetailEntry,
  extraSuggestions = [],
  customPerformers = [],
  onAddCustomPerformer,
  onUpdateCustomPerformer,
  onRemoveCustomPerformer,
  onAddCustomPerformerValue,
  onRemoveCustomPerformerValue,
}: PerformerCreditsSectionProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-foreground border-b border-border pb-1">{t("performerCredits.title")}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PERFORMER_FIELDS.map((f) => {
          const raw = details[f.key];
          const entries = Array.isArray(raw) ? raw : raw ? [raw] : [""];
          return (
            <div key={f.key} className="space-y-1">
              <label className="text-2xs text-muted-foreground font-medium">{t(f.labelKey)}</label>
              {entries.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <NameAutocomplete
                    value={entry}
                    onChange={(v) => updateDetail(f.key, idx, v)}
                    placeholder={"Enter " + t(f.labelKey).toLowerCase()}
                    className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
                    extraSuggestions={extraSuggestions}
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
              {entries[0]?.trim() && (
                <button
                  onClick={() => addDetailEntry(f.key)}
                  className="flex items-center gap-1 text-2xs text-brand-orange hover:text-brand-orange/80 font-semibold transition-colors mt-0.5"
                >
                  <Plus className="w-3 h-3" /> {t("performerCredits.addAnother")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Performers */}
      {customPerformers.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border/50">
          {customPerformers.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-dashed border-border/60 bg-secondary/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={entry.role}
                  onChange={(e) => onUpdateCustomPerformer?.(entry.id, "role", e.target.value)}
                  placeholder="Role name (e.g. Strings By)"
                  className="h-8 flex-1 px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-pink-500/30 transition-all font-semibold placeholder:text-muted-foreground/40 placeholder:font-normal"
                />
                <button
                  onClick={() => onRemoveCustomPerformer?.(entry.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {entry.values.map((val, idx) => (
                <div key={idx} className="flex items-center gap-1 pl-1">
                  <NameAutocomplete
                    value={val}
                    onChange={(v) => {
                      const updated = [...entry.values];
                      updated[idx] = v;
                      onUpdateCustomPerformer?.(entry.id, "values", updated);
                    }}
                    placeholder="Enter name"
                    className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-pink-500/30 transition-all font-medium placeholder:text-muted-foreground/40"
                    extraSuggestions={extraSuggestions}
                  />
                  {entry.values.length > 1 && (
                    <button
                      onClick={() => onRemoveCustomPerformerValue?.(entry.id, idx)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {entry.values[0]?.trim() && (
                <button
                  onClick={() => onAddCustomPerformerValue?.(entry.id)}
                  className="flex items-center gap-1 text-2xs text-brand-orange hover:text-brand-orange/80 font-semibold transition-colors ml-1"
                >
                  <Plus className="w-3 h-3" /> Add another
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {onAddCustomPerformer && (
        <button
          onClick={onAddCustomPerformer}
          className="flex items-center gap-1.5 text-xs text-pink-500 hover:text-pink-400 font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Custom Performer
        </button>
      )}
    </div>
  );
}
