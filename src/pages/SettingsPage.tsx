import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Sparkles,
  Laptop,
  ChevronDown,
  Save,
  AlertTriangle,
  LogOut,
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

/* ─── Animations ─── */
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

type SettingsSection = "profile" | "workspace" | "notifications" | "appearance" | "security";

const sections: { id: SettingsSection; labelKey: string; icon: React.ElementType; descKey: string }[] = [
  { id: "profile", labelKey: "settings.profile", icon: User, descKey: "settings.profileDesc" },
  { id: "workspace", labelKey: "settings.workspace", icon: Building2, descKey: "settings.workspaceDesc" },
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
  const { user } = useAuth();
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
    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName, last_name: lastName, phone, bio }
    });
    if (error) toast.error(error.message);
    else toast.success(t("settings.profileSaved"));
  };

  const handlePrivacySave = async () => {
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
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      setAvatarUrl(publicUrl);
      toast.success(t("settings.photoUpdated"));
    };
    input.click();
  };

  const handleAvatarRemove = async () => {
    await supabase.auth.updateUser({ data: { avatar_url: null } });
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
   SECTION: NOTIFICATIONS
   ═══════════════════════════════════════════════════════ */

function NotificationsSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
  const [theme, setTheme] = useState<"dark" | "light" | "system">(() => {
    return (localStorage.getItem("trakalog-theme") as "dark" | "light" | "system") || "dark";
  });
  const [accentIdx, setAccentIdx] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [animations, setAnimations] = useState(true);

  const handleThemeChange = (newTheme: "dark" | "light" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("trakalog-theme", newTheme);
    supabase.auth.updateUser({ data: { theme: newTheme } }).catch(() => {});
  };

  const themes: { id: "dark" | "light" | "system"; label: string; icon: React.ElementType; bar1: string; bar2: string; bar3: string; bg: string }[] = [
    { id: "dark", label: "Dark", icon: Moon, bg: "bg-[hsl(240,6%,8%)]", bar1: "bg-[hsl(240,4%,14%)]", bar2: "bg-[hsl(240,4%,18%)]", bar3: "bg-[hsl(24,100%,55%)]" },
    { id: "light", label: "Light", icon: Sun, bg: "bg-[hsl(0,0%,97%)]", bar1: "bg-[hsl(0,0%,90%)]", bar2: "bg-[hsl(0,0%,85%)]", bar3: "bg-[hsl(24,100%,55%)]" },
    { id: "system", label: "System", icon: Monitor, bg: "bg-gradient-to-br from-[hsl(240,6%,8%)] to-[hsl(0,0%,95%)]", bar1: "bg-[hsl(240,4%,20%)]", bar2: "bg-[hsl(0,0%,80%)]", bar3: "bg-[hsl(24,100%,55%)]" },
  ];

  const accents = [
    { colors: "from-[hsl(24,100%,55%)] to-[hsl(330,80%,60%)]", name: "Sunset" },
    { colors: "from-[hsl(200,80%,50%)] to-[hsl(240,70%,60%)]", name: "Ocean" },
    { colors: "from-[hsl(160,70%,45%)] to-[hsl(200,80%,50%)]", name: "Mint" },
    { colors: "from-[hsl(270,70%,55%)] to-[hsl(330,80%,60%)]", name: "Violet" },
    { colors: "from-[hsl(0,0%,75%)] to-[hsl(0,0%,50%)]", name: "Mono" },
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
            {accents.map((a, i) => (
              <button
                key={i}
                onClick={() => setAccentIdx(i)}
                className="group flex flex-col items-center gap-1.5"
              >
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${a.colors} transition-all duration-200 ${
                  accentIdx === i
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-card scale-110"
                    : "ring-1 ring-border/30 group-hover:ring-border/60 group-hover:scale-105"
                }`} />
                <span className={`text-[10px] font-semibold ${accentIdx === i ? "text-primary" : "text-muted-foreground/40"}`}>{a.name}</span>
              </button>
            ))}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Layout & Display" subtitle="Fine-tune your workspace layout" icon={Monitor} onSave={handleSave} saveLabel="Save Layout">
        <SettingToggleRow icon={Laptop} label="Compact Mode" description="Reduce padding and spacing for information-dense views" enabled={compactMode} onToggle={() => setCompactMode(!compactMode)} />
        <Divider />
        <SettingToggleRow icon={ChevronDown} label="Collapsed Sidebar" description="Start with the sidebar collapsed by default" enabled={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <Divider />
        <SettingToggleRow icon={Sparkles} label="Motion & Animations" description="Enable entrance animations and micro-interactions" enabled={animations} onToggle={() => setAnimations(!animations)} />
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
  const { user, signOut } = useAuth();
  const isOAuth = user?.app_metadata?.provider === "google";
  const [twoFa, setTwoFa] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

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
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) toast.error(error.message);
    else {
      toast.success(t("settings.passwordUpdated"));
      setCurrentPw("");
      setNewPw("");
    }
  };

  const handleSignOutEverywhere = async () => {
    await supabase.auth.signOut({ scope: "global" });
    toast.success("Signed out from all devices");
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
          <ToggleSwitch enabled={twoFa} onToggle={() => setTwoFa(!twoFa)} />
        </div>
        <AnimatePresence>
          {twoFa && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
              <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20" style={{ background: "hsl(160 60% 45% / 0.04)" }}>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[13px] text-emerald-400 font-semibold">2FA is active</p>
                  <p className="text-[11px] text-emerald-400/50 mt-0.5">Your account has an extra layer of protection</p>
                </div>
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
          <button onClick={handleSignOutEverywhere} className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all min-h-[40px] flex items-center gap-2 shrink-0">
            <LogOut className="w-3.5 h-3.5" /> Sign Out All
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
  workspace: WorkspaceSection,
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
