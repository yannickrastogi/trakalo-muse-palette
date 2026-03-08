import { useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Bell,
  Shield,
  Palette,
  Building2,
  Camera,
  Mail,
  Globe,
  Moon,
  Sun,
  Monitor,
  Lock,
  Smartphone,
  Key,
  Download,
  Trash2,
  ChevronRight,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRole } from "@/contexts/RoleContext";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };

type SettingsSection = "profile" | "workspace" | "notifications" | "appearance" | "security";

const sections: { id: SettingsSection; label: string; icon: React.ElementType; description: string }[] = [
  { id: "profile", label: "Profile", icon: User, description: "Your personal information" },
  { id: "workspace", label: "Workspace", icon: Building2, description: "Team & workspace settings" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Email & push preferences" },
  { id: "appearance", label: "Appearance", icon: Palette, description: "Theme & display options" },
  { id: "security", label: "Security", icon: Shield, description: "Password & authentication" },
];

/* ────────────── Shared Components ────────────── */

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground tracking-tight">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingInput({ value, placeholder, type = "text", onChange }: { value: string; placeholder: string; type?: string; onChange: (v: string) => void }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full sm:w-64 bg-secondary/50 border border-border/50 rounded-lg px-3.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus-brand transition-all font-medium"
    />
  );
}

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
        enabled ? "bg-primary" : "bg-secondary border border-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-foreground transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
        style={{ boxShadow: "0 1px 3px hsl(0 0% 0% / 0.3)" }}
      />
    </button>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <motion.div variants={item} className="card-premium p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/50">
        <div className="w-8 h-8 rounded-lg icon-brand flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand-orange" />
        </div>
        <h3 className="text-sm font-bold text-foreground tracking-tight">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

/* ────────────── Profile Section ────────────── */

function ProfileSection() {
  const [firstName, setFirstName] = useState("John");
  const [lastName, setLastName] = useState("Doe");
  const [email, setEmail] = useState("john@trakalog.com");
  const [bio, setBio] = useState("Music producer & songwriter based in Los Angeles.");
  const [phone, setPhone] = useState("+1 (555) 012-3456");

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      <SectionCard title="Personal Information" icon={User}>
        {/* Avatar */}
        <div className="flex items-center gap-4 pb-4 border-b border-border/50">
          <div className="relative group">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center text-lg font-bold text-primary-foreground btn-brand" style={{ boxShadow: "none" }}>
              JD
            </div>
            <button className="absolute inset-0 rounded-xl bg-background/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera className="w-4 h-4 text-foreground" />
            </button>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Profile Photo</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">JPG, PNG, or GIF. Max 2MB.</p>
            <button className="text-[11px] gradient-text font-semibold mt-1 hover:opacity-80 transition-opacity">Change photo</button>
          </div>
        </div>

        <SettingRow label="First Name">
          <SettingInput value={firstName} placeholder="First name" onChange={setFirstName} />
        </SettingRow>
        <SettingRow label="Last Name">
          <SettingInput value={lastName} placeholder="Last name" onChange={setLastName} />
        </SettingRow>
        <SettingRow label="Email" description="Used for login and notifications">
          <SettingInput value={email} placeholder="Email address" type="email" onChange={setEmail} />
        </SettingRow>
        <SettingRow label="Phone" description="Optional — for SMS alerts">
          <SettingInput value={phone} placeholder="+1 (555) 000-0000" onChange={setPhone} />
        </SettingRow>
        <SettingRow label="Bio" description="Visible to team members">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short bio…"
            rows={2}
            className="w-full sm:w-64 bg-secondary/50 border border-border/50 rounded-lg px-3.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus-brand transition-all font-medium resize-none"
          />
        </SettingRow>
      </SectionCard>

      <SectionCard title="Public Profile" icon={Globe}>
        <SettingRow label="Profile Visibility" description="Allow team members to see your profile">
          <ToggleSwitch enabled={true} onToggle={() => {}} />
        </SettingRow>
        <SettingRow label="Show Email" description="Display email on your public profile">
          <ToggleSwitch enabled={false} onToggle={() => {}} />
        </SettingRow>
      </SectionCard>

      <div className="flex justify-end pt-2">
        <button className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px]">
          Save Changes
        </button>
      </div>
    </motion.div>
  );
}

/* ────────────── Workspace Section ────────────── */

function WorkspaceSection() {
  const [workspaceName, setWorkspaceName] = useState("Nightfall Records");
  const [slug, setSlug] = useState("nightfall-records");

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      <SectionCard title="Workspace Details" icon={Building2}>
        <SettingRow label="Workspace Name" description="This is your team's visible name">
          <SettingInput value={workspaceName} placeholder="Workspace name" onChange={setWorkspaceName} />
        </SettingRow>
        <SettingRow label="Workspace URL" description="trakalog.app/">
          <SettingInput value={slug} placeholder="workspace-slug" onChange={setSlug} />
        </SettingRow>
        <SettingRow label="Default Language" description="Sets the default UI language for new members">
          <select className="bg-secondary/50 border border-border/50 rounded-lg px-3.5 py-2 text-[13px] text-foreground outline-none focus-brand transition-all font-medium w-full sm:w-64 appearance-none cursor-pointer">
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
          </select>
        </SettingRow>
      </SectionCard>

      <SectionCard title="Metadata Defaults" icon={Globe}>
        <SettingRow label="Default Genre" description="Pre-selected when uploading new tracks">
          <select className="bg-secondary/50 border border-border/50 rounded-lg px-3.5 py-2 text-[13px] text-foreground outline-none focus-brand transition-all font-medium w-full sm:w-64 appearance-none cursor-pointer">
            <option value="">None</option>
            <option value="hiphop">Hip-Hop</option>
            <option value="rnb">R&B</option>
            <option value="pop">Pop</option>
            <option value="electronic">Electronic</option>
            <option value="soul">Neo-Soul</option>
          </select>
        </SettingRow>
        <SettingRow label="Default Copyright" description="Applied to all new uploads">
          <SettingInput value="© 2026 Nightfall Records" placeholder="© Year Label" onChange={() => {}} />
        </SettingRow>
      </SectionCard>

      <SectionCard title="Danger Zone" icon={Trash2}>
        <SettingRow label="Delete Workspace" description="Permanently delete this workspace and all data. This action cannot be undone.">
          <button className="px-4 py-2 rounded-lg text-[13px] font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors min-h-[40px]">
            Delete Workspace
          </button>
        </SettingRow>
      </SectionCard>

      <div className="flex justify-end pt-2">
        <button className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px]">
          Save Changes
        </button>
      </div>
    </motion.div>
  );
}

/* ────────────── Notifications Section ────────────── */

function NotificationsSection() {
  const [emailPitch, setEmailPitch] = useState(true);
  const [emailUpload, setEmailUpload] = useState(true);
  const [emailTeam, setEmailTeam] = useState(false);
  const [emailDigest, setEmailDigest] = useState(true);
  const [pushPitch, setPushPitch] = useState(true);
  const [pushUpload, setPushUpload] = useState(false);
  const [pushComment, setPushComment] = useState(true);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      <SectionCard title="Email Notifications" icon={Mail}>
        <SettingRow label="Pitch Responses" description="When a recipient responds to your pitch">
          <ToggleSwitch enabled={emailPitch} onToggle={() => setEmailPitch(!emailPitch)} />
        </SettingRow>
        <SettingRow label="Track Uploads" description="When a team member uploads a new track">
          <ToggleSwitch enabled={emailUpload} onToggle={() => setEmailUpload(!emailUpload)} />
        </SettingRow>
        <SettingRow label="Team Activity" description="When members join, leave, or change roles">
          <ToggleSwitch enabled={emailTeam} onToggle={() => setEmailTeam(!emailTeam)} />
        </SettingRow>
        <SettingRow label="Weekly Digest" description="Summary of activity every Monday">
          <ToggleSwitch enabled={emailDigest} onToggle={() => setEmailDigest(!emailDigest)} />
        </SettingRow>
      </SectionCard>

      <SectionCard title="Push Notifications" icon={Bell}>
        <SettingRow label="Pitch Updates" description="Real-time alerts for pitch status changes">
          <ToggleSwitch enabled={pushPitch} onToggle={() => setPushPitch(!pushPitch)} />
        </SettingRow>
        <SettingRow label="New Uploads" description="When new tracks are added to the catalog">
          <ToggleSwitch enabled={pushUpload} onToggle={() => setPushUpload(!pushUpload)} />
        </SettingRow>
        <SettingRow label="Comments & Feedback" description="When someone leaves feedback on a track">
          <ToggleSwitch enabled={pushComment} onToggle={() => setPushComment(!pushComment)} />
        </SettingRow>
      </SectionCard>

      <div className="flex justify-end pt-2">
        <button className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px]">
          Save Preferences
        </button>
      </div>
    </motion.div>
  );
}

/* ────────────── Appearance Section ────────────── */

function AppearanceSection() {
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  const themes: { id: "dark" | "light" | "system"; label: string; icon: React.ElementType; preview: string }[] = [
    { id: "dark", label: "Dark", icon: Moon, preview: "bg-[hsl(240,6%,6%)]" },
    { id: "light", label: "Light", icon: Sun, preview: "bg-[hsl(0,0%,98%)]" },
    { id: "system", label: "System", icon: Monitor, preview: "bg-gradient-to-r from-[hsl(240,6%,6%)] to-[hsl(0,0%,98%)]" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      <SectionCard title="Theme" icon={Palette}>
        <div className="grid grid-cols-3 gap-3 pb-4 border-b border-border/50">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`relative rounded-xl border-2 transition-all duration-200 p-3 flex flex-col items-center gap-2 ${
                theme === t.id
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <div className={`w-full h-14 rounded-lg ${t.preview} border border-border/30 flex items-center justify-center`}>
                <t.icon className={`w-5 h-5 ${theme === t.id ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <span className={`text-[11px] font-semibold ${theme === t.id ? "text-primary" : "text-muted-foreground"}`}>
                {t.label}
              </span>
              {theme === t.id && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>

        <SettingRow label="Accent Color" description="Customize your brand accent">
          <div className="flex items-center gap-2">
            {[
              "bg-gradient-to-r from-[hsl(24,100%,55%)] to-[hsl(330,80%,60%)]",
              "bg-gradient-to-r from-[hsl(200,80%,50%)] to-[hsl(240,70%,60%)]",
              "bg-gradient-to-r from-[hsl(160,70%,45%)] to-[hsl(200,80%,50%)]",
              "bg-gradient-to-r from-[hsl(270,70%,55%)] to-[hsl(330,80%,60%)]",
            ].map((c, i) => (
              <button
                key={i}
                className={`w-7 h-7 rounded-full ${c} ring-2 ring-offset-2 ring-offset-background transition-all ${
                  i === 0 ? "ring-primary scale-110" : "ring-transparent hover:ring-border"
                }`}
              />
            ))}
          </div>
        </SettingRow>
      </SectionCard>

      <SectionCard title="Display" icon={Monitor}>
        <SettingRow label="Compact Mode" description="Reduce spacing for denser layouts">
          <ToggleSwitch enabled={compactMode} onToggle={() => setCompactMode(!compactMode)} />
        </SettingRow>
        <SettingRow label="Sidebar Default" description="Start with sidebar collapsed">
          <ToggleSwitch enabled={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        </SettingRow>
        <SettingRow label="Animations" description="Enable motion and transition effects">
          <ToggleSwitch enabled={animationsEnabled} onToggle={() => setAnimationsEnabled(!animationsEnabled)} />
        </SettingRow>
      </SectionCard>

      <div className="flex justify-end pt-2">
        <button className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px]">
          Save Preferences
        </button>
      </div>
    </motion.div>
  );
}

/* ────────────── Security Section ────────────── */

function SecuritySection() {
  const [twoFa, setTwoFa] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const sessions = [
    { device: "MacBook Pro — Chrome", location: "Los Angeles, CA", time: "Active now", current: true },
    { device: "iPhone 15 — Safari", location: "Los Angeles, CA", time: "2h ago", current: false },
    { device: "Windows PC — Firefox", location: "New York, NY", time: "3 days ago", current: false },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      <SectionCard title="Password" icon={Lock}>
        <SettingRow label="Current Password">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value="••••••••••••"
              readOnly
              className="w-full sm:w-64 bg-secondary/50 border border-border/50 rounded-lg px-3.5 py-2 pr-10 text-[13px] text-foreground outline-none focus-brand transition-all font-medium"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </SettingRow>
        <div className="pt-3">
          <button className="px-4 py-2 rounded-lg text-[13px] font-semibold border border-border text-foreground hover:bg-secondary transition-colors min-h-[40px]">
            Change Password
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Two-Factor Authentication" icon={Smartphone}>
        <SettingRow label="Enable 2FA" description="Add an extra layer of security with an authenticator app">
          <ToggleSwitch enabled={twoFa} onToggle={() => setTwoFa(!twoFa)} />
        </SettingRow>
        {twoFa && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="pt-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-[12px] text-emerald-400 font-medium">Two-factor authentication is enabled</p>
            </div>
          </motion.div>
        )}
      </SectionCard>

      <SectionCard title="Active Sessions" icon={Key}>
        <div className="space-y-0">
          {sessions.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  s.current ? "bg-emerald-500/12" : "bg-secondary"
                }`}>
                  <Monitor className={`w-4 h-4 ${s.current ? "text-emerald-400" : "text-muted-foreground"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground tracking-tight truncate">
                    {s.device}
                    {s.current && (
                      <span className="ml-2 text-[10px] font-semibold text-emerald-400 bg-emerald-500/12 px-1.5 py-0.5 rounded-full">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{s.location} · {s.time}</p>
                </div>
              </div>
              {!s.current && (
                <button className="text-[11px] font-semibold text-destructive hover:bg-destructive/10 px-2.5 py-1 rounded-lg transition-colors shrink-0">
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Data & Privacy" icon={Download}>
        <SettingRow label="Export Data" description="Download all your tracks, playlists, and account data">
          <button className="px-4 py-2 rounded-lg text-[13px] font-semibold border border-border text-foreground hover:bg-secondary transition-colors min-h-[40px] flex items-center gap-2">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </SettingRow>
        <SettingRow label="Delete Account" description="Permanently delete your account and all associated data">
          <button className="px-4 py-2 rounded-lg text-[13px] font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors min-h-[40px]">
            Delete Account
          </button>
        </SettingRow>
      </SectionCard>
    </motion.div>
  );
}

/* ────────────── Main Settings Page ────────────── */

const sectionComponents: Record<SettingsSection, React.FC> = {
  profile: ProfileSection,
  workspace: WorkspaceSection,
  notifications: NotificationsSection,
  appearance: AppearanceSection,
  security: SecuritySection,
};

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const isMobile = useIsMobile();
  const ActiveComponent = sectionComponents[activeSection];
  const activeInfo = sections.find((s) => s.id === activeSection)!;

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 max-w-[1200px]">
        {/* Header */}
        <motion.div variants={item} className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Manage your workspace and account preferences</p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sub-navigation */}
          <motion.nav variants={item} className={`shrink-0 ${isMobile ? "" : "w-56"}`}>
            <div className={`${isMobile ? "flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide" : "space-y-1 sticky top-20"}`}>
              {sections.map((s) => {
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`${
                      isMobile
                        ? "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium whitespace-nowrap shrink-0 min-h-[44px] transition-all"
                        : "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-medium transition-all text-left"
                    } ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <s.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                    <span className="tracking-tight">{s.label}</span>
                    {!isMobile && isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Desktop: visual separator under nav */}
            {!isMobile && (
              <div className="mt-6 pt-4 border-t border-border/50">
                <div className="px-3.5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold">v2.4.0</p>
                  <p className="text-[11px] text-muted-foreground/40 mt-0.5">TRAKALOG © 2026</p>
                </div>
              </div>
            )}
          </motion.nav>

          {/* Content area */}
          <motion.div variants={item} className="flex-1 min-w-0">
            {/* Section title bar */}
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
              <div className="w-9 h-9 rounded-xl icon-brand flex items-center justify-center">
                <activeInfo.icon className="w-[18px] h-[18px] text-brand-orange" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground tracking-tight">{activeInfo.label}</h2>
                <p className="text-[11px] text-muted-foreground">{activeInfo.description}</p>
              </div>
            </div>

            <ActiveComponent />
          </motion.div>
        </div>
      </motion.div>
    </PageShell>
  );
}
