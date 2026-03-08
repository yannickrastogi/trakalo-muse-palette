import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, ShieldCheck } from "lucide-react";
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

const INVITE_ROLES = ["Admin", "Manager", "Producer", "Viewer"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export interface InvitePayload {
  email: string;
  role: InviteRole;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (payload: InvitePayload) => void;
}

export function InviteMemberModal({ open, onOpenChange, onInvite }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("Viewer");
  const [error, setError] = useState("");

  const reset = () => {
    setEmail("");
    setRole("Viewer");
    setError("");
  };

  const handleSend = () => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("inviteMember.invalidEmail"));
      return;
    }
    onInvite({ email: trimmed, role });
    reset();
    onOpenChange(false);
  };

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

        <div className="space-y-5 py-2">
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
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-[13px] min-h-[44px]"
            />
            {error && <p className="text-destructive text-2xs font-medium">{error}</p>}
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
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
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
