import { useOnboarding, type OnboardingStep } from "@/contexts/OnboardingContext";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Users, Upload, FileText, UserPlus, ListMusic, Send, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";

interface ChecklistItem {
  step: OnboardingStep;
  labelKey: string;
  descKey: string;
  icon: React.ElementType;
  route: string;
}

const items: ChecklistItem[] = [
  { step: "create_team", labelKey: "onboarding.createTeam", descKey: "onboarding.createTeamDesc", icon: Users, route: "/team" },
  { step: "upload_track", labelKey: "onboarding.uploadTrack", descKey: "onboarding.uploadTrackDesc", icon: Upload, route: "/tracks" },
  { step: "complete_metadata", labelKey: "onboarding.completeMetadata", descKey: "onboarding.completeMetadataDesc", icon: FileText, route: "/tracks" },
  { step: "add_credits", labelKey: "onboarding.addCredits", descKey: "onboarding.addCreditsDesc", icon: UserPlus, route: "/tracks" },
  { step: "create_playlist", labelKey: "onboarding.createPlaylist", descKey: "onboarding.createPlaylistDesc", icon: ListMusic, route: "/playlists" },
  { step: "share_or_pitch", labelKey: "onboarding.sharePitchStep", descKey: "onboarding.sharePitchStepDesc", icon: Send, route: "/pitch" },
];

export function OnboardingChecklist() {
  const { t } = useTranslation();
  const { state, isStepCompleted, dismissChecklist, completionPercent, allStepsCompleted } = useOnboarding();
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  if (state.checklistDismissed || state.welcomeDismissed === false) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="card-premium overflow-visible"
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--gradient-brand-soft)" }}>
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground tracking-tight">{t("onboarding.gettingStarted")}</h3>
            <p className="text-2xs text-muted-foreground mt-0.5">
              {allStepsCompleted ? t("onboarding.allDone") : t("onboarding.completed", { done: state.completedSteps.length, total: items.length })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={dismissChecklist}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <Progress value={completionPercent} className="h-1.5 bg-secondary" />
      </div>

      {/* Checklist items */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-0.5">
              {items.map((item) => {
                const done = isStepCompleted(item.step);
                return (
                  <button
                    key={item.step}
                    onClick={() => !done && navigate(item.route)}
                    className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group " +
                      (done ? "opacity-60" : "hover:bg-secondary/50")
                    }
                    disabled={done}
                  >
                    <div
                      className={"w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all " +
                        (done
                          ? "border-emerald-500/40 bg-emerald-500/15"
                          : "border-border group-hover:border-primary/40")
                      }
                    >
                      {done ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <item.icon className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={"text-[13px] font-medium " + (done ? "line-through text-muted-foreground" : "text-foreground")}>
                        {t(item.labelKey)}
                      </p>
                      <p className="text-2xs text-muted-foreground/70 mt-0.5">{t(item.descKey)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
