import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Music, Image, FileText, Layers, Paperclip, PieChart, Send } from "lucide-react";
import { motion } from "framer-motion";
import { ShareModal } from "@/components/ShareModal";
import type { TrackData } from "@/contexts/TrackContext";

interface SharePackModalProps {
  open: boolean;
  onClose: () => void;
  trackData: TrackData;
}

const packItems = [
  { id: "track", label: "Track", description: "Original audio file", icon: Music },
  { id: "cover", label: "Cover Art", description: "3000×3000 JPEG artwork", icon: Image },
  { id: "lyrics", label: "Lyrics", description: "Branded PDF document", icon: FileText },
  { id: "stems", label: "Stems", description: "All stem files (original format)", icon: Layers },
  { id: "metadata", label: "Metadata", description: "Branded PDF with all track info", icon: PieChart },
  { id: "paperwork", label: "Paperwork", description: "All documents with watermark", icon: Paperclip },
] as const;

type PackItemId = typeof packItems[number]["id"];

export function SharePackModal({ open, onClose, trackData }: SharePackModalProps) {
  const [selectedItems, setSelectedItems] = useState<Set<PackItemId>>(
    new Set(["track", "cover", "lyrics", "stems", "metadata", "paperwork"])
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const toggleItem = (id: PackItemId) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = () => {
    setSelectedItems(new Set(["track", "cover", "lyrics", "stems", "metadata", "paperwork"]));
    setShowConfirm(false);
    setShowShareModal(false);
    onClose();
  };

  const handleSend = () => {
    if (selectedItems.size === 0) return;
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    onClose();
    // Small delay so the first dialog fully closes
    setTimeout(() => setShowShareModal(true), 150);
  };

  const handleShareModalClose = () => {
    setShowShareModal(false);
    setSelectedItems(new Set(["track", "cover", "lyrics", "stems", "metadata", "paperwork"]));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Share Trakalog Pack
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {trackData.title} — {trackData.artist}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 pt-2">
            <p className="text-xs text-muted-foreground mb-2">
              Select what to include in the shared pack
            </p>

            {packItems.map((item) => {
              const checked = selectedItems.has(item.id);
              const ItemIcon = item.icon;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                    checked
                      ? "border-primary/30 bg-primary/5"
                      : "border-transparent hover:bg-secondary/40"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleItem(item.id)}
                    className="shrink-0"
                  />
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <ItemIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.description}</p>
                  </div>
                </motion.button>
              );
            })}

            <button
              onClick={handleSend}
              disabled={selectedItems.size === 0}
              className="w-full mt-3 py-3 rounded-xl text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background:
                  "linear-gradient(135deg, hsl(24, 100%, 55%), hsl(330, 80%, 60%), hsl(270, 70%, 55%))",
              }}
            >
              <Send className="w-4 h-4" />
              Share Pack ({selectedItems.size} items)
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Send Trakalog Pack?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              You are about to share a Trakalog Pack for{" "}
              <span className="font-medium text-foreground">
                {trackData.title}
              </span>{" "}
              containing {selectedItems.size} item
              {selectedItems.size !== 1 ? "s" : ""}:{" "}
              <span className="text-foreground/80">
                {Array.from(selectedItems)
                  .map((id) => packItems.find((p) => p.id === id)?.label)
                  .join(", ")}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="text-primary-foreground"
              style={{
                background:
                  "linear-gradient(135deg, hsl(24, 100%, 55%), hsl(330, 80%, 60%), hsl(270, 70%, 55%))",
              }}
            >
              Yes, share pack
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share link modal — same as track/stems */}
      <ShareModal
        open={showShareModal}
        onClose={handleShareModalClose}
        shareType="pack"
        trackId={trackData.id}
        trackTitle={trackData.title}
        trackArtist={trackData.artist}
        trackCover={trackData.coverImage}
        packItems={Array.from(selectedItems)}
      />
    </>
  );
}
