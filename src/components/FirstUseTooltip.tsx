import { useOnboarding } from "@/contexts/OnboardingContext";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface FirstUseTooltipProps {
  id: string;
  children: React.ReactNode;
  message: string;
  position?: "top" | "bottom" | "left" | "right";
}

export function FirstUseTooltip({ id, children, message, position = "bottom" }: FirstUseTooltipProps) {
  const { isTooltipDismissed, dismissTooltip, state } = useOnboarding();

  // Don't show tooltips if welcome hasn't been dismissed yet
  if (!state.welcomeDismissed) return <>{children}</>;

  const show = !isTooltipDismissed(id);

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses: Record<string, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-primary/90 border-l-transparent border-r-transparent border-b-transparent border-[5px]",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-primary/90 border-l-transparent border-r-transparent border-t-transparent border-[5px]",
    left: "left-full top-1/2 -translate-y-1/2 border-l-primary/90 border-t-transparent border-b-transparent border-r-transparent border-[5px]",
    right: "right-full top-1/2 -translate-y-1/2 border-r-primary/90 border-t-transparent border-b-transparent border-l-transparent border-[5px]",
  };

  return (
    <div className="relative inline-flex">
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-50 ${positionClasses[position]} pointer-events-auto`}
          >
            <div className="relative bg-primary/90 text-primary-foreground px-3 py-2 rounded-lg shadow-lg max-w-[200px] backdrop-blur-sm">
              <div className="flex items-start gap-2">
                <p className="text-[11px] font-medium leading-snug flex-1">{message}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); dismissTooltip(id); }}
                  className="p-0.5 rounded hover:bg-primary-foreground/20 transition-colors shrink-0 -mt-0.5 -mr-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {/* Arrow */}
              <div className={`absolute w-0 h-0 ${arrowClasses[position]}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
