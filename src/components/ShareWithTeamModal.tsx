import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTeams } from "@/contexts/TeamContext";
import { Users, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ShareWithTeamModalProps {
  open: boolean;
  onClose: () => void;
  trackTitle: string;
}

export function ShareWithTeamModal({ open, onClose, trackTitle }: ShareWithTeamModalProps) {
  const { t } = useTranslation();
  const { teams } = useTeams();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleShare = () => {
    const names = teams.filter((tm) => selected.includes(tm.id)).map((tm) => tm.name);
    toast.success("\"" + trackTitle + "\" shared with " + names.join(", "));
    setSelected([]);
    onClose();
  };

  const handleClose = () => {
    setSelected([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("shareWithTeam.title")}</DialogTitle>
          <DialogDescription>
            {t("shareWithTeam.selectTeams", { title: trackTitle })}
          </DialogDescription>
        </DialogHeader>

        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{t("shareWithTeam.noTeams")}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {t("shareWithTeam.noTeamsDesc")}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {teams.map((team) => {
              const isSelected = selected.includes(team.id);
              return (
                <button
                  key={team.id}
                  onClick={() => toggle(team.id)}
                  className={"w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left " + (
                    isSelected
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-secondary/50 hover:border-border/80"
                  )}
                >
                  <div
                    className={"w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all " + (
                      isSelected
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {team.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("shareWithTeam.members", { count: team.members.length })}
                    </p>
                  </div>
                  <div
                    className={"w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 " + (
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>
            {t("shareWithTeam.cancel")}
          </Button>
          <Button
            onClick={handleShare}
            disabled={selected.length === 0}
          >
            {t("shareWithTeam.share", { count: selected.length })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
