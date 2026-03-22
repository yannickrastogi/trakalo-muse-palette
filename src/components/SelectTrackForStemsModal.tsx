import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Music, ChevronRight } from "lucide-react";
import { useTrack } from "@/contexts/TrackContext";
import { useNavigate } from "react-router-dom";

import { DEFAULT_COVER } from "@/lib/constants";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SelectTrackForStemsModal({ open, onClose }: Props) {
  const { tracks } = useTrack();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q)
    );
  }, [tracks, search]);

  const handleSelect = (trackUuid: string) => {
    onClose();
    setSearch("");
    navigate(`/track/${trackUuid}?tab=stems&upload=true`);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full md:max-w-lg bg-card border border-border rounded-t-2xl md:rounded-2xl overflow-hidden max-h-[95dvh]"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Select a Track</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose which track to upload stems to
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-border/50">
              <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2.5 border border-border/50 focus-within:border-primary/30 transition-all">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, artist, or genre…"
                  className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
                  autoFocus
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Track list */}
            <div className="max-h-[360px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Music className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">No tracks found</p>
                </div>
              ) : (
                <div className="py-1">
                  {filtered.map((track) => {
                    const coverSrc = track.coverImage || DEFAULT_COVER;
                    const stemCount = track.stems.length;
                    return (
                      <button
                        key={track.id}
                        onClick={() => handleSelect(track.uuid)}
                        className="w-full flex items-center gap-3 px-6 py-3 hover:bg-secondary/60 transition-colors text-left group"
                      >
                        <img
                          src={coverSrc}
                          alt={track.title}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{track.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {track.artist} · {track.genre}
                            {stemCount > 0 && (
                              <span className="ml-1.5 text-primary/70">· {stemCount} stem{stemCount !== 1 ? "s" : ""}</span>
                            )}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground/60 transition-colors shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
