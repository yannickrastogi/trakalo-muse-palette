import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryText?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, secondaryText }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card-premium py-16 px-6 flex flex-col items-center text-center"
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "var(--gradient-brand-soft)" }}>
        <Icon className="w-7 h-7 text-primary" />
      </div>
      <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn-brand mt-5 px-6 py-2.5 rounded-xl text-[13px] font-semibold"
        >
          {actionLabel}
        </button>
      )}
      {secondaryText && (
        <p className="text-xs text-muted-foreground/60 mt-3">{secondaryText}</p>
      )}
    </motion.div>
  );
}
