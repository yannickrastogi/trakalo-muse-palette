import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}

export function CreateTeamModal({ open, onOpenChange, onCreate }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setError("");
  };

  const handleCreate = () => {
    if (!name.trim()) {
      setError(t("createTeam.nameRequired"));
      return;
    }
    onCreate(name.trim());
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
            {t("createTeam.title")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {t("createTeam.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="team-name" className="text-foreground text-[13px] font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              {t("createTeam.nameLabel")}
            </Label>
            <Input
              id="team-name"
              placeholder={t("createTeam.namePlaceholder")}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-[13px] min-h-[44px]"
            />
          </div>

          <div className="rounded-lg bg-secondary/50 border border-border p-3">
            <p className="text-2xs text-muted-foreground">
              {t("createTeam.adminNote")}
            </p>
          </div>

          {error && <p className="text-destructive text-2xs font-medium">{error}</p>}
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
            {t("createTeam.cancel")}
          </Button>
          <button
            onClick={handleCreate}
            className="btn-brand px-5 py-2.5 rounded-lg text-[13px] font-semibold min-h-[40px]"
          >
            {t("createTeam.create")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
