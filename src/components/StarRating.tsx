import { useState } from "react";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface RatingStats {
  average: number;       // 0..5 (rounded server-side to 1 decimal)
  count: number;         // total ratings for the track
  myRating: number | null;  // current user's rating, or null if not rated
}

interface StarRatingProps {
  stats: RatingStats | null | undefined;
  onRate?: (rating: number) => void;
  /** Compact = single ★ + average, click opens 5-star popover. Full = inline 5-star rail. */
  compact?: boolean;
  /** Disable click-to-rate (e.g. shared track from another workspace). */
  readOnly?: boolean;
  /** Optional className to tweak the wrapper layout. */
  className?: string;
}

const RATING_LABELS = [
  "Not for me",
  "Okay",
  "Good",
  "Strong",
  "Outstanding",
];

export function StarRating({
  stats,
  onRate,
  compact = false,
  readOnly = false,
  className,
}: StarRatingProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const average = stats?.average ?? 0;
  const count = stats?.count ?? 0;
  const myRating = stats?.myRating ?? null;
  const canRate = !readOnly && typeof onRate === "function";

  const handleSelect = (rating: number) => {
    if (!canRate) return;
    onRate!(rating);
    setOpen(false);
  };

  // ─── Compact mode: TrackRow / Catalog ───
  if (compact) {
    const hasRatings = count > 0;
    const trigger = (
      <button
        type="button"
        disabled={!canRate}
        onClick={(e) => {
          e.stopPropagation();
          if (!canRate) return;
          setOpen((v) => !v);
        }}
        className={
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-2xs font-semibold transition-colors " +
          (hasRatings
            ? "text-amber-400 hover:text-amber-300"
            : "text-muted-foreground/50 hover:text-amber-400") +
          (!canRate ? " cursor-default opacity-60" : " cursor-pointer")
        }
        aria-label={
          hasRatings
            ? `Average rating ${average} out of 5 from ${count} member${count > 1 ? "s" : ""}`
            : "Not rated yet — click to rate"
        }
      >
        <Star
          className="w-3.5 h-3.5"
          fill={hasRatings ? "currentColor" : "none"}
          strokeWidth={hasRatings ? 0 : 1.5}
        />
        {hasRatings ? (
          <span className="tabular-nums">{average.toFixed(1)}</span>
        ) : (
          <span className="opacity-70">—</span>
        )}
      </button>
    );

    if (!canRate) return <span className={className}>{trigger}</span>;

    return (
      <span className={className} onClick={(e) => e.stopPropagation()}>
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setHover(null); }}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <StarRail
              myRating={myRating}
              hover={hover}
              setHover={setHover}
              onSelect={handleSelect}
            />
            <p className="mt-1 text-2xs text-center text-muted-foreground">
              {(() => {
                const idx = (hover ?? myRating ?? 0) - 1;
                return idx >= 0 ? RATING_LABELS[idx] : "Tap a star to rate";
              })()}
            </p>
            {count > 0 && (
              <p className="mt-1 text-2xs text-center text-muted-foreground/60">
                Team avg {average.toFixed(1)} · {count} rating{count > 1 ? "s" : ""}
              </p>
            )}
          </PopoverContent>
        </Popover>
      </span>
    );
  }

  // ─── Full mode: TrackDetail ───
  return (
    <div className={"flex flex-col gap-1.5 " + (className || "")}>
      <StarRail
        myRating={myRating}
        hover={hover}
        setHover={setHover}
        onSelect={handleSelect}
        disabled={!canRate}
        size="lg"
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {count > 0 ? (
          <>
            <span className="font-semibold text-foreground tabular-nums">
              {average.toFixed(1)}
            </span>
            <span>
              · {count} rating{count > 1 ? "s" : ""}
            </span>
          </>
        ) : (
          <span>{t("starRating.noRatings")}</span>
        )}
        {myRating != null && (
          <span className="ml-auto text-amber-400 font-medium">
            Your rating: {myRating}/5
          </span>
        )}
      </div>
    </div>
  );
}

function StarRail({
  myRating,
  hover,
  setHover,
  onSelect,
  disabled,
  size = "sm",
}: {
  myRating: number | null;
  hover: number | null;
  setHover: (n: number | null) => void;
  onSelect: (rating: number) => void;
  disabled?: boolean;
  size?: "sm" | "lg";
}) {
  const dim = size === "lg" ? "w-6 h-6" : "w-4 h-4";
  return (
    <div
      className="inline-flex items-center gap-1"
      onMouseLeave={() => setHover(null)}
      role="radiogroup"
      aria-label="Track rating"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const showFilled = (hover ?? myRating ?? 0) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            role="radio"
            aria-checked={myRating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) onSelect(n);
            }}
            className={
              "transition-transform " +
              (disabled ? "cursor-default" : "cursor-pointer hover:scale-110") +
              (showFilled ? " text-amber-400" : " text-white/20")
            }
          >
            <Star
              className={dim}
              fill={showFilled ? "currentColor" : "none"}
              strokeWidth={showFilled ? 0 : 1.5}
            />
          </button>
        );
      })}
    </div>
  );
}
