import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TimecodedComment } from "@/contexts/TrackReviewContext";

interface CommentMarkerLayerProps {
  comments: TimecodedComment[];
  totalDurationSeconds: number;
  onMarkerClick: (seconds: number) => void;
  height?: number;
}

export function CommentMarkerLayer({
  comments,
  totalDurationSeconds,
  onMarkerClick,
  height = 56,
}: CommentMarkerLayerProps) {
  // Group comments by approximate position (within 2% proximity)
  const markers = useMemo(() => {
    if (!totalDurationSeconds || totalDurationSeconds <= 0) return [];
    const groups: { percent: number; comments: TimecodedComment[] }[] = [];
    const sorted = [...comments].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

    sorted.forEach((c) => {
      const pct = (c.timestampSeconds / totalDurationSeconds) * 100;
      const existing = groups.find((g) => Math.abs(g.percent - pct) < 2);
      if (existing) {
        existing.comments.push(c);
      } else {
        groups.push({ percent: pct, comments: [c] });
      }
    });
    return groups;
  }, [comments, totalDurationSeconds]);

  if (markers.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[5]" style={{ height }}>
      {markers.map((marker, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <button
              className="absolute pointer-events-auto group"
              style={{
                left: `${marker.percent}%`,
                top: 0,
                height: "100%",
                width: "12px",
                transform: "translateX(-50%)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onMarkerClick(marker.comments[0].timestampSeconds);
              }}
            >
              {/* Marker dot */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                <div className="w-3 h-3 rounded-full bg-primary border-2 border-background shadow-sm group-hover:scale-125 transition-transform">
                  {marker.comments.length > 1 && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-brand-pink text-[7px] font-bold text-primary-foreground flex items-center justify-center">
                      {marker.comments.length}
                    </span>
                  )}
                </div>
              </div>
              {/* Marker line */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-px h-full bg-primary/20 group-hover:bg-primary/40 transition-colors" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-xs">
            <p className="font-semibold">{marker.comments[0].authorName}</p>
            <p className="text-muted-foreground line-clamp-2">{marker.comments[0].commentText}</p>
            {marker.comments.length > 1 && (
              <p className="text-muted-foreground/60 mt-1">+{marker.comments.length - 1} more</p>
            )}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
