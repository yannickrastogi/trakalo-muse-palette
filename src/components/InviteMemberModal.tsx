import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, ShieldCheck, User, Users, Plus } from "lucide-react";
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

  const [selectedTeamId, setSelectedTeamId] = useState<string>(preselectedTeamId || "");
  const [newTeamName, setNewTeamName] = useState("");
  const [showNewTeamInput, setShowNewTeamInput] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("Viewer");
  const [error, setError] = useState("");

  const reset = () => {
    setSelectedTeamId(preselectedTeamId || "");
    setNewTeamName("");
    setShowNewTeamInput(false);
    setFirstName("");
    setLastName("");
    setEmail("");
    setRole("Viewer");
    setError("");
  };

  const handleSend = () => {
    // Resolve team
    let teamId = selectedTeamId;

    if (teams.length === 0 || showNewTeamInput) {
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

    // Add member to team context
    addMember(teamId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: trimmedEmail,
      role: role,
    });

    onInvite({ firstName: firstName.trim(), lastName: lastName.trim(), email: trimmedEmail, role, teamId });
    reset();
    onOpenChange(false);
  };

  const hasTeams = teams.length > 0;

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

            {hasTeams && !showNewTeamInput ? (
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
                  placeholder="e.g. Nightfall Records, Studio Session A"
                  value={newTeamName}
                  onChange={(e) => { setNewTeamName(e.target.value); if (error) setError(""); }}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-[13px] min-h-[44px]"
                />
                <p className="text-2xs text-muted-foreground">
                  {hasTeams
                    ? "A new team will be created and you'll be added as Admin."
                    : "No teams yet — a new team will be created automatically."}
                </p>
                {hasTeams && (
                  <button
                    type="button"
                    onClick={() => { setShowNewTeamInput(false); setNewTeamName(""); }}
                    className="text-2xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                  >
                    ← Select existing team
                  </button>
                )}
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
            className="btn-brand px-5 py-2.5 rounded-lg text-[13px] font-semibold min-h-[40px]"
          >
            {t("inviteMember.sendInvite")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
