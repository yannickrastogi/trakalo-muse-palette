import { useState, useCallback } from "react";
import { Check, Users2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NameAutocomplete } from "@/components/NameAutocomplete";

export interface CreditRoleOption {
  key: string;
  label: string;
}

interface MultiRoleCreditAssignerProps {
  /** Role keys + labels available for batch assignment (e.g. drumsBy, synthsBy, producers, ...). */
  roles: CreditRoleOption[];
  /** Current credit map. Same shape used by PerformerCreditsSection/ProductionCreditsSection. */
  details: Record<string, string[]>;
  /** Replace the value for a given role key. */
  onAssign: (next: Record<string, string[]>) => void;
  /** Optional extra autocomplete suggestions (e.g. collaborators from splits). */
  extraSuggestions?: { name: string; stage_name?: string }[];
}

/**
 * UI to assign ONE person to many credit roles at once.
 * Type a name, tick every role they fulfill, click "Add to credits" —
 * the name is appended (not overwritten) to each selected role in `details`.
 */
export function MultiRoleCreditAssigner({
  roles,
  details,
  onAssign,
  extraSuggestions = [],
}: MultiRoleCreditAssignerProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = useCallback((key: string) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleAdd = useCallback(() => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const selectedKeys = Object.keys(checked).filter((k) => checked[k]);
    if (selectedKeys.length === 0) return;

    const next: Record<string, string[]> = { ...details };
    for (const k of selectedKeys) {
      const existing = Array.isArray(next[k]) ? next[k] : (next[k] ? [next[k] as unknown as string] : []);
      const hasIt = existing.some((v) => v.trim().toLowerCase() === cleanName.toLowerCase());
      if (hasIt) continue;
      const filtered = existing.filter((v) => v.trim());
      next[k] = filtered.length === 0 ? [cleanName] : [...filtered, cleanName];
    }
    onAssign(next);
    setName("");
    setChecked({});
  }, [name, checked, details, onAssign]);

  const selectedCount = Object.values(checked).filter(Boolean).length;
  const canAdd = name.trim().length > 0 && selectedCount > 0;

  return (
    <div className="rounded-xl border border-dashed border-brand-orange/30 bg-brand-orange/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Users2 className="w-4 h-4 text-brand-orange mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-foreground">
            {t("multiRoleAssigner.title", "Add a person with multiple roles")}
          </p>
          <p className="text-2xs text-muted-foreground mt-0.5">
            {t(
              "multiRoleAssigner.desc",
              "Type their name once, tick all the roles they play, and we'll fill them everywhere.",
            )}
          </p>
        </div>
      </div>

      <NameAutocomplete
        value={name}
        onChange={setName}
        placeholder={t("multiRoleAssigner.namePlaceholder", "Full name")}
        className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
        extraSuggestions={extraSuggestions}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {roles.map((r) => {
          const isOn = !!checked[r.key];
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => toggle(r.key)}
              className={
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-medium text-left transition-colors " +
                (isOn
                  ? "bg-brand-orange/15 text-brand-orange border border-brand-orange/40"
                  : "bg-secondary/60 text-muted-foreground border border-border hover:text-foreground")
              }
              aria-pressed={isOn}
            >
              <span
                className={
                  "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors " +
                  (isOn ? "bg-brand-orange border-brand-orange" : "border-muted-foreground/40")
                }
              >
                {isOn && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              <span className="truncate">{r.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-2xs text-muted-foreground">
          {selectedCount === 0
            ? t("multiRoleAssigner.noneSelected", "No roles selected")
            : t("multiRoleAssigner.selectedCount", { count: selectedCount, defaultValue: selectedCount + " roles selected" })}
        </span>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className={
            "px-3 py-1.5 rounded-lg text-2xs font-semibold transition-all " +
            (canAdd
              ? "bg-brand-orange text-white hover:opacity-90"
              : "bg-secondary text-muted-foreground cursor-not-allowed opacity-60")
          }
        >
          {t("multiRoleAssigner.add", "Add to credits")}
        </button>
      </div>
    </div>
  );
}
