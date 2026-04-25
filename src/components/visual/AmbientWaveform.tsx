import { VISUAL_FLAGS } from "@/lib/visualFlags";

const BARS = 48;
const BAR_WIDTH = 3;
const GAP = 2;
const MAX_HEIGHT = 32;
const SVG_WIDTH = BARS * (BAR_WIDTH + GAP);

function generateHeights(): number[] {
  const heights: number[] = [];
  for (let i = 0; i < BARS; i++) {
    const center = BARS / 2;
    const dist = Math.abs(i - center) / center;
    const base = (1 - dist * dist) * 0.8 + 0.2;
    const variation = Math.sin(i * 0.7) * 0.3 + Math.sin(i * 1.3) * 0.15;
    heights.push(Math.max(0.1, Math.min(1, base + variation)) * MAX_HEIGHT);
  }
  return heights;
}

const heights = generateHeights();

export function AmbientWaveform() {
  if (!VISUAL_FLAGS.ambientWaveform) return null;

  return (
    <div
      aria-hidden="true"
      className="ambient-waveform pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
    >
      <svg
        width={SVG_WIDTH}
        height={MAX_HEIGHT * 2}
        viewBox={`0 0 ${SVG_WIDTH} ${MAX_HEIGHT * 2}`}
        className="ambient-waveform-svg"
      >
        <defs>
          <linearGradient id="waveform-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        {heights.map((h, i) => (
          <rect
            key={i}
            x={i * (BAR_WIDTH + GAP)}
            y={MAX_HEIGHT - h / 2}
            width={BAR_WIDTH}
            height={h}
            rx={1.5}
            fill="url(#waveform-gradient)"
          />
        ))}
      </svg>

      <style>{`
        .ambient-waveform {
          opacity: 0.30;
        }
        .ambient-waveform-svg {
          animation: ambient-pulse 9s ease-in-out infinite;
          will-change: transform;
        }
        @keyframes ambient-pulse {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ambient-waveform-svg {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
