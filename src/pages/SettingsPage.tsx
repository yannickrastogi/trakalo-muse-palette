import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import trakalogLogo from "@/assets/trakalog-logo.png";
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
  Check,
  Eye,
  EyeOff,
  Edit3,
  Move,
  Sparkles,
  Laptop,
  ChevronDown,
  Save,
  AlertTriangle,
  LogOut,
  Image,
  Upload,
  X,
  Plus,
  Library,
  CheckCircle2,
  Loader2,
  ArrowRightLeft,
  Search,
  FileAudio,
  AlertCircle,
  Users,
  UserPlus,
  Send,
  Crosshair,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRole } from "@/contexts/RoleContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useTeams } from "@/contexts/TeamContext";
import { InviteMemberModal, type InvitePayload } from "@/components/InviteMemberModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccessLevel } from "@/contexts/RoleContext";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/constants";
import { applyTheme, applyAccent, getStoredTheme, getStoredAccent, watchSystemTheme, applyCompactMode, applyReduceMotion, setSidebarCollapsed, getStoredCompact, getStoredReduceMotion, getStoredSidebarCollapsed, type ThemeMode, type AccentPalette } from "@/lib/theme";

/* ─── Helpers ─── */
async function ensureSession(session: { access_token: string; refresh_token: string } | null | undefined) {
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (!currentSession && session) {
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  }
}

/* ─── Animations ─── */
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

type SettingsSection = "profile" | "language" | "notifications" | "appearance" | "security";

const sections: { id: SettingsSection; labelKey: string; icon: React.ElementType; descKey: string }[] = [
  { id: "profile", labelKey: "settings.profile", icon: User, descKey: "settings.profileDesc" },
  { id: "language", labelKey: "settings.language", icon: Globe, descKey: "settings.languageDesc" },
  { id: "notifications", labelKey: "settings.notifications", icon: Bell, descKey: "settings.notificationsDesc" },
  { id: "appearance", labelKey: "settings.appearance", icon: Palette, descKey: "settings.appearanceDesc" },
  { id: "security", labelKey: "settings.security", icon: Shield, descKey: "settings.securityDesc" },
];

/* ═══════════════════════════════════════════════════════
   SHARED PRIMITIVES
   ═══════════════════════════════════════════════════════ */

function FieldGroup({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/50 leading-relaxed">{hint}</p>}
    </div>
  );
}

function PremiumInput({
  value,
  placeholder,
  type = "text",
  onChange,
  id,
  prefix,
  suffix,
  readOnly,
}: {
  value: string;
  placeholder: string;
  type?: string;
  onChange: (v: string) => void;
  id?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  readOnly?: boolean;
}) {
  return (
    <div className="relative group">
      {prefix && (
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 text-[13px] font-medium pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-background border border-border/60 rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/35 outline-none transition-all duration-200 font-medium
          focus:border-primary/40 focus:ring-2 focus:ring-primary/8 focus:bg-card
          group-hover:border-border
          ${prefix ? "pl-10" : ""}
          ${suffix ? "pr-10" : ""}
          ${readOnly ? "cursor-default opacity-70" : ""}
        `}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {suffix}
        </span>
      )}
      {/* Subtle bottom gradient accent on focus */}
      <div className="absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-primary/0 to-transparent group-focus-within:via-primary/30 transition-all duration-300" />
    </div>
  );
}

function PremiumTextarea({ value, placeholder, onChange, rows = 3 }: { value: string; placeholder: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="relative group">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-background border border-border/60 rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/35 outline-none transition-all duration-200 font-medium resize-none
          focus:border-primary/40 focus:ring-2 focus:ring-primary/8 focus:bg-card
          group-hover:border-border"
      />
      <div className="absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-primary/0 to-transparent group-focus-within:via-primary/30 transition-all duration-300" />
    </div>
  );
}

function PremiumSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative group">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-border/60 rounded-xl px-4 py-3 text-[13px] text-foreground outline-none transition-all duration-200 font-medium appearance-none cursor-pointer
          focus:border-primary/40 focus:ring-2 focus:ring-primary/8 focus:bg-card
          group-hover:border-border"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
    </div>
  );
}

function ToggleSwitch({ enabled, onToggle, size = "md" }: { enabled: boolean; onToggle: () => void; size?: "sm" | "md" }) {
  const w = size === "sm" ? "w-9 h-5" : "w-12 h-[26px]";
  const dot = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  const translate = size === "sm" ? "translate-x-4" : "translate-x-[22px]";

  return (
    <button onClick={onToggle} className={`relative ${w} rounded-full transition-all duration-300 ${enabled ? "" : "bg-secondary border border-border/60"}`}
      style={enabled ? { background: "var(--gradient-brand-horizontal)" } : undefined}
    >
      <span
        className={`absolute top-[3px] left-[3px] ${dot} rounded-full transition-all duration-300 ${
          enabled ? "bg-primary-foreground " + translate : "bg-muted-foreground/60 translate-x-0"
        }`}
        style={{ boxShadow: "0 1px 4px hsl(0 0% 0% / 0.25)" }}
      />
    </button>
  );
}

function SettingToggleRow({ label, description, enabled, onToggle, icon: Icon }: {
  label: string; description: string; enabled: boolean; onToggle: () => void; icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 group">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-secondary transition-colors">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground tracking-tight">{label}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      <ToggleSwitch enabled={enabled} onToggle={onToggle} />
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border/40" />;
}

function SectionBlock({ title, subtitle, icon: Icon, children, onSave, saveLabel, changesHint }: {
  title: string; subtitle?: string; icon: React.ElementType; children: ReactNode; onSave?: () => void; saveLabel?: string; changesHint?: string;
}) {
  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-border/50 bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div className="px-6 py-5 flex items-center gap-3.5" style={{ background: "var(--gradient-brand-soft)" }}>
        <div className="w-9 h-9 rounded-xl icon-brand flex items-center justify-center shrink-0">
          <Icon className="w-[17px] h-[17px] text-brand-orange" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-foreground tracking-tight leading-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-5">
        {children}
      </div>

      {/* Footer with save */}
      {onSave && (
        <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between" style={{ background: "hsl(240 5% 8% / 0.5)" }}>
          <p className="text-[11px] text-muted-foreground/40 font-medium">{changesHint}</p>
          <button onClick={onSave} className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[40px]">
            <Save className="w-3.5 h-3.5" />
            {saveLabel}
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: PROFILE
   ═══════════════════════════════════════════════════════ */

function ProfileSection() {
  const { t } = useTranslation();
  const { user, session } = useAuth();
  const [firstName, setFirstName] = useState(user?.user_metadata?.first_name || "");
  const [lastName, setLastName] = useState(user?.user_metadata?.last_name || "");
  const [email] = useState(user?.email || "");
  const [bio, setBio] = useState(user?.user_metadata?.bio || "");
  const [phone, setPhone] = useState(user?.user_metadata?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url || null);
  const [profileVisible, setProfileVisible] = useState(user?.user_metadata?.profile_visible !== false);
  const [showEmail, setShowEmail] = useState(user?.user_metadata?.show_email === true);

  const initials = ((user?.user_metadata?.first_name || "")[0] || "") + ((user?.user_metadata?.last_name || "")[0] || "") || "?";

  const handleSave = async () => {
    const { error } = await supabase.rpc("update_user_profile", {
      _user_id: user!.id,
      _first_name: firstName,
      _last_name: lastName,
      _phone: phone || null,
      _bio: bio || null,
      _avatar_url: user?.user_metadata?.avatar_url || null,
    });
    if (error) toast.error(error.message);
    else toast.success(t("settings.profileSaved"));
  };

  const handlePrivacySave = async () => {
    await ensureSession(session);
    const { error } = await supabase.auth.updateUser({
      data: { profile_visible: profileVisible, show_email: showEmail }
    });
    if (error) toast.error(error.message);
    else toast.success(t("settings.profileSaved"));
  };

  const handleAvatarUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png, image/jpeg, image/webp";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("settings.fileTooLarge"));
        return;
      }
      const path = user!.id + "/avatar." + file.name.split(".").pop();
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadErr) { toast.error(uploadErr.message); return; }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();
      const { error } = await supabase.rpc("update_user_profile", {
        _user_id: user!.id,
        _first_name: user?.user_metadata?.first_name || null,
        _last_name: user?.user_metadata?.last_name || null,
        _phone: user?.user_metadata?.phone || null,
        _bio: user?.user_metadata?.bio || null,
        _avatar_url: publicUrl,
      });
      if (error) { toast.error(error.message); return; }
      setAvatarUrl(publicUrl);
      toast.success(t("settings.photoUpdated"));
    };
    input.click();
  };

  const handleAvatarRemove = async () => {
    const { error } = await supabase.rpc("update_user_profile", {
      _user_id: user!.id,
      _first_name: user?.user_metadata?.first_name || null,
      _last_name: user?.user_metadata?.last_name || null,
      _phone: user?.user_metadata?.phone || null,
      _bio: user?.user_metadata?.bio || null,
      _avatar_url: null,
    });
    if (error) { toast.error(error.message); return; }
    setAvatarUrl(null);
    toast.success(t("settings.photoRemoved"));
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <SectionBlock title={t("settings.personalInfo")} subtitle={t("settings.personalInfoDesc")} icon={User} onSave={handleSave} saveLabel={t("settings.saveChanges")} changesHint={t("settings.changesHint")}>
        {/* Avatar row */}
        <div className="flex items-center gap-5 pb-6 mb-6 border-b border-border/30">
          <div className="relative group cursor-pointer" onClick={handleAvatarUpload}>
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-bold text-primary-foreground overflow-hidden"
              style={{ background: avatarUrl ? undefined : "var(--gradient-brand)", boxShadow: "0 4px 20px hsl(24 95% 53% / 0.2)" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="absolute inset-0 rounded-2xl bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-200">
              <Camera className="w-5 h-5 text-foreground mb-0.5" />
              <span className="text-[9px] font-semibold text-foreground/80 uppercase tracking-wider">Change</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground tracking-tight">{t("settings.profilePhoto")}</p>
            <p className="text-[11px] text-muted-foreground/50">{t("settings.photoHint")}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <button onClick={handleAvatarUpload} className="text-[11px] gradient-text font-bold hover:opacity-80 transition-opacity">{t("settings.uploadNew")}</button>
              <span className="text-muted-foreground/20">·</span>
              <button onClick={handleAvatarRemove} className="text-[11px] text-muted-foreground/40 font-medium hover:text-destructive transition-colors">{t("settings.remove")}</button>
            </div>
          </div>
        </div>

        {/* Form grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FieldGroup label={t("settings.firstName")} htmlFor="firstName">
            <PremiumInput id="firstName" value={firstName} placeholder="Your first name" onChange={setFirstName} />
          </FieldGroup>
          <FieldGroup label={t("settings.lastName")} htmlFor="lastName">
            <PremiumInput id="lastName" value={lastName} placeholder="Your last name" onChange={setLastName} />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
          <FieldGroup label={t("settings.emailAddress")} hint={t("settings.emailHint")} htmlFor="email">
            <PremiumInput id="email" value={email} placeholder="you@example.com" type="email" onChange={() => {}}
              prefix={<Mail className="w-3.5 h-3.5" />} readOnly />
          </FieldGroup>
          <FieldGroup label={t("settings.phoneNumber")} hint={t("settings.phoneHint")} htmlFor="phone">
            <PremiumInput id="phone" value={phone} placeholder="+1 (555) 000-0000" onChange={setPhone}
              prefix={<Smartphone className="w-3.5 h-3.5" />} />
          </FieldGroup>
        </div>

        <div className="mt-5">
          <FieldGroup label={t("settings.bio")} hint={t("settings.bioHint")}>
            <PremiumTextarea value={bio} placeholder="Tell your team a bit about yourself…" onChange={setBio} rows={3} />
          </FieldGroup>
        </div>
      </SectionBlock>

      <SectionBlock title={t("settings.privacy")} subtitle={t("settings.privacyControlDesc")} icon={Eye} onSave={handlePrivacySave} saveLabel={t("settings.updatePrivacy")} changesHint={t("settings.changesHint")}>
        <SettingToggleRow icon={Globe} label={t("settings.profileVisibility")} description={t("settings.profileVisibilityDesc")} enabled={profileVisible} onToggle={() => setProfileVisible(!profileVisible)} />
        <Divider />
        <SettingToggleRow icon={Mail} label={t("settings.showEmailAddress")} description={t("settings.showEmailDesc")} enabled={showEmail} onToggle={() => setShowEmail(!showEmail)} />
      </SectionBlock>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: LANGUAGE
   ═══════════════════════════════════════════════════════ */

const AVAILABLE_LANGUAGES = [
  { code: "en", label: "English", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "fr", label: "Fran\u00e7ais", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "es", label: "Espa\u00f1ol", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "pt", label: "Portugu\u00eas", flag: "\u{1F1E7}\u{1F1F7}" },
  { code: "it", label: "Italiano", flag: "\u{1F1EE}\u{1F1F9}" },
  { code: "de", label: "Deutsch", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "ko", label: "\ud55c\uad6d\uc5b4", flag: "\u{1F1F0}\u{1F1F7}" },
  { code: "ja", label: "\u65e5\u672c\u8a9e", flag: "\u{1F1EF}\u{1F1F5}" },
];

function LanguageSection() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <SectionBlock title={t("settings.language")} subtitle={t("settings.languageDesc")} icon={Globe}>
        <FieldGroup label={t("settings.language")} hint={t("settings.languageHint")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AVAILABLE_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleChange(lang.code)}
                className={"flex items-center gap-3 px-4 py-3 rounded-xl border transition-all " + (currentLang === lang.code || currentLang.startsWith(lang.code + "-") ? "border-primary/40 bg-primary/5 text-foreground" : "border-border/30 bg-secondary/20 text-muted-foreground hover:bg-secondary/40 hover:text-foreground")}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="text-[13px] font-semibold">{lang.label}</span>
                {(currentLang === lang.code || currentLang.startsWith(lang.code + "-")) && (
                  <Check className="w-4 h-4 text-primary ml-auto" />
                )}
              </button>
            ))}
          </div>
        </FieldGroup>
      </SectionBlock>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: NOTIFICATIONS
   ═══════════════════════════════════════════════════════ */

const NOTIF_STORAGE_KEY = "trakalog_notification_prefs";
const NOTIF_DEFAULTS: Record<string, boolean> = { link_activity: true, comments: true, signatures: true, new_member: true, track_uploads: true };

function loadNotifPrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (raw) return { ...NOTIF_DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...NOTIF_DEFAULTS };
}

function NotificationsSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(loadNotifPrefs);

  const toggle = (key: string) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <SectionBlock title={t("settings.emailNotifications")} subtitle={user?.email ? "Delivered to " + user.email : ""} icon={Mail}>
        <SettingToggleRow label={t("settings.notifLinkActivity")} description={t("settings.notifLinkActivityDesc")} enabled={prefs.link_activity} onToggle={() => toggle("link_activity")} />
        <Divider />
        <SettingToggleRow label={t("settings.notifComments")} description={t("settings.notifCommentsDesc")} enabled={prefs.comments} onToggle={() => toggle("comments")} />
        <Divider />
        <SettingToggleRow label={t("settings.notifSignatures")} description={t("settings.notifSignaturesDesc")} enabled={prefs.signatures} onToggle={() => toggle("signatures")} />
        <Divider />
        <SettingToggleRow label={t("settings.notifNewMember")} description={t("settings.notifNewMemberDesc")} enabled={prefs.new_member} onToggle={() => toggle("new_member")} />
        <Divider />
        <SettingToggleRow label={t("settings.notifTrackUploads")} description={t("settings.notifTrackUploadsDesc")} enabled={prefs.track_uploads} onToggle={() => toggle("track_uploads")} />
      </SectionBlock>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: APPEARANCE
   ═══════════════════════════════════════════════════════ */

function AppearanceSection() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);
  const [accent, setAccentState] = useState<AccentPalette>(getStoredAccent);
  const [compactMode, setCompactMode] = useState(getStoredCompact);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(getStoredSidebarCollapsed);
  const [animations, setAnimations] = useState(() => !getStoredReduceMotion());

  const handleThemeChange = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    await ensureSession(session);
    supabase.auth.updateUser({ data: { theme: newTheme } }).catch(() => {});
  };

  const handleAccentChange = async (newAccent: AccentPalette) => {
    setAccentState(newAccent);
    applyAccent(newAccent);
    await ensureSession(session);
    supabase.auth.updateUser({ data: { accent: newAccent } }).catch(() => {});
  };

  // Watch system theme changes
  useEffect(() => {
    if (theme !== "system") return;
    return watchSystemTheme(() => applyTheme("system"));
  }, [theme]);

  const themes: { id: ThemeMode; label: string; icon: React.ElementType; bar1: string; bar2: string; bar3: string; bg: string }[] = [
    { id: "dark", label: "Dark", icon: Moon, bg: "bg-[hsl(240,6%,8%)]", bar1: "bg-[hsl(240,4%,14%)]", bar2: "bg-[hsl(240,4%,18%)]", bar3: "bg-[hsl(24,100%,55%)]" },
    { id: "light", label: "Light", icon: Sun, bg: "bg-[hsl(0,0%,97%)]", bar1: "bg-[hsl(0,0%,90%)]", bar2: "bg-[hsl(0,0%,85%)]", bar3: "bg-[hsl(24,100%,55%)]" },
    { id: "system", label: "System", icon: Monitor, bg: "bg-gradient-to-br from-[hsl(240,6%,8%)] to-[hsl(0,0%,95%)]", bar1: "bg-[hsl(240,4%,20%)]", bar2: "bg-[hsl(0,0%,80%)]", bar3: "bg-[hsl(24,100%,55%)]" },
  ];

  const accents: { id: AccentPalette; colors: string; name: string }[] = [
    { id: "sunset", colors: "from-[hsl(24,100%,55%)] to-[hsl(330,80%,60%)]", name: "Sunset" },
    { id: "ocean", colors: "from-[hsl(200,80%,50%)] to-[hsl(240,70%,60%)]", name: "Ocean" },
    { id: "mint", colors: "from-[hsl(160,70%,45%)] to-[hsl(200,80%,50%)]", name: "Mint" },
    { id: "violet", colors: "from-[hsl(270,70%,55%)] to-[hsl(330,80%,60%)]", name: "Violet" },
    { id: "mono", colors: "from-[hsl(0,0%,75%)] to-[hsl(0,0%,50%)]", name: "Mono" },
  ];

  const handleSave = () => toast.success("Appearance preferences saved");

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <SectionBlock title="Theme" subtitle="Choose your visual mode" icon={Palette} onSave={handleSave} saveLabel="Save Appearance">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {themes.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className={`relative rounded-2xl border-2 transition-all duration-300 p-3.5 flex flex-col items-center gap-3 group ${
                  active
                    ? "border-primary/60 shadow-[0_0_20px_hsl(24_95%_53%/0.1)]"
                    : "border-border/30 hover:border-border/60"
                }`}
              >
                {/* Mini window preview */}
                <div className={`w-full aspect-[4/3] rounded-xl ${t.bg} border border-border/20 p-2.5 flex gap-1.5 overflow-hidden`}>
                  <div className="w-1/4 flex flex-col gap-1">
                    <div className={`h-1.5 rounded-full ${t.bar1} w-full`} />
                    <div className={`h-1.5 rounded-full ${t.bar1} w-3/4`} />
                    <div className={`h-1.5 rounded-full ${t.bar3} w-2/3`} />
                    <div className={`h-1.5 rounded-full ${t.bar1} w-full`} />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className={`h-2 rounded ${t.bar2} w-2/3`} />
                    <div className={`flex-1 rounded-lg ${t.bar1}`} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <t.icon className={`w-3.5 h-3.5 ${active ? "text-primary" : "text-muted-foreground/50"}`} />
                  <span className={`text-[12px] font-bold tracking-tight ${active ? "text-primary" : "text-muted-foreground/60"}`}>
                    {t.label}
                  </span>
                </div>
                {active && (
                  <motion.div layoutId="theme-check" className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "var(--gradient-brand)" }}>
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </motion.div>
                )}
              </button>
            );
          })}
        </div>

        <Divider />

        <div className="pt-5">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Accent Palette</p>
          <div className="flex items-center gap-3">
            {accents.map((a) => (
              <button
                key={a.id}
                onClick={() => handleAccentChange(a.id)}
                className="group flex flex-col items-center gap-1.5"
              >
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${a.colors} transition-all duration-200 ${
                  accent === a.id
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-card scale-110"
                    : "ring-1 ring-border/30 group-hover:ring-border/60 group-hover:scale-105"
                }`} />
                <span className={`text-[10px] font-semibold ${accent === a.id ? "text-primary" : "text-muted-foreground/40"}`}>{a.name}</span>
              </button>
            ))}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Layout & Display" subtitle="Fine-tune your workspace layout" icon={Monitor} onSave={handleSave} saveLabel="Save Layout">
        <SettingToggleRow icon={Laptop} label="Compact Mode" description="Reduce padding and spacing for information-dense views" enabled={compactMode} onToggle={async () => { const next = !compactMode; setCompactMode(next); applyCompactMode(next); await ensureSession(session); supabase.auth.updateUser({ data: { compact_mode: next } }).catch(() => {}); }} />
        <Divider />
        <SettingToggleRow icon={ChevronDown} label="Collapsed Sidebar" description="Start with the sidebar collapsed by default" enabled={sidebarCollapsed} onToggle={async () => { const next = !sidebarCollapsed; setSidebarCollapsedState(next); setSidebarCollapsed(next); await ensureSession(session); supabase.auth.updateUser({ data: { sidebar_collapsed: next } }).catch(() => {}); }} />
        <Divider />
        <SettingToggleRow icon={Sparkles} label="Motion & Animations" description="Enable entrance animations and micro-interactions" enabled={animations} onToggle={async () => { const next = !animations; setAnimations(next); applyReduceMotion(!next); await ensureSession(session); supabase.auth.updateUser({ data: { reduce_motion: !next } }).catch(() => {}); }} />
      </SectionBlock>

      <ResetOnboardingBlock />
    </motion.div>
  );
}

function ResetOnboardingBlock() {
  const { resetOnboarding } = useOnboarding();
  return (
    <motion.div variants={fadeUp} className="card-premium p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl icon-brand flex items-center justify-center shrink-0">
          <RotateCcw className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Restart Onboarding</p>
          <p className="text-2xs text-muted-foreground mt-0.5">Show the welcome modal and getting started checklist again</p>
        </div>
      </div>
      <button
        onClick={() => { resetOnboarding(); toast.success("Onboarding reset — refresh to see the welcome screen"); }}
        className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
      >
        Reset
      </button>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: SECURITY
   ═══════════════════════════════════════════════════════ */

function SecuritySection() {
  const { t } = useTranslation();
  const { user, signOut, session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const isOAuth = user?.app_metadata?.provider === "google";
  const [twoFa, setTwoFa] = useState(false);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  // Check MFA status on mount
  useEffect(() => {
    const checkMfa = async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return;
      const verified = data.totp?.find((f: any) => f.status === "verified");
      if (verified) {
        setTwoFa(true);
        setMfaFactorId(verified.id);
      }
    };
    checkMfa();
  }, []);

  const handleToggle2FA = async () => {
    if (twoFa) {
      // Disable 2FA
      if (!mfaFactorId) return;
      setMfaLoading(true);
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      setMfaLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("2FA disabled");
        setTwoFa(false);
        setMfaFactorId(null);
      }
    } else {
      // Start enrollment
      setMfaLoading(true);
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      setMfaLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setMfaQrCode(data.totp.qr_code);
      setMfaFactorId(data.id);
      setMfaEnrolling(true);
      setMfaCode("");
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaFactorId || !mfaCode) return;
    setMfaLoading(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challenge.error) {
      setMfaLoading(false);
      toast.error(challenge.error.message);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.data.id,
      code: mfaCode,
    });
    setMfaLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("2FA enabled!");
      setTwoFa(true);
      setMfaEnrolling(false);
      setMfaQrCode(null);
      setMfaCode("");
    }
  };

  const handleCancelEnroll = async () => {
    if (mfaFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
    }
    setMfaEnrolling(false);
    setMfaQrCode(null);
    setMfaFactorId(null);
    setMfaCode("");
  };

  const currentSession = {
    device: navigator.userAgent.includes("Mac") ? "Mac" : navigator.userAgent.includes("Windows") ? "Windows" : navigator.userAgent.includes("Linux") ? "Linux" : "Unknown Device",
    browser: navigator.userAgent.includes("Chrome") ? "Chrome" : navigator.userAgent.includes("Firefox") ? "Firefox" : navigator.userAgent.includes("Safari") ? "Safari" : "Browser",
    time: "Active now",
    current: true,
    icon: navigator.userAgent.includes("Mac") ? Laptop : navigator.userAgent.includes("iPhone") ? Smartphone : Monitor,
  };

  const handlePasswordChange = async () => {
    if (!newPw || newPw.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    await ensureSession(session);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) toast.error(error.message);
    else {
      toast.success(t("settings.passwordUpdated"));
      setCurrentPw("");
      setNewPw("");
    }
  };

  const [signingOut, setSigningOut] = useState(false);

  const handleSignOutEverywhere = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        toast.error(error.message);
        setSigningOut(false);
        return;
      }
      localStorage.removeItem("trakalog_was_auth");
      localStorage.removeItem("trakalog_session_backup");
      localStorage.removeItem("trakalog_active_workspace");
      toast.success("Signed out from all devices");
      window.location.href = "/auth";
    } catch (err: any) {
      toast.error(err?.message || "Failed to sign out");
      setSigningOut(false);
    }
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {isOAuth ? (
        <SectionBlock title={t("settings.changePassword")} subtitle={t("settings.changePasswordDesc")} icon={Lock}>
          <div className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-secondary/30">
            <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[13px] text-foreground font-semibold">Signed in with Google</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">Password management is handled by your Google account</p>
            </div>
          </div>
        </SectionBlock>
      ) : (
        <SectionBlock title={t("settings.changePassword")} subtitle={t("settings.changePasswordDesc")} icon={Lock} onSave={handlePasswordChange} saveLabel={t("settings.updatePassword")} changesHint={t("settings.changesHint")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FieldGroup label={t("settings.currentPassword")}>
              <PremiumInput
                value={currentPw}
                placeholder="Enter current password"
                type={showPw ? "text" : "password"}
                onChange={setCurrentPw}
                suffix={
                  <button onClick={() => setShowPw(!showPw)} className="text-muted-foreground/40 hover:text-foreground transition-colors">
                    {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                }
              />
            </FieldGroup>
            <FieldGroup label={t("settings.newPassword")}>
              <PremiumInput
                value={newPw}
                placeholder="Enter new password"
                type={showPw ? "text" : "password"}
                onChange={setNewPw}
                suffix={
                  <button onClick={() => setShowPw(!showPw)} className="text-muted-foreground/40 hover:text-foreground transition-colors">
                    {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                }
              />
            </FieldGroup>
          </div>
          {newPw.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((level) => (
                  <div key={level} className={`h-1 flex-1 rounded-full transition-colors ${
                    newPw.length >= level * 3
                      ? level >= 4 ? "bg-emerald-400" : level >= 3 ? "bg-brand-orange" : "bg-destructive"
                      : "bg-secondary"
                  }`} />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/40 mt-1.5 font-medium">
                {newPw.length < 6 ? "Too short" : newPw.length < 9 ? "Fair" : newPw.length < 12 ? "Good" : "Strong"}
              </p>
            </motion.div>
          )}
        </SectionBlock>
      )}

      <SectionBlock title={t("settings.twoFactor")} subtitle={t("settings.twoFactorDesc")} icon={Shield}>
        <div className="flex items-center justify-between gap-4 py-1">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${twoFa ? "bg-emerald-500/12" : "bg-secondary/60"}`}>
              <Smartphone className={`w-[18px] h-[18px] ${twoFa ? "text-emerald-400" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground tracking-tight">Authenticator App</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">Use an app like Google Authenticator or Authy</p>
            </div>
          </div>
          <ToggleSwitch enabled={twoFa || mfaEnrolling} onToggle={mfaEnrolling ? handleCancelEnroll : handleToggle2FA} />
        </div>
        <AnimatePresence>
          {mfaEnrolling && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
              <div className="p-4 rounded-xl border border-border/40 bg-secondary/30 space-y-4">
                <p className="text-[13px] text-foreground font-semibold">Scan this QR code with your authenticator app</p>
                {mfaQrCode && (
                  <div className="flex justify-center">
                    <img src={mfaQrCode} alt="TOTP QR Code" className="w-48 h-48 rounded-lg" />
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground/50">Enter the 6-digit code from your app</p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="flex-1 h-10 px-3 rounded-lg border border-border/40 bg-background text-foreground text-center text-lg tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                    />
                    <button
                      onClick={handleVerifyMfa}
                      disabled={mfaCode.length !== 6 || mfaLoading}
                      className="h-10 px-4 rounded-lg bg-brand-orange text-white text-[13px] font-semibold hover:bg-brand-orange/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {mfaLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Verify
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {twoFa && !mfaEnrolling && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-emerald-500/20" style={{ background: "hsl(160 60% 45% / 0.04)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[13px] text-emerald-400 font-semibold">2FA is active</p>
                    <p className="text-[11px] text-emerald-400/50 mt-0.5">Your account has an extra layer of protection</p>
                  </div>
                </div>
                <button
                  onClick={handleToggle2FA}
                  disabled={mfaLoading}
                  className="text-[11px] text-destructive/70 hover:text-destructive font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {mfaLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Disable 2FA
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SectionBlock>

      <SectionBlock title="Active Sessions" subtitle="Manage where you're signed in" icon={Key}>
        <div className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10">
              <currentSession.icon className="w-[18px] h-[18px] text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold text-foreground tracking-tight">{currentSession.device}</p>
                <span className="text-[11px] text-muted-foreground/40">· {currentSession.browser}</span>
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Current
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground/40 mt-0.5">{currentSession.time}</p>
            </div>
          </div>
        </div>
        <Divider />
        <div className="flex items-center justify-between gap-3 py-4">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Sign out everywhere</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">This will sign you out from all devices and sessions</p>
          </div>
          <button onClick={handleSignOutEverywhere} disabled={signingOut} className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all min-h-[40px] flex items-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
            <LogOut className="w-3.5 h-3.5" /> {signingOut ? "Signing out…" : "Sign Out All"}
          </button>
        </div>
      </SectionBlock>

      <SectionBlock title="Data & Privacy" subtitle="Export or delete your data" icon={Download}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Export all data</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Download tracks, playlists, contacts, and metadata as a ZIP archive</p>
          </div>
          <button className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border border-border/60 text-foreground hover:bg-secondary transition-all min-h-[40px] flex items-center gap-2 shrink-0">
            <Download className="w-3.5 h-3.5" /> Export ZIP
          </button>
        </div>
        <Divider />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Delete your account</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">This will permanently remove your account and all associated data</p>
          </div>
          <button className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border border-destructive/25 text-destructive hover:bg-destructive/8 transition-all min-h-[40px] shrink-0">
            Delete Account
          </button>
        </div>
      </SectionBlock>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN SETTINGS PAGE
   ═══════════════════════════════════════════════════════ */

const sectionComponents: Record<SettingsSection, React.FC> = {
  profile: ProfileSection,
  language: LanguageSection,
  notifications: NotificationsSection,
  appearance: AppearanceSection,
  security: SecuritySection,
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const visibleSections = sections;
  const validSections: SettingsSection[] = visibleSections.map((s) => s.id);
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

  useEffect(() => {
    const s = searchParams.get("section");
    if (s && validSections.includes(s as SettingsSection)) {
      setActiveSection(s as SettingsSection);
    }
  }, [searchParams]);
  const isMobile = useIsMobile();
  const ActiveComponent = sectionComponents[activeSection];
  const activeInfo = sections.find((s) => s.id === activeSection)!;

  return (
    <PageShell>
      <motion.div variants={stagger} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 max-w-[1200px]">
        {/* Page header */}
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("settings.title")}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">{t("settings.subtitle")}</p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left navigation */}
          <motion.nav variants={fadeUp} className={`shrink-0 ${isMobile ? "" : "w-60"}`}>
            <div className={isMobile
              ? "flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1"
              : "space-y-0.5 sticky top-20"
            }>
              {visibleSections.map((s) => {
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`relative ${
                      isMobile
                        ? "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium whitespace-nowrap shrink-0 min-h-[44px] transition-all"
                        : "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200"
                    } ${
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/30"
                    }`}
                  >
                    {/* Active gradient bar (desktop) */}
                    {!isMobile && isActive && (
                      <motion.div
                        layoutId="settings-active"
                        className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full"
                        style={{ background: "var(--gradient-brand)" }}
                        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                      />
                    )}
                    {/* Mobile active pill bg */}
                    {isMobile && isActive && (
                      <motion.div layoutId="settings-pill" className="absolute inset-0 rounded-xl bg-primary/10" transition={{ duration: 0.2 }} />
                    )}

                    <s.icon className={`w-[17px] h-[17px] shrink-0 relative z-10 ${isActive ? "text-primary" : ""}`} />
                    <div className="relative z-10 min-w-0">
                      <span className={`text-[13px] font-semibold tracking-tight block ${isActive ? "" : ""}`}>{t(s.labelKey)}</span>
                      {!isMobile && (
                        <span className={`text-[10px] mt-0.5 block ${isActive ? "text-muted-foreground/50" : "text-muted-foreground/30"}`}>
                          {t(s.descKey)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {!isMobile && (
              <div className="mt-8 pt-5 border-t border-border/30 px-4">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/25 font-bold">TRAKALOG</p>
              </div>
            )}
          </motion.nav>

          {/* Right content */}
          <motion.div variants={fadeUp} className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>
    </PageShell>
  );
}
