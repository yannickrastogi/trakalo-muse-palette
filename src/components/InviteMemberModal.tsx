import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, ShieldCheck, User, Users, Plus, AlertTriangle } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

const INVITE_ROLES = ["Admin", "Producer", "Songwriter", "Musician", "Mix Engineer", "Mastering Engineer", "Manager", "Publisher", "A&R", "Assistant", "Viewer"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export interface InvitePayload {
  firstName: string;
  lastName: string;
  email: string;
  role: InviteRole;
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
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [selectedTeamId, setSelectedTeamId] = useState<string>(preselectedTeamId || "");
  const [newTeamName, setNewTeamName] = useState("");
  const [showNewTeamInput, setShowNewTeamInput] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("Viewer");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);

  const reset = () => {
    setSelectedTeamId(preselectedTeamId || "");
    setNewTeamName("");
    setShowNewTeamInput(false);
    setFirstName("");
    setLastName("");
    setEmail("");
    setRole("Viewer");
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
      setError("Please select a team");
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
      const res = await fetch("https://xhmeitivkclbeziqavxw.supabase.co/functions/v1/create-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik",
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
          role: role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send invitation");
        setSending(false);
        return;
      }

      // Also add to local team context for immediate UI update
      addMember(teamId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: trimmedEmail,
        role: role,
      });

      onInvite({ firstName: firstName.trim(), lastName: lastName.trim(), email: trimmedEmail, role, teamId });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      setError("Failed to send invitation: " + (err.message || "unknown error"));
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
      <DialogContent className="sm:max-w-md bg-card border-border">
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
                    <SelectValue placeholder="Select a team…" />
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

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="invite-role" className="text-foreground text-[13px] font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
              {t("inviteMember.roleLabel")}
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
              <SelectTrigger className="bg-secondary border-border text-foreground text-[13px] min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {INVITE_ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="text-[13px]">
                    {t(`team.role_${r.toLowerCase()}`)}
                  </SelectItem>
                ))}
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
            {sending ? "Sending…" : t("inviteMember.sendInvite")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
