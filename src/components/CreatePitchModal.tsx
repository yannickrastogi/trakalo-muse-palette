import { useState, useMemo, useEffect, useRef } from "react";
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
  Link2,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useTrack } from "@/contexts/TrackContext";
import { usePlaylists } from "@/contexts/PlaylistContext";
import { getSavedContacts, saveContact, type SavedContact } from "@/hooks/use-saved-contacts";

import { DEFAULT_COVER } from "@/lib/constants";

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
  allowDownload?: boolean;
  downloadQuality?: "hi-res" | "low-res";
  linkType?: "public" | "secured";
  password?: string;
  recipientName: string;
  recipientCompany: string;
  recipientEmail: string;
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
}

export function CreatePitchModal({ open, onOpenChange, onCreate, initialPlaylistId }: CreatePitchModalProps) {
  const [step, setStep] = useState<"select" | "compose">("select");
  const [pitchType, setPitchType] = useState<"track" | "playlist">("track");
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientCompany, setRecipientCompany] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [downloadQuality, setDownloadQuality] = useState<"hi-res" | "low-res">("low-res");
  const [linkType, setLinkType] = useState<"public" | "secured">("public");
  const [password, setPassword] = useState("");
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { playlists } = usePlaylists();

  // Auto-select playlist when initialPlaylistId is provided
  useEffect(() => {
    if (open && initialPlaylistId && playlists.length > 0) {
      const pl = playlists.find((p) => p.id === initialPlaylistId);
      if (pl) {
        setPitchType("playlist");
        setSelectedItem({
          name: pl.name,
          artist: "Various",
          coverIdx: pl.coverIdxs[0],
          coverImage: pl.coverImage,
          trackCount: pl.tracks,
          playlistUuid: pl.id,
        });
        setStep("compose");
      }
    }
  }, [open, initialPlaylistId, playlists]);

  const savedContacts = useMemo(() => getSavedContacts(), [open]);

  const filteredContacts = useMemo(() => {
    if (!contactQuery) return savedContacts.slice(0, 5);
    const q = contactQuery.toLowerCase();
    return savedContacts
      .filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.company.toLowerCase().includes(q))
      .slice(0, 5);
  }, [contactQuery, savedContacts]);

  const selectContact = (contact: SavedContact) => {
    setRecipientName(contact.name);
    setRecipientCompany(contact.company);
    setRecipientEmail(contact.email);
    setShowContactSuggestions(false);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowContactSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const resetForm = () => {
    setStep("select");
    setPitchType("track");
    setSelectedItem(null);
    setItemSearch("");
    setRecipientName("");
    setRecipientCompany("");
    setRecipientEmail("");
    setMessage("");
    setAllowDownload(false);
    setDownloadQuality("low-res");
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

  const canCompose = !!selectedItem;
  const canSubmit = recipientName.trim().length > 0 && recipientCompany.trim().length > 0 && recipientEmail.trim().length > 0;

  const buildPitch = (status: "Draft" | "Sent"): PitchEntry => {
    const now = new Date();
    return {
      id: `pitch-${Date.now()}`,
      workspace_id: "", // Inherited from active workspace
      type: pitchType,
      itemName: selectedItem!.name,
      artist: selectedItem!.artist,
      coverIdx: selectedItem!.coverIdx,
      trackCount: selectedItem!.trackCount,
      trackUuid: selectedItem!.trackUuid,
      playlistUuid: selectedItem!.playlistUuid,
      allowDownload,
      downloadQuality: allowDownload ? downloadQuality : undefined,
      linkType,
      password: linkType === "secured" ? password : undefined,
      recipientName: recipientName.trim(),
      recipientCompany: recipientCompany.trim(),
      recipientEmail: recipientEmail.trim(),
      date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      status,
      notes: message.trim(),
    };
  };

  const persistContact = () => {
    if (recipientName.trim() && recipientEmail.trim()) {
      saveContact({
        name: recipientName.trim(),
        company: recipientCompany.trim(),
        email: recipientEmail.trim(),
      });
    }
  };

  const handleSaveDraft = () => {
    if (!selectedItem || !canSubmit) return;
    persistContact();
    onCreate(buildPitch("Draft"));
    handleOpenChange(false);
  };

  const handleSend = () => {
    if (!selectedItem || !canSubmit) return;
    if (linkType === "secured" && !password.trim()) {
      alert("Please enter a password for the secured link.");
      return;
    }
    persistContact();
    onCreate(buildPitch("Sent"));
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="md:max-w-2xl bg-card border-border p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg tracking-tight">Create Pitch</DialogTitle>
            <DialogDescription className="text-muted-foreground/70 text-xs mt-1">
              {step === "select"
                ? "Choose a track or playlist to pitch."
                : "Fill in recipient details and your message."}
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
              Select
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
              Compose
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
                    onClick={() => { setPitchType("track"); setSelectedItem(null); setItemSearch(""); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                      pitchType === "track" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" /> Tracks
                  </button>
                  <button
                    onClick={() => { setPitchType("playlist"); setSelectedItem(null); setItemSearch(""); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                      pitchType === "playlist" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <ListMusic className="w-3.5 h-3.5" /> Playlists
                  </button>
                </div>

                {/* Selected indicator */}
                {selectedItem && (
                  <div className="px-6 pb-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/6 border border-primary/15">
                      <img src={selectedItem.coverImage || DEFAULT_COVER} alt="" className="w-10 h-10 rounded-lg object-cover ring-1 ring-primary/20" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-foreground truncate">{selectedItem.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {selectedItem.artist}
                          {selectedItem.trackCount != null && ` · ${selectedItem.trackCount} tracks`}
                        </p>
                      </div>
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    </div>
                  </div>
                )}

                {/* Search */}
                <div className="px-6 pb-2">
                  <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-3.5 py-2.5 border border-border/50 focus-within:border-primary/30 transition-colors">
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      placeholder={`Search ${pitchType === "track" ? "tracks" : "playlists"}…`}
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
                      <EmptyState text="No matching tracks" />
                    ) : (
                      filteredTracks.map((track) => (
                        <ItemRow
                          key={track.id}
                          name={track.title}
                          sub={track.artist}
                          extra={track.genre}
                          coverIdx={track.coverIdx}
                          coverImage={track.coverImage}
                          icon={<Music className="w-3 h-3 text-primary/40" />}
                          selected={selectedItem?.name === track.title}
                          onClick={() => setSelectedItem({ name: track.title, artist: track.artist, coverIdx: track.coverIdx, coverImage: track.coverImage, trackUuid: track.uuid })}
                        />
                      ))
                    )
                  ) : filteredPlaylists.length === 0 ? (
                    <EmptyState text="No matching playlists" />
                  ) : (
                    filteredPlaylists.map((pl) => (
                      <ItemRow
                        key={pl.id}
                        name={pl.name}
                        sub={pl.tracks + " tracks \u00B7 " + pl.duration}
                        coverIdx={pl.coverIdxs[0]}
                        coverImage={pl.coverImage}
                        icon={<ListMusic className="w-3 h-3 text-accent/40" />}
                        selected={selectedItem?.name === pl.name}
                        onClick={() =>
                          setSelectedItem({
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
                {/* Pitched item card — always visible */}
                {selectedItem && (
                  <div className="relative p-4 rounded-xl overflow-hidden">
                    {/* Gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-accent/6 to-brand-purple/8 rounded-xl" />
                    <div className="absolute inset-0 border border-primary/10 rounded-xl" />
                    <div className="relative flex items-center gap-4">
                      <img
                        src={selectedItem.coverImage || DEFAULT_COVER}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover ring-2 ring-primary/15 shadow-lg shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-2xs text-muted-foreground/50 uppercase tracking-widest font-semibold mb-1">
                          Pitching {pitchType === "playlist" ? "Playlist" : "Track"}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {pitchType === "playlist" ? (
                            <ListMusic className="w-4 h-4 text-accent/60 shrink-0" />
                          ) : (
                            <Music className="w-4 h-4 text-primary/60 shrink-0" />
                          )}
                          <p className="font-bold text-foreground text-[15px] tracking-tight truncate">
                            {selectedItem.name}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedItem.artist}
                          {selectedItem.trackCount != null && (
                            <span className="text-primary/60 font-semibold"> · {selectedItem.trackCount} tracks</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => setStep("select")}
                        className="text-2xs text-muted-foreground/50 hover:text-primary font-semibold transition-colors shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                )}

                {/* Recipient fields */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs text-muted-foreground/50 uppercase tracking-widest font-semibold">
                      Recipient
                    </p>
                    {savedContacts.length > 0 && (
                      <div className="relative" ref={suggestionsRef}>
                        <button
                          type="button"
                          onClick={() => setShowContactSuggestions((v) => !v)}
                          className="text-2xs text-primary/70 hover:text-primary font-semibold transition-colors flex items-center gap-1"
                        >
                          <User className="w-3 h-3" />
                          Saved contacts ({savedContacts.length})
                        </button>
                        {showContactSuggestions && (
                          <div className="absolute right-0 top-full mt-1.5 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                            <div className="p-2 border-b border-border/50">
                              <input
                                type="text"
                                value={contactQuery}
                                onChange={(e) => setContactQuery(e.target.value)}
                                placeholder="Search contacts…"
                                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border/50 text-xs text-foreground outline-none focus:border-primary/30 placeholder:text-muted-foreground/40"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {filteredContacts.length === 0 ? (
                                <p className="text-xs text-muted-foreground/50 text-center py-4">No contacts found</p>
                              ) : (
                                filteredContacts.map((c, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => selectContact(c)}
                                    className="w-full text-left px-3 py-2.5 hover:bg-secondary/70 transition-colors flex items-center gap-3 group"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                      <User className="w-3.5 h-3.5 text-primary/60" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                                      <p className="text-2xs text-muted-foreground truncate">{c.company} · {c.email}</p>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <User className="w-3 h-3" /> Name <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="e.g. Jamie Lin"
                        maxLength={100}
                        className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" /> Company / Label <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={recipientCompany}
                        onChange={(e) => setRecipientCompany(e.target.value)}
                        placeholder="e.g. Interscope Records"
                        maxLength={100}
                        className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <Mail className="w-3 h-3" /> Email <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="e.g. jamie@interscope.com"
                      maxLength={255}
                      className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                    />
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" /> Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write a personal note to go with your pitch…"
                    rows={4}
                    maxLength={2000}
                    className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40 resize-none leading-relaxed"
                  />
                  <p className="text-2xs text-muted-foreground/40 text-right">{message.length}/2000</p>
                </div>

                {/* Link Type */}
                <div className="space-y-3">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block">Link Type</label>
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
                      <span className="text-xs font-semibold text-foreground">Public</span>
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
                      <span className="text-xs font-semibold text-foreground">Secured</span>
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
                          placeholder="Enter a password…"
                          maxLength={100}
                          className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40 mt-2"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Download Permissions */}
                <div className="space-y-3">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block">Download Permission</label>
                  <div className={`rounded-xl border transition-all ${allowDownload ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30"} p-3.5`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {allowDownload ? (
                          <Download className="w-4 h-4 text-primary" />
                        ) : (
                          <ShieldOff className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-xs font-semibold text-foreground">{allowDownload ? "Download Enabled" : "Download Disabled"}</p>
                          <p className="text-[10px] text-muted-foreground">{allowDownload ? "Recipient can download files" : "Recipient can only view & play"}</p>
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
                              <p className="text-xs font-semibold text-foreground">Low-Res</p>
                              <p className="text-[10px] text-muted-foreground">Compressed MP3</p>
                            </button>
                            <button
                              onClick={() => setDownloadQuality("hi-res")}
                              className={`p-2.5 rounded-lg border text-center transition-all ${
                                downloadQuality === "hi-res"
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:bg-secondary"
                              }`}
                            >
                              <p className="text-xs font-semibold text-foreground">Hi-Res</p>
                              <p className="text-[10px] text-muted-foreground">Original WAV/FLAC</p>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between gap-3 shrink-0 bg-card">
          <div className="text-xs text-muted-foreground/50">
            {step === "compose" && selectedItem && (
              <span className="flex items-center gap-1.5">
                {pitchType === "playlist" ? <ListMusic className="w-3 h-3" /> : <Music className="w-3 h-3" />}
                {selectedItem.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === "compose" && (
              <button
                onClick={() => setStep("select")}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
              >
                Back
              </button>
            )}
            {step === "select" ? (
              <button
                onClick={() => setStep("compose")}
                disabled={!canCompose}
                className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-2"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveDraft}
                  disabled={!canSubmit}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold border border-border bg-card text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Save Draft
                </button>
                <button
                  onClick={handleSend}
                  disabled={!canSubmit}
                  className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Pitch
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
  onClick,
}: {
  name: string;
  sub: string;
  extra?: string;
  coverIdx: number;
  coverImage?: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer group/item ${
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
      {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
    </div>
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
