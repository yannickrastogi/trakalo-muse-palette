import { motion } from "framer-motion";
import { User, Bell, Shield, Palette, Globe, ChevronRight } from "lucide-react";
import { PageShell } from "@/components/PageShell";

const sections = [
  { title: "Profile", description: "Manage your account details and public profile", icon: User },
  { title: "Notifications", description: "Configure email and in-app notification preferences", icon: Bell },
  { title: "Privacy & Security", description: "Two-factor authentication, sessions, and data export", icon: Shield },
  { title: "Appearance", description: "Theme, display density, and sidebar preferences", icon: Palette },
  { title: "Integrations", description: "Connect Spotify, Apple Music, DistroKid, and more", icon: Globe },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

export default function SettingsPage() {
  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[800px]">
        <motion.div variants={item}>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Manage your workspace and account preferences</p>
        </motion.div>

        <div className="space-y-2.5">
          {sections.map((s) => (
            <motion.button
              key={s.title}
              variants={item}
              className="w-full card-premium flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left group min-h-[64px]"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/8 transition-colors duration-300 shrink-0">
                <s.icon className="w-[18px] h-[18px] text-muted-foreground group-hover:text-primary transition-colors duration-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground text-sm tracking-tight">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{s.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-muted-foreground transition-colors duration-300 shrink-0" />
            </motion.button>
          ))}
        </div>
      </motion.div>
    </PageShell>
  );
}
