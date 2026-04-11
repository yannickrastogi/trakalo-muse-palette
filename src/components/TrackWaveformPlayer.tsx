import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import type { TrackChapter } from "@/contexts/TrackContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, X } from "lucide-react";

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
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

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
    (percent: number) => chapters.find((c) => percent >= c.startPercent && percent < c.endPercent),
    [chapters]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      onSeek(pct);
    },
    [onSeek]
  );

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

  const handleAddSection = useCallback(() => {
    if (!onChaptersChange) return;
    const splitAt = progress > 0 && progress < 100 ? progress : 50;

    if (chapters.length === 0) {
      // No chapters yet — create two sections split at cursor
      const newChapters: TrackChapter[] = [
        { id: "ch-0", label: "Section 1", startPercent: 0, endPercent: Math.round(splitAt * 100) / 100, color: COLOR_PALETTE[0] },
        { id: "ch-1", label: "Section 2", startPercent: Math.round(splitAt * 100) / 100, endPercent: 100, color: COLOR_PALETTE[1] },
      ];
      onChaptersChange(newChapters);
      return;
    }

    // Find which chapter the cursor is in
    const targetIdx = chapters.findIndex((c) => splitAt >= c.startPercent && splitAt < c.endPercent);
    if (targetIdx === -1) return;

    const target = chapters[targetIdx];
    // Don't split if it would create a tiny section (< 2%)
    if (splitAt - target.startPercent < 2 || target.endPercent - splitAt < 2) return;

    const newChapters = [...chapters];
    const newId = "ch-" + Date.now();
    const newSection: TrackChapter = {
      id: newId,
      label: "Section",
      startPercent: Math.round(splitAt * 100) / 100,
      endPercent: target.endPercent,
      color: COLOR_PALETTE[(targetIdx + 1) % COLOR_PALETTE.length],
    };
    newChapters[targetIdx] = { ...target, endPercent: Math.round(splitAt * 100) / 100 };
    newChapters.splice(targetIdx + 1, 0, newSection);

    // Re-assign colors
    const recolored = newChapters.map((ch, i) => ({ ...ch, color: COLOR_PALETTE[i % COLOR_PALETTE.length] }));
    onChaptersChange(recolored);
  }, [chapters, progress, onChaptersChange]);

  const handleDeleteSection = useCallback((chapterId: string) => {
    if (!onChaptersChange || chapters.length <= 1) return;
    const idx = chapters.findIndex((c) => c.id === chapterId);
    if (idx === -1) return;

    const newChapters = [...chapters];
    if (idx > 0) {
      // Merge into previous section
      newChapters[idx - 1] = { ...newChapters[idx - 1], endPercent: newChapters[idx].endPercent };
    } else {
      // First section: merge into next
      newChapters[1] = { ...newChapters[1], startPercent: newChapters[0].startPercent };
    }
    newChapters.splice(idx, 1);

    const recolored = newChapters.map((ch, i) => ({ ...ch, color: COLOR_PALETTE[i % COLOR_PALETTE.length] }));
    onChaptersChange(recolored);
  }, [chapters, onChaptersChange]);

  const handleRenameCommit = useCallback(() => {
    if (!editingLabelId || !onChaptersChange) {
      setEditingLabelId(null);
      return;
    }
    const trimmed = editingLabelValue.trim();
    if (!trimmed) {
      setEditingLabelId(null);
      return;
    }
    const updated = chapters.map((ch) =>
      ch.id === editingLabelId ? { ...ch, label: trimmed } : ch
    );
    onChaptersChange(updated);
    setEditingLabelId(null);
  }, [editingLabelId, editingLabelValue, chapters, onChaptersChange]);

  const barWidth = 2.5;
  const barGap = 1;
  const totalWidth = bars * (barWidth + barGap);
  const height = 56;

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Waveform */}
      <div
        className="relative cursor-pointer group"
        onClick={handleClick}
        onDoubleClick={(e) => {
          if (onDoubleClick) {
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
            className="absolute top-0 bottom-0 w-px bg-foreground/30 z-10 pointer-events-none"
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
      {(chapters.length > 0 || editable) && (
        <div className="flex items-center gap-1">
          <div className="relative h-6 flex rounded-md overflow-hidden border border-border/50 flex-1">
            {chapters.map((ch) => {
              const width = ch.endPercent - ch.startPercent;
              const isHovered = hoveredChapter === ch.id;
              const isActive = progress >= ch.startPercent && progress < ch.endPercent;
              const isEditing = editingLabelId === ch.id;

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
                        if (!isEditing) onSeek(ch.startPercent);
                      }}
                    >
                      {isEditing ? (
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
                          className={`truncate px-0.5 leading-none select-none ${editable ? "cursor-text" : ""}`}
                          onClick={(e) => {
                            if (editable && onChaptersChange) {
                              e.stopPropagation();
                              setEditingLabelId(ch.id);
                              setEditingLabelValue(ch.label);
                            }
                          }}
                        >
                          {width > 6 ? ch.label : ch.label.charAt(0)}
                        </span>
                      )}
                      {editable && !isEditing && chapters.length > 1 && (
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
          {editable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="h-6 w-6 flex-shrink-0 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                  onClick={handleAddSection}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Add section at playhead
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
