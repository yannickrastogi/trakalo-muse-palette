import { useState, useRef, useEffect } from "react";
import { Send, Clock, X } from "lucide-react";
import { formatTimestamp } from "@/contexts/TrackReviewContext";

interface TimecodedCommentComposerProps {
  currentSeconds: number;
  onSubmit: (text: string, timestampSeconds: number) => void;
  onCancel: () => void;
  initialTimestamp?: number;
  compact?: boolean;
  placeholder?: string;
}

export function TimecodedCommentComposer({
  currentSeconds,
  onSubmit,
  onCancel,
  initialTimestamp,
  compact = false,
  placeholder = "Leave feedback at this moment…",
}: TimecodedCommentComposerProps) {
  const [text, setText] = useState("");
  const [timestamp, setTimestamp] = useState(initialTimestamp ?? currentSeconds);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (initialTimestamp !== undefined) setTimestamp(initialTimestamp);
  }, [initialTimestamp]);

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim(), timestamp);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className={`rounded-xl border border-border bg-secondary/50 overflow-hidden ${compact ? "" : ""}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Clock className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-mono font-bold text-primary">{formatTimestamp(timestamp)}</span>
        <span className="text-[10px] text-muted-foreground">Commenting at this timestamp</span>
        <button onClick={onCancel} className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={compact ? 2 : 3}
        className="w-full px-3 py-2.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none"
      />
      <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
        <span className="text-[10px] text-muted-foreground">⌘+Enter to submit</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3 h-3" /> Comment
          </button>
        </div>
      </div>
    </div>
  );
}
