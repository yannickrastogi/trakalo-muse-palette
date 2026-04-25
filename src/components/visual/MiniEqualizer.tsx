import { VISUAL_FLAGS } from "@/lib/visualFlags";

export function MiniEqualizer() {
  if (!VISUAL_FLAGS.miniEqualizer) return null;

  return (
    <div
      aria-hidden="true"
      className="mini-eq inline-flex items-end gap-[2px] h-3.5 ml-1.5 shrink-0"
    >
      <span className="mini-eq-bar mini-eq-bar-1" />
      <span className="mini-eq-bar mini-eq-bar-2" />
      <span className="mini-eq-bar mini-eq-bar-3" />
      <span className="mini-eq-bar mini-eq-bar-4" />

      <style>{`
        .mini-eq-bar {
          display: block;
          width: 2.5px;
          border-radius: 1px;
          background: linear-gradient(to top, #f97316, #ec4899, #a855f7);
          will-change: height;
        }
        .mini-eq-bar-1 {
          animation: eq-bounce 0.8s ease-in-out infinite alternate;
          height: 40%;
        }
        .mini-eq-bar-2 {
          animation: eq-bounce 0.6s ease-in-out infinite alternate-reverse;
          height: 70%;
        }
        .mini-eq-bar-3 {
          animation: eq-bounce 0.9s ease-in-out infinite alternate;
          height: 50%;
        }
        .mini-eq-bar-4 {
          animation: eq-bounce 0.7s ease-in-out infinite alternate-reverse;
          height: 60%;
        }
        @keyframes eq-bounce {
          0% { height: 20%; }
          100% { height: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mini-eq-bar {
            animation: none !important;
          }
          .mini-eq-bar-1 { height: 40%; }
          .mini-eq-bar-2 { height: 70%; }
          .mini-eq-bar-3 { height: 50%; }
          .mini-eq-bar-4 { height: 60%; }
        }
      `}</style>
    </div>
  );
}
