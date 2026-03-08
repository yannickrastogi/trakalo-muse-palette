import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pause,
  Shuffle,
  MoreHorizontal,
  Plus,
  Download,
  Share2,
  Edit3,
  Music,
  Clock,
  ChevronRight,
  Trash2,
  ListMusic,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { MiniWaveform } from "@/components/MiniWaveform";
import { useIsMobile } from "@/hooks/use-mobile";
import { playlistsData } from "./Playlists";

import cover1 from "@/assets/covers/cover-1.jpg";
import cover2 from "@/assets/covers/cover-2.jpg";
import cover3 from "@/assets/covers/cover-3.jpg";
import cover4 from "@/assets/covers/cover-4.jpg";
import cover5 from "@/assets/covers/cover-5.jpg";
import cover6 from "@/assets/covers/cover-6.jpg";

const covers = [cover1, cover2, cover3, cover4, cover5, cover6];

// Sample tracks belonging to playlists
const playlistTracks: Record<string, typeof sampleTracks> = {};

const sampleTracks = [
  { id: 1, title: "Velvet Hour", artist: "Kira Nomura", duration: "4:12", bpm: 92, key: "Ab Maj", genre: "Neo-Soul", coverIdx: 0 },
  { id: 2, title: "Ghost Protocol", artist: "Dex Moraes × JVNE", duration: "3:38", bpm: 128, key: "F# Min", genre: "Electronic", coverIdx: 1 },
  { id: 3, title: "Burning Chrome", artist: "Alina Voss", duration: "5:01", bpm: 118, key: "C Min", genre: "Synthwave", coverIdx: 2 },
  { id: 4, title: "Soft Landing", artist: "Marco Silva", duration: "6:44", bpm: 72, key: "D Maj", genre: "Ambient", coverIdx: 3 },
  { id: 5, title: "Paper Moons", artist: "Kira Nomura × AYA", duration: "3:22", bpm: 105, key: "Bb Maj", genre: "Indie Pop", coverIdx: 4 },
  { id: 6, title: "Static Bloom", artist: "JVNE", duration: "2:59", bpm: 140, key: "E Min", genre: "Glitch Hop", coverIdx: 5 },
  { id: 7, title: "Golden Frequency", artist: "Alina Voss × Marco", duration: "5:33", bpm: 124, key: "G Maj", genre: "House", coverIdx: 2 },
  { id: 8, title: "Daybreak", artist: "Kira Nomura", duration: "3:55", bpm: 88, key: "Eb Maj", genre: "Neo-Soul", coverIdx: 0 },
];

// Distribute tracks across playlists
playlistsData.forEach((pl) => {
  const count = Math.min(pl.tracks, sampleTracks.length);
  playlistTracks[pl.id] = sampleTracks.slice(0, count);
});

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };

export default function PlaylistDetail() {
  const { id } = useParams();
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const playlist = playlistsData.find((p) => p.id === id);
  const tracks = playlistTracks[id || ""] || [];

  if (!playlist) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <ListMusic className="w-12 h-12 text-muted-foreground/15 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Playlist not found</h2>
          <p className="text-sm text-muted-foreground mt-1">This playlist may have been removed.</p>
          <Link to="/playlists" className="mt-4 text-sm gradient-text font-semibold hover:opacity-80 transition-opacity">
            ← Back to Playlists
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]"
      >
        {/* Breadcrumb */}
        <motion.div variants={item} className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/playlists" className="hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Playlists
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium truncate">{playlist.name}</span>
        </motion.div>

        {/* Hero */}
        <motion.div variants={item} className="flex flex-col sm:flex-row gap-5 sm:gap-6">
          {/* Cover mosaic */}
          <div className="w-full sm:w-52 lg:w-60 shrink-0">
            <div
              className={`relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br ${playlist.color}`}
              style={{ boxShadow: "var(--shadow-elevated)" }}
            >
              <div className="grid grid-cols-2 gap-0.5 w-full h-full">
                {playlist.coverIdxs.slice(0, 4).map((ci, i) => (
                  <img
                    key={i}
                    src={covers[ci]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ))}
              </div>
              {/* Gradient overlay at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-accent/12 text-accent/80 mb-2">
                #{playlist.mood}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
                {playlist.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-lg">
                {playlist.description}
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Music className="w-3.5 h-3.5" />
                {playlist.tracks} tracks
              </span>
              <span className="w-px h-4 bg-border" />
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                {playlist.duration}
              </span>
              <span className="w-px h-4 bg-border hidden sm:block" />
              <span className="text-xs font-medium hidden sm:inline">
                Updated {playlist.updated}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => setPlayingTrackId(playingTrackId ? null : tracks[0]?.id || null)}
                className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px]"
              >
                {playingTrackId ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                {playingTrackId ? "Pause" : "Play All"}
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]">
                <Shuffle className="w-4 h-4" /> Shuffle
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]">
                <Plus className="w-4 h-4" /> Add Tracks
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px]">
                <Share2 className="w-4 h-4" />
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px]">
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Track list */}
        <motion.div variants={item}>
          {isMobile ? (
            /* Mobile: Card layout */
            <div className="space-y-2">
              {tracks.map((track, idx) => {
                const isPlaying = playingTrackId === track.id;
                return (
                  <div
                    key={track.id}
                    className="card-premium p-3.5 flex items-center gap-3"
                  >
                    <button
                      onClick={() => setPlayingTrackId(isPlaying ? null : track.id)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] transition-all ${
                        isPlaying ? "btn-brand shadow-none" : "bg-secondary"
                      }`}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 text-primary-foreground" />
                      ) : (
                        <Play className="w-4 h-4 text-muted-foreground ml-0.5" />
                      )}
                    </button>
                    <img
                      src={covers[track.coverIdx]}
                      alt={track.title}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground text-[13px] tracking-tight truncate">
                        {track.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {track.artist}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-2xs text-muted-foreground/60">
                          {track.genre}
                        </span>
                        <span className="text-2xs text-muted-foreground/40">
                          {track.bpm} BPM
                        </span>
                      </div>
                    </div>
                    <span className="text-2xs text-muted-foreground font-mono tabular-nums shrink-0">
                      {track.duration}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Desktop: Table layout */
            <div className="card-premium overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left pl-5 pr-2 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest w-8">
                        #
                      </th>
                      <th className="text-left px-2 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">
                        Track
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">
                        Genre
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">
                        BPM
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">
                        Key
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest w-20">
                        <Clock className="w-3 h-3 inline" />
                      </th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracks.map((track, idx) => {
                      const isPlaying = playingTrackId === track.id;
                      return (
                        <tr
                          key={track.id}
                          className="border-b border-border/40 last:border-0 hover:bg-secondary/25 transition-all duration-200 group/row cursor-pointer"
                        >
                          {/* # / Play */}
                          <td className="pl-5 pr-2 py-3">
                            <button
                              onClick={() => setPlayingTrackId(isPlaying ? null : track.id)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                isPlaying
                                  ? "btn-brand shadow-none"
                                  : "text-muted-foreground/40 group-hover/row:text-foreground"
                              }`}
                            >
                              {isPlaying ? (
                                <Pause className="w-3 h-3 text-primary-foreground" />
                              ) : (
                                <>
                                  <span className="group-hover/row:hidden text-2xs font-mono font-medium">
                                    {idx + 1}
                                  </span>
                                  <Play className="w-3 h-3 hidden group-hover/row:block" />
                                </>
                              )}
                            </button>
                          </td>

                          {/* Track info */}
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={covers[track.coverIdx]}
                                alt={track.title}
                                className="w-10 h-10 rounded-lg object-cover shrink-0 ring-1 ring-border/50"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground truncate text-[13px] tracking-tight leading-tight">
                                  {track.title}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                  {track.artist}
                                </p>
                              </div>
                              <div
                                className={`hidden md:flex items-center gap-2 transition-opacity duration-300 ${
                                  isPlaying
                                    ? "opacity-100"
                                    : "opacity-20 group-hover/row:opacity-50"
                                }`}
                              >
                                <MiniWaveform seed={track.id * 11 + 3} bars={18} />
                              </div>
                            </div>
                          </td>

                          {/* Genre */}
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {track.genre}
                            </span>
                          </td>

                          {/* BPM */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="font-mono text-2xs text-foreground/60 tabular-nums">
                              {track.bpm}
                            </span>
                          </td>

                          {/* Key */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-2xs font-semibold text-foreground/70">
                              <Music className="w-2.5 h-2.5 text-brand-orange/50" />
                              {track.key}
                            </span>
                          </td>

                          {/* Duration */}
                          <td className="px-4 py-3 text-right">
                            <span className="text-2xs text-muted-foreground font-mono tabular-nums">
                              {track.duration}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <button className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground opacity-0 group-hover/row:opacity-100">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground font-medium"
                style={{
                  borderTop: "1px solid transparent",
                  borderImage:
                    "linear-gradient(90deg, hsl(24 100% 55% / 0.1), hsl(330 80% 60% / 0.06), transparent) 1",
                }}
              >
                <span>
                  {tracks.length} tracks · {playlist.duration}
                </span>
                <span className="text-2xs text-muted-foreground/50">
                  TRAKALOG Playlist
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </PageShell>
  );
}
