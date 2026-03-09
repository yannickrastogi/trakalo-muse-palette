import { useMemo, useState, useCallback } from "react";
import type { TrackChapter } from "@/contexts/TrackContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TrackWaveformPlayerProps {
  seed: number;
  bars?: number;
  progress: number;
  onSeek: (percent: number) => void;
  onDoubleClick?: (percent: number) => void;
  chapters?: TrackChapter[];
  isPlaying?: boolean;
  className?: string;
}

/**
 * Full-width interactive waveform with chapter markers.
 * Deterministic bars derived from seed, with gradient coloring by chapter region.
 */
export function TrackWaveformPlayer({
  seed,
  bars = 120,
  progress,
  onSeek,
  chapters = [],
  isPlaying = false,
  className = "",
}: TrackWaveformPlayerProps) {
  const [hoveredChapter, setHoveredChapter] = useState<string | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);

  const heights = useMemo(() => {
    const result: number[] = [];
    let s = seed + 1;
    for (let i = 0; i < bars; i++) {
      s = (s * 16807 + 7) % 2147483647;
      const normalized = (s % 100) / 100;
      const envelope = Math.sin((i / (bars - 1)) * Math.PI) * 0.5 + 0.5;
      result.push(Math.max(0.12, normalized * envelope));
    }
    return result;
  }, [seed, bars]);

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
                fill={played ? `url(#wf-played-${seed})` : "hsl(var(--muted-foreground) / 0.2)"}
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
      {chapters.length > 0 && (
        <div className="relative h-6 flex rounded-md overflow-hidden border border-border/50">
          {chapters.map((ch) => {
            const width = ch.endPercent - ch.startPercent;
            const isHovered = hoveredChapter === ch.id;
            const isActive = progress >= ch.startPercent && progress < ch.endPercent;

            return (
              <Tooltip key={ch.id}>
                <TooltipTrigger asChild>
                  <div
                    className="relative flex items-center justify-center text-[9px] font-semibold uppercase tracking-wide cursor-pointer transition-all duration-150 border-r border-border/30 last:border-r-0"
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
                      onSeek(ch.startPercent);
                    }}
                  >
                    <span className="truncate px-0.5 leading-none select-none">
                      {width > 6 ? ch.label : ch.label.charAt(0)}
                    </span>
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
      )}
    </div>
  );
}
