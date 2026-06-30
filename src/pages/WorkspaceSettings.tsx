import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import trakalogLogo from "@/assets/trakalog-logo.png";
import {
  Building2,
  Palette,
  Users,
  ArrowRightLeft,
  Search,
  Image,
  Upload,
  Edit3,
  Move,
  Trash2,
  Crosshair,
  UserPlus,
  ChevronDown,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Sparkles,
  Save,
  X,
  Link2,
  ExternalLink,
  CheckCircle2,
  Download,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/contexts/RoleContext";
import { useTeams } from "@/contexts/TeamContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InviteMemberModal, type InvitePayload } from "@/components/InviteMemberModal";
import { EditMemberModal } from "@/components/EditMemberModal";
import { validateSocialInput, isValidHexColor, type SocialPlatform } from "@/lib/social-urls";
import type { AccessLevel } from "@/contexts/RoleContext";
import type { TeamMember } from "@/contexts/TeamContext";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

type WsSection = "info" | "branding" | "members" | "catalogSharing" | "leakTracing";

function getWsSections(t: (key: string) => string): { id: WsSection; label: string; icon: React.ElementType; desc: string }[] {
  return [
    { id: "info", label: t("workspaceSettings.nav.info"), icon: Building2, desc: t("workspaceSettings.nav.infoDesc") },
    { id: "branding", label: t("workspaceSettings.nav.branding"), icon: Palette, desc: t("workspaceSettings.nav.brandingDesc") },
    { id: "members", label: t("workspaceSettings.nav.members"), icon: Users, desc: t("workspaceSettings.nav.membersDesc") },
    { id: "catalogSharing", label: t("workspaceSettings.nav.catalogSharing"), icon: ArrowRightLeft, desc: t("workspaceSettings.nav.catalogSharingDesc") },
    { id: "leakTracing", label: t("workspaceSettings.nav.leakTracing"), icon: Search, desc: t("workspaceSettings.nav.leakTracingDesc") },
  ];
}

/* ═══════════════════════════════════════════════════════
   SHARED PRIMITIVES (same as SettingsPage)
   ═══════════════════════════════════════════════════════ */

function FieldGroup({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest block">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/40 leading-relaxed">{hint}</p>}
    </div>
  );
}

function PremiumInput({ value, placeholder, onChange, prefix, readOnly, type }: { value: string; placeholder?: string; onChange: (v: string) => void; prefix?: ReactNode; readOnly?: boolean; type?: string }) {
  return (
    <div className="relative group/input">
      {prefix && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40">{prefix}</div>}
      <input
        type={type || "text"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={`w-full h-11 ${prefix ? "pl-10" : "pl-4"} pr-4 rounded-xl bg-secondary/40 border border-border/30 text-[13px] text-foreground font-medium outline-none focus:border-primary/30 focus:bg-secondary/60 transition-all placeholder:text-muted-foreground/30 ${readOnly ? "opacity-50 cursor-not-allowed" : ""}`}
      />
    </div>
  );
}

function SectionBlock({ title, subtitle, icon: Icon, children, onSave, saveLabel, changesHint }: { title: string; subtitle?: string; icon: React.ElementType; children: ReactNode; onSave?: () => void; saveLabel?: string; changesHint?: string }) {
  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-5 flex items-center gap-3.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(139,92,246,0.12))" }}>
          <Icon className="w-[17px] h-[17px] text-primary" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-foreground tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground/50 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-6 pb-6 space-y-5">{children}</div>
      {onSave && (
        <div className="px-6 py-4 border-t border-border/20 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/30">{changesHint || ""}</span>
          <button onClick={onSave} className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-90 min-h-[40px]" style={{ background: "var(--gradient-brand-horizontal)" }}>
            {saveLabel || "Save"}
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: INFO
   ═══════════════════════════════════════════════════════ */

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/[\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

function InfoSection() {
  const { t } = useTranslation();
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const { user } = useAuth();
  const [name, setName] = useState(activeWorkspace?.name || "");
  const [slug, setSlug] = useState(activeWorkspace?.slug || "");

  useEffect(() => {
    if (activeWorkspace) {
      setName(activeWorkspace.name || "");
      setSlug(activeWorkspace.slug || "");
    }
  }, [activeWorkspace]);

  const handleSave = async () => {
    if (!activeWorkspace || !user) return;
    const { error } = await supabase.rpc("update_workspace_name", {
      _user_id: user.id,
      _workspace_id: activeWorkspace.id,
      _name: name,
    });
    if (error) { toast.error(error.message); return; }

    // Auto-update slug
    const newSlug = slugify(name);
    if (newSlug && newSlug !== slug) {
      await supabase.rpc("update_workspace_slug", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _slug: newSlug,
      });
      setSlug(newSlug);
    }

    toast.success(t("workspaceSettings.toasts.workspaceNameSaved"));
    await refreshWorkspaces();
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <SectionBlock title={t("workspaceSettings.general")} subtitle={t("workspaceSettings.generalSubtitle")} icon={Building2} onSave={handleSave} saveLabel="Save Changes">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FieldGroup label={t("workspaceSettings.workspaceName")} hint="The name visible to your team and on shared links">
            <PremiumInput value={name} placeholder="Your workspace" onChange={setName} />
          </FieldGroup>
          <FieldGroup label={t("workspaceSettings.workspaceUrl")} hint="trakalog.app/w/">
            <PremiumInput value={slug} placeholder="your-workspace" onChange={() => {}} prefix={<span className="text-[11px]">/w/</span>} readOnly />
          </FieldGroup>
        </div>
      </SectionBlock>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: BRANDING (delegates to SettingsPage's BrandingSection)
   We import the workspace branding logic inline to avoid
   modifying SettingsPage before step 2.
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
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const { user } = useAuth();
  const [heroUrl, setHeroUrl] = useState<string | null>(activeWorkspace?.hero_image_url || null);
  const [logoUrl, setLogoUrl] = useState<string | null>(activeWorkspace?.logo_url || null);
  const [brandColor, setBrandColor] = useState<string>(activeWorkspace?.brand_color || "");
  const [uploading, setUploading] = useState<"hero" | "logo" | null>(null);
  const [heroPosition, setHeroPosition] = useState<number>(activeWorkspace?.hero_position ?? 50);
  const [repositioning, setRepositioning] = useState(false);
  const [dragPosition, setDragPosition] = useState<number>(50);
  const dragRef = useRef<{ startY: number; startPos: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [focalPoint, setFocalPoint] = useState<string>(activeWorkspace?.hero_focal_point || "50% 50%");
  const [editingFocal, setEditingFocal] = useState(false);
  const [socialInstagram, setSocialInstagram] = useState(activeWorkspace?.social_instagram || "");
  const [socialTiktok, setSocialTiktok] = useState(activeWorkspace?.social_tiktok || "");
  const [socialYoutube, setSocialYoutube] = useState(activeWorkspace?.social_youtube || "");
  const [socialFacebook, setSocialFacebook] = useState(activeWorkspace?.social_facebook || "");
  const [socialX, setSocialX] = useState(activeWorkspace?.social_x || "");
  const [socialWebsite, setSocialWebsite] = useState(activeWorkspace?.social_website || "");
  const [bio, setBio] = useState(activeWorkspace?.bio || "");

  useEffect(() => {
    if (activeWorkspace) {
      setHeroUrl(activeWorkspace.hero_image_url || null);
      setLogoUrl(activeWorkspace.logo_url || null);
      setBrandColor(activeWorkspace.brand_color || "");
      setHeroPosition(activeWorkspace.hero_position ?? 50);
      setFocalPoint(activeWorkspace.hero_focal_point || "50% 50%");
      setBio(activeWorkspace.bio || "");
      setSocialInstagram(activeWorkspace.social_instagram || "");
      setSocialTiktok(activeWorkspace.social_tiktok || "");
      setSocialYoutube(activeWorkspace.social_youtube || "");
      setSocialFacebook(activeWorkspace.social_facebook || "");
      setSocialX(activeWorkspace.social_x || "");
      setSocialWebsite(activeWorkspace.social_website || "");
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
    if (!activeWorkspace || !user) return;
    const pos = Math.round(dragPosition);
    const { error } = await supabase.rpc("update_workspace_branding", {
      _user_id: user.id, _workspace_id: activeWorkspace.id,
      _hero_image_url: heroUrl, _logo_url: logoUrl, _brand_color: brandColor || null,
      _hero_position: pos, _hero_focal_point: focalPoint,
      _social_instagram: socialInstagram || null, _social_tiktok: socialTiktok || null,
      _social_youtube: socialYoutube || null, _social_facebook: socialFacebook || null, _social_x: socialX || null, _social_website: (socialWebsite && !socialWebsite.startsWith("http") ? "https://" + socialWebsite : socialWebsite) || null,
      _bio: bio || null,
    });
    if (error) { toast.error(error.message); return; }
    setHeroPosition(pos);
    setRepositioning(false);
    toast.success(t("workspaceSettings.toasts.heroPositionSaved"));
    await refreshWorkspaces();
  };

  const handleCancelReposition = () => {
    setDragPosition(heroPosition);
    setRepositioning(false);
  };

  const handleFocalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setFocalPoint(x + "% " + y + "%");
  };

  const handleSaveFocalPoint = async () => {
    if (!activeWorkspace || !user) return;
    const { error } = await supabase.rpc("update_workspace_branding", {
      _user_id: user.id, _workspace_id: activeWorkspace.id,
      _hero_image_url: heroUrl, _logo_url: logoUrl, _brand_color: brandColor || null,
      _hero_position: heroPosition, _hero_focal_point: focalPoint,
      _social_instagram: socialInstagram || null, _social_tiktok: socialTiktok || null,
      _social_youtube: socialYoutube || null, _social_facebook: socialFacebook || null, _social_x: socialX || null, _social_website: (socialWebsite && !socialWebsite.startsWith("http") ? "https://" + socialWebsite : socialWebsite) || null,
      _bio: bio || null,
    });
    if (error) { toast.error(error.message); return; }
    setEditingFocal(false);
    toast.success(t("workspaceSettings.toasts.focalPointSaved"));
    await refreshWorkspaces();
  };

  const handleUpload = (type: "hero" | "logo") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = type === "logo"
      ? "image/png, image/jpeg, image/webp, image/svg+xml"
      : "image/png, image/jpeg, image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !activeWorkspace) return;
      setUploading(type);
      try {
        const ext = file.name.split(".").pop() || "png";
        const path = activeWorkspace.id + "/" + type + "_" + Date.now() + "." + ext;
        const { error: uploadErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
        if (uploadErr) { toast.error(uploadErr.message); setUploading(null); return; }
        const { data: urlData } = supabase.storage.from("branding").getPublicUrl(path);
        const publicUrl = urlData?.publicUrl;
        if (!publicUrl) { toast.error("Failed to get URL"); setUploading(null); return; }
        const newHero = type === "hero" ? publicUrl : heroUrl;
        const newLogo = type === "logo" ? publicUrl : logoUrl;
        const { error: updateErr } = await supabase.rpc("update_workspace_branding", {
          _user_id: user!.id, _workspace_id: activeWorkspace.id,
          _hero_image_url: newHero, _logo_url: newLogo, _brand_color: brandColor || null,
          _hero_position: heroPosition, _hero_focal_point: focalPoint,
          _social_instagram: socialInstagram || null, _social_tiktok: socialTiktok || null,
          _social_youtube: socialYoutube || null, _social_facebook: socialFacebook || null, _social_x: socialX || null, _social_website: (socialWebsite && !socialWebsite.startsWith("http") ? "https://" + socialWebsite : socialWebsite) || null,
          _bio: bio || null,
        });
        if (updateErr) { toast.error(updateErr.message); setUploading(null); return; }
        if (type === "hero") setHeroUrl(publicUrl);
        else setLogoUrl(publicUrl);
        toast.success((type === "hero" ? "Background" : "Logo") + " uploaded");
        await refreshWorkspaces();
      } catch (err: any) {
        toast.error(err?.message || "Upload failed");
      }
      setUploading(null);
    };
    input.click();
  };

  const handleRemove = async (type: "hero" | "logo") => {
    if (!activeWorkspace || !user) return;
    const newHero = type === "hero" ? null : heroUrl;
    const newLogo = type === "logo" ? null : logoUrl;
    const { error } = await supabase.rpc("update_workspace_branding", {
      _user_id: user.id, _workspace_id: activeWorkspace.id,
      _hero_image_url: newHero, _logo_url: newLogo, _brand_color: brandColor || null,
      _hero_position: heroPosition, _hero_focal_point: focalPoint,
      _social_instagram: socialInstagram || null, _social_tiktok: socialTiktok || null,
      _social_youtube: socialYoutube || null, _social_facebook: socialFacebook || null, _social_x: socialX || null, _social_website: (socialWebsite && !socialWebsite.startsWith("http") ? "https://" + socialWebsite : socialWebsite) || null,
      _bio: bio || null,
    });
    if (error) { toast.error(error.message); return; }
    if (type === "hero") setHeroUrl(null);
    else setLogoUrl(null);
    toast.success((type === "hero" ? "Background" : "Logo") + " removed");
    await refreshWorkspaces();
  };

  const handleColorSave = async () => {
    if (!activeWorkspace || !user) return;
    if (!isValidHexColor(brandColor || null)) {
      toast.error("Brand color must be a 6-digit hex code (e.g. #FF8C32).");
      return;
    }
    const { error } = await supabase.rpc("update_workspace_branding", {
      _user_id: user.id, _workspace_id: activeWorkspace.id,
      _hero_image_url: heroUrl, _logo_url: logoUrl, _brand_color: brandColor || null,
      _hero_position: heroPosition, _hero_focal_point: focalPoint,
      _social_instagram: socialInstagram || null, _social_tiktok: socialTiktok || null,
      _social_youtube: socialYoutube || null, _social_facebook: socialFacebook || null, _social_x: socialX || null, _social_website: (socialWebsite && !socialWebsite.startsWith("http") ? "https://" + socialWebsite : socialWebsite) || null,
      _bio: bio || null,
    });
    if (error) toast.error(error.message);
    else { toast.success(t("workspaceSettings.toasts.brandColorSaved")); await refreshWorkspaces(); }
  };

  const handleSocialSave = async () => {
    if (!activeWorkspace || !user) return;
    const checks: Array<[string, SocialPlatform]> = [
      [socialInstagram, "instagram"],
      [socialTiktok, "tiktok"],
      [socialYoutube, "youtube"],
      [socialFacebook, "facebook"],
      [socialX, "x"],
    ];
    for (const [value, platform] of checks) {
      const result = validateSocialInput(value, platform);
      if (!result.ok) { toast.error(result.reason); return; }
    }
    const { error } = await supabase.rpc("update_workspace_branding", {
      _user_id: user.id, _workspace_id: activeWorkspace.id,
      _hero_image_url: heroUrl, _logo_url: logoUrl, _brand_color: brandColor || null,
      _hero_position: heroPosition, _hero_focal_point: focalPoint,
      _social_instagram: socialInstagram || null, _social_tiktok: socialTiktok || null,
      _social_youtube: socialYoutube || null, _social_facebook: socialFacebook || null, _social_x: socialX || null, _social_website: (socialWebsite && !socialWebsite.startsWith("http") ? "https://" + socialWebsite : socialWebsite) || null,
      _bio: bio || null,
    });
    if (error) toast.error(error.message);
    else { toast.success(t("workspaceSettings.toasts.socialLinksSaved")); await refreshWorkspaces(); }
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Background Image */}
      <SectionBlock title={t("workspaceSettings.backgroundImage")} subtitle={t("workspaceSettings.backgroundImageSubtitle")} icon={Image}>
        <FieldGroup label="Background Image" hint="Full-screen background shown to recipients on your shared links. Recommended: high-resolution photo (min 1920x1080px). The image will be darkened for readability.">
          {heroUrl ? (
            <div className="space-y-3">
              <div
                ref={containerRef}
                className={"group/hero relative rounded-xl overflow-hidden border border-border/50 bg-black " + (repositioning ? "cursor-grab active:cursor-grabbing" : editingFocal ? "" : "cursor-pointer")}
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
                {/* Dark overlay */}
                {!repositioning && !editingFocal && <div className="absolute inset-0 bg-black/55" />}
                {/* Mini-mockup of recipient view */}
                {!repositioning && !editingFocal && (
                  <div className="absolute inset-0 flex flex-col items-center pointer-events-none select-none">
                    <div className="flex flex-col items-center mt-[8%] gap-0.5">
                      <img src={logoUrl || trakalogLogo} alt="Logo" className="h-[40px] object-contain" />
                      <span className="text-[9px] font-bold tracking-wider bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple bg-clip-text text-transparent">TRAKALOG</span>
                      <span className="text-[5px] tracking-[0.15em] text-white/30 font-medium">CATALOG MANAGER</span>
                    </div>
                    <div className="mt-[5%] w-[55%] flex items-start gap-1.5 rounded bg-white/5 border border-white/10 px-2 py-1.5">
                      <div className="w-[2px] h-3 rounded-full bg-gradient-to-b from-brand-orange to-brand-pink flex-shrink-0 mt-0.5" />
                      <span className="text-[5px] text-white/50 italic leading-tight">Message from sender...</span>
                    </div>
                    <div className="mt-[4%] w-[55%] rounded-lg bg-white/8 backdrop-blur border border-white/10 p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-[30px] h-[30px] rounded bg-gradient-to-br from-brand-orange to-brand-pink flex-shrink-0" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[7px] font-bold text-white leading-none">Track Title</span>
                          <span className="text-[5px] text-white/60 leading-none">Artist Name</span>
                        </div>
                      </div>
                      <div className="flex items-end gap-[1px] mt-2 h-3">
                        {[40, 70, 55, 85, 45, 75, 60, 90, 50, 80, 65, 45, 70, 55, 85, 40, 75, 60, 50, 80, 65, 55, 70, 45, 85].map((h, i) => (
                          <div key={i} className="flex-1 bg-white/20 rounded-sm" style={{ height: h + "%" }} />
                        ))}
                      </div>
                      <div className="flex justify-center mt-2">
                        <div className="w-[14px] h-[14px] rounded-full bg-brand-orange flex items-center justify-center">
                          <div className="w-0 h-0 border-l-[4px] border-l-white border-y-[2.5px] border-y-transparent ml-[1px]" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-auto mb-[4%]">
                      <span className="text-[4px] text-white/30">Shared via Trakalog</span>
                    </div>
                  </div>
                )}
                {/* Reposition mode */}
                {repositioning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/50 text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg backdrop-blur-sm">
                      {t("workspaceSettings.dragToReposition")}
                    </div>
                  </div>
                )}
                {/* Hover overlay with actions */}
                {!repositioning && !editingFocal && (
                  <div className="absolute inset-0 bg-black/0 group-hover/hero:bg-black/40 transition-all duration-200">
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-2 opacity-0 group-hover/hero:opacity-100 transition-opacity duration-200">
                      <button onClick={startReposition} className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm" title={t("workspaceSettings.reposition")}>
                        <Move className="w-3.5 h-3.5 text-gray-700" />
                      </button>
                      <button onClick={() => setEditingFocal(true)} className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm" title={t("workspaceSettings.setFocalPoint")}>
                        <Crosshair className="w-3.5 h-3.5 text-gray-700" />
                      </button>
                      <button onClick={() => handleUpload("hero")} className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm" title={t("workspaceSettings.change")}>
                        <Edit3 className="w-3.5 h-3.5 text-gray-700" />
                      </button>
                      <button onClick={() => handleRemove("hero")} className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm" title={t("workspaceSettings.remove")}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                )}
                {/* Focal point editing overlay */}
                {editingFocal && (
                  <div className="absolute inset-0 cursor-crosshair" onClick={handleFocalClick}>
                    <div className="absolute inset-0 bg-black/30" />
                    <div
                      className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ left: focalPoint.split(" ")[0], top: focalPoint.split(" ")[1] }}
                    >
                      <div className="w-full h-full rounded-full border-2 border-white shadow-lg" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[11px] font-medium px-2.5 py-1 rounded-lg backdrop-blur-sm">
                      {t("workspaceSettings.clickToSetFocalPoint")} ({focalPoint})
                    </div>
                  </div>
                )}
                {uploading === "hero" && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-[12px] font-semibold">{t("workspaceSettings.uploading")}</span>
                  </div>
                )}
              </div>
              {/* Reposition action buttons */}
              {repositioning && (
                <div className="flex items-center gap-3">
                  <button onClick={handleSavePosition} className="px-4 py-2 text-[12px] font-bold rounded-lg text-white transition-opacity hover:opacity-90" style={{ background: "var(--gradient-brand-horizontal)" }}>
                    {t("workspaceSettings.savePosition")}
                  </button>
                  <button onClick={handleCancelReposition} className="px-4 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                    {t("workspaceSettings.cancel")}
                  </button>
                </div>
              )}
              {editingFocal && (
                <div className="flex items-center gap-3">
                  <button onClick={handleSaveFocalPoint} className="px-4 py-2 text-[12px] font-bold rounded-lg text-white transition-opacity hover:opacity-90" style={{ background: "var(--gradient-brand-horizontal)" }}>
                    {t("workspaceSettings.saveFocalPoint")}
                  </button>
                  <button onClick={() => { setFocalPoint(activeWorkspace?.hero_focal_point || "50% 50%"); setEditingFocal(false); }} className="px-4 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                    {t("workspaceSettings.cancel")}
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
                {uploading === "hero" ? t("workspaceSettings.uploading") : "Click to upload background image"}
              </span>
            </button>
          )}
        </FieldGroup>
      </SectionBlock>

      {/* Logo */}
      <SectionBlock title={t("workspaceSettings.logo")} subtitle={t("workspaceSettings.logoSubtitle")} icon={Image}>
        <FieldGroup label="Workspace Logo" hint="Displayed on shared links and pitch emails. Square or horizontal format recommended.">
          {logoUrl ? (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl border border-border/50 bg-secondary/30 flex items-center justify-center overflow-hidden">
                <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleUpload("logo")} className="px-3 py-2 rounded-lg text-[12px] font-medium bg-secondary hover:bg-secondary/80 transition-colors">
                  {t("workspaceSettings.change")}
                </button>
                <button onClick={() => handleRemove("logo")} className="px-3 py-2 rounded-lg text-[12px] font-medium text-destructive hover:bg-destructive/10 transition-colors">
                  {t("workspaceSettings.remove")}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => handleUpload("logo")}
              disabled={uploading === "logo"}
              className="w-full border-2 border-dashed border-border/50 rounded-xl py-6 flex flex-col items-center gap-2 hover:border-primary/30 hover:bg-primary/[0.02] transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-[12px] font-semibold text-muted-foreground/60 group-hover:text-foreground transition-colors">
                {uploading === "logo" ? t("workspaceSettings.uploading") : "Click to upload logo"}
              </span>
            </button>
          )}
        </FieldGroup>
      </SectionBlock>

      {/* Brand Color */}
      <SectionBlock title={t("workspaceSettings.brandColor")} subtitle={t("workspaceSettings.brandColorSubtitle")} icon={Palette} onSave={handleColorSave} saveLabel="Save Color">
        <FieldGroup label="Brand Color" hint="Used for play buttons, download buttons, and accents on shared links.">
          <div className="flex items-center gap-3 flex-wrap">
            {BRAND_PRESET_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => setBrandColor(c.hex)}
                className={"w-8 h-8 rounded-full border-2 transition-all " + (brandColor === c.hex ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                style={{ background: c.hex }}
                title={c.label}
              />
            ))}
            <div className="flex items-center gap-2 ml-2">
              <input
                type="color"
                value={brandColor || "#FF8C32"}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-8 h-8 rounded-full border border-border cursor-pointer"
              />
              <span className="text-[11px] text-muted-foreground/50 font-mono">{brandColor || "Default"}</span>
            </div>
          </div>
        </FieldGroup>
      </SectionBlock>

      {/* About / Bio */}
      <SectionBlock title={t("workspaceSettings.about")} subtitle={t("workspaceSettings.aboutSubtitle")} icon={Edit3} onSave={async () => {
        if (!activeWorkspace || !user) return;
        const { error } = await supabase.rpc("update_workspace_branding", {
          _user_id: user.id, _workspace_id: activeWorkspace.id,
          _hero_image_url: heroUrl, _logo_url: logoUrl, _brand_color: brandColor || null,
          _hero_position: heroPosition, _hero_focal_point: focalPoint,
          _social_instagram: socialInstagram || null, _social_tiktok: socialTiktok || null,
          _social_youtube: socialYoutube || null, _social_facebook: socialFacebook || null, _social_x: socialX || null, _social_website: (socialWebsite && !socialWebsite.startsWith("http") ? "https://" + socialWebsite : socialWebsite) || null,
          _bio: bio || null,
        });
        if (error) toast.error(error.message);
        else { toast.success(t("workspaceSettings.toasts.bioSaved")); await refreshWorkspaces(); }
      }} saveLabel="Save Bio">
        <FieldGroup label="Bio" hint="A short bio to introduce your workspace to recipients (max 280 characters)">
          <div className="relative">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 280))}
              maxLength={280}
              placeholder="Tell recipients a bit about you or your workspace..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border/30 text-[13px] text-foreground font-medium outline-none focus:border-primary/30 focus:bg-secondary/60 transition-all placeholder:text-muted-foreground/30 resize-none"
            />
            <span className="absolute bottom-2.5 right-3 text-[10px] text-muted-foreground/40">{bio.length}/280</span>
          </div>
        </FieldGroup>
      </SectionBlock>

      {/* Social Links */}
      <SectionBlock title={t("workspaceSettings.socialLinks")} subtitle={t("workspaceSettings.socialLinksSubtitle")} icon={Link2} onSave={handleSocialSave} saveLabel="Save Social Links">
        <div className="space-y-3">
          <div className="relative group/input">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </div>
            <input type="text" value={socialInstagram} placeholder="@yourusername or https://instagram.com/yourusername" onChange={(e) => setSocialInstagram(e.target.value)} className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary/40 border border-border/30 text-[13px] text-foreground font-medium outline-none focus:border-primary/30 focus:bg-secondary/60 transition-all placeholder:text-muted-foreground/30" />
          </div>
          <div className="relative group/input">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.6a8.22 8.22 0 004.77 1.52V6.69h-1z"/></svg>
            </div>
            <input type="text" value={socialTiktok} placeholder="@yourusername or https://tiktok.com/@yourusername" onChange={(e) => setSocialTiktok(e.target.value)} className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary/40 border border-border/30 text-[13px] text-foreground font-medium outline-none focus:border-primary/30 focus:bg-secondary/60 transition-all placeholder:text-muted-foreground/30" />
          </div>
          <div className="relative group/input">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </div>
            <input type="text" value={socialYoutube} placeholder="https://youtube.com/@yourchannel" onChange={(e) => setSocialYoutube(e.target.value)} className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary/40 border border-border/30 text-[13px] text-foreground font-medium outline-none focus:border-primary/30 focus:bg-secondary/60 transition-all placeholder:text-muted-foreground/30" />
          </div>
          <div className="relative group/input">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </div>
            <input type="text" value={socialFacebook} placeholder="https://facebook.com/yourpage" onChange={(e) => setSocialFacebook(e.target.value)} className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary/40 border border-border/30 text-[13px] text-foreground font-medium outline-none focus:border-primary/30 focus:bg-secondary/60 transition-all placeholder:text-muted-foreground/30" />
          </div>
          <div className="relative group/input">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </div>
            <input type="text" value={socialX} placeholder="@yourusername or https://x.com/yourusername" onChange={(e) => setSocialX(e.target.value)} className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary/40 border border-border/30 text-[13px] text-foreground font-medium outline-none focus:border-primary/30 focus:bg-secondary/60 transition-all placeholder:text-muted-foreground/30" />
          </div>
          <div className="relative group/input">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <input type="url" value={socialWebsite} placeholder="https://yoursite.com" onChange={(e) => setSocialWebsite(e.target.value)} className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary/40 border border-border/30 text-[13px] text-foreground font-medium outline-none focus:border-primary/30 focus:bg-secondary/60 transition-all placeholder:text-muted-foreground/30" />
          </div>
        </div>
      </SectionBlock>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: MEMBERS (reuses TeamContext)
   ═══════════════════════════════════════════════════════ */

function MembersSection() {
  const { t } = useTranslation();
  const { teams, removeMember } = useTeams();
  const { permissions } = useRole();
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ member: TeamMember; mode: "admin" | "self" } | null>(null);

  const teamId = activeWorkspace?.id || "";
  const team = teams.find((t) => t.id === teamId);
  const members = team?.members || [];

  const handleInvite = async (payload: InvitePayload) => {
    toast.success(t("inviteMember.inviteSent", { email: payload.email }));
  };

  const handleRemoveMember = (memberId: string) => {
    removeMember(teamId, memberId);
  };

  const isAdmin = permissions.canManageTeam;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <SectionBlock title={"Members (" + members.length + ")"} subtitle={t("workspaceSettings.manageMembersSubtitle")} icon={Users}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-muted-foreground/60">{members.length} member{members.length !== 1 ? "s" : ""}</p>
            {permissions.canInviteMembers && (
              <button
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--gradient-brand-horizontal)" }}
              >
                <UserPlus className="w-3.5 h-3.5" /> Invite Member
              </button>
            )}
          </div>

          {/* Members table */}
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">{t("workspaceSettings.member")}</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden sm:table-cell">{t("workspaceSettings.title")}</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">{t("workspaceSettings.access")}</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground text-2xs uppercase tracking-widest w-32"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isSelf = !!user && m.id === user.id;
                  const canEdit = isAdmin || isSelf;
                  const editMode: "admin" | "self" = isAdmin ? "admin" : "self";
                  return (
                    <tr key={m.id} className="border-b border-border/10 last:border-0">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">{m.firstName} {m.lastName}</p>
                          {m.email && <p className="text-[11px] text-muted-foreground/50">{m.email}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-[12px] text-muted-foreground">{m.professionalTitle || m.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-muted-foreground capitalize">{m.accessLevel}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-3 justify-end">
                          {canEdit && m.status === "active" && !m.membershipId.startsWith("pending-") && (
                            <button
                              onClick={() => setEditTarget({ member: m, mode: editMode })}
                              className="text-[11px] text-brand-orange/80 hover:text-brand-orange transition-colors font-semibold"
                            >
                              {isAdmin ? t("workspaceSettings.editMember") : t("workspaceSettings.editMyTitle")}
                            </button>
                          )}
                          {permissions.canManageTeam && m.id !== activeWorkspace?.owner_id && (
                            <button
                              onClick={() => handleRemoveMember(m.id)}
                              className="text-[11px] text-destructive/60 hover:text-destructive transition-colors"
                            >
                              {t("workspaceSettings.removeMember")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </SectionBlock>
      <InviteMemberModal open={inviteOpen} onOpenChange={setInviteOpen} onInvite={handleInvite} preselectedTeamId={teamId || undefined} />
      <EditMemberModal
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        member={editTarget?.member || null}
        mode={editTarget?.mode || "self"}
      />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: CATALOG SHARING (placeholder — actual logic
   will be moved from SettingsPage in step 2)
   ═══════════════════════════════════════════════════════ */

function CatalogSharingSection() {
  const { t } = useTranslation();
  const { activeWorkspace, workspaces } = useWorkspace();
  const { user } = useAuth();
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [shareDropdownOpen, setShareDropdownOpen] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string; isTrack: boolean } | null>(null);
  const [revoking, setRevoking] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchShares = useCallback(() => {
    if (!activeWorkspace) return;
    supabase.from("catalog_shares").select("id, target_workspace_id, track_id, created_at, workspaces!catalog_shares_target_workspace_id_fkey(name)")
      .eq("source_workspace_id", activeWorkspace.id)
      .eq("status", "active")
      .then(({ data }) => { if (data) setOutgoing(data); })
      .catch((err) => console.error("Failed to fetch outgoing shares:", err));
    supabase.from("catalog_shares").select("id, source_workspace_id, track_id, created_at, workspaces!catalog_shares_source_workspace_id_fkey(name)")
      .eq("target_workspace_id", activeWorkspace.id)
      .eq("status", "active")
      .then(({ data }) => { if (data) setIncoming(data); })
      .catch((err) => console.error("Failed to fetch incoming shares:", err));
  }, [activeWorkspace]);

  useEffect(() => { fetchShares(); }, [fetchShares]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!shareDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShareDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [shareDropdownOpen]);

  // Workspaces available for full catalog sharing (exclude self + already shared)
  const outgoingFullCatalogTargetIds = new Set(outgoing.filter((s) => !s.track_id).map((s) => s.target_workspace_id));
  const availableWorkspaces = workspaces.filter((w) => w.id !== activeWorkspace?.id && !outgoingFullCatalogTargetIds.has(w.id));

  const handleShareFullCatalog = async (targetWs: { id: string; name: string }) => {
    if (!activeWorkspace || !user) return;
    setSharing(targetWs.id);
    const { error } = await supabase.rpc("insert_catalog_share", {
      _user_id: user.id,
      _track_id: null,
      _source_workspace_id: activeWorkspace.id,
      _target_workspace_id: targetWs.id,
      _access_level: "pitcher",
    });
    if (error) { toast.error(error.message); }
    else { toast.success(t("workspaceSettings.toasts.fullCatalogSharedWith") + " " + targetWs.name); fetchShares(); }
    setSharing(null);
    setShareDropdownOpen(false);
  };

  const handleRevoke = async () => {
    if (!revokeTarget || !user) return;
    setRevoking(true);
    const { error } = await supabase.rpc("revoke_catalog_share", { _user_id: user.id, _share_id: revokeTarget.id });
    if (error) toast.error(error.message);
    else { setOutgoing((prev) => prev.filter((x) => x.id !== revokeTarget.id)); toast.success(t("workspaceSettings.toasts.shareRevoked")); }
    setRevoking(false);
    setRevokeTarget(null);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Share Full Catalog button */}
      <motion.div variants={fadeUp} className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShareDropdownOpen(!shareDropdownOpen)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--gradient-brand-horizontal)" }}
        >
          <ArrowRightLeft className="w-4 h-4" />
          {t("workspaceSettings.shareFullCatalog")}
          <ChevronDown className={"w-3.5 h-3.5 transition-transform " + (shareDropdownOpen ? "rotate-180" : "")} />
        </button>
        {shareDropdownOpen && (
          <div className="absolute left-0 top-full mt-2 w-80 rounded-xl border border-border/30 bg-card/95 backdrop-blur-md shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/20">
              <p className="text-[12px] font-semibold text-foreground">{t("workspaceSettings.shareFullCatalogWith")}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{t("workspaceSettings.selectWorkspaceToShare")}</p>
            </div>
            {availableWorkspaces.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-[12px] text-muted-foreground/50">{t("workspaceSettings.noOtherWorkspacesAvailable")}</p>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto py-1">
                {availableWorkspaces.map((ws) => (
                  <div key={ws.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-orange/20 to-brand-purple/20 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-foreground">{(ws.name || "W").charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-[13px] font-medium text-foreground truncate">{ws.name}</span>
                    </div>
                    <button
                      onClick={() => handleShareFullCatalog(ws)}
                      disabled={sharing === ws.id}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ background: "var(--gradient-brand-horizontal)" }}
                    >
                      {sharing === ws.id ? t("workspaceSettings.sharing") : t("workspaceSettings.share")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      <SectionBlock title={"Outgoing Shares (" + outgoing.length + ")"} subtitle={t("workspaceSettings.catalogsYouShare")} icon={ExternalLink}>
        {outgoing.length === 0 ? (
          <p className="text-[12px] text-muted-foreground/50">{t("workspaceSettings.noOutgoingShares")}</p>
        ) : (
          <div className="space-y-2">
            {outgoing.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-secondary/20 border border-border/20">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{(s as any).workspaces?.name || "Unknown"}</p>
                  <p className="text-[11px] text-muted-foreground/50">{s.track_id ? "Single track" : "Full catalog"}</p>
                </div>
                <button
                  onClick={() => setRevokeTarget({ id: s.id, name: (s as any).workspaces?.name || "Unknown", isTrack: !!s.track_id })}
                  className="text-[11px] text-destructive/60 hover:text-destructive transition-colors"
                >
                  {t("workspaceSettings.revoke")}
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionBlock>

      <SectionBlock title={"Incoming Shares (" + incoming.length + ")"} subtitle={t("workspaceSettings.catalogsSharedWithYou")} icon={Link2}>
        {incoming.length === 0 ? (
          <p className="text-[12px] text-muted-foreground/50">{t("workspaceSettings.noIncomingShares")}</p>
        ) : (
          <div className="space-y-2">
            {incoming.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-secondary/20 border border-border/20">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{(s as any).workspaces?.name || "Unknown"}</p>
                  <p className="text-[11px] text-muted-foreground/50">{s.track_id ? "Single track" : "Full catalog"}</p>
                </div>
                <span className="text-[11px] text-muted-foreground/40">{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </SectionBlock>

      {/* Revoke confirmation dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workspaceSettings.revokeCatalogShare")}</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.isTrack
                ? t("workspaceSettings.revokeTrackShareConfirm", { name: revokeTarget.name })
                : t("workspaceSettings.revokeCatalogShareConfirm", { name: revokeTarget?.name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>{t("workspaceSettings.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking ? t("workspaceSettings.revoking") : t("workspaceSettings.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION: LEAK TRACING
   ═══════════════════════════════════════════════════════ */

type LeakTrace = {
  id: string;
  file_name: string;
  created_at: string;
  match: boolean;
  visitor_email: string | null;
  visitor_name: string | null;
  link_id: string | null;
  confidence: number;
  hash_hex: string | null;
  leaker_ip: string | null;
  ip_source: "download" | "listen" | "link_only" | null;
};

function LeakTracingSection() {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();

  const [leakAnalyzing, setLeakAnalyzing] = useState(false);
  const [leakResult, setLeakResult] = useState<{ match: boolean; visitor_email?: string | null; visitor_name?: string | null; link_id?: string | null; confidence?: number; hash_hex?: string | null; leaker_ip?: string | null; ip_source?: "download" | "listen" | "link_only" | null } | null>(null);
  const [leakTraces, setLeakTraces] = useState<LeakTrace[]>([]);
  const [leakDragOver, setLeakDragOver] = useState(false);
  const leakInputRef = useRef<HTMLInputElement>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fileName: string } | null>(null);
  const [deletingTrace, setDeletingTrace] = useState(false);
  const selectedTrace = leakTraces.find((tr) => tr.id === selectedTraceId) || null;

  const loadLeakTraces = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const { data } = await supabase.from("leak_traces")
        .select("id, file_name, created_at, match, visitor_email, visitor_name, link_id, confidence, hash_hex, leaker_ip, ip_source")
        .eq("workspace_id", activeWorkspace.id).order("created_at", { ascending: false }).limit(10);
      if (data) setLeakTraces(data as LeakTrace[]);
    } catch (e) { console.error("Failed to load leak traces:", e); }
  }, [activeWorkspace]);

  const handleDeleteTrace = async () => {
    if (!deleteTarget) return;
    setDeletingTrace(true);
    // Robust user_id sourcing (known auth.uid-null bug) before the SECURITY DEFINER RPC.
    let userId = user?.id;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }
    if (!userId) {
      toast.error("Session not ready — please retry in a moment");
      setDeletingTrace(false);
      return;
    }
    // delete_leak_trace enforces workspace ownership server-side (SECURITY DEFINER).
    const { error } = await supabase.rpc("delete_leak_trace", { _user_id: userId, _trace_id: deleteTarget.id });
    if (error) {
      toast.error(error.message || t("workspaceSettings.deleteFailed"));
    } else {
      const deletedId = deleteTarget.id;
      setLeakTraces((prev) => prev.filter((tr) => tr.id !== deletedId));
      if (selectedTraceId === deletedId) setSelectedTraceId(null);
      toast.success(t("workspaceSettings.traceDeletedSuccess"));
    }
    setDeletingTrace(false);
    setDeleteTarget(null);
  };

  const downloadTraceReport = async (tr: LeakTrace) => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const left = 56;
      let y = 64;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Trakalog — Leak Trace Report", left, y);
      y += 28;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const row = (label: string, value: string) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, left, y);
        doc.setFont("helvetica", "normal");
        doc.text(value || "—", left + 130, y);
        y += 20;
      };
      row("Date", tr.created_at ? new Date(tr.created_at).toLocaleString() : "—");
      row("File", tr.file_name || "—");
      row("Status", tr.match ? "LEAK DETECTED" : "Clean (no watermark)");
      if (tr.match) {
        row("Name", tr.visitor_name || "—");
        row("Email", tr.visitor_email || "—");
        row("Shared Link", tr.link_id || "—");
        row("IP", tr.leaker_ip ? tr.leaker_ip + (tr.ip_source === "link_only" ? " (via link, email unverified)" : "") : "—");
        row("Confidence", tr.confidence != null ? Math.round(tr.confidence * 100) + "%" : "—");
        row("Watermark hash", tr.hash_hex || "—");
      }
      const datePart = (tr.created_at ? new Date(tr.created_at) : new Date()).toISOString().slice(0, 10);
      doc.save("leak-report-" + datePart + ".pdf");
    } catch (e) {
      console.error("Failed to generate leak report:", e);
      toast.error(t("workspaceSettings.deleteFailed"));
    }
  };

  useEffect(() => { loadLeakTraces(); }, [loadLeakTraces]);

  const handleLeakFile = async (file: File) => {
    if (!activeWorkspace) {
      toast.error("No active workspace selected");
      return;
    }
    if (!file.name.match(/\.(wav|mp3|flac|ogg|m4a|aac)$/i)) {
      toast.error("Please upload an audio file");
      return;
    }
    // Source user_id from a hydrated session — useAuth().user can lag the real
    // session (known auth.uid-null bug), so fall back to getSession() before bailing.
    let userId = user?.id;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }
    if (!userId) {
      toast.error("Session not ready — please retry in a moment");
      return;
    }
    setLeakAnalyzing(true);
    setLeakResult(null);
    try {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("workspace_id", activeWorkspace.id);
      formData.append("user_id", userId);
      formData.append("file_name", file.name);
      const res = await fetch(SUPABASE_URL + "/functions/v1/trace-leak", {
        method: "POST",
        headers: { "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY },
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result?.error || "Analysis failed");
        setLeakAnalyzing(false);
        return;
      }
      setLeakResult(result);
      loadLeakTraces();
    } catch (e: any) {
      toast.error(e?.message || "Analysis failed");
    }
    setLeakAnalyzing(false);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <SectionBlock title={t("workspaceSettings.leakTracing")} subtitle={t("workspaceSettings.leakTracingSubtitle")} icon={Search}>
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
            accept="audio/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLeakFile(f); e.target.value = ""; }}
          />
          {leakAnalyzing ? (
            <>
              <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
              <p className="text-[13px] font-semibold text-foreground">{t("workspaceSettings.analyzingAudioWatermark")}</p>
              <p className="text-[11px] text-muted-foreground/50">{t("workspaceSettings.thisMayTakeSeconds")}</p>
            </>
          ) : (
            <>
              <Search className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-[13px] font-semibold text-foreground">{t("workspaceSettings.dropAudioFileHere")}</p>
              <p className="text-[11px] text-muted-foreground/50">{t("workspaceSettings.supportsFormats")}</p>
            </>
          )}
        </div>

        {leakResult && (
          <div className="mt-4">
            {leakResult.match ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <p className="text-[13px] text-destructive font-semibold">{t("workspaceSettings.watermarkDetected")}</p>
                </div>
                <div className="pl-6 space-y-0.5">
                  {leakResult.visitor_name && <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">{t("workspaceSettings.leakName")}</span> {leakResult.visitor_name}</p>}
                  {leakResult.visitor_email && <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">{t("workspaceSettings.leakEmail")}</span> {leakResult.visitor_email}</p>}
                  {leakResult.link_id && <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">{t("workspaceSettings.leakSharedLink")}</span> {leakResult.link_id}</p>}
                  {leakResult.confidence != null && <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">{t("workspaceSettings.leakConfidence")}</span> {Math.round(leakResult.confidence * 100)}%</p>}
                  {leakResult.leaker_ip && (
                    <p className="text-[12px] text-foreground flex items-center gap-1.5 flex-wrap">
                      <span className="text-muted-foreground/60">{t("workspaceSettings.leakIp")}</span> <span className="font-mono">{leakResult.leaker_ip}</span>
                      {leakResult.ip_source === "link_only" && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500">{t("workspaceSettings.leakIpLinkOnly")}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="text-[13px] text-emerald-400 font-semibold">{t("workspaceSettings.noWatermarkDetected")}</p>
                    <p className="text-[11px] text-emerald-400/50 mt-0.5">{t("workspaceSettings.audioAppearsClean")}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {leakTraces.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-[12px] font-bold text-muted-foreground/50 uppercase tracking-widest">{t("workspaceSettings.recentTraces")}</h4>
            {leakTraces.map((trace) => (
              <div
                key={trace.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedTraceId(trace.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedTraceId(trace.id); } }}
                className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-secondary/20 border border-border/15 cursor-pointer hover:bg-secondary/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-foreground truncate">{trace.file_name}</p>
                  <p className="text-[10px] text-muted-foreground/40">{new Date(trace.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={"text-[11px] font-semibold px-2 py-0.5 rounded-full " + (trace.match ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-500")}>
                    {trace.match ? t("workspaceSettings.traceLeak") : t("workspaceSettings.traceClean")}
                  </span>
                  <button
                    type="button"
                    aria-label={t("workspaceSettings.deleteTrace")}
                    title={t("workspaceSettings.deleteTrace")}
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: trace.id, fileName: trace.file_name }); }}
                    className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Trace detail */}
        <Dialog open={!!selectedTrace} onOpenChange={(open) => { if (!open) setSelectedTraceId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("workspaceSettings.traceDetail")}</DialogTitle>
            </DialogHeader>
            {selectedTrace && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {selectedTrace.match
                    ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{t("workspaceSettings.traceLeak")}</span>
                    : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">{t("workspaceSettings.traceClean")}</span>}
                </div>
                <div className="space-y-1">
                  <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">{t("workspaceSettings.file")}</span> {selectedTrace.file_name}</p>
                  <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">{t("workspaceSettings.traceAnalyzedOn")}</span> {new Date(selectedTrace.created_at).toLocaleString()}</p>
                  {selectedTrace.match && (
                    <>
                      {selectedTrace.visitor_name && <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">{t("workspaceSettings.leakName")}</span> {selectedTrace.visitor_name}</p>}
                      {selectedTrace.visitor_email && <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">{t("workspaceSettings.leakEmail")}</span> {selectedTrace.visitor_email}</p>}
                      {selectedTrace.link_id && <p className="text-[12px] text-foreground break-all"><span className="text-muted-foreground/60">{t("workspaceSettings.leakSharedLink")}</span> {selectedTrace.link_id}</p>}
                      {selectedTrace.confidence != null && <p className="text-[12px] text-foreground"><span className="text-muted-foreground/60">{t("workspaceSettings.leakConfidence")}</span> {Math.round(selectedTrace.confidence * 100)}%</p>}
                      {selectedTrace.leaker_ip && (
                        <p className="text-[12px] text-foreground flex items-center gap-1.5 flex-wrap">
                          <span className="text-muted-foreground/60">{t("workspaceSettings.leakIp")}</span> <span className="font-mono">{selectedTrace.leaker_ip}</span>
                          {selectedTrace.ip_source === "link_only" && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500">{t("workspaceSettings.leakIpLinkOnly")}</span>
                          )}
                        </p>
                      )}
                      {selectedTrace.hash_hex && <p className="text-[12px] text-foreground break-all"><span className="text-muted-foreground/60">{t("workspaceSettings.leakHash")}</span> <span className="font-mono">{selectedTrace.hash_hex}</span></p>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => downloadTraceReport(selectedTrace)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold btn-brand"
                  >
                    <Download className="w-4 h-4" /> {t("workspaceSettings.downloadReport")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeleteTarget({ id: selectedTrace.id, fileName: selectedTrace.file_name }); }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> {t("workspaceSettings.deleteTrace")}
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("workspaceSettings.deleteTrace")}</AlertDialogTitle>
              <AlertDialogDescription>{t("workspaceSettings.deleteTraceConfirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingTrace}>{t("workspaceSettings.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTrace}
                disabled={deletingTrace}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingTrace ? t("workspaceSettings.deletingTrace") : t("workspaceSettings.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SectionBlock>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */

const sectionComponents: Record<WsSection, React.FC> = {
  info: InfoSection,
  branding: BrandingSection,
  members: MembersSection,
  catalogSharing: CatalogSharingSection,
  leakTracing: LeakTracingSection,
};

export default function WorkspaceSettings() {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<WsSection>("info");
  const ActiveComponent = sectionComponents[activeSection];
  const wsSections = getWsSections(t);

  return (
    <PageShell>
      <motion.div variants={stagger} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 max-w-[1200px]">
        {/* Page header */}
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("workspaceSettings.pageTitle")}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">{activeWorkspace?.name || "Workspace"}</p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left navigation */}
          <motion.nav variants={fadeUp} className={`shrink-0 ${isMobile ? "" : "w-60"}`}>
            <div className={isMobile
              ? "flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1"
              : "space-y-0.5 sticky top-20"
            }>
              {wsSections.map((s) => {
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
                    {!isMobile && isActive && (
                      <motion.div
                        layoutId="ws-settings-active"
                        className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full"
                        style={{ background: "var(--gradient-brand)" }}
                        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                      />
                    )}
                    {isMobile && isActive && (
                      <motion.div layoutId="ws-settings-pill" className="absolute inset-0 rounded-xl bg-primary/10" transition={{ duration: 0.2 }} />
                    )}

                    <s.icon className={`w-[17px] h-[17px] shrink-0 relative z-10 ${isActive ? "text-primary" : ""}`} />
                    <div className="relative z-10 min-w-0">
                      <span className={`text-[13px] font-semibold tracking-tight block`}>{s.label}</span>
                      {!isMobile && (
                        <span className={`text-[10px] mt-0.5 block ${isActive ? "text-muted-foreground/50" : "text-muted-foreground/30"}`}>
                          {s.desc}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
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
