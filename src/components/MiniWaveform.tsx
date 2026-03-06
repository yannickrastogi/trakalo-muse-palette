import { useMemo } from "react";

interface MiniWaveformProps {
  seed?: number;
  bars?: number;
  className?: string;
  accentColor?: string;
}

/** Deterministic pseudo-random mini waveform bars for visual flair. */
export function MiniWaveform({ seed = 0, bars = 24, className = "", accentColor }: MiniWaveformProps) {
  const heights = useMemo(() => {
    const result: number[] = [];
    let s = seed + 1;
    for (let i = 0; i < bars; i++) {
      // Simple LCG for deterministic variety
      s = (s * 16807 + 7) % 2147483647;
      const normalized = (s % 100) / 100;
      // Shape: higher in middle, creating a natural waveform envelope
      const envelope = Math.sin((i / (bars - 1)) * Math.PI) * 0.6 + 0.4;
      result.push(Math.max(0.15, normalized * envelope));
    }
    return result;
  }, [seed, bars]);

  const gradientId = `wf-${seed}`;

  return (
    <div className={`flex items-center gap-[1.5px] h-5 ${className}`} aria-hidden="true">
      <svg width={bars * 3.5} height={20} className="shrink-0">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={accentColor || "hsl(24 100% 55%)"} stopOpacity="0.7" />
            <stop offset="50%" stopColor={accentColor || "hsl(330 80% 60%)"} stopOpacity="0.5" />
            <stop offset="100%" stopColor={accentColor || "hsl(270 70% 55%)"} stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {heights.map((h, i) => {
          const barHeight = h * 16;
          const y = (20 - barHeight) / 2;
          return (
            <rect
              key={i}
              x={i * 3.5}
              y={y}
              width={2}
              height={barHeight}
              rx={1}
              fill={`url(#${gradientId})`}
            />
          );
        })}
      </svg>
    </div>
  );
}
