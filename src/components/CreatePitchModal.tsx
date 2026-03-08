import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Music,
  ListMusic,
  Send,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { allTracks } from "@/pages/Catalog";
import { usePlaylists } from "@/contexts/PlaylistContext";

import cover1 from "@/assets/covers/cover-1.jpg";
import cover2 from "@/assets/covers/cover-2.jpg";
import cover3 from "@/assets/covers/cover-3.jpg";
import cover4 from "@/assets/covers/cover-4.jpg";
import cover5 from "@/assets/covers/cover-5.jpg";
import cover6 from "@/assets/covers/cover-6.jpg";

const covers = [cover1, cover2, cover3, cover4, cover5, cover6];

export interface PitchEntry {
  id: string;
  type: "track" | "playlist";
  itemName: string;
  artist: string;
  coverIdx: number;
  recipientName: string;
  recipientCompany: string;
  recipientEmail: string;
  date: string;
  status: string;
  notes: string;
}

interface CreatePitchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (pitch: PitchEntry) => void;
}

type Step = "item" | "recipient" | "review";

export function CreatePitchModal({ open, onOpenChange, onCreate }: CreatePitchModalProps) {
  const [step, setStep] = useState<Step>("item");
  const [pitchType, setPitchType] = useState<"track" | "playlist">("track");
  const [selectedItem, setSelectedItem] = useState<{ name: string; artist: string; coverIdx: number } | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientCompany, setRecipientCompany] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [sendNow, setSendNow] = useState(false);

  const { playlists } = usePlaylists();

  const resetForm = () => {
    setStep("item");
    setPitchType("track");
    setSelectedItem(null);
    setItemSearch("");
    setRecipientName("");
    setRecipientCompany("");
    setRecipientEmail("");
    setNotes("");
    setSendNow(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const filteredTracks = useMemo(() => {
    if (!itemSearch) return allTracks;
    const q = itemSearch.toLowerCase();
    return allTracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    );
  }, [itemSearch]);

  const filteredPlaylists = useMemo(() => {
    if (!itemSearch) return playlists;
    const q = itemSearch.toLowerCase();
    return playlists.filter((p) => p.name.toLowerCase().includes(q));
  }, [itemSearch, playlists]);

  const canProceedToRecipient = !!selectedItem;
  const canProceedToReview = recipientName.trim() && recipientCompany.trim() && recipientEmail.trim();

  const handleCreate = () => {
    if (!selectedItem) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const pitch: PitchEntry = {
      id: `pitch-${Date.now()}`,
      type: pitchType,
      itemName: selectedItem.name,
      artist: selectedItem.artist,
      coverIdx: selectedItem.coverIdx,
      recipientName: recipientName.trim(),
      recipientCompany: recipientCompany.trim(),
      recipientEmail: recipientEmail.trim(),
      date: dateStr,
      status: sendNow ? "Sent" : "Draft",
      notes: notes.trim(),
    };
    onCreate(pitch);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl bg-card border-border p-0 gap-0 max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg tracking-tight">Create Pitch</DialogTitle>
            <DialogDescription className="text-muted-foreground/70 text-xs mt-1">
              {step === "item" && "Select a track or playlist to pitch."}
              {step === "recipient" && "Enter the recipient's details."}
              {step === "review" && "Review and submit your pitch."}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {(["item", "recipient", "review"] as Step[]).map((s, i) => {
              const labels = ["Select Item", "Recipient", "Review"];
              const stepNum = i + 1;
              const isActive = step === s;
              const isPast =
                (s === "item" && (step === "recipient" || step === "review")) ||
                (s === "recipient" && step === "review");
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="w-5 h-px bg-border" />}
                  <button
                    onClick={() => {
                      if (s === "item") setStep("item");
                      if (s === "recipient" && canProceedToRecipient) setStep("recipient");
                      if (s === "review" && canProceedToRecipient && canProceedToReview) setStep("review");
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full text-2xs flex items-center justify-center font-bold ${
                      isActive ? "btn-brand" : isPast ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                    }`}>
                      {isPast ? <Check className="w-3 h-3" /> : stepNum}
                    </span>
                    <span className="hidden sm:inline">{labels[i]}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <AnimatePresence mode="wait">
            {step === "item" && (
              <motion.div
                key="item"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
              >
                {/* Type toggle */}
                <div className="px-6 pt-4 pb-2 flex gap-2">
                  <button
                    onClick={() => { setPitchType("track"); setSelectedItem(null); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                      pitchType === "track" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" /> Tracks
                  </button>
                  <button
                    onClick={() => { setPitchType("playlist"); setSelectedItem(null); }}
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
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-primary/8 border border-primary/15">
                      <img src={covers[selectedItem.coverIdx]} alt="" className="w-9 h-9 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-foreground truncate">{selectedItem.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{selectedItem.artist}</p>
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
                          coverIdx={track.coverIdx}
                          icon={<Music className="w-3 h-3 text-primary/40" />}
                          selected={selectedItem?.name === track.title}
                          onClick={() => setSelectedItem({ name: track.title, artist: track.artist, coverIdx: track.coverIdx })}
                        />
                      ))
                    )
                  ) : (
                    filteredPlaylists.length === 0 ? (
                      <EmptyState text="No matching playlists" />
                    ) : (
                      filteredPlaylists.map((pl) => (
                        <ItemRow
                          key={pl.id}
                          name={pl.name}
                          sub={`${pl.tracks} tracks`}
                          coverIdx={pl.coverIdxs[0]}
                          icon={<ListMusic className="w-3 h-3 text-accent/40" />}
                          selected={selectedItem?.name === pl.name}
                          onClick={() => setSelectedItem({ name: pl.name, artist: "Various", coverIdx: pl.coverIdxs[0] })}
                        />
                      ))
                    )
                  )}
                </div>
              </motion.div>
            )}

            {step === "recipient" && (
              <motion.div
                key="recipient"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="p-6 space-y-5"
              >
                <FormField label="Recipient Name" required>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Jamie Lin"
                    className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                    autoFocus
                  />
                </FormField>
                <FormField label="Company / Label" required>
                  <input
                    type="text"
                    value={recipientCompany}
                    onChange={(e) => setRecipientCompany(e.target.value)}
                    placeholder="e.g. Interscope Records"
                    className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                  />
                </FormField>
                <FormField label="Email" required>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="e.g. jamie@interscope.com"
                    className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                  />
                </FormField>
                <FormField label="Notes (optional)">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional context for this pitch…"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40 resize-none leading-relaxed"
                  />
                </FormField>
              </motion.div>
            )}

            {step === "review" && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="p-6 space-y-5"
              >
                {/* Pitch summary */}
                <div className="p-4 rounded-xl border border-border/50 bg-secondary/30 space-y-4">
                  <div className="flex items-center gap-3">
                    {selectedItem && (
                      <img src={covers[selectedItem.coverIdx]} alt="" className="w-14 h-14 rounded-xl object-cover ring-1 ring-border/50" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {pitchType === "playlist" ? <ListMusic className="w-3.5 h-3.5 text-accent/60" /> : <Music className="w-3.5 h-3.5 text-primary/50" />}
                        <p className="font-semibold text-foreground text-sm truncate">{selectedItem?.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedItem?.artist}</p>
                    </div>
                  </div>

                  <div className="h-px bg-border/50" />

                  <div className="grid grid-cols-2 gap-3">
                    <ReviewField label="Recipient" value={recipientName} />
                    <ReviewField label="Company" value={recipientCompany} />
                    <ReviewField label="Email" value={recipientEmail} />
                    <ReviewField label="Type" value={pitchType === "track" ? "Track" : "Playlist"} />
                  </div>

                  {notes && (
                    <>
                      <div className="h-px bg-border/50" />
                      <div>
                        <p className="text-2xs text-muted-foreground/50 uppercase tracking-widest font-semibold mb-1">Notes</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{notes}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Send now toggle */}
                <button
                  type="button"
                  onClick={() => setSendNow(!sendNow)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                    sendNow ? "border-primary/30 bg-primary/5" : "border-border/50 bg-secondary/30 hover:border-border"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    sendNow ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}>
                    {sendNow && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Send immediately</p>
                    <p className="text-2xs text-muted-foreground/60 mt-0.5">Otherwise it will be saved as a draft</p>
                  </div>
                  <Send className={`w-4 h-4 ml-auto transition-colors ${sendNow ? "text-primary" : "text-muted-foreground/30"}`} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between gap-3 shrink-0 bg-card">
          <div className="text-xs text-muted-foreground/50">
            {step === "review" && (
              <span>Status: {sendNow ? "Will be sent" : "Saved as draft"}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step !== "item" && (
              <button
                onClick={() => setStep(step === "review" ? "recipient" : "item")}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
              >
                Back
              </button>
            )}
            {step === "item" && (
              <button
                onClick={() => setStep("recipient")}
                disabled={!canProceedToRecipient}
                className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                Next: Recipient
              </button>
            )}
            {step === "recipient" && (
              <button
                onClick={() => setStep("review")}
                disabled={!canProceedToReview}
                className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                Next: Review
              </button>
            )}
            {step === "review" && (
              <button
                onClick={handleCreate}
                className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] flex items-center gap-2"
              >
                {sendNow ? <Send className="w-3.5 h-3.5" /> : null}
                {sendNow ? "Send Pitch" : "Save Draft"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Small Components ─── */

function ItemRow({
  name,
  sub,
  coverIdx,
  icon,
  selected,
  onClick,
}: {
  name: string;
  sub: string;
  coverIdx: number;
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
      <img src={covers[coverIdx]} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {icon}
          <p className="text-[13px] font-semibold text-foreground truncate tracking-tight">{name}</p>
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{sub}</p>
      </div>
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

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs text-muted-foreground/50 uppercase tracking-widest font-semibold">{label}</p>
      <p className="text-sm text-foreground font-medium mt-0.5 truncate">{value}</p>
    </div>
  );
}
