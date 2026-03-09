import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, ShieldCheck, ShieldAlert, Users, Lock, Unlock, Info } from "lucide-react";
import { useApprovals, type ApprovalMode, type MemberApprovalRule } from "@/contexts/ApprovalContext";
import { useTeams, type TeamMember } from "@/contexts/TeamContext";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const modeConfig: Record<ApprovalMode, { icon: typeof Shield; label: string; description: string; color: string }> = {
  everyone_requires_approval: {
    icon: ShieldAlert,
    label: "Everyone Requires Approval",
    description: "Every outbound send must be approved by an admin before delivery.",
    color: "border-brand-orange/40 bg-brand-orange/5",
  },
  everyone_auto_approved: {
    icon: ShieldCheck,
    label: "Everyone Auto-Approved",
    description: "Outbound sends are approved automatically for users who already have send permissions.",
    color: "border-emerald-500/40 bg-emerald-500/5",
  },
  custom_by_user: {
    icon: Users,
    label: "Custom by User",
    description: "Decide which team members require approval and which can send directly.",
    color: "border-brand-purple/40 bg-brand-purple/5",
  },
};

const roleColors: Record<string, string> = {
  Admin: "from-brand-orange to-brand-pink",
  Producer: "from-brand-purple to-[hsl(200,70%,50%)]",
  Songwriter: "from-brand-pink to-brand-orange",
  Musician: "from-brand-purple to-brand-pink",
  "Mix Engineer": "from-[hsl(180,60%,45%)] to-brand-purple",
  "Mastering Engineer": "from-brand-orange to-[hsl(180,60%,45%)]",
  Manager: "from-brand-pink to-brand-purple",
  Publisher: "from-[hsl(200,70%,50%)] to-brand-purple",
  "A&R": "from-brand-orange to-brand-purple",
  Assistant: "from-brand-pink to-[hsl(200,70%,50%)]",
  Viewer: "from-muted-foreground/40 to-muted-foreground/20",
};

function getInitials(first: string, last: string) {
  return ((first[0] || "") + (last[0] || "")).toUpperCase() || "?";
}

interface Props {
  teamId: string;
}

export function SendApprovalSettings({ teamId }: Props) {
  const { getTeamSettings, setTeamApprovalMode, getMemberRule, setMemberRule } = useApprovals();
  const { teams } = useTeams();
  const team = teams.find(t => t.id === teamId);
  const settings = getTeamSettings(teamId);
  const [mode, setMode] = useState<ApprovalMode>(settings.approvalMode);

  if (!team) return null;

  const handleModeChange = (newMode: ApprovalMode) => {
    setMode(newMode);
    setTeamApprovalMode(teamId, newMode);
    toast.success(`Approval mode updated to "${modeConfig[newMode].label}"`);
  };

  const handleMemberRuleChange = (userId: string, rule: MemberApprovalRule) => {
    setMemberRule(teamId, userId, rule);
    toast.success("Member approval rule updated");
  };

  const nonOwnerMembers = team.members.filter(m => m.firstName !== "You");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-brand-orange" />
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-foreground">Send Approvals</h3>
          <p className="text-xs text-muted-foreground">Control whether outbound sends require admin approval before delivery.</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-secondary/60 border border-border">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Auto-approved does <span className="font-semibold text-foreground">not</span> grant send permissions. Users must already have permission to send. Approval rules only decide whether a send needs manual review before delivery.
        </p>
      </div>

      {/* Mode Selector */}
      <div className="grid gap-3">
        {(Object.keys(modeConfig) as ApprovalMode[]).map((key) => {
          const cfg = modeConfig[key];
          const Icon = cfg.icon;
          const isActive = mode === key;
          return (
            <button
              key={key}
              onClick={() => handleModeChange(key)}
              className={`relative w-full text-left p-4 rounded-xl border-2 transition-all ${
                isActive ? cfg.color : "border-border bg-card hover:border-muted-foreground/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${
                  isActive
                    ? key === "everyone_requires_approval" ? "text-brand-orange"
                    : key === "everyone_auto_approved" ? "text-emerald-400"
                    : "text-brand-purple"
                    : "text-muted-foreground"
                }`} />
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {cfg.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                </div>
                {isActive && (
                  <div className="ml-auto shrink-0">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      key === "everyone_requires_approval" ? "bg-brand-orange"
                      : key === "everyone_auto_approved" ? "bg-emerald-500"
                      : "bg-brand-purple"
                    }`}>
                      <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom by User table */}
      {mode === "custom_by_user" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Per-Member Rules</h4>
            <Badge variant="outline" className="text-2xs">{nonOwnerMembers.length} members</Badge>
          </div>

          {nonOwnerMembers.length === 0 ? (
            <div className="card-premium p-8 text-center">
              <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No team members to configure</p>
            </div>
          ) : (
            <div className="card-premium divide-y divide-border/60 overflow-hidden">
              {nonOwnerMembers.map((member) => {
                const rule = getMemberRule(teamId, member.id);
                const isAutoApproved = rule === "auto_approved";
                return (
                  <div key={member.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarFallback className={`bg-gradient-to-br ${roleColors[member.role] || "from-muted to-muted"} text-primary-foreground text-2xs font-bold`}>
                        {getInitials(member.firstName, member.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground truncate">
                        {member.firstName} {member.lastName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-2xs text-muted-foreground truncate">{member.email}</span>
                        <Badge variant="outline" className="text-2xs border-border shrink-0">{member.role}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-2xs font-semibold ${isAutoApproved ? "text-emerald-400" : "text-brand-orange"}`}>
                        {isAutoApproved ? "Auto" : "Review"}
                      </span>
                      <Switch
                        checked={isAutoApproved}
                        onCheckedChange={(checked) => handleMemberRuleChange(member.id, checked ? "auto_approved" : "requires_approval")}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-secondary/40 border border-border/60">
            <Lock className="w-3.5 h-3.5 text-brand-orange shrink-0 mt-0.5" />
            <p className="text-2xs text-muted-foreground">
              <span className="font-semibold text-brand-orange">Requires Approval</span> — sends must be reviewed before delivery.
            </p>
          </div>
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-secondary/40 border border-border/60">
            <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-2xs text-muted-foreground">
              <span className="font-semibold text-emerald-400">Auto-Approved</span> — sends are delivered immediately if the user has send permissions.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
