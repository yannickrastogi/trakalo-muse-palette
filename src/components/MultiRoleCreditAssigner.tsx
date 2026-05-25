import { useState, useCallback } from "react";
import { Check, Users2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ArtistsInput } from "@/components/ArtistsInput";

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
}

/**
 * UI to assign ONE OR MORE people to many credit roles at once.
 * Type one or more names (chips + autocomplete via ArtistsInput), tick every
 * role each person fulfills, click "Add to credits" — every name is appended
 * (not overwritten) to each selected role in `details`.
 */
export function MultiRoleCreditAssigner({
  roles,
  details,
  onAssign,
}: MultiRoleCreditAssignerProps) {
  const { t } = useTranslation();
  const [names, setNames] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = useCallback((key: string) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleAdd = useCallback(() => {
    const cleanNames = names.map((n) => n.trim()).filter(Boolean);
    if (cleanNames.length === 0) return;
    const selectedKeys = Object.keys(checked).filter((k) => checked[k]);
    if (selectedKeys.length === 0) return;

    const next: Record<string, string[]> = { ...details };
    for (const k of selectedKeys) {
      const existing = Array.isArray(next[k]) ? next[k] : (next[k] ? [next[k] as unknown as string] : []);
      const filtered = existing.filter((v) => v.trim());
      const seen = new Set(filtered.map((v) => v.trim().toLowerCase()));
      const additions: string[] = [];
      for (const n of cleanNames) {
        const lower = n.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        additions.push(n);
      }
      if (additions.length > 0) {
        next[k] = [...filtered, ...additions];
      } else if (filtered.length !== existing.length) {
        // No new names, but we dropped empty entries — persist the cleaned list.
        next[k] = filtered;
      }
    }
    onAssign(next);
    setNames([]);
    setChecked({});
  }, [names, checked, details, onAssign]);

  const selectedCount = Object.values(checked).filter(Boolean).length;
  const canAdd = names.length > 0 && selectedCount > 0;

  return (
    <div className="rounded-xl border border-dashed border-brand-orange/30 bg-brand-orange/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Users2 className="w-4 h-4 text-brand-orange mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-foreground">
            {t("multiRoleAssigner.title", "Add one or more people with multiple roles")}
          </p>
          <p className="text-2xs text-muted-foreground mt-0.5">
            {t(
              "multiRoleAssigner.desc",
              "Type their names, check all the roles they play, and we'll fill them in everywhere.",
            )}
          </p>
        </div>
      </div>

      <ArtistsInput
        value={names}
        onChange={setNames}
        placeholder={t("multiRoleAssigner.namesPlaceholder", "Add names")}
        className="w-full rounded-lg bg-secondary border border-border focus-within:border-brand-orange/30 transition-all"
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
