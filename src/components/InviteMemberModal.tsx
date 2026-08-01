import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, ShieldCheck, User, Users, Plus, AlertTriangle, Eye, Send, Edit3, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeams } from "@/contexts/TeamContext";
import { CreateTeamModal } from "@/components/CreateTeamModal";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import type { AccessLevel } from "@/contexts/RoleContext";
import { useWorkspaceSeats, SEAT_LIMIT_ERROR } from "@/hooks/useWorkspaceSeats";
import { FEATURES } from "@/config/features";

const PROFESSIONAL_TITLES = [
  "Producer", "Songwriter", "Musician", "Mix Engineer", "Mastering Engineer",
  "Manager", "Publisher", "A&R", "Assistant", "Artist",
];

const ACCESS_LEVEL_CARDS: { level: AccessLevel; icon: typeof Eye; title: string; subtitle: string; description: string }[] = [
  { level: "viewer", icon: Eye, title: "Viewer", subtitle: "Listen & review", description: "Can play tracks, browse the catalog, and rate. No edits." },
  { level: "pitcher", icon: Send, title: "Pitcher", subtitle: "Pitch & Share", description: "Can create playlists, pitches, and share links" },
  { level: "editor", icon: Edit3, title: "Editor", subtitle: "Work the catalog", description: "Can upload and edit tracks, create playlists and share links, and manage contacts, stems, and documents." },
  { level: "admin", icon: Shield, title: "Admin", subtitle: "Manage the workspace", description: "Everything an editor can do, plus delete tracks, manage members, share the catalog, and change workspace settings." },
];

export interface InvitePayload {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  accessLevel: AccessLevel;
  professionalTitle: string | null;
  teamId: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (payload: InvitePayload) => void;
  /** Pre-select a team (e.g. when inviting from team page) */
  preselectedTeamId?: string;
}

export function InviteMemberModal({ open, onOpenChange, onInvite, preselectedTeamId }: Props) {
  const { t } = useTranslation();
  const { teams, createTeam, addMember } = useTeams();
  const { user, session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  // Fetch seat usage only while the modal is open. Viewer stays free; paid roles
  // are gated when no seat is available. The DB triggers enforce this regardless.
  const { seats } = useWorkspaceSeats(open);
  const paidRolesDisabled = seats ? !seats.can_invite_active : false;

  const [selectedTeamId, setSelectedTeamId] = useState<string>(preselectedTeamId || "");
  const [newTeamName, setNewTeamName] = useState("");
  const [showNewTeamInput, setShowNewTeamInput] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("viewer");
  const [professionalTitle, setProfessionalTitle] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);

  // If seats run out while a paid role is selected, fall back to the free Viewer role.
  useEffect(() => {
    if (paidRolesDisabled && accessLevel !== "viewer") setAccessLevel("viewer");
  }, [paidRolesDisabled, accessLevel]);

  const reset = () => {
    setSelectedTeamId(preselectedTeamId || "");
    setNewTeamName("");
    setShowNewTeamInput(false);
    setFirstName("");
    setLastName("");
    setEmail("");
    setAccessLevel("viewer");
    setProfessionalTitle(null);
    setError("");
    setSending(false);
  };

  const handleSend = async () => {
    // Resolve team
    let teamId = selectedTeamId;

    if (showNewTeamInput) {
      const name = newTeamName.trim() || "My Team";
      const newTeam = createTeam(name);
      teamId = newTeam.id;
    }

    if (!teamId) {
      setError(t("inviteMember.selectTeamError"));
      return;
    }
    if (!firstName.trim()) {
      setError(t("inviteMember.firstNameRequired"));
      return;
    }
    if (!lastName.trim()) {
      setError(t("inviteMember.lastNameRequired"));
      return;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t("inviteMember.invalidEmail"));
      return;
    }

    setSending(true);
    setError("");

    try {
      const res = await fetch(SUPABASE_URL + "/functions/v1/create-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Send the USER's access token — the Edge Function authenticates the
          // caller and verifies workspace admin before creating the invitation.
          "Authorization": "Bearer " + (session?.access_token || SUPABASE_PUBLISHABLE_KEY),
          "apikey": SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          workspace_id: activeWorkspace?.id,
          workspace_name: activeWorkspace?.name || "Trakalog",
          user_id: user?.id,
          invited_by: user?.id,
          inviter_name: user?.user_metadata?.full_name || user?.email || "Your team",
          email: trimmedEmail,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          role: accessLevel,
          access_level: accessLevel,
          professional_title: professionalTitle,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const raw = typeof data?.error === "string" ? data.error : "";
        // Backend DB trigger blocks over-quota seats — show a clean message.
        setError(raw.includes(SEAT_LIMIT_ERROR) ? t("inviteMember.seatLimitError") : raw || "Failed to send invitation");
        setSending(false);
        return;
      }

      // Also add to local team context for immediate UI update
      addMember(teamId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: trimmedEmail,
        role: accessLevel === "admin" ? "Admin" : accessLevel === "editor" ? "Manager" : accessLevel === "pitcher" ? "Publisher" : "Viewer",
        accessLevel: accessLevel,
        professionalTitle: professionalTitle,
      });

      onInvite({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: trimmedEmail,
        role: accessLevel,
        accessLevel: accessLevel,
        professionalTitle: professionalTitle,
        teamId,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError("Failed to send invitation: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setSending(false);
    }
  };

  const hasTeams = teams.length > 0;

  const handleCreateTeam = (name: string) => {
    createTeam(name);
    setShowCreateTeamModal(false);
  };

  // No teams exist — show blocking message
  if (!hasTeams && !preselectedTeamId) {
    return (
      <>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            if (!v) reset();
            onOpenChange(v);
          }}
        >
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground text-lg font-bold">
                {t("inviteMember.title")}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                {t("inviteMember.description")}
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-destructive" />
              </div>
              <div className="space-y-1.5">
                <p className="text-foreground text-[15px] font-semibold">
                  You can't invite a member without creating a team.
                </p>
                <p className="text-muted-foreground text-[13px]">
                  Would you like to create a new team first?
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="ghost"
                onClick={() => { reset(); onOpenChange(false); }}
                className="text-muted-foreground text-[13px]"
              >
                {t("inviteMember.cancel")}
              </Button>
              <button
                onClick={() => {
                  onOpenChange(false);
                  setShowCreateTeamModal(true);
                }}
                className="btn-brand px-5 py-2.5 rounded-lg text-[13px] font-semibold min-h-[40px]"
              >
                Create a Team
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CreateTeamModal
          open={showCreateTeamModal}
          onOpenChange={setShowCreateTeamModal}
          onCreate={handleCreateTeam}
        />
      </>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg font-bold">
            {t("inviteMember.title")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {t("inviteMember.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Team Selection */}
          <div className="space-y-2">
            <Label className="text-foreground text-[13px] font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              Team
            </Label>

            {!showNewTeamInput ? (
              <div className="space-y-2">
                <Select value={selectedTeamId} onValueChange={(v) => { setSelectedTeamId(v); if (error) setError(""); }}>
                  <SelectTrigger className="bg-secondary border-border text-foreground text-[13px] min-h-[44px]">
                    <SelectValue placeholder={t("inviteMember.selectTeam")} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id} className="text-[13px]">
                        {team.name}
                        <span className="ml-2 text-muted-foreground text-2xs">· {team.members.length} members</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => setShowNewTeamInput(true)}
                  className="flex items-center gap-1.5 text-2xs text-brand-orange hover:text-brand-orange/80 font-semibold transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Create new team instead
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder={t("createTeam.namePlaceholder")}
                  value={newTeamName}
                  onChange={(e) => { setNewTeamName(e.target.value); if (error) setError(""); }}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-[13px] min-h-[44px]"
                />
                <p className="text-2xs text-muted-foreground">
                  A new team will be created and you'll be added as Admin.
                </p>
                <button
                  type="button"
                  onClick={() => { setShowNewTeamInput(false); setNewTeamName(""); }}
                  className="text-2xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                >
                  ← Select existing team
                </button>
              </div>
            )}
          </div>

          {/* First & Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="invite-first" className="text-foreground text-[13px] font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                {t("inviteMember.firstName")}
              </Label>
              <Input
                id="invite-first"
                placeholder={t("inviteMember.firstNamePlaceholder")}
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); if (error) setError(""); }}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-[13px] min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-last" className="text-foreground text-[13px] font-semibold flex items-center gap-1.5">
                {t("inviteMember.lastName")}
              </Label>
              <Input
                id="invite-last"
                placeholder={t("inviteMember.lastNamePlaceholder")}
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); if (error) setError(""); }}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-[13px] min-h-[44px]"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-foreground text-[13px] font-semibold flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              {t("inviteMember.emailLabel")}
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t("inviteMember.emailPlaceholder")}
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-[13px] min-h-[44px]"
            />
          </div>

          {/* Access Level — 4 cards */}
          <div className="space-y-2">
            <Label className="text-foreground text-[13px] font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
              {t("inviteMember.roleLabel")}
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACCESS_LEVEL_CARDS.filter(function (card) { return FEATURES.PITCHER_ROLE_ENABLED || card.level !== "pitcher"; }).map(function (card) {
                var CardIcon = card.icon;
                var isSelected = accessLevel === card.level;
                // Viewer is always free; paid roles are gated when no seat is available.
                var isDisabled = paidRolesDisabled && card.level !== "viewer";
                return (
                  <button
                    key={card.level}
                    type="button"
                    disabled={isDisabled}
                    onClick={function () { if (!isDisabled) setAccessLevel(card.level); }}
                    className={
                      "border rounded-xl p-3 sm:p-4 text-left transition-all min-h-[44px] " +
                      (isDisabled
                        ? "border-border opacity-50 cursor-not-allowed"
                        : isSelected
                        ? "border-brand-orange/40 bg-brand-orange/5"
                        : "border-border hover:border-brand-orange/30")
                    }
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      <CardIcon className={"w-4 h-4 " + (isSelected ? "text-brand-orange" : "text-muted-foreground")} />
                      <span className={"text-[13px] font-semibold " + (isSelected ? "text-foreground" : "text-foreground")}>{card.title}</span>
                    </div>
                    <p className={"text-2xs font-medium " + (isSelected ? "text-brand-orange" : "text-muted-foreground")}>{card.subtitle}</p>
                    <p className="text-2xs text-muted-foreground mt-0.5">{card.description}</p>
                  </button>
                );
              })}
            </div>
            {paidRolesDisabled && (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-brand-orange/30 bg-brand-orange/5 px-3 py-2 text-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                <span className="text-foreground font-medium">{t("inviteMember.noSeats")}</span>
                <Link
                  to="/settings/billing"
                  onClick={() => { reset(); onOpenChange(false); }}
                  className="font-semibold text-brand-orange hover:underline"
                >
                  {t("inviteMember.goToBilling")}
                </Link>
              </div>
            )}
          </div>

          {/* Professional Title (optional) */}
          <div className="space-y-2">
            <Label className="text-foreground text-[13px] font-semibold flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              Professional Title
              <span className="text-2xs text-muted-foreground font-normal ml-1">(optional)</span>
            </Label>
            <p className="text-2xs text-muted-foreground">A job label shown on credits (Producer, A&R, Mix Engineer…). It does not grant any permissions — access is set by the role above.</p>
            <Select value={professionalTitle || "__none__"} onValueChange={function (v) { setProfessionalTitle(v === "__none__" ? null : v); }}>
              <SelectTrigger className="bg-secondary border-border text-foreground text-[13px] min-h-[44px]">
                <SelectValue placeholder="Select a title" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__none__" className="text-[13px] text-muted-foreground">
                  No title
                </SelectItem>
                {PROFESSIONAL_TITLES.map(function (title) {
                  return (
                    <SelectItem key={title} value={title} className="text-[13px]">
                      {title}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-destructive text-2xs font-medium">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => { reset(); onOpenChange(false); }}
            className="text-muted-foreground text-[13px]"
          >
            {t("inviteMember.cancel")}
          </Button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="btn-brand px-5 py-2.5 rounded-lg text-[13px] font-semibold min-h-[40px] disabled:opacity-50"
          >
            {sending ? t("inviteMember.sending") : t("inviteMember.sendInvite")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
