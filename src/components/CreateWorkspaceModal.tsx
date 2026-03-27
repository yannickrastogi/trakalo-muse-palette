import { useState } from "react";
import { Briefcase } from "lucide-react";
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
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceModal({ open, onOpenChange }: Props) {
  const { createWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setError("");
    setCreating(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Workspace name is required");
      return;
    }
    setCreating(true);
    const id = await createWorkspace(name.trim(), description.trim() || undefined);
    if (id) {
      toast.success("Workspace created!");
      reset();
      onOpenChange(false);
    } else {
      setError("Failed to create workspace. Please try again.");
      setCreating(false);
    }
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
            Create New Workspace
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            A workspace is a separate catalog with its own tracks, playlists, and branding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ws-name" className="text-foreground text-[13px] font-semibold flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
              Workspace Name
            </Label>
            <Input
              id="ws-name"
              placeholder="e.g. My Label, Studio Sessions"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && !creating && handleCreate()}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-[13px] min-h-[44px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ws-desc" className="text-foreground text-[13px] font-semibold">
              Description
              <span className="text-muted-foreground/50 font-normal ml-1.5">optional</span>
            </Label>
            <textarea
              id="ws-desc"
              placeholder="What is this workspace for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
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
            Cancel
          </Button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="btn-brand px-5 py-2.5 rounded-lg text-[13px] font-semibold min-h-[40px] disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Workspace"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
