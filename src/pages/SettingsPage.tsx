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
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRole } from "@/contexts/RoleContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
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

type SettingsSection = "profile" | "workspace" | "branding" | "catalogSharing" | "notifications" | "appearance" | "security";

const sections: { id: SettingsSection; labelKey: string; icon: React.ElementType; descKey: string }[] = [
  { id: "profile", labelKey: "settings.profile", icon: User, descKey: "settings.profileDesc" },
  { id: "workspace", labelKey: "settings.workspace", icon: Building2, descKey: "settings.workspaceDesc" },
  { id: "branding", labelKey: "settings.branding", icon: Palette, descKey: "settings.brandingDesc" },
  { id: "catalogSharing", labelKey: "settings.catalogSharing", icon: Move, descKey: "settings.catalogSharingDesc" },
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
   SECTION: WORKSPACE
   ═══════════════════════════════════════════════════════ */

function WorkspaceSection() {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const [name, setName] = useState(activeWorkspace?.name || "");
  const [slug, setSlug] = useState(activeWorkspace?.slug || "");
  const [language, setLanguage] = useState(activeWorkspace?.settings?.defaultLanguage || "en");
  const [genre, setGenre] = useState("");
  const [copyright, setCopyright] = useState("");

  useEffect(() => {
    if (activeWorkspace) {
      setName(activeWorkspace.name || "");
      setSlug(activeWorkspace.slug || "");
      setLanguage(activeWorkspace.settings?.defaultLanguage || "en");
    }
  }, [activeWorkspace]);

  const handleSave = async () => {
    if (!activeWorkspace) return;
    const { error } = await supabase.from("workspaces").update({ name, slug }).eq("id", activeWorkspace.id);
    if (error) toast.error(error.message);
    else toast.success(t("settings.workspaceSaved"));
  };

  const handleDefaultsSave = async () => {
    if (!activeWorkspace) return;
    const newSettings = { ...activeWorkspace.settings, defaultLanguage: language, defaultGenre: genre, defaultCopyright: copyright };
    const { error } = await supabase.from("workspaces").update({ settings: newSettings as unknown as Record<string, unknown> }).eq("id", activeWorkspace.id);
    if (error) toast.error(error.message);
    else toast.success(t("settings.workspaceSaved"));
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <SectionBlock title={t("settings.general")} subtitle={t("settings.generalDesc")} icon={Building2} onSave={handleSave} saveLabel={t("settings.saveChanges")} changesHint={t("settings.changesHint")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FieldGroup label={t("settings.workspaceName")} hint={t("settings.workspaceNameHint")}>
            <PremiumInput value={name} placeholder="Your workspace" onChange={setName} />
          </FieldGroup>
          <FieldGroup label={t("settings.workspaceUrl")} hint="trakalog.app/w/">
            <PremiumInput value={slug} placeholder="your-workspace" onChange={() => {}} prefix={<span className="text-[11px]">/w/</span>} readOnly />
          </FieldGroup>
        </div>
        <div className="mt-5">
          <FieldGroup label={t("settings.defaultLanguage")} hint={t("settings.defaultLanguageHint")}>
            <PremiumSelect value={language} onChange={setLanguage} options={[
              { value: "en", label: "English" },
              { value: "fr", label: "Français" },
              { value: "es", label: "Español" },
            ]} />
          </FieldGroup>
        </div>
      </SectionBlock>

      <SectionBlock title={t("settings.uploadDefaults")} subtitle={t("settings.uploadDefaultsDesc")} icon={Sparkles} onSave={handleDefaultsSave} saveLabel={t("settings.saveDefaults")} changesHint={t("settings.changesHint")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FieldGroup label={t("settings.defaultGenre")} hint={t("settings.defaultGenreHint")}>
            <PremiumSelect value={genre} onChange={setGenre} options={[
              { value: "", label: "None" },
              { value: "hiphop", label: "Hip-Hop" },
              { value: "rnb", label: "R&B" },
              { value: "pop", label: "Pop" },
              { value: "electronic", label: "Electronic" },
              { value: "soul", label: "Neo-Soul" },
              { value: "rock", label: "Rock" },
              { value: "jazz", label: "Jazz" },
            ]} />
          </FieldGroup>
          <FieldGroup label={t("settings.defaultCopyright")} hint={t("settings.defaultCopyrightHint")}>
            <PremiumInput value={copyright} placeholder="© Year Label Name" onChange={setCopyright} />
          </FieldGroup>
        </div>
      </SectionBlock>

      <motion.div variants={fadeUp} className="rounded-2xl border border-destructive/15 bg-destructive/[0.02] overflow-hidden">
        <div className="px-6 py-5 flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-[17px] h-[17px] text-destructive" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-destructive tracking-tight">{t("settings.dangerZone")}</h3>
            <p className="text-[11px] text-destructive/50 mt-0.5">{t("settings.dangerZoneDesc")}</p>
          </div>
        </div>
        <div className="px-6 py-5 border-t border-destructive/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Delete this workspace</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">All tracks, playlists, and team data will be permanently removed.</p>
            </div>
            <button className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all min-h-[40px] shrink-0">
              Delete Workspace
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: BRANDING
   ═══════════════════════════════════════════════════════ */

const BRAND_PRESET_COLORS = [
  { hex: "#FF8C32", label: "Orange" },
  { hex: "#EC4899", label: "Pink" },
  { hex: "#8B5CF6", label: "Purple" },
  { hex: "#3B82F6", label: "Blue" },
  { hex: "#10B981", label: "Green" },
  { hex: "#F59E0B", label: "Amber" },
  { hex: "#6B7280", label: "Gray" },
  { hex: "#1F2937", label: "Dark" },
];

function BrandingSection() {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const [heroUrl, setHeroUrl] = useState<string | null>(activeWorkspace?.hero_image_url || null);
  const [logoUrl, setLogoUrl] = useState<string | null>(activeWorkspace?.logo_url || null);
  const [brandColor, setBrandColor] = useState<string>(activeWorkspace?.brand_color || "");
  const [uploading, setUploading] = useState<"hero" | "logo" | null>(null);
  const [heroPosition, setHeroPosition] = useState<number>(activeWorkspace?.hero_position ?? 50);
  const [repositioning, setRepositioning] = useState(false);
  const [dragPosition, setDragPosition] = useState<number>(50);
  const dragRef = useRef<{ startY: number; startPos: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeWorkspace) {
      setHeroUrl(activeWorkspace.hero_image_url || null);
      setLogoUrl(activeWorkspace.logo_url || null);
      setBrandColor(activeWorkspace.brand_color || "");
      setHeroPosition(activeWorkspace.hero_position ?? 50);
    }
  }, [activeWorkspace]);

  const startReposition = useCallback(() => {
    setDragPosition(heroPosition);
    setRepositioning(true);
  }, [heroPosition]);

  const handleDragStart = useCallback((clientY: number) => {
    dragRef.current = { startY: clientY, startPos: dragPosition };
  }, [dragPosition]);

  const handleDragMove = useCallback((clientY: number) => {
    if (!dragRef.current || !containerRef.current) return;
    const containerHeight = containerRef.current.getBoundingClientRect().height;
    const deltaY = clientY - dragRef.current.startY;
    const deltaPct = (deltaY / containerHeight) * 100;
    const newPos = Math.max(0, Math.min(100, dragRef.current.startPos - deltaPct));
    setDragPosition(newPos);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    if (!repositioning) return;
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientY);
    const onMouseUp = () => handleDragEnd();
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); handleDragMove(e.touches[0].clientY); };
    const onTouchEnd = () => handleDragEnd();
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [repositioning, handleDragMove, handleDragEnd]);

  const handleSavePosition = async () => {
    if (!activeWorkspace) return;
    const pos = Math.round(dragPosition);
    const { error } = await supabase.from("workspaces").update({ hero_position: pos }).eq("id", activeWorkspace.id);
    if (error) { toast.error(error.message); return; }
    setHeroPosition(pos);
    setRepositioning(false);
    toast.success("Hero position saved");
  };

  const handleCancelReposition = () => {
    setDragPosition(heroPosition);
    setRepositioning(false);
  };

  const handleUpload = (type: "hero" | "logo") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = type === "logo"
      ? "image/png, image/jpeg, image/webp, image/svg+xml"
      : "image/png, image/jpeg, image/webp";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !activeWorkspace) return;
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large (max 10MB)");
        return;
      }
      setUploading(type);
      const ext = file.name.split(".").pop() || "png";
      const path = activeWorkspace.id + "/" + type + "." + ext;
      const { error: uploadErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
      if (uploadErr) {
        toast.error(uploadErr.message);
        setUploading(null);
        return;
      }
      const { data: urlData } = supabase.storage.from("branding").getPublicUrl(path);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();
      const column = type === "hero" ? "hero_image_url" : "logo_url";
      const { error: updateErr } = await supabase.from("workspaces").update({ [column]: publicUrl }).eq("id", activeWorkspace.id);
      if (updateErr) {
        toast.error(updateErr.message);
        setUploading(null);
        return;
      }
      if (type === "hero") setHeroUrl(publicUrl);
      else setLogoUrl(publicUrl);
      setUploading(null);
      toast.success(type === "hero" ? "Background image updated" : "Logo updated");
    };
    input.click();
  };

  const handleRemove = async (type: "hero" | "logo") => {
    if (!activeWorkspace) return;
    const column = type === "hero" ? "hero_image_url" : "logo_url";
    const { error } = await supabase.from("workspaces").update({ [column]: null }).eq("id", activeWorkspace.id);
    if (error) { toast.error(error.message); return; }
    if (type === "hero") setHeroUrl(null);
    else setLogoUrl(null);
    toast.success(type === "hero" ? "Background image removed" : "Logo removed");
  };

  const handleBrandColorSave = async () => {
    if (!activeWorkspace) return;
    const { error } = await supabase.from("workspaces").update({ brand_color: brandColor || null }).eq("id", activeWorkspace.id);
    if (error) toast.error(error.message);
    else toast.success("Brand color saved");
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Logo */}
      <SectionBlock title="Logo" subtitle="Your logo displayed alongside TRAKALOG branding" icon={Image}>
        <FieldGroup label="Logo" hint="Your logo displayed alongside TRAKALOG branding. Recommended: PNG with transparent background">
          {logoUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center p-4 rounded-xl border border-border/50 bg-secondary/30">
                <img src={logoUrl} alt="Logo" style={{ maxHeight: 80 }} className="object-contain" />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleUpload("logo")} className="inline-flex items-center gap-1.5 text-[11px] gradient-text font-bold hover:opacity-80 transition-opacity">
                  <Edit3 className="w-3 h-3" />
                  {uploading === "logo" ? "Uploading..." : "Change"}
                </button>
                <span className="text-muted-foreground/20">·</span>
                <button onClick={() => handleRemove("logo")} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/40 font-medium hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => handleUpload("logo")}
              disabled={uploading === "logo"}
              className="w-full border-2 border-dashed border-border/50 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-primary/30 hover:bg-primary/[0.02] transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-[12px] font-semibold text-muted-foreground/60 group-hover:text-foreground transition-colors">
                {uploading === "logo" ? "Uploading..." : "Click to upload logo"}
              </span>
              <span className="text-[10px] text-muted-foreground/30">.jpg, .png, .webp, .svg</span>
            </button>
          )}
        </FieldGroup>
      </SectionBlock>

      {/* Background Image */}
      <SectionBlock title="Background Image" subtitle="Full-screen background for your shared links" icon={Image}>
        <FieldGroup label="Background Image" hint="Full-screen background shown to recipients on your shared links. Recommended: high-resolution photo (min 1920×1080px). The image will be darkened for readability.">
          {heroUrl ? (
            <div className="space-y-3">
              <div
                ref={containerRef}
                className={"group/hero relative rounded-xl overflow-hidden border border-border/50 bg-black " + (repositioning ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")}
                style={{ aspectRatio: "16/9" }}
                onMouseDown={repositioning ? (e) => { e.preventDefault(); handleDragStart(e.clientY); } : undefined}
                onTouchStart={repositioning ? (e) => handleDragStart(e.touches[0].clientY) : undefined}
              >
                <img
                  src={heroUrl}
                  alt="Background"
                  className="w-full h-full object-cover pointer-events-none select-none"
                  style={{ objectPosition: "center " + (repositioning ? dragPosition : heroPosition) + "%" }}
                  draggable={false}
                />
                {/* Dark overlay like SharedLinkPage */}
                {!repositioning && <div className="absolute inset-0 bg-black/55" />}
                {/* Mini-mockup of recipient view */}
                {!repositioning && (
                  <div className="absolute inset-0 flex flex-col items-center pointer-events-none select-none">
                    {/* Header: logo + TRAKALOG + CATALOG MANAGER */}
                    <div className="flex flex-col items-center mt-[8%] gap-0.5">
                      <img src={logoUrl || trakalogLogo} alt="Logo" className="h-[25px] object-contain" />
                      <span className="text-[6px] font-bold tracking-wider bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple bg-clip-text text-transparent">TRAKALOG</span>
                      <span className="text-[4px] tracking-[0.15em] text-white/30 font-medium">CATALOG MANAGER</span>
                    </div>
                    {/* Message card */}
                    <div className="mt-[5%] w-[55%] flex items-start gap-1.5 rounded bg-white/5 border border-white/10 px-2 py-1.5">
                      <div className="w-[2px] h-3 rounded-full bg-gradient-to-b from-brand-orange to-brand-pink flex-shrink-0 mt-0.5" />
                      <span className="text-[5px] text-white/50 italic leading-tight">Message from sender...</span>
                    </div>
                    {/* Glassmorphism card */}
                    <div className="mt-[4%] w-[55%] rounded-lg bg-white/8 backdrop-blur border border-white/10 p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-[30px] h-[30px] rounded bg-gradient-to-br from-brand-orange to-brand-pink flex-shrink-0" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[7px] font-bold text-white leading-none">Track Title</span>
                          <span className="text-[5px] text-white/60 leading-none">Artist Name</span>
                        </div>
                      </div>
                      {/* Fake waveform */}
                      <div className="flex items-end gap-[1px] mt-2 h-3">
                        {[40, 70, 55, 85, 45, 75, 60, 90, 50, 80, 65, 45, 70, 55, 85, 40, 75, 60, 50, 80, 65, 55, 70, 45, 85].map((h, i) => (
                          <div key={i} className="flex-1 bg-white/20 rounded-sm" style={{ height: h + "%" }} />
                        ))}
                      </div>
                      {/* Fake play button */}
                      <div className="flex justify-center mt-2">
                        <div className="w-[14px] h-[14px] rounded-full bg-brand-orange flex items-center justify-center">
                          <div className="w-0 h-0 border-l-[4px] border-l-white border-y-[2.5px] border-y-transparent ml-[1px]" />
                        </div>
                      </div>
                    </div>
                    {/* Footer */}
                    <div className="mt-auto mb-[4%]">
                      <span className="text-[4px] text-white/30">Shared via Trakalog</span>
                    </div>
                  </div>
                )}
                {/* Reposition mode overlay */}
                {repositioning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/50 text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg backdrop-blur-sm">
                      Drag to reposition
                    </div>
                  </div>
                )}
                {/* Hover overlay with actions (not in reposition mode) */}
                {!repositioning && (
                  <div className="absolute inset-0 bg-black/0 group-hover/hero:bg-black/40 transition-all duration-200">
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-2 opacity-0 group-hover/hero:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={startReposition}
                        className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm"
                        title="Reposition"
                      >
                        <Move className="w-3.5 h-3.5 text-gray-700" />
                      </button>
                      <button
                        onClick={() => handleUpload("hero")}
                        className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm"
                        title="Change"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-gray-700" />
                      </button>
                      <button
                        onClick={() => handleRemove("hero")}
                        className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                )}
                {uploading === "hero" && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-[12px] font-semibold">Uploading...</span>
                  </div>
                )}
              </div>
              {/* Reposition action buttons */}
              {repositioning && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSavePosition}
                    className="px-4 py-2 text-[12px] font-bold rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ background: "var(--gradient-brand-horizontal)" }}
                  >
                    Save Position
                  </button>
                  <button
                    onClick={handleCancelReposition}
                    className="px-4 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => handleUpload("hero")}
              disabled={uploading === "hero"}
              className="w-full border-2 border-dashed border-border/50 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-primary/30 hover:bg-primary/[0.02] transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-[12px] font-semibold text-muted-foreground/60 group-hover:text-foreground transition-colors">
                {uploading === "hero" ? "Uploading..." : "Click to upload background image"}
              </span>
              <span className="text-[10px] text-muted-foreground/30">.jpg, .png, .webp</span>
            </button>
          )}
        </FieldGroup>
      </SectionBlock>

      {/* Brand Color */}
      <SectionBlock title="Brand Color" subtitle="Accent color for your branded pages" icon={Palette} onSave={handleBrandColorSave} saveLabel="Save Color" changesHint="Color will apply to shared links">
        <FieldGroup label="Accent Color" hint="Accent color for your branded pages">
          <div className="space-y-4">
            {/* Preset colors */}
            <div className="flex flex-wrap gap-3">
              {BRAND_PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setBrandColor(c.hex)}
                  className="group flex flex-col items-center gap-1.5"
                >
                  <div
                    className={"w-9 h-9 rounded-xl transition-all duration-200 " + (brandColor === c.hex ? "ring-2 ring-primary ring-offset-2 ring-offset-card scale-110" : "ring-1 ring-border/30 group-hover:ring-border/60 group-hover:scale-105")}
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className={"text-[10px] font-semibold " + (brandColor === c.hex ? "text-primary" : "text-muted-foreground/40")}>{c.label}</span>
                </button>
              ))}
            </div>
            {/* Brand color preview */}
            {brandColor && (
              <div className="flex items-center gap-3">
                <div className="w-16 h-10 rounded-lg border border-border/40 shadow-sm" style={{ backgroundColor: brandColor }} />
                <span className="text-[13px] font-mono font-semibold text-foreground/70">{brandColor.toUpperCase()}</span>
              </div>
            )}
            {/* Custom color input */}
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor || "#FF8C32"}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-9 h-9 rounded-lg border border-border/60 cursor-pointer bg-transparent"
              />
              <PremiumInput
                value={brandColor}
                placeholder="#FF8C32"
                onChange={(v) => setBrandColor(v)}
              />
              {brandColor && (
                <button onClick={() => setBrandColor("")} className="text-[11px] text-muted-foreground/40 hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </FieldGroup>
      </SectionBlock>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: CATALOG SHARING
   ═══════════════════════════════════════════════════════ */

function CatalogSharingSection() {
  const { t } = useTranslation();
  const { activeWorkspace, workspaces } = useWorkspace();
  const { user } = useAuth();
  const [shares, setShares] = useState<{ id: string; target_workspace_id: string | null; source_workspace_id: string | null; track_id: string | null; status: string }[]>([]);
  const [incomingShares, setIncomingShares] = useState<{ id: string; source_workspace_id: string; track_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shareDropdownOpen, setShareDropdownOpen] = useState(false);
  const [revokeConfirmWsId, setRevokeConfirmWsId] = useState<string | null>(null);
  const shareDropdownRef = useRef<HTMLDivElement>(null);

  var fetchCatalogShares = useCallback(async function () {
    if (!activeWorkspace) return;
    setLoading(true);

    var [outgoingRes, incomingRes] = await Promise.all([
      supabase
        .from("catalog_shares")
        .select("id, target_workspace_id, source_workspace_id, track_id, status")
        .eq("source_workspace_id", activeWorkspace.id)
        .eq("status", "active"),
      supabase
        .from("catalog_shares")
        .select("id, source_workspace_id, track_id")
        .eq("target_workspace_id", activeWorkspace.id)
        .eq("status", "active"),
    ]);

    if (!outgoingRes.error && outgoingRes.data) {
      setShares(outgoingRes.data as any[]);
    }
    if (!incomingRes.error && incomingRes.data) {
      setIncomingShares(incomingRes.data as any[]);
    }
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(function () {
    fetchCatalogShares();
  }, [fetchCatalogShares]);

  // Close share dropdown on outside click
  useEffect(function () {
    if (!shareDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(e.target as Node)) {
        setShareDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return function () { document.removeEventListener("mousedown", handleClick); };
  }, [shareDropdownOpen]);

  var handleRevokeAll = async function (targetWsId: string) {
    if (!activeWorkspace) return;
    setSubmitting(true);
    var { error } = await supabase
      .from("catalog_shares")
      .update({ status: "revoked", revoked_at: new Date().toISOString() } as any)
      .eq("source_workspace_id", activeWorkspace.id)
      .eq("target_workspace_id", targetWsId)
      .eq("status", "active");

    if (error) {
      toast.error(t("catalogSharing.revokeFailed"));
    } else {
      var ws = workspaces.find(function (w) { return w.id === targetWsId; });
      toast.success(t("catalogSharing.fullCatalogRevoked", { name: ws?.name || "" }));
      fetchCatalogShares();
    }
    setSubmitting(false);
    setRevokeConfirmWsId(null);
  };

  var handleUpgradeToFullCatalog = async function (targetWsId: string) {
    if (!activeWorkspace || !user) return;
    setSubmitting(true);

    // Insert full catalog share
    var { error } = await supabase.from("catalog_shares").insert({
      track_id: null,
      source_workspace_id: activeWorkspace.id,
      target_workspace_id: targetWsId,
      shared_by: user.id,
      access_level: "pitcher",
    } as any);

    if (error) {
      toast.error(t("catalogSharing.shareFailed"));
    } else {
      // Revoke individual shares (now redundant)
      await supabase
        .from("catalog_shares")
        .update({ status: "revoked", revoked_at: new Date().toISOString() } as any)
        .eq("source_workspace_id", activeWorkspace.id)
        .eq("target_workspace_id", targetWsId)
        .eq("status", "active")
        .not("track_id", "is", null);

      var ws = workspaces.find(function (w) { return w.id === targetWsId; });
      toast.success(t("catalogSharing.fullCatalogShareSuccess", { name: ws?.name || "" }));
      fetchCatalogShares();
    }
    setSubmitting(false);
  };

  var handleShareFullCatalog = async function (targetWsId: string) {
    if (!activeWorkspace || !user) return;
    setSubmitting(true);

    var { error } = await supabase.from("catalog_shares").insert({
      track_id: null,
      source_workspace_id: activeWorkspace.id,
      target_workspace_id: targetWsId,
      shared_by: user.id,
      access_level: "pitcher",
    } as any);

    if (error) {
      toast.error(t("catalogSharing.shareFailed"));
    } else {
      var ws = workspaces.find(function (w) { return w.id === targetWsId; });
      toast.success(t("catalogSharing.fullCatalogShareSuccess", { name: ws?.name || "" }));
      fetchCatalogShares();
    }
    setSubmitting(false);
    setShareDropdownOpen(false);
  };

  // Group outgoing shares by target workspace
  var sharesByWs: Record<string, { fullCatalog: boolean; trackCount: number; shares: typeof shares }> = {};
  for (var i = 0; i < shares.length; i++) {
    var s = shares[i];
    var wsId = s.target_workspace_id || "";
    if (!sharesByWs[wsId]) {
      sharesByWs[wsId] = { fullCatalog: false, trackCount: 0, shares: [] };
    }
    if (s.track_id === null) {
      sharesByWs[wsId].fullCatalog = true;
    } else {
      sharesByWs[wsId].trackCount += 1;
    }
    sharesByWs[wsId].shares.push(s);
  }

  var wsEntries = Object.entries(sharesByWs);

  // Group incoming shares by source workspace
  var incomingBySource: Record<string, { fullCatalog: boolean; trackCount: number }> = {};
  for (var j = 0; j < incomingShares.length; j++) {
    var inc = incomingShares[j];
    var srcId = inc.source_workspace_id;
    if (!incomingBySource[srcId]) incomingBySource[srcId] = { fullCatalog: false, trackCount: 0 };
    if (inc.track_id === null) {
      incomingBySource[srcId].fullCatalog = true;
    } else {
      incomingBySource[srcId].trackCount += 1;
    }
  }
  var incomingEntries = Object.entries(incomingBySource);

  // Workspaces available for new shares (not already shared to)
  var sharedWsIds = new Set(Object.keys(sharesByWs));
  var availableWorkspaces = workspaces.filter(function (ws) {
    return ws.id !== (activeWorkspace?.id || "") && !sharedWsIds.has(ws.id);
  });

  function getWsInitials(name: string) {
    return name.split(/\s+/).map(function (w) { return w[0] || ""; }).join("").toUpperCase().slice(0, 2);
  }

  var hasAnyShares = wsEntries.length > 0 || incomingEntries.length > 0;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <SectionBlock title={t("settings.catalogSharing")} subtitle={t("settings.catalogSharingDesc")} icon={ArrowRightLeft}>
        {/* Share Catalog button */}
        {availableWorkspaces.length > 0 && (
          <div className="relative mb-4" ref={shareDropdownRef}>
            <button
              onClick={function () { setShareDropdownOpen(!shareDropdownOpen); }}
              className="btn-brand flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold min-h-[44px]"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("catalogSharing.shareCatalog")}
            </button>

            {shareDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 z-50 bg-card border border-border rounded-xl shadow-xl min-w-[280px] py-2 max-h-[300px] overflow-y-auto">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("catalogSharing.selectWorkspace")}
                </p>
                {availableWorkspaces.map(function (ws) {
                  return (
                    <button
                      key={ws.id}
                      onClick={function () { handleShareFullCatalog(ws.id); }}
                      disabled={submitting}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors"
                    >
                      {ws.logo_url ? (
                        <img src={ws.logo_url} alt="" className="w-7 h-7 rounded-lg object-contain shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-white">{getWsInitials(ws.name)}</span>
                        </div>
                      )}
                      <span className="text-sm font-medium text-foreground truncate flex-1">{ws.name}</span>
                      <span className="text-[11px] font-semibold text-brand-orange shrink-0 flex items-center gap-1">
                        {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Library className="w-3 h-3" />}
                        {t("catalogSharing.shareFullCatalog")}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
          </div>
        ) : !hasAnyShares ? (
          <div className="py-8 text-center">
            <ArrowRightLeft className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">{t("catalogSharing.noShares")}</p>
            <p className="text-[11px] text-muted-foreground/60">{t("catalogSharing.noSharesHint")}</p>
            {availableWorkspaces.length > 0 && (
              <button
                onClick={function () { setShareDropdownOpen(true); }}
                className="btn-brand flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold min-h-[44px] mx-auto mt-4"
              >
                <Plus className="w-3.5 h-3.5" />
                {t("catalogSharing.shareCatalog")}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Outgoing shares */}
            {wsEntries.length > 0 && (
              <div className="space-y-2">
                {wsEntries.map(function ([targetWsId, info]) {
                  var ws = workspaces.find(function (w) { return w.id === targetWsId; });
                  var wsName = ws?.name || targetWsId;

                  return (
                    <div key={targetWsId} className="p-3 rounded-xl border border-border/50 bg-secondary/20">
                      <div className="flex items-center gap-3">
                        {ws?.logo_url ? (
                          <img src={ws.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-white">{getWsInitials(wsName)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{wsName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {info.fullCatalog
                              ? t("catalogSharing.fullCatalogShared")
                              : t("catalogSharing.tracksSharedCount", { count: info.trackCount })}
                          </p>
                        </div>
                        {info.fullCatalog ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/12 text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-3 h-3" /> {t("catalogSharing.fullCatalog")}
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-purple/10 text-brand-purple shrink-0">
                            {info.trackCount + " tracks"}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-2.5 pl-11">
                        {!info.fullCatalog && (
                          <button
                            onClick={function () { handleUpgradeToFullCatalog(targetWsId); }}
                            disabled={submitting}
                            className="btn-brand inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold min-h-[44px]"
                          >
                            {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Library className="w-3 h-3" />}
                            {t("catalogSharing.upgradeToFull")}
                          </button>
                        )}
                        <button
                          onClick={function () { setRevokeConfirmWsId(targetWsId); }}
                          disabled={submitting}
                          className="text-[11px] text-destructive hover:text-destructive/80 font-semibold transition-colors min-h-[44px] px-2"
                        >
                          {t("catalogSharing.revokeAccess")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Incoming shares */}
            {incomingEntries.length > 0 && (
              <div className="mt-6">
                <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t("catalogSharing.incomingTitle")}
                </p>
                <div className="space-y-2">
                  {incomingEntries.map(function ([sourceWsId, info]) {
                    var ws = workspaces.find(function (w) { return w.id === sourceWsId; });
                    var wsName = ws?.name || sourceWsId;
                    return (
                      <div key={sourceWsId} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-secondary/20">
                        {ws?.logo_url ? (
                          <img src={ws.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-white">{getWsInitials(wsName)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{wsName}</p>
                        </div>
                        {info.fullCatalog ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/12 text-emerald-400 shrink-0">
                            {t("catalogSharing.fullCatalog")}
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-purple/10 text-brand-purple shrink-0">
                            {info.trackCount + " tracks"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </SectionBlock>

      {/* Revoke confirmation dialog */}
      {revokeConfirmWsId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={function () { setRevokeConfirmWsId(null); }}>
          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 max-w-sm mx-4" onClick={function (e) { e.stopPropagation(); }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-foreground">{t("catalogSharing.revokeConfirmTitle")}</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {t("catalogSharing.revokeConfirmDesc", {
                    name: (workspaces.find(function (w) { return w.id === revokeConfirmWsId; }) || { name: "" }).name
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={function () { setRevokeConfirmWsId(null); }}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
              >
                {t("catalogSharing.cancel")}
              </button>
              <button
                onClick={function () { handleRevokeAll(revokeConfirmWsId); }}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors min-h-[44px]"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t("catalogSharing.revokeAccess")}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: NOTIFICATIONS
   ═══════════════════════════════════════════════════════ */

function NotificationsSection() {
  const { t } = useTranslation();
  const { user, session } = useAuth();
  const prefs = user?.user_metadata?.notification_prefs || {};
  const [emailPitch, setEmailPitch] = useState(prefs.email_pitch !== false);
  const [emailUpload, setEmailUpload] = useState(prefs.email_upload !== false);
  const [emailTeam, setEmailTeam] = useState(prefs.email_team === true);
  const [emailDigest, setEmailDigest] = useState(prefs.email_digest !== false);
  const [pushPitch, setPushPitch] = useState(prefs.push_pitch !== false);
  const [pushUpload, setPushUpload] = useState(prefs.push_upload === true);
  const [pushComment, setPushComment] = useState(prefs.push_comment !== false);
  const [pushMention, setPushMention] = useState(prefs.push_mention !== false);

  const savePrefs = async (updates: Record<string, boolean>) => {
    await ensureSession(session);
    const current = user?.user_metadata?.notification_prefs || {};
    await supabase.auth.updateUser({ data: { notification_prefs: { ...current, ...updates } } });
  };

  const handleSave = async () => {
    await savePrefs({
      email_pitch: emailPitch,
      email_upload: emailUpload,
      email_team: emailTeam,
      email_digest: emailDigest,
      push_pitch: pushPitch,
      push_upload: pushUpload,
      push_comment: pushComment,
      push_mention: pushMention,
    });
    toast.success(t("settings.profileSaved"));
  };

  const toggleAndSave = (key: string, current: boolean, setter: (v: boolean) => void) => {
    const next = !current;
    setter(next);
    savePrefs({ [key]: next }).catch(() => {});
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <SectionBlock title={t("settings.emailNotifications")} subtitle={user?.email ? "Delivered to " + user.email : ""} icon={Mail} onSave={handleSave} saveLabel={t("settings.saveChanges")} changesHint={t("settings.changesHint")}>
        <SettingToggleRow label="Pitch Responses" description="When a recipient opens or responds to your pitch" enabled={emailPitch} onToggle={() => toggleAndSave("email_pitch", emailPitch, setEmailPitch)} />
        <Divider />
        <SettingToggleRow label="Track Uploads" description="When a collaborator uploads a new track to the catalog" enabled={emailUpload} onToggle={() => toggleAndSave("email_upload", emailUpload, setEmailUpload)} />
        <Divider />
        <SettingToggleRow label="Team Changes" description="When members join, leave, or have their roles updated" enabled={emailTeam} onToggle={() => toggleAndSave("email_team", emailTeam, setEmailTeam)} />
        <Divider />
        <SettingToggleRow label="Weekly Digest" description="A curated summary of your workspace activity every Monday" enabled={emailDigest} onToggle={() => toggleAndSave("email_digest", emailDigest, setEmailDigest)} />
      </SectionBlock>

      <SectionBlock title={t("settings.pushNotifications")} subtitle={t("settings.realTimeAlertsDesc")} icon={Bell} onSave={handleSave} saveLabel={t("settings.saveChanges")} changesHint={t("settings.changesHint")}>
        <SettingToggleRow label="Pitch Status Updates" description="Real-time alerts when pitches are opened, read, or replied to" enabled={pushPitch} onToggle={() => toggleAndSave("push_pitch", pushPitch, setPushPitch)} />
        <Divider />
        <SettingToggleRow label="New Catalog Uploads" description="When tracks or stems are added to the catalog" enabled={pushUpload} onToggle={() => toggleAndSave("push_upload", pushUpload, setPushUpload)} />
        <Divider />
        <SettingToggleRow label="Comments & Feedback" description="When someone leaves feedback or a note on your track" enabled={pushComment} onToggle={() => toggleAndSave("push_comment", pushComment, setPushComment)} />
        <Divider />
        <SettingToggleRow label="Mentions" description="When you're @mentioned in a comment or note" enabled={pushMention} onToggle={() => toggleAndSave("push_mention", pushMention, setPushMention)} />
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

  // Leak tracing state
  const [leakAnalyzing, setLeakAnalyzing] = useState(false);
  const [leakResult, setLeakResult] = useState<{ match: boolean; visitor_email?: string | null; visitor_name?: string | null; link_id?: string | null; confidence?: number; hash_hex?: string | null } | null>(null);
  const [leakTraces, setLeakTraces] = useState<{ id: string; file_name: string; created_at: string; match: boolean; visitor_email: string | null; confidence: number }[]>([]);
  const [leakDragOver, setLeakDragOver] = useState(false);
  const leakInputRef = useRef<HTMLInputElement>(null);

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

  const REST_URL = SUPABASE_URL + "/rest/v1";
  const SB_HEADERS: Record<string, string> = { "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY };

  // Load recent leak traces
  const loadLeakTraces = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    try {
      const res = await fetch(REST_URL + "/leak_traces?select=id,file_name,created_at,match,visitor_email,confidence&workspace_id=eq." + encodeURIComponent(activeWorkspace.id) + "&order=created_at.desc&limit=10", { headers: SB_HEADERS });
      if (res.ok) {
        const data = await res.json();
        setLeakTraces(data || []);
      }
    } catch (_e) { /* silent */ }
  }, [activeWorkspace?.id]);

  useEffect(() => { loadLeakTraces(); }, [loadLeakTraces]);

  const handleLeakFile = async (file: File) => {
    if (!user?.id || !activeWorkspace?.id) return;
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 100MB.");
      return;
    }
    const validTypes = [".wav", ".mp3", ".aiff", ".flac"];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    if (!validTypes.includes(ext)) {
      toast.error("Unsupported format. Use WAV, MP3, AIFF or FLAC.");
      return;
    }
    setLeakAnalyzing(true);
    setLeakResult(null);
    try {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("workspace_id", activeWorkspace.id);
      formData.append("user_id", user.id);
      formData.append("file_name", file.name);
      const res = await fetch(SUPABASE_URL + "/functions/v1/trace-leak", {
        method: "POST",
        headers: { "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY, "apikey": SUPABASE_PUBLISHABLE_KEY },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Analysis failed" }));
        toast.error(err.error || "Analysis failed");
        setLeakAnalyzing(false);
        return;
      }
      const result = await res.json();
      setLeakResult(result);
      loadLeakTraces();
    } catch (_e) {
      toast.error("Failed to analyze audio");
    }
    setLeakAnalyzing(false);
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

      <SectionBlock title="Leak Tracing" subtitle="Detect watermarks in leaked audio files" icon={Search}>
        <div
          onDragOver={(e) => { e.preventDefault(); setLeakDragOver(true); }}
          onDragLeave={() => setLeakDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setLeakDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleLeakFile(f); }}
          onClick={() => leakInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${leakDragOver ? "border-brand-orange bg-brand-orange/5" : "border-border/40 hover:border-border/70 bg-secondary/20 hover:bg-secondary/30"}`}
        >
          <input
            ref={leakInputRef}
            type="file"
            accept=".wav,.mp3,.aiff,.flac"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLeakFile(f); e.target.value = ""; }}
          />
          {leakAnalyzing ? (
            <>
              <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
              <p className="text-[13px] font-semibold text-foreground">Analyzing audio watermark...</p>
              <p className="text-[11px] text-muted-foreground/50">This may take a moment</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-secondary/60 flex items-center justify-center">
                <FileAudio className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-semibold text-foreground">Drop an audio file here or click to browse</p>
                <p className="text-[11px] text-muted-foreground/50 mt-1">WAV, MP3, AIFF, FLAC — Max 100MB</p>
              </div>
            </>
          )}
        </div>

        <AnimatePresence>
          {leakResult && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-4">
              {leakResult.match ? (
                <div className="p-4 rounded-xl border border-destructive/30" style={{ background: "hsl(0 70% 50% / 0.04)" }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] text-destructive font-semibold">Watermark detected — Leak source identified</p>
                      <div className="mt-2 space-y-1">
                        {leakResult.visitor_name && <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">Name:</span> {leakResult.visitor_name}</p>}
                        {leakResult.visitor_email && <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">Email:</span> {leakResult.visitor_email}</p>}
                        {leakResult.link_id && <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">Shared Link:</span> {leakResult.link_id}</p>}
                        {leakResult.confidence != null && <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">Confidence:</span> {Math.round(leakResult.confidence * 100)}%</p>}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-emerald-500/20" style={{ background: "hsl(160 60% 45% / 0.04)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[13px] text-emerald-400 font-semibold">No watermark detected in this file</p>
                      <p className="text-[11px] text-emerald-400/50 mt-0.5">The audio appears clean or the watermark could not be read</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {leakTraces.length > 0 && (
          <>
            <Divider />
            <div className="pt-2">
              <p className="text-[12px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">Recent Traces</p>
              <div className="space-y-2">
                {leakTraces.map((trace) => (
                  <div key={trace.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${trace.match ? "bg-destructive/12" : "bg-emerald-500/10"}`}>
                        {trace.match ? <AlertCircle className="w-3.5 h-3.5 text-destructive" /> : <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">{trace.file_name}</p>
                        <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                          {new Date(trace.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {trace.match && trace.visitor_email && <span className="text-destructive/70 ml-2">{trace.visitor_email}</span>}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${trace.match ? "text-destructive bg-destructive/10" : "text-emerald-400 bg-emerald-500/10"}`}>
                      {trace.match ? "Leak" : "Clean"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
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
  workspace: WorkspaceSection,
  branding: BrandingSection,
  catalogSharing: CatalogSharingSection,
  notifications: NotificationsSection,
  appearance: AppearanceSection,
  security: SecuritySection,
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
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
              {sections.map((s) => {
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
