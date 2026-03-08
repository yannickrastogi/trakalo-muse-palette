import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Plus,
  Music,
  Check,
  Trash2,
  GripVertical,
  ListMusic,
} from "lucide-react";
import { allTracks } from "@/pages/Catalog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import cover1 from "@/assets/covers/cover-1.jpg";
import cover2 from "@/assets/covers/cover-2.jpg";
import cover3 from "@/assets/covers/cover-3.jpg";
import cover4 from "@/assets/covers/cover-4.jpg";
import cover5 from "@/assets/covers/cover-5.jpg";
import cover6 from "@/assets/covers/cover-6.jpg";

const covers = [cover1, cover2, cover3, cover4, cover5, cover6];

type Track = (typeof allTracks)[number];

interface CreatePlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePlaylistModal({ open, onOpenChange }: CreatePlaylistModalProps) {
  const [step, setStep] = useState<"details" | "tracks">("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [trackSearch, setTrackSearch] = useState("");

  const resetForm = () => {
    setStep("details");
    setName("");
    setDescription("");
    setSelectedTracks([]);
    setTrackSearch("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const availableTracks = useMemo(() => {
    const selectedIds = new Set(selectedTracks.map((t) => t.id));
    let filtered = allTracks.filter((t) => !selectedIds.has(t.id));
    if (trackSearch) {
      const q = trackSearch.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [trackSearch, selectedTracks]);

  const addTrack = (track: Track) => {
    setSelectedTracks((prev) => [...prev, track]);
  };

  const removeTrack = (trackId: number) => {
    setSelectedTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  const canProceed = name.trim().length > 0;
  const canCreate = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl bg-card border-border p-0 gap-0 max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg tracking-tight">
              Create Playlist
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/70 text-xs mt-1">
              {step === "details"
                ? "Give your playlist a name and description."
                : `Add tracks from your catalog. ${selectedTracks.length} selected.`}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setStep("details")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                step === "details"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`w-5 h-5 rounded-full text-2xs flex items-center justify-center font-bold ${
                step === "details" ? "btn-brand" : "bg-secondary text-muted-foreground"
              }`}>
                {step === "tracks" && canProceed ? <Check className="w-3 h-3" /> : "1"}
              </span>
              Details
            </button>
            <div className="w-6 h-px bg-border" />
            <button
              onClick={() => canProceed && setStep("tracks")}
              disabled={!canProceed}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                step === "tracks"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
              }`}
            >
              <span className={`w-5 h-5 rounded-full text-2xs flex items-center justify-center font-bold ${
                step === "tracks" ? "btn-brand" : "bg-secondary text-muted-foreground"
              }`}>
                2
              </span>
              Tracks
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <AnimatePresence mode="wait">
            {step === "details" ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="p-6 space-y-5"
              >
                {/* Name */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Playlist Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Summer Vibes 2026"
                    className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's this playlist about?"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40 resize-none leading-relaxed"
                  />
                </div>

                {/* Preview */}
                {name.trim() && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl border border-border/50 bg-secondary/30"
                  >
                    <p className="text-2xs text-muted-foreground/60 uppercase tracking-widest font-semibold mb-2">
                      Preview
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                        <ListMusic className="w-5 h-5 text-primary/60" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{name}</p>
                        {description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>
                        )}
                        <p className="text-2xs text-muted-foreground/50 mt-0.5">0 tracks · Just now</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="tracks"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
              >
                {/* Selected tracks */}
                {selectedTracks.length > 0 && (
                  <div className="px-6 pt-4 pb-3 border-b border-border/50">
                    <p className="text-2xs text-muted-foreground/60 uppercase tracking-widest font-semibold mb-2">
                      Added · {selectedTracks.length}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTracks.map((track) => (
                        <motion.span
                          key={track.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-primary/8 border border-primary/15 text-xs font-medium text-foreground"
                        >
                          <img
                            src={covers[track.coverIdx]}
                            alt=""
                            className="w-5 h-5 rounded object-cover"
                          />
                          <span className="truncate max-w-[120px]">{track.title}</span>
                          <button
                            onClick={() => removeTrack(track.id)}
                            className="p-0.5 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </motion.span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search */}
                <div className="px-6 pt-3 pb-2">
                  <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-3.5 py-2.5 border border-border/50 focus-within:border-primary/30 transition-colors">
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      placeholder="Search by title, artist, or genre…"
                      value={trackSearch}
                      onChange={(e) => setTrackSearch(e.target.value)}
                      className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none w-full font-medium"
                    />
                    {trackSearch && (
                      <button
                        onClick={() => setTrackSearch("")}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Track list */}
                <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-0.5">
                  {availableTracks.length === 0 ? (
                    <div className="py-12 text-center">
                      <Music className="w-8 h-8 mx-auto mb-3 text-muted-foreground/15" />
                      <p className="text-sm font-medium text-muted-foreground">
                        {trackSearch ? "No matching tracks" : "All tracks added"}
                      </p>
                      <p className="text-xs text-muted-foreground/50 mt-1">
                        {trackSearch
                          ? "Try a different search term"
                          : "Your entire catalog is in this playlist"}
                      </p>
                    </div>
                  ) : (
                    availableTracks.map((track) => (
                      <motion.div
                        key={track.id}
                        layout
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 transition-all cursor-pointer group/track"
                        onClick={() => addTrack(track)}
                      >
                        <img
                          src={covers[track.coverIdx]}
                          alt={track.title}
                          className="w-10 h-10 rounded-lg object-cover shrink-0 ring-1 ring-border/50"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-foreground truncate tracking-tight">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {track.artist}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-2xs text-muted-foreground/50 hidden sm:inline">
                            {track.genre}
                          </span>
                          <span className="text-2xs text-muted-foreground/40 font-mono tabular-nums hidden sm:inline">
                            {track.bpm} BPM
                          </span>
                          <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center group-hover/track:bg-primary/15 transition-colors">
                            <Plus className="w-3.5 h-3.5 text-muted-foreground/50 group-hover/track:text-primary transition-colors" />
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between gap-3 shrink-0 bg-card">
          <div className="text-xs text-muted-foreground/50">
            {step === "tracks" && selectedTracks.length > 0 && (
              <span>{selectedTracks.length} track{selectedTracks.length !== 1 ? "s" : ""} selected</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === "tracks" && (
              <button
                onClick={() => setStep("details")}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
              >
                Back
              </button>
            )}
            {step === "details" ? (
              <button
                onClick={() => setStep("tracks")}
                disabled={!canProceed}
                className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                Next: Add Tracks
              </button>
            ) : (
              <button
                onClick={() => {
                  // In a real app, this would save to DB
                  handleOpenChange(false);
                }}
                disabled={!canCreate}
                className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                Create Playlist
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
