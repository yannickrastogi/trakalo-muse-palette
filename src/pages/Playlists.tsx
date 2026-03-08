import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ListMusic,
  Plus,
  Play,
  Pause,
  MoreHorizontal,
  Search,
  X,
  Clock,
  Music,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreatePlaylistModal } from "@/components/CreatePlaylistModal";
import { usePlaylists, covers } from "@/contexts/PlaylistContext";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

function MiniCoverGrid({ idxs, coverImage }: { idxs: number[]; coverImage?: string }) {
  if (coverImage) {
    return (
      <div className="w-full aspect-square rounded-xl overflow-hidden">
        <img src={coverImage} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-0.5 w-full aspect-square rounded-xl overflow-hidden">
      {idxs.slice(0, 4).map((ci, i) => (
        <img key={i} src={covers[ci]} alt="" className="w-full h-full object-cover" />
      ))}
    </div>
  );
}

export default function Playlists() {
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { playlists, addPlaylist } = usePlaylists();

  const filtered = useMemo(() => {
    if (!search) return playlists;
    const q = search.toLowerCase();
    return playlists.filter(
      (pl) =>
        pl.name.toLowerCase().includes(q) ||
        pl.mood.toLowerCase().includes(q) ||
        pl.description.toLowerCase().includes(q)
    );
  }, [search, playlists]);

  return (
    <PageShell>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-7 max-w-[1400px]"
      >
        {/* Header */}
        <motion.div
          variants={item}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Playlists
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              {playlists.length} curated collections ·{" "}
              {playlists.reduce((s, p) => s + p.tracks, 0)} total tracks
            </p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="btn-brand flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold shrink-0 self-start min-h-[44px]">
            <Plus className="w-4 h-4" /> Create Playlist
          </button>
        </motion.div>

        {/* Search */}
        <motion.div variants={item}>
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2.5 max-w-md border border-border/50 focus-brand transition-all">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search playlists by name, mood, or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Playlist Grid */}
        {filtered.length === 0 ? (
          <motion.div variants={item} className="card-premium py-20 text-center">
            <ListMusic className="w-10 h-10 mx-auto mb-4 text-muted-foreground/15" />
            <p className="text-sm font-semibold text-foreground">No playlists found</p>
            <p className="text-xs mt-1.5 text-muted-foreground/70">Try a different search term</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filtered.map((pl) => {
              const isPlaying = playingId === pl.id;
              return (
                <motion.div
                  key={pl.id}
                  variants={item}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="card-premium group cursor-pointer flex flex-col"
                  onClick={() => navigate(`/playlist/${pl.id}`)}
                >
                  {/* Cover art */}
                  <div className="relative p-4 pb-0">
                    <div className={`absolute inset-0 bg-gradient-to-br ${pl.color} opacity-60 group-hover:opacity-90 transition-opacity duration-500 rounded-t-[var(--radius)]`} />
                    <div className="relative w-full max-w-[200px] mx-auto">
                      <MiniCoverGrid idxs={pl.coverIdxs} coverImage={pl.coverImage} />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPlayingId(isPlaying ? null : pl.id); }}
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg min-h-[48px] min-w-[48px] ${
                            isPlaying ? "btn-brand scale-100" : "bg-foreground/80 backdrop-blur-sm scale-90 hover:scale-100"
                          }`}
                        >
                          {isPlaying ? <Pause className="w-5 h-5 text-primary-foreground" /> : <Play className="w-5 h-5 text-background ml-0.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 pt-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground text-sm tracking-tight leading-snug line-clamp-2">{pl.name}</h3>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center -mt-1 -mr-1"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed line-clamp-2">{pl.description}</p>
                    <div className="flex items-center gap-3 mt-3 text-muted-foreground">
                      <span className="flex items-center gap-1 text-2xs font-medium"><Music className="w-3 h-3" />{pl.tracks} tracks</span>
                      <span className="w-px h-3 bg-border" />
                      <span className="flex items-center gap-1 text-2xs font-medium"><Clock className="w-3 h-3" />{pl.duration}</span>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-3.5 border-t border-border/50 mt-3.5">
                      <span className="text-2xs text-muted-foreground/60 font-medium">Updated {pl.updated}</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-accent/12 text-accent/80">#{pl.mood}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
      <CreatePlaylistModal open={createOpen} onOpenChange={setCreateOpen} onCreate={addPlaylist} />
    </PageShell>
  );
}
