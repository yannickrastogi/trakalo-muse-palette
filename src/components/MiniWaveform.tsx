import { useMemo } from "react";

interface MiniWaveformProps {
  seed?: number;
  bars?: number;
  peaks?: number[];
  progress?: number; // 0-100, only colored when a track is actively playing
  className?: string;
  accentColor?: string;
}

/** Mini waveform bars — uses real peaks when available, falls back to deterministic seed-based generation. */
export function MiniWaveform({ seed = 0, bars = 24, peaks, progress, className = "", accentColor }: MiniWaveformProps) {
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
        result.push(Math.max(0.15, sum / (end - start)));
      }
      return result;
    }
    // Fallback: deterministic pseudo-random
    const result: number[] = [];
    let s = seed + 1;
    for (let i = 0; i < bars; i++) {
      s = (s * 16807 + 7) % 2147483647;
      const normalized = (s % 100) / 100;
      const envelope = Math.sin((i / (bars - 1)) * Math.PI) * 0.6 + 0.4;
      result.push(Math.max(0.15, normalized * envelope));
    }
    return result;
  }, [seed, bars, peaks]);

  const gradientId = "wf-" + seed;
  const playedGradientId = "wf-played-" + seed;
  const hasProgress = progress !== undefined && progress > 0;

  return (
    <div className={"flex items-center gap-[1px] h-6 " + className} aria-hidden="true">
      <svg width={bars * 2} height={24} className="shrink-0">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id={playedGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={accentColor || "hsl(24 100% 55%)"} />
            <stop offset="100%" stopColor={accentColor || "hsl(330 80% 60%)"} />
          </linearGradient>
        </defs>
        {heights.map((h, i) => {
          const barHeight = h * 20;
          const y = (24 - barHeight) / 2;
          const barPct = (i / bars) * 100;
          const played = hasProgress && barPct <= progress;
          return (
            <rect
              key={i}
              x={i * 2}
              y={y}
              width={1}
              height={barHeight}
              rx={0.5}
              fill={played ? "url(#" + playedGradientId + ")" : "url(#" + gradientId + ")"}
            />
          );
        })}
      </svg>
    </div>
  );
}
