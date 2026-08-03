import { type ReactNode } from "react";
import { Layers, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

// Sticky selection action bar shown when one or more tracks are selected. It keeps
// the exact selection count visible and offers the two primary actions — "Edit all"
// (opens the full multi-track editor) and an optional destructive action — plus any
// context-specific `extra` action (e.g. "Remove from playlist").
export function BulkEditBar({
  count,
  onEditAll,
  onDelete,
  extra,
  onClear,
}: {
  count: number;
  onEditAll: () => void;
  /** Optional destructive action (e.g. delete tracks). Omit to hide the button. */
  onDelete?: () => void;
  /** Optional extra action rendered inline (e.g. "Remove from playlist"). */
  extra?: ReactNode;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-orange/30 bg-brand-orange/5 mb-3">
      <span className="text-xs font-semibold text-foreground">
        {t("bulkEdit.selectedCount", { count, defaultValue: count + " selected" })}
      </span>
      <span className="w-px h-4 bg-border" />

      <button
        onClick={onEditAll}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand"
      >
        <Layers className="w-3.5 h-3.5" /> {t("bulkEdit.editAll", "Edit all")}
      </button>

      {onDelete && (
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-destructive/30 bg-card text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> {t("common.delete", "Delete")}
        </button>
      )}

      {extra}

      <button
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-3.5 h-3.5" /> {t("common.clear", "Clear")}
      </button>
    </div>
  );
}
