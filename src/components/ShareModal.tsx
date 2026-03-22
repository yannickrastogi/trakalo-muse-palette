import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link2, Lock, Copy, Check, Music, ListMusic, Download, ShieldOff } from "lucide-react";
import { useSharedLinks, type SharedLink, type ShareType } from "@/contexts/SharedLinksContext";
import { Switch } from "@/components/ui/switch";
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
  packItems,
}: ShareModalProps) {
  const { t } = useTranslation();
  const { createSharedLink } = useSharedLinks();

  const [linkType, setLinkType] = useState<"public" | "secured">("public");
  const [password, setPassword] = useState("");
  const [linkName, setLinkName] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [message, setMessage] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [downloadQuality, setDownloadQuality] = useState<"hi-res" | "low-res">("low-res");
  const [copied, setCopied] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const shareTypeLabels: Record<ShareType, string> = {
    stems: t("shareModal.shareStems"),
    track: t("shareModal.shareTrack"),
    playlist: t("shareModal.sharePlaylist"),
    pack: t("shareModal.sharePack"),
  };

  const title = shareType === "playlist" ? playlistName || "Playlist" : trackTitle || "Track";
  const subtitle = shareType === "playlist"
    ? (playlistTracks?.length || 0) + " tracks"
    : shareType === "pack"
    ? (packItems?.length || 0) + " items in pack"
    : (trackArtist || "");

  const itemCount = shareType === "stems"
    ? stems?.length || 0
    : shareType === "track"
    ? 1
    : shareType === "pack"
    ? packItems?.length || 0
    : playlistTracks?.length || 0;

  const defaultLinkName = shareType === "playlist"
    ? "" + playlistName
    : shareType === "stems"
    ? trackTitle + " — Stems"
    : shareType === "pack"
    ? trackTitle + " — Trakalog Pack"
    : "" + trackTitle;

  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (linkType === "secured" && !password.trim()) {
      toast.error(t("shareModal.passwordRequired"));
      return;
    }

    setCreating(true);

    const newLink: SharedLink = {
      id: "",
      workspace_id: "",
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
      packItems: packItems || undefined,
      allowDownload,
      downloadQuality: allowDownload ? downloadQuality : undefined,
    };

    const created = await createSharedLink(newLink);
    setCreating(false);

    if (created && created.linkSlug) {
      const url = window.location.origin + "/share/" + created.linkSlug;
      setCreatedLink(url);
      toast.success(t("shareModal.linkCreatedToast"));
    } else {
      toast.error(t("shareModal.createFailed"));
    }
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
    setAllowDownload(false);
    setDownloadQuality("low-res");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="relative z-10 w-full md:max-w-md bg-card border border-border rounded-t-2xl md:rounded-2xl overflow-hidden"
            style={{ boxShadow: "var(--shadow-elevated)", maxHeight: "95dvh", display: "flex", flexDirection: "column" }}
          >
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-border">
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
              <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-2xl icon-brand flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">{t("shareModal.linkCreated")}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{t("shareModal.linkCreatedDesc")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground font-mono truncate">
                    {createdLink}
                  </div>
                  <button onClick={handleCopy} className="shrink-0 px-3 py-2.5 rounded-lg text-xs font-semibold btn-brand flex items-center gap-1.5">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? t("shareModal.copied") : t("shareModal.copy")}
                  </button>
                </div>
                {linkType === "secured" && (
                  <p className="text-xs text-muted-foreground text-center">
                    {t("shareModal.password")}: <span className="text-foreground font-mono">{password}</span>
                  </p>
                )}
                <button onClick={handleClose} className="w-full px-4 py-2.5 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">
                  {t("shareModal.done")}
                </button>
              </div>
            ) : (
              <>
              {/* Form */}
              <div className="flex-1 overflow-y-auto min-h-0 px-6 pt-6 pb-4 space-y-5">
                {/* Link Type */}
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-2">{t("shareModal.linkType")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLinkType("public")}
                      className={"flex items-center gap-2.5 p-3.5 rounded-xl border transition-all " + (
                        linkType === "public"
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-secondary"
                      )}
                    >
                      <Link2 className={"w-4 h-4 " + (linkType === "public" ? "text-primary" : "text-muted-foreground")} />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-foreground">{t("shareModal.public")}</p>
                        <p className="text-[10px] text-muted-foreground">{t("shareModal.publicDesc")}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setLinkType("secured")}
                      className={"flex items-center gap-2.5 p-3.5 rounded-xl border transition-all " + (
                        linkType === "secured"
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-secondary"
                      )}
                    >
                      <Lock className={"w-4 h-4 " + (linkType === "secured" ? "text-primary" : "text-muted-foreground")} />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-foreground">{t("shareModal.secured")}</p>
                        <p className="text-[10px] text-muted-foreground">{t("shareModal.securedDesc")}</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Password (secured only) */}
                <AnimatePresence>
                  {linkType === "secured" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">{t("shareModal.password")}</label>
                      <input
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("shareModal.setPassword")}
                        className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Link Name */}
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">{t("shareModal.linkName")}</label>
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
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">{t("shareModal.expirationDate")}</label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">{t("shareModal.message")}</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("shareModal.messagePlaceholder")}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all resize-none"
                  />
                </div>

                {/* Download Permissions */}
                <div className="space-y-3">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block">{t("shareModal.downloadPermission")}</label>
                  <div className={"rounded-xl border transition-all " + (allowDownload ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30") + " p-3.5"}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {allowDownload ? (
                          <Download className="w-4 h-4 text-primary" />
                        ) : (
                          <ShieldOff className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-xs font-semibold text-foreground">{allowDownload ? t("shareModal.downloadEnabled") : t("shareModal.downloadDisabled")}</p>
                          <p className="text-[10px] text-muted-foreground">{allowDownload ? t("shareModal.downloadEnabledDesc") : t("shareModal.downloadDisabledDesc")}</p>
                        </div>
                      </div>
                      <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
                    </div>

                    <AnimatePresence>
                      {allowDownload && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/50">
                            <button
                              onClick={() => setDownloadQuality("low-res")}
                              className={"p-2.5 rounded-lg border text-center transition-all " + (
                                downloadQuality === "low-res"
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:bg-secondary"
                              )}
                            >
                              <p className="text-xs font-semibold text-foreground">{t("shareModal.lowRes")}</p>
                              <p className="text-[10px] text-muted-foreground">{t("shareModal.lowResDesc")}</p>
                            </button>
                            <button
                              onClick={() => setDownloadQuality("hi-res")}
                              className={"p-2.5 rounded-lg border text-center transition-all " + (
                                downloadQuality === "hi-res"
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:bg-secondary"
                              )}
                            >
                              <p className="text-xs font-semibold text-foreground">{t("shareModal.hiRes")}</p>
                              <p className="text-[10px] text-muted-foreground">{t("shareModal.hiResDesc")}</p>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Item count */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-xs text-muted-foreground">{t("shareModal.sharing")}</span>
                  <span className="text-xs font-semibold text-foreground">
                    {shareType === "track"
                      ? t("shareModal.oneTrack")
                      : itemCount + " " + shareTypeItemLabel[shareType]}
                  </span>
                </div>
              </div>

              {/* Actions — fixed at bottom */}
              <div className="shrink-0 px-6 py-3 border-t border-border flex items-center justify-between">
                <button onClick={handleClose} className="px-4 py-2.5 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">
                  {t("shareModal.cancel")}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={(itemCount === 0 && shareType !== "track") || creating}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold btn-brand disabled:opacity-40 disabled:pointer-events-none"
                >
                  {creating ? t("shareModal.creating") : t("shareModal.createLink")}
                </button>
              </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
