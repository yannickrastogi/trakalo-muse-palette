import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  note?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, secondaryLabel, onSecondaryAction, note }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="py-16 px-6 flex flex-col items-center text-center"
    >
      <Icon className="w-12 h-12 text-muted-foreground opacity-50 mb-5" />
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="text-muted-foreground text-sm max-w-md text-center mt-2">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-6 py-2.5 rounded-xl text-[13px] font-semibold bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 hover:from-orange-600 hover:via-pink-600 hover:to-purple-600 text-white transition-all"
        >
          {actionLabel}
        </button>
      )}
      {secondaryLabel && onSecondaryAction && (
        <button
          onClick={onSecondaryAction}
          className="mt-3 text-sm text-muted-foreground underline cursor-pointer hover:text-foreground transition-colors"
        >
          {secondaryLabel}
        </button>
      )}
      {note && (
        <p className="text-xs text-muted-foreground mt-3">{note}</p>
      )}
    </motion.div>
  );
}
