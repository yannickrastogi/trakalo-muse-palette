import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, Palette, Globe } from "lucide-react";
import { PageShell } from "@/components/PageShell";

const sections = [
  { title: "Profile", description: "Manage your account details and public profile", icon: User },
  { title: "Notifications", description: "Configure email and in-app notification preferences", icon: Bell },
  { title: "Privacy & Security", description: "Two-factor authentication, sessions, and data export", icon: Shield },
  { title: "Appearance", description: "Theme, display density, and sidebar preferences", icon: Palette },
  { title: "Integrations", description: "Connect Spotify, Apple Music, DistroKid, and more", icon: Globe },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function SettingsPage() {
  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-6 lg:p-8 space-y-6 max-w-[900px]">
        <motion.div variants={item}>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your workspace and account preferences</p>
        </motion.div>

        <div className="space-y-3">
          {sections.map((s) => (
            <motion.button
              key={s.title}
              variants={item}
              className="w-full flex items-center gap-4 p-5 bg-card border border-border rounded-xl text-left hover:border-primary/25 transition-all group"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors shrink-0">
                <s.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </PageShell>
  );
}
