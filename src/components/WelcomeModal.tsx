import { useOnboarding } from "@/contexts/OnboardingContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Music, Users, ListMusic, Send, Layers } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/trakalog-logo.png";
import { useTranslation } from "react-i18next";

export function WelcomeModal() {
  const { t } = useTranslation();
  const { isFirstVisit, dismissWelcome } = useOnboarding();

  const features = [
    { icon: Music, label: t("onboarding.organizeTracks") },
    { icon: Users, label: t("onboarding.collaborate") },
    { icon: ListMusic, label: t("onboarding.buildPlaylists") },
    { icon: Send, label: t("onboarding.sharePitch") },
    { icon: Layers, label: t("onboarding.manageStems") },
  ];

  return (
    <Dialog open={isFirstVisit} onOpenChange={(open) => !open && dismissWelcome()}>
      <DialogContent className="sm:max-w-md border-border/60 bg-card p-0 overflow-hidden">
        {/* Top gradient band */}
        <div className="h-1.5 w-full" style={{ background: "var(--gradient-brand-horizontal)" }} />

        <div className="px-6 pt-6 pb-2">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Trakalog" className="h-8 w-auto" />
            </div>
            <DialogTitle className="text-xl font-bold text-foreground tracking-tight">
              {t("onboarding.welcomeTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {t("onboarding.welcomeDesc")}
            </DialogDescription>
          </DialogHeader>

          {/* Feature list */}
          <div className="mt-5 space-y-2.5">
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
                className="flex items-center gap-3 py-1.5"
              >
                <div className="w-8 h-8 rounded-lg icon-brand flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[13px] text-foreground/80 font-medium">{f.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-4 flex flex-col gap-2.5">
          <button
            onClick={dismissWelcome}
            className="btn-brand w-full py-3 rounded-xl text-[13px] font-semibold"
          >
            {t("onboarding.getStarted")}
          </button>
          <button
            onClick={dismissWelcome}
            className="w-full py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            {t("onboarding.skipForNow")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
