import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link2, Lock, Copy, Check, Music, ListMusic } from "lucide-react";
import { useSharedLinks, type SharedLink, type ShareType } from "@/contexts/SharedLinksContext";
import { toast } from "sonner";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  shareType: ShareType;
  // For track/stems
  trackId?: number;
  trackTitle?: string;
  trackArtist?: string;
  trackCover?: string;
  stems?: { id: string; fileName: string; type: string; fileSize: string }[];
  // For playlist
  playlistId?: string;
  playlistName?: string;
  playlistCover?: string;
  playlistTracks?: { id: number; title: string; artist: string; duration: string; genre: string; coverImage?: string }[];
  // For pack
  packItems?: string[];
}

const shareTypeLabels: Record<ShareType, string> = {
  stems: "Share Stems",
  track: "Share Track",
  playlist: "Share Playlist",
  pack: "Share Trakalog Pack",
};

const shareTypeItemLabel: Record<ShareType, string> = {
  stems: "stems",
  track: "track",
  playlist: "tracks",
  pack: "items",
};

export function ShareModal({
  open, onClose, shareType,
  trackId, trackTitle, trackArtist, trackCover, stems,
  playlistId, playlistName, playlistCover, playlistTracks,
}: ShareModalProps) {
  const { createSharedLink } = useSharedLinks();

  const [linkType, setLinkType] = useState<"public" | "secured">("public");
  const [password, setPassword] = useState("");
  const [linkName, setLinkName] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const title = shareType === "playlist" ? playlistName || "Playlist" : trackTitle || "Track";
  const subtitle = shareType === "playlist"
    ? `${playlistTracks?.length || 0} tracks`
    : `${trackArtist || ""}`;

  const itemCount = shareType === "stems"
    ? stems?.length || 0
    : shareType === "track"
    ? 1
    : playlistTracks?.length || 0;

  const defaultLinkName = shareType === "playlist"
    ? `${playlistName}`
    : shareType === "stems"
    ? `${trackTitle} — Stems`
    : `${trackTitle}`;

  const handleCreate = () => {
    if (linkType === "secured" && !password.trim()) {
      toast.error("Please set a password for the secured link");
      return;
    }

    const linkId = `sl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newLink: SharedLink = {
      id: linkId,
      shareType,
      trackId: trackId || 0,
      trackTitle: trackTitle || playlistName || "",
      trackArtist: trackArtist || "",
      trackCover: trackCover || playlistCover,
      linkName: linkName.trim() || defaultLinkName,
      linkType,
      password: linkType === "secured" ? password : undefined,
      message: message.trim() || undefined,
      expirationDate: expirationDate || undefined,
      createdAt: new Date().toISOString(),
      status: "active",
      downloads: [],
      stems: stems || [],
      playlistId: playlistId || undefined,
      playlistName: playlistName || undefined,
      playlistCover: playlistCover || undefined,
      playlistTracks: playlistTracks || undefined,
    };

    createSharedLink(newLink);
    const url = `${window.location.origin}/shared/${linkId}`;
    setCreatedLink(url);
    toast.success("Share link created!");
  };

  const handleCopy = () => {
    if (createdLink) {
      navigator.clipboard.writeText(createdLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setCreatedLink(null);
    setLinkType("public");
    setPassword("");
    setLinkName("");
    setExpirationDate("");
    setMessage("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden"
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{shareTypeLabels[shareType]}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{title} — {subtitle}</p>
                </div>
                <button onClick={handleClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {createdLink ? (
              /* Success state */
              <div className="p-6 space-y-4">
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-2xl icon-brand flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">Link Created!</h4>
                  <p className="text-xs text-muted-foreground mt-1">Share this link with your recipient</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground font-mono truncate">
                    {createdLink}
                  </div>
                  <button onClick={handleCopy} className="shrink-0 px-3 py-2.5 rounded-lg text-xs font-semibold btn-brand flex items-center gap-1.5">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                {linkType === "secured" && (
                  <p className="text-xs text-muted-foreground text-center">
                    Password: <span className="text-foreground font-mono">{password}</span>
                  </p>
                )}
                <button onClick={handleClose} className="w-full px-4 py-2.5 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">
                  Done
                </button>
              </div>
            ) : (
              /* Form */
              <div className="p-6 space-y-5">
                {/* Link Type */}
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-2">Link Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLinkType("public")}
                      className={`flex items-center gap-2.5 p-3.5 rounded-xl border transition-all ${
                        linkType === "public"
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-secondary"
                      }`}
                    >
                      <Link2 className={`w-4 h-4 ${linkType === "public" ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-foreground">Public</p>
                        <p className="text-[10px] text-muted-foreground">Anyone can access</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setLinkType("secured")}
                      className={`flex items-center gap-2.5 p-3.5 rounded-xl border transition-all ${
                        linkType === "secured"
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-secondary"
                      }`}
                    >
                      <Lock className={`w-4 h-4 ${linkType === "secured" ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-foreground">Secured</p>
                        <p className="text-[10px] text-muted-foreground">Password protected</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Password (secured only) */}
                <AnimatePresence>
                  {linkType === "secured" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Password</label>
                      <input
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Set a password"
                        className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Link Name */}
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Link Name</label>
                  <input
                    type="text"
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder={defaultLinkName}
                    className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all"
                  />
                </div>

                {/* Expiration */}
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Expiration Date (Optional)</label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Message (Optional)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a note for the recipient…"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all resize-none"
                  />
                </div>

                {/* Item count */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-xs text-muted-foreground">Sharing</span>
                  <span className="text-xs font-semibold text-foreground">
                    {shareType === "track"
                      ? "1 track"
                      : `${itemCount} ${shareTypeItemLabel[shareType]}`}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <button onClick={handleClose} className="px-4 py-2.5 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={itemCount === 0 && shareType !== "track"}
                    className="px-5 py-2.5 rounded-lg text-xs font-semibold btn-brand disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Create Link
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
