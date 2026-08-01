import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Shield, Eye, Send, Edit3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTeams, type TeamMember } from "@/contexts/TeamContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { SEAT_LIMIT_ERROR } from "@/hooks/useWorkspaceSeats";
import type { AccessLevel } from "@/contexts/RoleContext";
import { INDUSTRY_ROLES } from "@/lib/constants";
import { FEATURES } from "@/config/features";

const ACCESS_LEVELS: { level: AccessLevel; icon: typeof Eye; label: string; description: string }[] = [
  { level: "viewer", icon: Eye, label: "Viewer", description: "View & listen only" },
  { level: "pitcher", icon: Send, label: "Pitcher", description: "+ playlists, pitches, share links" },
  { level: "editor", icon: Edit3, label: "Editor", description: "+ edit metadata, stems, lyrics" },
  { level: "admin", icon: Shield, label: "Admin", description: "Full access incl. splits, members" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  /** "admin" → can edit both; "self" → title only. */
  mode: "admin" | "self";
  /** Called after a successful save (e.g. to refresh seat usage). */
  onSaved?: () => void;
}

export function EditMemberModal({ open, onOpenChange, member, mode, onSaved }: Props) {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const { updateWorkspaceMember } = useTeams();

  const [title, setTitle] = useState<string>("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("viewer");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && member) {
      setTitle(member.professionalTitle || "");
      setAccessLevel(member.accessLevel);
    }
  }, [open, member]);

  if (!member || !activeWorkspace) return null;

  const isOwnerTarget = activeWorkspace.owner_id === member.id;
  const titleChanged = (title || null) !== (member.professionalTitle || null);
  const accessChanged = mode === "admin" && !isOwnerTarget && accessLevel !== member.accessLevel;
  const canSave = titleChanged || accessChanged;

  const handleSave = async () => {
    setSaving(true);
    const updates: { professionalTitle?: string | null; accessLevel?: AccessLevel } = {};
    if (titleChanged) updates.professionalTitle = title || null;
    if (accessChanged) updates.accessLevel = accessLevel;

    const { error } = await updateWorkspaceMember(activeWorkspace.id, member.membershipId, updates);
    setSaving(false);

    if (error) {
      // Surface a clean message when the DB seat-limit trigger blocks the change.
      toast.error(error.includes(SEAT_LIMIT_ERROR) ? t("team.seatLimitError") : error);
      return;
    }

    toast.success("Member updated");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !saving && onOpenChange(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div>
                <h2 className="text-base font-bold text-foreground tracking-tight">
                  {mode === "admin" ? "Edit member" : "Edit my title"}
                </h2>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  {member.firstName} {member.lastName}
                  {member.email && <span className="text-muted-foreground/50"> · {member.email}</span>}
                </p>
              </div>
              <button
                onClick={() => !saving && onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Professional Title */}
              <div className="space-y-1.5">
                <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Professional title
                </label>
                <select
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-10 w-full px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium"
                >
                  <option value="">— No title —</option>
                  {INDUSTRY_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              {/* Access Level — admin only */}
              {mode === "admin" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
                      Access level
                    </label>
                    {isOwnerTarget && (
                      <span className="text-2xs text-muted-foreground/60 italic">
                        Owner access cannot be changed
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ACCESS_LEVELS.filter((opt) => FEATURES.PITCHER_ROLE_ENABLED || opt.level !== "pitcher" || member.accessLevel === "pitcher").map((opt) => {
                      const Icon = opt.icon;
                      const selected = accessLevel === opt.level;
                      return (
                        <button
                          key={opt.level}
                          type="button"
                          disabled={isOwnerTarget}
                          onClick={() => setAccessLevel(opt.level)}
                          className={
                            "flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all " +
                            (selected
                              ? "border-brand-orange/50 bg-brand-orange/5"
                              : "border-border hover:border-brand-orange/30 hover:bg-secondary/50") +
                            (isOwnerTarget ? " opacity-50 cursor-not-allowed" : "")
                          }
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon className={"w-3.5 h-3.5 " + (selected ? "text-brand-orange" : "text-muted-foreground")} />
                            <span className={"text-[12px] font-semibold " + (selected ? "text-brand-orange" : "text-foreground")}>
                              {opt.label}
                            </span>
                          </div>
                          <span className="text-2xs text-muted-foreground leading-snug">{opt.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/40 bg-secondary/20">
              <button
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--gradient-brand-horizontal)" }}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
