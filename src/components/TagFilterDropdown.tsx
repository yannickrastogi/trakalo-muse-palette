import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

export type TagFilterColor = "pink" | "purple" | "orange" | "blue" | "green";

const colorClasses: Record<TagFilterColor, { trigger: string; option: string; check: string }> = {
  pink: {
    trigger: "border-2 border-pink-500/40 text-pink-500",
    option: "bg-pink-500/10 text-pink-500",
    check: "bg-pink-500 border-pink-500",
  },
  purple: {
    trigger: "border-2 border-purple-500/40 text-purple-500",
    option: "bg-purple-500/10 text-purple-500",
    check: "bg-purple-500 border-purple-500",
  },
  orange: {
    trigger: "border-2 border-orange-500/40 text-orange-500",
    option: "bg-orange-500/10 text-orange-500",
    check: "bg-orange-500 border-orange-500",
  },
  blue: {
    trigger: "border-2 border-blue-500/40 text-blue-500",
    option: "bg-blue-500/10 text-blue-500",
    check: "bg-blue-500 border-blue-500",
  },
  green: {
    trigger: "border-2 border-green-500/40 text-green-500",
    option: "bg-green-500/10 text-green-500",
    check: "bg-green-500 border-green-500",
  },
};

interface TagFilterDropdownProps {
  label: string;
  options: readonly string[];
  values: string[];
  onChange: (values: string[]) => void;
  color?: TagFilterColor;
}

export function TagFilterDropdown({ label, options, values, onChange, color = "pink" }: TagFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const isActive = values.length > 0;
  const cls = colorClasses[color];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (option: string) => {
    if (values.includes(option)) {
      onChange(values.filter((v) => v !== option));
    } else {
      onChange([...values, option]);
    }
  };

  const display = isActive ? `${label} (${values.length})` : label;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={
          "flex items-center justify-between gap-2 h-10 px-3 rounded-xl bg-card text-[13px] font-medium transition-all whitespace-nowrap " +
          (isActive
            ? cls.trigger
            : "border border-border text-muted-foreground hover:border-brand-pink/20 hover:text-foreground")
        }
      >
        <span className="truncate">{display}</span>
        <ChevronDown className={"w-3.5 h-3.5 shrink-0 transition-transform duration-200 " + (open ? "rotate-180" : "")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 mt-1.5 left-0 min-w-[200px] bg-card border border-border rounded-xl shadow-xl backdrop-blur-sm max-h-72 overflow-y-auto"
          >
            <div className="p-1">
              {options.map((opt) => {
                const checked = values.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={
                      "w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-[13px] transition-colors " +
                      (checked ? cls.option + " font-medium" : "text-foreground hover:bg-secondary/60")
                    }
                  >
                    <span
                      className={
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0 " +
                        (checked ? cls.check : "border-border bg-transparent")
                      }
                    >
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="truncate">{opt}</span>
                  </button>
                );
              })}
              {isActive && (
                <button
                  type="button"
                  onClick={() => {
                    onChange([]);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 mt-1 rounded-lg text-[12px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 border-t border-border/40"
                >
                  Clear selection
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface TempoToggleProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: readonly string[];
}

export function TempoToggle({ value, onChange, options }: TempoToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 h-10 px-2 rounded-xl border border-border bg-card text-[13px]">
      <span className="text-muted-foreground font-medium pr-2 border-r border-border/50">Tempo</span>
      <div className="flex items-center gap-0.5 pl-1">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? null : opt)}
              className={
                "h-7 px-2.5 rounded-lg font-medium transition-all " +
                (active
                  ? "bg-blue-500/10 text-blue-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60")
              }
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
