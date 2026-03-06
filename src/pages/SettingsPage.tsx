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

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function SettingsPage() {
  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-5 lg:p-7 space-y-5 max-w-[800px]">
        <motion.div variants={item}>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">Manage your workspace and account preferences</p>
        </motion.div>

        <div className="space-y-2">
          {sections.map((s) => (
            <motion.button
              key={s.title}
              variants={item}
              className="w-full flex items-center gap-3.5 p-4 bg-card border border-border rounded-xl text-left hover:border-primary/15 transition-all group"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/8 transition-colors shrink-0">
                <s.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground text-[13px]">{s.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.description}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
            </motion.button>
          ))}
        </div>
      </motion.div>
    </PageShell>
  );
}
