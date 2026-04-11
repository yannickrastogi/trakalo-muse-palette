import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import type { TrackChapter } from "@/contexts/TrackContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Pencil } from "lucide-react";

const COLOR_PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--brand-pink))",
  "hsl(var(--brand-purple))",
  "hsl(var(--brand-orange))",
  "hsl(var(--accent))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface TrackWaveformPlayerProps {
  seed: number;
  bars?: number;
  peaks?: number[];
  progress: number;
  onSeek: (percent: number) => void;
  onDoubleClick?: (percent: number) => void;
  chapters?: TrackChapter[];
  isPlaying?: boolean;
  className?: string;
  unplayedColor?: string;
  editable?: boolean;
  onChaptersChange?: (chapters: TrackChapter[]) => void;
}

/**
 * Full-width interactive waveform with chapter markers.
 * Deterministic bars derived from seed, with gradient coloring by chapter region.
 */
export function TrackWaveformPlayer({
  seed,
  bars = 120,
  peaks,
  progress,
  onSeek,
  onDoubleClick,
  chapters = [],
  isPlaying = false,
  className = "",
  unplayedColor,
  editable = false,
  onChaptersChange,
}: TrackWaveformPlayerProps) {
  const [hoveredChapter, setHoveredChapter] = useState<string | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const [draftChapters, setDraftChapters] = useState<TrackChapter[]>([]);
  const editInputRef = useRef<HTMLInputElement>(null);

  // The chapters to display: draft when editing, props otherwise
  const displayChapters = editMode ? draftChapters : chapters;

  useEffect(() => {
    if (editingLabelId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingLabelId]);

  const heights = useMemo(() => {
    if (peaks && peaks.length > 0) {
      // Downsample real peaks to target bar count
      const result: number[] = [];
      const step = peaks.length / bars;
      for (let i = 0; i < bars; i++) {
        const start = Math.floor(i * step);
        const end = Math.floor((i + 1) * step);
        let sum = 0;
        for (let j = start; j < end; j++) {
          sum += peaks[j] || 0;
        }
        result.push(Math.max(0.12, sum / (end - start)));
      }
      return result;
    }
    // Fallback: deterministic pseudo-random
    const result: number[] = [];
    let s = seed + 1;
    for (let i = 0; i < bars; i++) {
      s = (s * 16807 + 7) % 2147483647;
      const normalized = (s % 100) / 100;
      const envelope = Math.sin((i / (bars - 1)) * Math.PI) * 0.5 + 0.5;
      result.push(Math.max(0.12, normalized * envelope));
    }
    return result;
  }, [seed, bars, peaks]);

  const getChapterAt = useCallback(
    (percent: number) => displayChapters.find((c) => percent >= c.startPercent && percent < c.endPercent),
    [displayChapters]
  );

  const addBoundaryAt = useCallback((splitAt: number) => {
    setDraftChapters((prev) => {
      if (prev.length === 0) {
        // First click — create two sections
        const rounded = Math.round(splitAt * 100) / 100;
        return renumberAndColor([
          { id: "ch-0", label: "Section 1", startPercent: 0, endPercent: rounded, color: COLOR_PALETTE[0] },
          { id: "ch-1", label: "Section 2", startPercent: rounded, endPercent: 100, color: COLOR_PALETTE[1] },
        ]);
      }

      const targetIdx = prev.findIndex((c) => splitAt >= c.startPercent && splitAt < c.endPercent);
      if (targetIdx === -1) return prev;

      const target = prev[targetIdx];
      // Don't split if it would create a tiny section (< 2%)
      if (splitAt - target.startPercent < 2 || target.endPercent - splitAt < 2) return prev;

      const rounded = Math.round(splitAt * 100) / 100;
      const updated = [...prev];
      updated[targetIdx] = { ...target, endPercent: rounded };
      updated.splice(targetIdx + 1, 0, {
        id: "ch-" + Date.now(),
        label: "Section",
        startPercent: rounded,
        endPercent: target.endPercent,
        color: COLOR_PALETTE[0],
      });
      return renumberAndColor(updated);
    });
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));

      if (editMode) {
        addBoundaryAt(pct);
      } else {
        onSeek(pct);
      }
    },
    [editMode, onSeek, addBoundaryAt]
  );

  const handleDeleteSection = useCallback((chapterId: string) => {
    setDraftChapters((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((c) => c.id === chapterId);
      if (idx === -1) return prev;

      const updated = [...prev];
      if (idx > 0) {
        updated[idx - 1] = { ...updated[idx - 1], endPercent: updated[idx].endPercent };
      } else {
        updated[1] = { ...updated[1], startPercent: updated[0].startPercent };
      }
      updated.splice(idx, 1);
      return renumberAndColor(updated);
    });
  }, []);

  const handleRenameCommit = useCallback(() => {
    if (!editingLabelId) {
      setEditingLabelId(null);
      return;
    }
    const trimmed = editingLabelValue.trim();
    if (!trimmed) {
      setEditingLabelId(null);
      return;
    }
    setDraftChapters((prev) =>
      prev.map((ch) => (ch.id === editingLabelId ? { ...ch, label: trimmed } : ch))
    );
    setEditingLabelId(null);
  }, [editingLabelId, editingLabelValue]);

  const enterEditMode = useCallback(() => {
    setDraftChapters([...chapters]);
    setEditMode(true);
  }, [chapters]);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setEditingLabelId(null);
    if (onChaptersChange) {
      onChaptersChange(draftChapters);
    }
  }, [draftChapters, onChaptersChange]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      setHoverPercent(pct);
      const ch = getChapterAt(pct);
      setHoveredChapter(ch?.id || null);
    },
    [getChapterAt]
  );

  const barWidth = 2.5;
  const barGap = 1;
  const totalWidth = bars * (barWidth + barGap);
  const height = 56;

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Waveform */}
      <div
        className={`relative cursor-pointer group ${editMode ? "ring-1 ring-primary/30 rounded" : ""}`}
        onClick={handleClick}
        onDoubleClick={(e) => {
          if (!editMode && onDoubleClick) {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            onDoubleClick(pct);
          }
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setHoverPercent(null);
          setHoveredChapter(null);
        }}
      >
        {/* Hover position indicator */}
        {hoverPercent !== null && (
          <div
            className={`absolute top-0 bottom-0 w-px z-10 pointer-events-none ${editMode ? "bg-primary/60" : "bg-foreground/30"}`}
            style={{ left: `${hoverPercent}%` }}
          />
        )}

        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${totalWidth} ${height}`}
          preserveAspectRatio="none"
          className="w-full"
        >
          <defs>
            <linearGradient id={`wf-played-${seed}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--brand-orange))" />
              <stop offset="50%" stopColor="hsl(var(--brand-pink))" />
              <stop offset="100%" stopColor="hsl(var(--brand-purple))" />
            </linearGradient>
          </defs>

          {heights.map((h, i) => {
            const barPct = (i / bars) * 100;
            const barHeight = h * (height - 4);
            const y = (height - barHeight) / 2;
            const played = barPct <= progress;

            return (
              <rect
                key={i}
                x={i * (barWidth + barGap)}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={1}
                fill={played ? `url(#wf-played-${seed})` : (unplayedColor || "hsl(var(--muted-foreground) / 0.2)")}
                className={`transition-opacity duration-75 ${
                  isPlaying && played ? "opacity-100" : played ? "opacity-80" : "opacity-100"
                }`}
              />
            );
          })}

          {/* Playhead */}
          <rect
            x={(progress / 100) * totalWidth - 1}
            y={0}
            width={2}
            height={height}
            rx={1}
            fill="hsl(var(--foreground))"
            className="drop-shadow-sm"
          />
        </svg>
      </div>

      {/* Chapter lane */}
      {displayChapters.length > 0 && (
        <div className="flex items-center gap-1">
          <div className="relative h-6 flex rounded-md overflow-hidden border border-border/50 flex-1">
            {displayChapters.map((ch) => {
              const width = ch.endPercent - ch.startPercent;
              const isHovered = hoveredChapter === ch.id;
              const isActive = progress >= ch.startPercent && progress < ch.endPercent;
              const isEditingLabel = editingLabelId === ch.id;

              return (
                <Tooltip key={ch.id}>
                  <TooltipTrigger asChild>
                    <div
                      className="relative flex items-center justify-center text-[9px] font-semibold uppercase tracking-wide cursor-pointer transition-all duration-150 border-r border-border/30 last:border-r-0 group/section"
                      style={{
                        width: `${width}%`,
                        backgroundColor: isActive
                          ? `color-mix(in srgb, ${ch.color} 30%, transparent)`
                          : isHovered
                          ? `color-mix(in srgb, ${ch.color} 20%, transparent)`
                          : "hsl(var(--secondary) / 0.5)",
                        color: isActive ? ch.color : "hsl(var(--muted-foreground))",
                      }}
                      onMouseEnter={() => setHoveredChapter(ch.id)}
                      onMouseLeave={() => setHoveredChapter(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!editMode && !isEditingLabel) onSeek(ch.startPercent);
                      }}
                    >
                      {isEditingLabel ? (
                        <input
                          ref={editInputRef}
                          className="w-full h-full bg-transparent text-center text-[9px] font-semibold uppercase tracking-wide outline-none border-none px-0.5"
                          value={editingLabelValue}
                          onChange={(e) => setEditingLabelValue(e.target.value)}
                          onBlur={handleRenameCommit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameCommit();
                            if (e.key === "Escape") setEditingLabelId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={`truncate px-0.5 leading-none select-none`}
                          onDoubleClick={(e) => {
                            if (editMode) {
                              e.stopPropagation();
                              setEditingLabelId(ch.id);
                              setEditingLabelValue(ch.label);
                            }
                          }}
                        >
                          {width > 6 ? ch.label : ch.label.charAt(0)}
                        </span>
                      )}
                      {editMode && !isEditingLabel && displayChapters.length > 1 && (
                        <button
                          className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/section:opacity-100 transition-opacity z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSection(ch.id);
                          }}
                        >
                          <X className="w-2 h-2" />
                        </button>
                      )}
                      {isActive && (
                        <div
                          className="absolute bottom-0 left-0 h-[2px] rounded-full"
                          style={{
                            backgroundColor: ch.color,
                            width: `${((progress - ch.startPercent) / width) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {ch.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          {editable && !editMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="h-6 w-6 flex-shrink-0 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                  onClick={enterEditMode}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Edit sections
              </TooltipContent>
            </Tooltip>
          )}
          {editMode && (
            <button
              className="h-6 px-2 flex-shrink-0 flex items-center justify-center rounded-md border border-primary/50 text-primary text-[10px] font-medium hover:bg-primary/10 transition-colors"
              onClick={exitEditMode}
            >
              Done
            </button>
          )}
        </div>
      )}

      {/* Empty state: Add Sections button or Done button */}
      {displayChapters.length === 0 && editable && (
        <div>
          {!editMode ? (
            <button
              className="h-6 px-3 text-[10px] font-medium text-muted-foreground border border-border/50 rounded-md hover:text-foreground hover:bg-secondary/80 transition-colors"
              onClick={enterEditMode}
            >
              Add Sections
            </button>
          ) : (
            <button
              className="h-6 px-3 text-[10px] font-medium text-primary border border-primary/50 rounded-md hover:bg-primary/10 transition-colors"
              onClick={exitEditMode}
            >
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Re-number section labels that still have default names and re-assign colors */
function renumberAndColor(chapters: TrackChapter[]): TrackChapter[] {
  let sectionNum = 0;
  return chapters.map((ch, i) => {
    const isDefaultLabel = /^Section(\s+\d+)?$/.test(ch.label);
    if (isDefaultLabel) {
      sectionNum++;
      return { ...ch, label: `Section ${sectionNum}`, color: COLOR_PALETTE[i % COLOR_PALETTE.length] };
    }
    return { ...ch, color: COLOR_PALETTE[i % COLOR_PALETTE.length] };
  });
}
