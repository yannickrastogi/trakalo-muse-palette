import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Music,
  ListMusic,
  Send,
  Check,
  FileText,
  ArrowRight,
  User,
  Building2,
  Mail,
  MessageSquare,
  Download,
  ShieldOff,
  ShieldCheck,
  Link2,
  Lock,
  Bookmark,
  Briefcase,
  Phone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { NameAutocomplete } from "@/components/NameAutocomplete";
import { useTrack } from "@/contexts/TrackContext";
import { usePlaylists } from "@/contexts/PlaylistContext";
import { useContacts } from "@/contexts/ContactsContext";

import { DEFAULT_COVER, INDUSTRY_ROLES } from "@/lib/constants";

export interface PitchEntry {
  id: string;
  workspace_id: string;
  type: "track" | "playlist";
  itemName: string;
  artist: string;
  coverIdx: number;
  trackCount?: number;
  trackUuid?: string;
  playlistUuid?: string;
  /** When set, addPitch auto-creates a playlist from these track UUIDs before pitching it. */
  newPlaylistName?: string;
  newPlaylistTrackUuids?: string[];
  allowDownload?: boolean;
  allowSave?: boolean;
  downloadQuality?: "hi-res" | "low-res";
  watermarkEnabled?: boolean;
  linkType?: "public" | "secured";
  password?: string;
  recipientName: string;
  recipientCompany: string;
  recipientEmail: string;
  recipientRole?: string;
  recipientPhone?: string;
  date: string;
  status: string;
  notes: string;
}

interface SelectedItem {
  name: string;
  artist: string;
  coverIdx: number;
  coverImage?: string;
  trackCount?: number;
  trackUuid?: string;
  playlistUuid?: string;
}

interface CreatePitchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (pitch: PitchEntry) => void;
  initialPlaylistId?: string;
  initialRecipientName?: string;
  initialRecipientEmail?: string;
  initialRecipientCompany?: string;
}

export function CreatePitchModal({ open, onOpenChange, onCreate, initialPlaylistId, initialRecipientName, initialRecipientEmail, initialRecipientCompany }: CreatePitchModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"select" | "compose">("select");
  const [pitchType, setPitchType] = useState<"track" | "playlist">("track");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [playlistName, setPlaylistName] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [recipientName, setRecipientName] = useState(initialRecipientName || "");
  const [recipientCompany, setRecipientCompany] = useState(initialRecipientCompany || "");
  const [recipientEmail, setRecipientEmail] = useState(initialRecipientEmail || "");
  const [recipientRole, setRecipientRole] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [message, setMessage] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [allowSave, setAllowSave] = useState(true);
  const [downloadQuality, setDownloadQuality] = useState<"hi-res" | "low-res">("low-res");
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [linkType, setLinkType] = useState<"public" | "secured">("public");
  const [password, setPassword] = useState("");

  const { playlists } = usePlaylists();
  const { contacts } = useContacts();

  // Auto-select playlist when initialPlaylistId is provided
  useEffect(() => {
    if (open && initialPlaylistId && playlists.length > 0) {
      const pl = playlists.find((p) => p.id === initialPlaylistId);
      if (pl) {
        setPitchType("playlist");
        setSelectedItems([{
          name: pl.name,
          artist: "Various",
          coverIdx: pl.coverIdxs[0],
          coverImage: pl.coverImage,
          trackCount: pl.tracks,
          playlistUuid: pl.id,
        }]);
        setStep("compose");
      }
    }
  }, [open, initialPlaylistId, playlists]);

  // Pre-fill recipient when initial props are provided
  useEffect(() => {
    if (open) {
      if (initialRecipientName) setRecipientName(initialRecipientName);
      if (initialRecipientEmail) setRecipientEmail(initialRecipientEmail);
      if (initialRecipientCompany) setRecipientCompany(initialRecipientCompany);
    }
  }, [open, initialRecipientName, initialRecipientEmail, initialRecipientCompany]);

  // When the recipient name matches a DB contact, autofill the remaining fields.
  const handleNameChange = (val: string) => {
    setRecipientName(val);
    const q = val.trim().toLowerCase();
    if (!q) return;
    const match = contacts.find((c) => {
      const full = ((c.firstName || "") + " " + (c.lastName || "")).trim().toLowerCase();
      return full === q || (c.stageName && c.stageName.toLowerCase() === q);
    });
    if (match) {
      if (match.organization) setRecipientCompany(match.organization);
      if (match.email) setRecipientEmail(match.email);
      if (match.role) setRecipientRole(match.role);
      if (match.phone) setRecipientPhone(match.phone);
    }
  };

  const resetForm = () => {
    setStep("select");
    setPitchType("track");
    setSelectedItems([]);
    setPlaylistName("");
    setItemSearch("");
    setRecipientName("");
    setRecipientCompany("");
    setRecipientEmail("");
    setRecipientRole("");
    setRecipientPhone("");
    setMessage("");
    setAllowDownload(false);
    setAllowSave(true);
    setDownloadQuality("low-res");
    setWatermarkEnabled(true);
    setLinkType("public");
    setPassword("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const { tracks: allTracks } = useTrack();

  const filteredTracks = useMemo(() => {
    if (!itemSearch) return allTracks;
    const q = itemSearch.toLowerCase();
    return allTracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    );
  }, [itemSearch, allTracks]);

  const filteredPlaylists = useMemo(() => {
    if (!itemSearch) return playlists;
    const q = itemSearch.toLowerCase();
    return playlists.filter((p) => p.name.toLowerCase().includes(q));
  }, [itemSearch, playlists]);

  const isTrackSelected = (uuid?: string) => selectedItems.some((s) => s.trackUuid === uuid);

  const toggleTrack = (item: SelectedItem) => {
    setSelectedItems((prev) => {
      const exists = prev.some((s) => s.trackUuid === item.trackUuid);
      if (exists) return prev.filter((s) => s.trackUuid !== item.trackUuid);
      return [...prev, item];
    });
  };

  const selectPlaylist = (item: SelectedItem) => setSelectedItems([item]);

  const isMulti = pitchType === "track" && selectedItems.length >= 2;
  const canCompose = selectedItems.length > 0;
  const canSubmit =
    recipientName.trim().length > 0 &&
    recipientCompany.trim().length > 0 &&
    recipientEmail.trim().length > 0 &&
    (!isMulti || playlistName.trim().length > 0);

  const buildPitch = (status: "Draft" | "Sent"): PitchEntry => {
    const now = new Date();
    const primary = selectedItems[0];
    return {
      id: `pitch-${Date.now()}`,
      workspace_id: "", // Inherited from active workspace
      type: isMulti ? "playlist" : pitchType,
      itemName: isMulti ? playlistName.trim() : primary.name,
      artist: isMulti ? "Various" : primary.artist,
      coverIdx: isMulti ? 0 : primary.coverIdx,
      trackCount: isMulti ? selectedItems.length : primary.trackCount,
      trackUuid: isMulti ? undefined : primary.trackUuid,
      playlistUuid: isMulti ? undefined : primary.playlistUuid,
      newPlaylistName: isMulti ? playlistName.trim() : undefined,
      newPlaylistTrackUuids: isMulti
        ? (selectedItems.map((s) => s.trackUuid).filter(Boolean) as string[])
        : undefined,
      allowDownload,
      allowSave,
      downloadQuality: allowDownload ? downloadQuality : undefined,
      watermarkEnabled,
      linkType,
      password: linkType === "secured" ? password : undefined,
      recipientName: recipientName.trim(),
      recipientCompany: recipientCompany.trim(),
      recipientEmail: recipientEmail.trim(),
      recipientRole: recipientRole || undefined,
      recipientPhone: recipientPhone.trim() || undefined,
      date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      status,
      notes: message.trim(),
    };
  };

  const handleSaveDraft = () => {
    if (!canCompose || !canSubmit) return;
    onCreate(buildPitch("Draft"));
    handleOpenChange(false);
  };

  const handleSend = () => {
    if (!canCompose || !canSubmit) return;
    if (linkType === "secured" && !password.trim()) {
      alert(t("shareModal.passwordRequired"));
      return;
    }
    onCreate(buildPitch("Sent"));
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="md:max-w-2xl bg-card border-border p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg tracking-tight">{t("createPitchModal.title")}</DialogTitle>
            <DialogDescription className="text-muted-foreground/70 text-xs mt-1">
              {step === "select"
                ? t("createPitchModal.selectDesc")
                : t("createPitchModal.composeDesc")}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setStep("select")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                step === "select" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`w-5 h-5 rounded-full text-2xs flex items-center justify-center font-bold ${
                step === "select" ? "btn-brand" : "bg-primary/20 text-primary"
              }`}>
                {step === "compose" ? <Check className="w-3 h-3" /> : "1"}
              </span>
              {t("createPitchModal.select")}
            </button>
            <div className="w-6 h-px bg-border" />
            <button
              onClick={() => canCompose && setStep("compose")}
              disabled={!canCompose}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                step === "compose"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
              }`}
            >
              <span className={`w-5 h-5 rounded-full text-2xs flex items-center justify-center font-bold ${
                step === "compose" ? "btn-brand" : "bg-secondary text-muted-foreground"
              }`}>2</span>
              {t("createPitchModal.compose")}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <AnimatePresence mode="wait">
            {step === "select" ? (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
              >
                {/* Type toggle */}
                <div className="px-6 pt-4 pb-2 flex gap-2">
                  <button
                    onClick={() => { setPitchType("track"); setSelectedItems([]); setItemSearch(""); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                      pitchType === "track" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" /> {t("createPitchModal.tracks")}
                  </button>
                  <button
                    onClick={() => { setPitchType("playlist"); setSelectedItems([]); setItemSearch(""); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                      pitchType === "playlist" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <ListMusic className="w-3.5 h-3.5" /> {t("createPitchModal.playlists")}
                  </button>
                </div>

                {/* Selected indicator */}
                {selectedItems.length > 0 && (
                  <div className="px-6 pb-2">
                    {pitchType === "track" ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/6 border border-primary/15">
                        <div className="w-10 h-10 rounded-lg bg-primary/12 flex items-center justify-center shrink-0">
                          <Music className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-foreground truncate">
                            {t("pitch.tracksSelected", { count: selectedItems.length })}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {selectedItems.length >= 2 ? t("pitch.playlistCreated") : selectedItems[0].artist}
                          </p>
                        </div>
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/6 border border-primary/15">
                        <img src={selectedItems[0].coverImage || DEFAULT_COVER} alt="" className="w-10 h-10 rounded-lg object-cover ring-1 ring-primary/20" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-foreground truncate">{selectedItems[0].name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {selectedItems[0].artist}
                            {selectedItems[0].trackCount != null && (" · " + selectedItems[0].trackCount + " " + t("common.tracks"))}
                          </p>
                        </div>
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      </div>
                    )}
                  </div>
                )}

                {/* Search */}
                <div className="px-6 pb-2">
                  <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-3.5 py-2.5 border border-border/50 focus-within:border-primary/30 transition-colors">
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      placeholder={pitchType === "track" ? t("createPitchModal.searchTracks") : t("createPitchModal.searchPlaylists")}
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none w-full font-medium"
                    />
                    {itemSearch && (
                      <button onClick={() => setItemSearch("")} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Item list */}
                <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-0.5">
                  {pitchType === "track" ? (
                    filteredTracks.length === 0 ? (
                      <EmptyState text={t("createPitchModal.noMatching", { type: t("common.tracks") })} />
                    ) : (
                      filteredTracks.map((track) => (
                        <ItemRow
                          key={track.id}
                          name={track.title}
                          sub={track.artist}
                          extra={Array.isArray(track.genre) ? track.genre.join(", ") : track.genre}
                          coverIdx={track.coverIdx}
                          coverImage={track.coverImage}
                          icon={<Music className="w-3 h-3 text-primary/40" />}
                          selected={isTrackSelected(track.uuid)}
                          multi
                          onClick={() => toggleTrack({ name: track.title, artist: track.artist, coverIdx: track.coverIdx, coverImage: track.coverImage, trackUuid: track.uuid })}
                        />
                      ))
                    )
                  ) : filteredPlaylists.length === 0 ? (
                    <EmptyState text={t("createPitchModal.noMatching", { type: t("createPitchModal.playlists").toLowerCase() })} />
                  ) : (
                    filteredPlaylists.map((pl) => (
                      <ItemRow
                        key={pl.id}
                        name={pl.name}
                        sub={pl.tracks + " tracks · " + pl.duration}
                        coverIdx={pl.coverIdxs[0]}
                        coverImage={pl.coverImage}
                        icon={<ListMusic className="w-3 h-3 text-accent/40" />}
                        selected={selectedItems[0]?.playlistUuid === pl.id}
                        onClick={() =>
                          selectPlaylist({
                            name: pl.name,
                            artist: "Various",
                            coverIdx: pl.coverIdxs[0],
                            coverImage: pl.coverImage,
                            trackCount: pl.tracks,
                            playlistUuid: pl.id,
                          })
                        }
                      />
                    ))
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="compose"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="p-6 space-y-5"
              >
                {/* Multi-track → name the auto-created playlist */}
                {isMulti ? (
                  <div className="relative p-4 rounded-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-accent/6 to-brand-purple/8 rounded-xl" />
                    <div className="absolute inset-0 border border-primary/10 rounded-xl" />
                    <div className="relative space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ListMusic className="w-4 h-4 text-accent/70 shrink-0" />
                          <p className="text-sm font-bold text-foreground tracking-tight">{t("pitch.namePlaylist")}</p>
                        </div>
                        <button
                          onClick={() => setStep("select")}
                          className="text-2xs text-muted-foreground/50 hover:text-primary font-semibold transition-colors shrink-0"
                        >
                          {t("createPitchModal.change")}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        placeholder={t("pitch.namePlaylist")}
                        maxLength={100}
                        className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                        autoFocus
                      />
                      <div>
                        <p className="text-2xs text-muted-foreground/50 uppercase tracking-widest font-semibold mb-1.5">
                          {t("pitch.playlistCreated")} · {selectedItems.length}
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {selectedItems.map((it, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <img src={it.coverImage || DEFAULT_COVER} alt="" className="w-6 h-6 rounded object-cover ring-1 ring-border/40 shrink-0" />
                              <span className="text-xs text-foreground/80 truncate">{it.name}</span>
                              <span className="text-2xs text-muted-foreground/50 truncate">{it.artist}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : selectedItems[0] ? (
                  <div className="relative p-4 rounded-xl overflow-hidden">
                    {/* Gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-accent/6 to-brand-purple/8 rounded-xl" />
                    <div className="absolute inset-0 border border-primary/10 rounded-xl" />
                    <div className="relative flex items-center gap-4">
                      <img
                        src={selectedItems[0].coverImage || DEFAULT_COVER}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover ring-2 ring-primary/15 shadow-lg shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-2xs text-muted-foreground/50 uppercase tracking-widest font-semibold mb-1">
                          {pitchType === "playlist" ? t("createPitchModal.pitchingPlaylist") : t("createPitchModal.pitchingTrack")}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {pitchType === "playlist" ? (
                            <ListMusic className="w-4 h-4 text-accent/60 shrink-0" />
                          ) : (
                            <Music className="w-4 h-4 text-primary/60 shrink-0" />
                          )}
                          <p className="font-bold text-foreground text-[15px] tracking-tight truncate">
                            {selectedItems[0].name}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedItems[0].artist}
                          {selectedItems[0].trackCount != null && (
                            <span className="text-primary/60 font-semibold">{" · " + selectedItems[0].trackCount + " " + t("common.tracks")}</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => setStep("select")}
                        className="text-2xs text-muted-foreground/50 hover:text-primary font-semibold transition-colors shrink-0"
                      >
                        {t("createPitchModal.change")}
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Recipient fields */}
                <div className="space-y-4">
                  <p className="text-2xs text-muted-foreground/50 uppercase tracking-widest font-semibold">
                    {t("createPitchModal.recipientLabel")}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <User className="w-3 h-3" /> {t("createPitchModal.name")} <span className="text-destructive">*</span>
                      </label>
                      <NameAutocomplete
                        value={recipientName}
                        onChange={handleNameChange}
                        placeholder={t("createPitchModal.namePlaceholder")}
                        className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" /> {t("createPitchModal.companyLabel")} <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={recipientCompany}
                        onChange={(e) => setRecipientCompany(e.target.value)}
                        placeholder={t("createPitchModal.companyPlaceholder")}
                        maxLength={100}
                        className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <Mail className="w-3 h-3" /> {t("createPitchModal.emailLabel")} <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder={t("createPitchModal.emailPlaceholder")}
                      maxLength={255}
                      className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <Briefcase className="w-3 h-3" /> {t("pitch.recipientRole")}
                      </label>
                      <select
                        value={recipientRole}
                        onChange={(e) => setRecipientRole(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium"
                      >
                        <option value="">—</option>
                        {INDUSTRY_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <Phone className="w-3 h-3" /> {t("pitch.recipientPhone")}
                      </label>
                      <input
                        type="tel"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        maxLength={40}
                        className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                      />
                    </div>
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" /> {t("createPitchModal.messageLabel")}
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("createPitchModal.messagePlaceholder")}
                    rows={4}
                    maxLength={2000}
                    className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40 resize-none leading-relaxed"
                  />
                  <p className="text-2xs text-muted-foreground/40 text-right">{message.length}/2000</p>
                </div>

                {/* Link Type */}
                <div className="space-y-3">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block">{t("shareModal.linkType")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLinkType("public")}
                      className={"flex items-center justify-center gap-2 p-3 rounded-xl border text-center transition-all " + (
                        linkType === "public"
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-secondary"
                      )}
                    >
                      <Link2 className="w-4 h-4" />
                      <span className="text-xs font-semibold text-foreground">{t("shareModal.public")}</span>
                    </button>
                    <button
                      onClick={() => setLinkType("secured")}
                      className={"flex items-center justify-center gap-2 p-3 rounded-xl border text-center transition-all " + (
                        linkType === "secured"
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-secondary"
                      )}
                    >
                      <Lock className="w-4 h-4" />
                      <span className="text-xs font-semibold text-foreground">{t("shareModal.secured")}</span>
                    </button>
                  </div>
                  <AnimatePresence>
                    {linkType === "secured" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={t("shareModal.setPassword")}
                          maxLength={100}
                          className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40 mt-2"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Watermarking */}
                <div className="space-y-3">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block">{t("pitch.watermark")}</label>
                  <div className={"rounded-xl border transition-all " + (watermarkEnabled ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30") + " p-3.5"}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className={"w-4 h-4 " + (watermarkEnabled ? "text-primary" : "text-muted-foreground")} />
                        <div>
                          <p className="text-xs font-semibold text-foreground">{t("pitch.watermark")}</p>
                          <p className="text-[10px] text-muted-foreground">{t("pitch.watermarkDesc")}</p>
                        </div>
                      </div>
                      <Switch checked={watermarkEnabled} onCheckedChange={setWatermarkEnabled} />
                    </div>
                  </div>
                </div>

                {/* Download Permissions */}
                <div className="space-y-3">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block">{t("shareModal.downloadPermission")}</label>
                  <div className={`rounded-xl border transition-all ${allowDownload ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30"} p-3.5`}>
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
                              className={`p-2.5 rounded-lg border text-center transition-all ${
                                downloadQuality === "low-res"
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:bg-secondary"
                              }`}
                            >
                              <p className="text-xs font-semibold text-foreground">{t("shareModal.lowRes")}</p>
                              <p className="text-[10px] text-muted-foreground">{t("shareModal.lowResDesc")}</p>
                            </button>
                            <button
                              onClick={() => setDownloadQuality("hi-res")}
                              className={`p-2.5 rounded-lg border text-center transition-all ${
                                downloadQuality === "hi-res"
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:bg-secondary"
                              }`}
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

                {/* Save to Trakalog Permission */}
                <div className="space-y-3 mt-4">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block">Save Permission</label>
                  <div className={"rounded-xl border transition-all " + (allowSave ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30") + " p-3.5"}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Bookmark className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-xs font-semibold text-foreground">{allowSave ? "Save to Trakalog enabled" : "Save to Trakalog disabled"}</p>
                          <p className="text-[10px] text-muted-foreground">{allowSave ? "Recipients with a Trakalog account can save this track to their catalog" : "Recipients cannot save this track"}</p>
                        </div>
                      </div>
                      <Switch checked={allowSave} onCheckedChange={setAllowSave} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between gap-3 shrink-0 bg-card">
          <div className="text-xs text-muted-foreground/50">
            {step === "compose" && (
              <span className="flex items-center gap-1.5">
                {isMulti || pitchType === "playlist" ? <ListMusic className="w-3 h-3" /> : <Music className="w-3 h-3" />}
                {isMulti ? t("pitch.tracksSelected", { count: selectedItems.length }) : selectedItems[0]?.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === "compose" && (
              <button
                onClick={() => setStep("select")}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
              >
                {t("common.back")}
              </button>
            )}
            {step === "select" ? (
              <button
                onClick={() => setStep("compose")}
                disabled={!canCompose}
                className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-2"
              >
                {t("common.next")} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveDraft}
                  disabled={!canSubmit}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold border border-border bg-card text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {t("createPitchModal.saveDraft")}
                </button>
                <button
                  onClick={handleSend}
                  disabled={!canSubmit}
                  className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  {t("createPitchModal.sendPitch")}
                </button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Reusable Components ─── */

function ItemRow({
  name,
  sub,
  extra,
  coverIdx,
  coverImage,
  icon,
  selected,
  multi,
  onClick,
}: {
  name: string;
  sub: string;
  extra?: string;
  coverIdx: number;
  coverImage?: string;
  icon: React.ReactNode;
  selected: boolean;
  multi?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer group/item appearance-none bg-transparent border-0 text-left font-inherit ${
        selected ? "bg-primary/8 ring-1 ring-primary/20" : "hover:bg-secondary/50"
      }`}
      onClick={onClick}
    >
      <img src={coverImage || DEFAULT_COVER} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {icon}
          <p className="text-[13px] font-semibold text-foreground truncate tracking-tight">{name}</p>
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{sub}</p>
      </div>
      {extra && <span className="text-2xs text-muted-foreground/50 hidden sm:inline shrink-0">{extra}</span>}
      {multi ? (
        <div
          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
            selected ? "bg-primary border-primary" : "border-border opacity-0 group-hover/item:opacity-100"
          }`}
        >
          {selected && <Check className="w-3 h-3 text-white" />}
        </div>
      ) : (
        selected && <Check className="w-4 h-4 text-primary shrink-0" />
      )}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <Music className="w-8 h-8 mx-auto mb-3 text-muted-foreground/15" />
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  );
}
