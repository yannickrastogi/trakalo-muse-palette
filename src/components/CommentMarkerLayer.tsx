import { useMemo, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { TimecodedComment, AuthorType } from "@/contexts/TrackReviewContext";
import { formatTimestamp } from "@/contexts/TrackReviewContext";

const markerColors: Record<AuthorType, { dot: string; line: string }> = {
  owner: { dot: "bg-brand-orange", line: "bg-brand-orange/25" },
  team_member: { dot: "bg-brand-purple", line: "bg-brand-purple/25" },
  recipient: { dot: "bg-brand-pink", line: "bg-brand-pink/25" },
  guest_recipient: { dot: "bg-brand-pink", line: "bg-brand-pink/25" },
};

const badgeStyle: Record<AuthorType, string> = {
  owner: "bg-brand-orange/15 text-brand-orange",
  team_member: "bg-brand-purple/15 text-brand-purple",
  recipient: "bg-brand-pink/15 text-brand-pink",
  guest_recipient: "bg-brand-pink/15 text-brand-pink",
};

const badgeLabel: Record<AuthorType, string> = {
  owner: "Owner",
  team_member: "Team",
  recipient: "Recipient",
  guest_recipient: "Guest",
};

interface CommentMarkerLayerProps {
  comments: TimecodedComment[];
  totalDurationSeconds: number;
  onMarkerClick: (seconds: number) => void;
  height?: number;
  filterAuthor?: string | null;
}

export function CommentMarkerLayer({
  comments,
  totalDurationSeconds,
  onMarkerClick,
  height = 56,
  filterAuthor,
}: CommentMarkerLayerProps) {
  const [openMarkerId, setOpenMarkerId] = useState<number | null>(null);

  const markers = useMemo(() => {
    if (!totalDurationSeconds || totalDurationSeconds <= 0) return [];

    const filtered = filterAuthor
      ? comments.filter((c) => c.authorName === filterAuthor)
      : comments;

    const groups: { percent: number; comments: TimecodedComment[] }[] = [];
    const sorted = [...filtered].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

    sorted.forEach((c) => {
      const pct = (c.timestampSeconds / totalDurationSeconds) * 100;
      const existing = groups.find((g) => Math.abs(g.percent - pct) < 3);
      if (existing) {
        existing.comments.push(c);
      } else {
        groups.push({ percent: pct, comments: [c] });
      }
    });
    return groups;
  }, [comments, totalDurationSeconds, filterAuthor]);

  if (markers.length === 0) return null;

  // Determine dominant color for a marker group
  const getDotColor = (group: TimecodedComment[]) => {
    const types = group.map((c) => c.authorType);
    if (types.every((t) => t === "owner")) return markerColors.owner;
    if (types.every((t) => t === "team_member")) return markerColors.team_member;
    if (types.some((t) => t === "guest_recipient" || t === "recipient")) return markerColors.guest_recipient;
    return markerColors.owner;
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-[5]" style={{ height }}>
      {markers.map((marker, i) => {
        const colors = getDotColor(marker.comments);
        return (
          <Popover key={i} open={openMarkerId === i} onOpenChange={(open) => setOpenMarkerId(open ? i : null)}>
            <PopoverTrigger asChild>
              <button
                className="absolute pointer-events-auto group"
                style={{
                  left: marker.percent + "%",
                  top: 0,
                  height: "100%",
                  width: "14px",
                  transform: "translateX(-50%)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMarkerId(openMarkerId === i ? null : i);
                }}
              >
                {/* Line */}
                <div className={"absolute left-1/2 -translate-x-1/2 bottom-0 w-px h-full transition-colors " + colors.line + " group-hover:opacity-80"} />
                {/* Dot */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                  <div className={"w-2.5 h-2.5 rounded-full border-2 border-background shadow-sm group-hover:scale-150 transition-transform " + colors.dot}>
                    {marker.comments.length > 1 && (
                      <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-foreground text-background text-[8px] font-bold flex items-center justify-center">
                        {marker.comments.length}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="w-72 p-0 max-h-60 overflow-y-auto">
              <div className="divide-y divide-border">
                {marker.comments.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { onMarkerClick(c.timestampSeconds); setOpenMarkerId(null); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono font-bold text-primary">{formatTimestamp(c.timestampSeconds)}</span>
                      <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
                      <span className={"inline-flex px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider " + badgeStyle[c.authorType]}>
                        {badgeLabel[c.authorType]}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/70 line-clamp-2">{c.commentText}</p>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
