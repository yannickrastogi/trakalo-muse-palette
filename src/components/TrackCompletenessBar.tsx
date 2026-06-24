import { useTranslation } from "react-i18next";
import type { CompletenessResult } from "@/hooks/useTrackCompleteness";

interface TrackCompletenessBarProps {
  result: CompletenessResult;
  compact?: boolean;
  className?: string;
}

const STROKE_COLOR: Record<CompletenessResult["color"], string> = {
  green: "text-emerald-500",
  amber: "text-amber-500",
  red: "text-red-500",
};
const TEXT_COLOR: Record<CompletenessResult["color"], string> = {
  green: "text-emerald-500",
  amber: "text-amber-500",
  red: "text-red-500",
};
const BG_COLOR: Record<CompletenessResult["color"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

// r=14 → circumference = 2·π·14 ≈ 87.96
const R = 14;
const CIRC = 2 * Math.PI * R;

export function TrackCompletenessBar({ result, compact = false, className = "" }: TrackCompletenessBarProps) {
  const { t } = useTranslation();
  const { score, missing, color } = result;

  if (compact) {
    const tooltip =
      missing.length > 0
        ? `${t("completeness.title")} ${score}% — ${t("completeness.missing")}: ${missing.map((m) => t(m)).join(", ")}`
        : `${t("completeness.title")} ${score}% — ${t("completeness.complete")}`;
    return (
      <div className={"inline-flex shrink-0 " + className} title={tooltip} aria-label={tooltip}>
        <svg viewBox="0 0 32 32" className="w-8 h-8">
          <circle cx="16" cy="16" r={R} fill="none" stroke="currentColor" strokeWidth="3" className="text-secondary" />
          <circle
            cx="16"
            cy="16"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${(score / 100) * CIRC} ${CIRC}`}
            strokeLinecap="round"
            className={STROKE_COLOR[color]}
            transform="rotate(-90 16 16)"
          />
          <text x="16" y="19.5" textAnchor="middle" className="text-[8px] font-bold fill-current text-foreground">
            {score}%
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className={"space-y-2 " + className}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{t("completeness.title")}</span>
        <span className={"text-sm font-bold " + TEXT_COLOR[color]}>{score}%</span>
      </div>
      <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
        <div
          className={"h-2 rounded-full transition-all " + BG_COLOR[color]}
          style={{ width: `${score}%` }}
        />
      </div>
      {missing.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("completeness.missing")} :</p>
          <div className="flex flex-wrap gap-1">
            {missing.map((m) => (
              <span key={m} className="px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground">
                {t(m)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-emerald-500">{t("completeness.complete")}</p>
      )}
    </div>
  );
}
