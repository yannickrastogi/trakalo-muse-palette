import { VISUAL_FLAGS } from "@/lib/visualFlags";

export function AuroraBackground() {
  if (!VISUAL_FLAGS.auroraBackground) return null;

  return (
    <div
      aria-hidden="true"
      className="aurora-bg pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />

      <style>{`
        .aurora-bg {
          opacity: 0.5;
        }
        .aurora-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          will-change: transform;
        }
        .aurora-blob-1 {
          width: 55%;
          height: 55%;
          top: -10%;
          left: -5%;
          background: radial-gradient(circle, #f97316 0%, transparent 70%);
          animation: aurora-drift-1 18s ease-in-out infinite alternate;
        }
        .aurora-blob-2 {
          width: 50%;
          height: 50%;
          top: 30%;
          right: -10%;
          background: radial-gradient(circle, #ec4899 0%, transparent 70%);
          animation: aurora-drift-2 20s ease-in-out infinite alternate;
        }
        .aurora-blob-3 {
          width: 45%;
          height: 45%;
          bottom: -5%;
          left: 25%;
          background: radial-gradient(circle, #a855f7 0%, transparent 70%);
          animation: aurora-drift-3 16s ease-in-out infinite alternate;
        }
        @keyframes aurora-drift-1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(8%, 12%) scale(1.15); }
        }
        @keyframes aurora-drift-2 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-10%, -8%) scale(1.1); }
        }
        @keyframes aurora-drift-3 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(6%, -10%) scale(1.2); }
        }
        @media (prefers-reduced-motion: reduce) {
          .aurora-blob {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
