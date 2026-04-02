import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/components/PageShell";
import { useTrack, type TrackData } from "@/contexts/TrackContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { usePlaylists } from "@/contexts/PlaylistContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getCrossfadePlayer,
  destroyCrossfadePlayer,
  type CrossfadeTrack,
  type RadioState,
} from "@/lib/crossfadePlayer";
import { DEFAULT_COVER, GENRES, MOODS } from "@/lib/constants";
import { toast } from "sonner";
import {
  Radio,
  Shuffle,
  Music,
  Sparkles,
  Moon,
  Zap,
  Clock,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  ListPlus,
  ListMusic,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  GripVertical,
  Trash2,
  RotateCcw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  var m = Math.floor(seconds / 60);
  var s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" + s : String(s));
}

function mapTrackToCrossfade(track: TrackData): CrossfadeTrack {
  return {
    id: track.id,
    uuid: track.uuid,
    title: track.title,
    artist: track.artist,
    genre: track.genre,
    bpm: track.bpm,
    key: track.key,
    mood: track.mood,
    duration: track.duration,
    coverImage: track.coverImage,
    waveformData: track.waveformData,
    previewUrl: track.previewUrl,
    originalFileUrl: track.originalFileUrl,
  };
}

function shuffleArray<T>(arr: T[]): T[] {
  var copy = arr.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Inline styles for vinyl spin & equalizer
// ---------------------------------------------------------------------------

var vinylKeyframes = "@keyframes radio-vinyl-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
var eqKeyframes =
  "@keyframes radio-eq-bar1 { 0%,100% { height: 30%; } 50% { height: 100%; } }" +
  " @keyframes radio-eq-bar2 { 0%,100% { height: 60%; } 50% { height: 20%; } }" +
  " @keyframes radio-eq-bar3 { 0%,100% { height: 40%; } 50% { height: 80%; } }";

type RadioMode = "shuffle" | "genre" | "mood" | "energy" | "chill" | "recent" | null;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RadioPage() {
  var { t } = useTranslation();
  var navigate = useNavigate();
  var { user } = useAuth();
  var { tracks } = useTrack();
  var { pause } = useAudioPlayer();
  var { playlists } = usePlaylists();
  var { currentWorkspace } = useWorkspace();

  // State
  var [radioState, setRadioState] = useState<RadioState>({
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    shuffle: false,
    repeat: false,
    crossfadeDuration: 3,
  });
  var [mode, setMode] = useState<RadioMode>(null);
  var [genreFilter, setGenreFilter] = useState<string | null>(null);
  var [moodFilter, setMoodFilter] = useState<string | null>(null);
  var [queueOpen, setQueueOpen] = useState(false);
  var [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  var [crossfadeValue, setCrossfadeValue] = useState(3);
  var [genreDropdownOpen, setGenreDropdownOpen] = useState(false);
  var [moodDropdownOpen, setMoodDropdownOpen] = useState(false);
  var playerRef = useRef<ReturnType<typeof getCrossfadePlayer> | null>(null);
  var genreDropdownRef = useRef<HTMLDivElement>(null);
  var moodDropdownRef = useRef<HTMLDivElement>(null);

  // Click-outside handlers for custom dropdowns
  useEffect(function () {
    if (!genreDropdownOpen) return;
    var handler = function (e: MouseEvent) {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(e.target as Node)) setGenreDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return function () { document.removeEventListener("mousedown", handler); };
  }, [genreDropdownOpen]);

  useEffect(function () {
    if (!moodDropdownOpen) return;
    var handler = function (e: MouseEvent) {
      if (moodDropdownRef.current && !moodDropdownRef.current.contains(e.target as Node)) setMoodDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return function () { document.removeEventListener("mousedown", handler); };
  }, [moodDropdownOpen]);

  // -----------------------------------------------------------------------
  // Effect: mount / unmount crossfade player
  // -----------------------------------------------------------------------
  useEffect(function () {
    var player = getCrossfadePlayer();
    playerRef.current = player;
    var unsub = player.subscribe(function (s) {
      setRadioState({ ...s });
    });
    // Pause the global AudioPlayer so both don't play simultaneously
    pause();
    return function () {
      unsub();
      destroyCrossfadePlayer();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Build queue when mode or filters change
  // -----------------------------------------------------------------------
  var buildQueue = useCallback(
    function () {
      if (!mode || tracks.length === 0) return;

      var filtered: TrackData[] = [];

      if (mode === "shuffle") {
        filtered = shuffleArray(tracks);
      } else if (mode === "genre") {
        if (!genreFilter) return;
        filtered = shuffleArray(tracks.filter(function (tr) { return tr.genre === genreFilter; }));
      } else if (mode === "mood") {
        if (!moodFilter) return;
        filtered = shuffleArray(
          tracks.filter(function (tr) {
            return tr.mood && tr.mood.some(function (m) {
              return m.toLowerCase() === (moodFilter as string).toLowerCase();
            });
          })
        );
      } else if (mode === "energy") {
        filtered = shuffleArray(
          tracks.filter(function (tr) {
            var highBpm = tr.bpm > 110;
            var energyMood =
              tr.mood &&
              tr.mood.some(function (m) {
                var low = m.toLowerCase();
                return low === "energetic" || low === "hype" || low === "party" || low === "driving" || low === "euphoric";
              });
            return highBpm || energyMood;
          })
        );
      } else if (mode === "chill") {
        filtered = shuffleArray(
          tracks.filter(function (tr) {
            var lowBpm = tr.bpm > 0 && tr.bpm < 100;
            var chillMood =
              tr.mood &&
              tr.mood.some(function (m) {
                var low = m.toLowerCase();
                return low === "calm" || low === "chill" || low === "dreamy" || low === "meditative" || low === "smooth";
              });
            return lowBpm || chillMood;
          })
        );
      } else if (mode === "recent") {
        var thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        filtered = tracks
          .filter(function (tr) {
            if (!tr.createdAt) return false;
            return new Date(tr.createdAt) >= thirtyDaysAgo;
          })
          .sort(function (a, b) {
            return new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime();
          });
      }

      if (filtered.length === 0) {
        toast(t("radio.noTracks", "No tracks match this filter"));
        return;
      }

      var mapped = filtered.map(mapTrackToCrossfade);
      var player = playerRef.current;
      if (player) {
        player.setQueue(mapped);
        player.play(mapped[0], mapped);
      }
    },
    [mode, genreFilter, moodFilter, tracks, t]
  );

  useEffect(
    function () {
      buildQueue();
    },
    [buildQueue]
  );

  // -----------------------------------------------------------------------
  // Crossfade value sync
  // -----------------------------------------------------------------------
  useEffect(
    function () {
      var player = playerRef.current;
      if (player) {
        player.setCrossfadeDuration(crossfadeValue);
      }
    },
    [crossfadeValue]
  );

  // -----------------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------------
  var upcomingQueue = useMemo(function () {
    var player = playerRef.current;
    if (!player) return [];
    return player.getQueue().slice(0, 10);
  }, [radioState]); // eslint-disable-line react-hooks/exhaustive-deps

  var availableGenres = useMemo(function () {
    var set = new Set<string>();
    tracks.forEach(function (tr) {
      if (tr.genre) set.add(tr.genre);
    });
    return Array.from(set).sort();
  }, [tracks]);

  var availableMoods = useMemo(function () {
    var set = new Set<string>();
    tracks.forEach(function (tr) {
      if (tr.mood) {
        tr.mood.forEach(function (m) { set.add(m); });
      }
    });
    return Array.from(set).sort();
  }, [tracks]);

  // -----------------------------------------------------------------------
  // Track counts per mode (for card sub-labels)
  // -----------------------------------------------------------------------
  var modeCounts = useMemo(function () {
    var energy = tracks.filter(function (tr) {
      var highBpm = tr.bpm > 110;
      var energyMood = tr.mood && tr.mood.some(function (m) {
        var low = m.toLowerCase();
        return low === "energetic" || low === "hype" || low === "party" || low === "driving" || low === "euphoric";
      });
      return highBpm || energyMood;
    }).length;
    var chill = tracks.filter(function (tr) {
      var lowBpm = tr.bpm > 0 && tr.bpm < 100;
      var chillMood = tr.mood && tr.mood.some(function (m) {
        var low = m.toLowerCase();
        return low === "calm" || low === "chill" || low === "dreamy" || low === "meditative" || low === "smooth";
      });
      return lowBpm || chillMood;
    }).length;
    var thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    var recent = tracks.filter(function (tr) {
      if (!tr.createdAt) return false;
      return new Date(tr.createdAt) >= thirtyDaysAgo;
    }).length;
    return {
      shuffle: tracks.length,
      genre: availableGenres.length,
      mood: availableMoods.length,
      energy: energy,
      chill: chill,
      recent: recent,
    } as Record<string, number>;
  }, [tracks, availableGenres, availableMoods]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  function handleModeSelect(newMode: RadioMode) {
    if (newMode === mode) {
      // Deselect
      setMode(null);
      var player = playerRef.current;
      if (player) player.stop();
      return;
    }
    setMode(newMode);
    if (newMode !== "genre") setGenreFilter(null);
    if (newMode !== "mood") setMoodFilter(null);
  }

  function handleTogglePlay() {
    var player = playerRef.current;
    if (player) player.togglePlay();
  }

  function handleNext() {
    var player = playerRef.current;
    if (player) player.playNext();
  }

  function handlePrev() {
    var player = playerRef.current;
    if (player) player.playPrev();
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    var rect = e.currentTarget.getBoundingClientRect();
    var percent = ((e.clientX - rect.left) / rect.width) * 100;
    var player = playerRef.current;
    if (player) player.seek(percent);
  }

  function handleToggleShuffle() {
    var player = playerRef.current;
    if (player) player.setShuffle(!radioState.shuffle);
  }

  function handleToggleRepeat() {
    var player = playerRef.current;
    if (player) player.setRepeat(!radioState.repeat);
  }

  function handleRemoveFromQueue(index: number) {
    var player = playerRef.current;
    if (player) player.removeFromQueue(index);
  }

  function handleClearQueue() {
    var player = playerRef.current;
    if (player) player.clearQueue();
  }

  function handleShuffleQueue() {
    var player = playerRef.current;
    if (player) player.shuffleQueue();
  }

  async function handleAddToPlaylist(playlistId: string) {
    if (!radioState.currentTrack) return;
    try {
      var { error } = await supabase.rpc("add_playlist_tracks", {
        _user_id: user?.id || "",
        _playlist_id: playlistId,
        _track_ids: [radioState.currentTrack.id],
      });
      if (error) throw error;
      toast.success(t("radio.addedToPlaylist", "Added to playlist"));
      setAddToPlaylistOpen(false);
    } catch (err) {
      toast.error("Failed to add to playlist");
    }
  }

  // -----------------------------------------------------------------------
  // Mode card data
  // -----------------------------------------------------------------------
  var modeCards: { key: RadioMode; icon: React.ReactNode; label: string; gradient: string; iconColor: string; glowColor: string }[] = [
    { key: "shuffle", icon: <Shuffle className="w-5 h-5" />, label: t("radio.shuffleAll", "Shuffle All"), gradient: "from-brand-orange/15 to-brand-pink/15", iconColor: "text-brand-orange", glowColor: "rgba(255,140,50,0.3)" },
    { key: "genre", icon: <Music className="w-5 h-5" />, label: t("radio.byGenre", "By Genre"), gradient: "from-brand-purple/15 to-brand-pink/15", iconColor: "text-brand-purple", glowColor: "rgba(168,85,247,0.3)" },
    { key: "mood", icon: <Sparkles className="w-5 h-5" />, label: t("radio.byMood", "By Mood"), gradient: "from-brand-pink/15 to-brand-orange/15", iconColor: "text-brand-pink", glowColor: "rgba(236,72,153,0.3)" },
    { key: "energy", icon: <Zap className="w-5 h-5" />, label: t("radio.highEnergy", "High Energy"), gradient: "from-brand-orange/20 to-red-500/15", iconColor: "text-brand-orange", glowColor: "rgba(255,140,50,0.3)" },
    { key: "chill", icon: <Moon className="w-5 h-5" />, label: t("radio.chill", "Chill"), gradient: "from-brand-purple/15 to-blue-500/15", iconColor: "text-blue-400", glowColor: "rgba(96,165,250,0.3)" },
    { key: "recent", icon: <Clock className="w-5 h-5" />, label: t("radio.recentlyAdded", "Recently Added"), gradient: "from-emerald-500/15 to-teal-500/15", iconColor: "text-emerald-400", glowColor: "rgba(52,211,153,0.3)" },
  ];

  var coverSrc = (radioState.currentTrack && radioState.currentTrack.coverImage) || DEFAULT_COVER;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <PageShell>
      {/* Inject keyframes */}
      <style>{vinylKeyframes + " " + eqKeyframes}</style>

      <motion.div
        className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Radio className="w-7 h-7 text-brand-orange" />
            <span>{t("radio.title", "Trakalog Radio")}</span>
            {/* Equalizer bars */}
            {radioState.isPlaying && (
              <span className="flex items-end gap-[2px] h-5 ml-1">
                <span
                  className="w-[3px] bg-brand-orange rounded-full"
                  style={{ animation: "radio-eq-bar1 0.6s ease-in-out infinite" }}
                />
                <span
                  className="w-[3px] bg-brand-pink rounded-full"
                  style={{ animation: "radio-eq-bar2 0.5s ease-in-out infinite" }}
                />
                <span
                  className="w-[3px] bg-brand-purple rounded-full"
                  style={{ animation: "radio-eq-bar3 0.7s ease-in-out infinite" }}
                />
              </span>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("radio.subtitle", "Your personal catalog, on demand")}
          </p>
          {tracks.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="bg-secondary rounded-full px-3 py-1 text-xs text-muted-foreground">
                {tracks.length + " " + t("radio.tracksInCatalog", "tracks in catalog")}
              </span>
              <span className="bg-secondary rounded-full px-3 py-1 text-xs text-muted-foreground">
                {availableGenres.length + " " + t("radio.genresAvailable", "genres available")}
              </span>
              <span className="bg-secondary rounded-full px-3 py-1 text-xs text-muted-foreground">
                {availableMoods.length + " " + t("radio.moodsLabel", "moods")}
              </span>
            </div>
          )}
        </div>

        {/* Empty state */}
        {tracks.length === 0 && (
          <div className="card-premium p-10 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-pink/20 flex items-center justify-center mx-auto mb-4">
              <Radio className="w-10 h-10 text-brand-orange" />
            </div>
            <p className="text-muted-foreground text-sm">
              {t("radio.emptyCatalog", "Your catalog is empty! Upload some tracks to start your personal radio station.")}
            </p>
          </div>
        )}

        {/* Mode cards */}
        {tracks.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {modeCards.map(function (card) {
              var isActive = mode === card.key;
              return (
                <motion.button
                  key={card.key as string}
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ scale: 1.03, brightness: 1.1 }}
                  onClick={function () { handleModeSelect(card.key); }}
                  className={
                    "relative overflow-hidden rounded-xl border p-4 flex flex-col items-center gap-2 min-h-[100px] transition-all duration-200 bg-gradient-to-br " +
                    card.gradient + " " +
                    (isActive
                      ? "border-brand-orange/50 ring-2 ring-brand-orange/40"
                      : "border-border/50 hover:border-border hover:brightness-110 hover:ring-1 hover:ring-border/60")
                  }
                  style={isActive ? { boxShadow: "0 0 20px " + card.glowColor + ", 0 0 40px " + card.glowColor.replace("0.3", "0.1") } : undefined}
                >
                  <span className={card.iconColor}>
                    {card.icon}
                  </span>
                  <span className={"text-xs font-semibold " + (isActive ? "text-foreground" : "text-foreground/70")}>
                    {card.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    {(modeCounts[card.key as string] || 0) + " " + (card.key === "genre" ? t("radio.genresLabel", "genres") : card.key === "mood" ? t("radio.moodsLabel", "moods") : t("radio.tracksLabel", "tracks"))}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Genre dropdown */}
        {mode === "genre" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 w-full sm:w-64" ref={genreDropdownRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={function () { setGenreDropdownOpen(!genreDropdownOpen); }}
                  className={"flex items-center justify-between w-full h-10 px-3 rounded-xl bg-card text-[13px] font-medium transition-all " + (genreFilter ? "border-2 border-brand-orange/40 text-brand-orange" : "border border-border text-muted-foreground hover:border-brand-pink/20 hover:text-foreground")}
                >
                  <span className="truncate">{genreFilter || t("radio.selectGenre", "Select a genre...")}</span>
                  <ChevronDown className={"w-3.5 h-3.5 shrink-0 ml-2 transition-transform duration-200 " + (genreDropdownOpen ? "rotate-180" : "")} />
                </button>
                <AnimatePresence>
                  {genreDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute z-50 mt-1.5 w-full bg-card border border-border rounded-xl shadow-xl backdrop-blur-sm max-h-60 overflow-y-auto"
                    >
                      <div className="p-1">
                        {availableGenres.map(function (g) {
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={function () { setGenreFilter(g); setGenreDropdownOpen(false); }}
                              className={"w-full text-left px-4 py-2.5 rounded-lg text-[13px] transition-colors " + (genreFilter === g ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-foreground hover:bg-secondary/60")}
                            >
                              {g}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}

        {/* Mood dropdown */}
        {mode === "mood" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 w-full sm:w-64" ref={moodDropdownRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={function () { setMoodDropdownOpen(!moodDropdownOpen); }}
                  className={"flex items-center justify-between w-full h-10 px-3 rounded-xl bg-card text-[13px] font-medium transition-all " + (moodFilter ? "border-2 border-brand-orange/40 text-brand-orange" : "border border-border text-muted-foreground hover:border-brand-pink/20 hover:text-foreground")}
                >
                  <span className="truncate">{moodFilter || t("radio.selectMood", "Select a mood...")}</span>
                  <ChevronDown className={"w-3.5 h-3.5 shrink-0 ml-2 transition-transform duration-200 " + (moodDropdownOpen ? "rotate-180" : "")} />
                </button>
                <AnimatePresence>
                  {moodDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute z-50 mt-1.5 w-full bg-card border border-border rounded-xl shadow-xl backdrop-blur-sm max-h-60 overflow-y-auto"
                    >
                      <div className="p-1">
                        {availableMoods.map(function (m) {
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={function () { setMoodFilter(m); setMoodDropdownOpen(false); }}
                              className={"w-full text-left px-4 py-2.5 rounded-lg text-[13px] transition-colors " + (moodFilter === m ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-foreground hover:bg-secondary/60")}
                            >
                              {m}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}

        {/* Now Playing */}
        {radioState.currentTrack && (
          <motion.div
            className="card-premium p-6 sm:p-8"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* Vinyl cover art */}
              <div className="relative w-48 h-48 sm:w-64 sm:h-64 shrink-0">
                <div
                  className="w-full h-full rounded-full overflow-hidden border-4 border-border shadow-xl"
                  style={{
                    animation: "radio-vinyl-spin 8s linear infinite",
                    animationPlayState: radioState.isPlaying ? "running" : "paused",
                  }}
                >
                  <img
                    src={coverSrc}
                    alt={radioState.currentTrack.title}
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                {/* Center hole */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background border-2 border-border" />
              </div>

              {/* Track info + controls */}
              <div className="flex-1 min-w-0 text-center lg:text-left w-full">
                <h2 className="text-xl sm:text-2xl font-bold truncate">
                  {radioState.currentTrack.title}
                </h2>
                <p className="text-muted-foreground truncate">
                  {radioState.currentTrack.artist}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-3 justify-center lg:justify-start">
                  {radioState.currentTrack.genre && (
                    <span className="text-xs px-2 py-1 rounded-full bg-brand-orange/12 text-brand-orange">
                      {radioState.currentTrack.genre}
                    </span>
                  )}
                  {radioState.currentTrack.bpm > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-brand-pink/12 text-brand-pink">
                      {radioState.currentTrack.bpm + " BPM"}
                    </span>
                  )}
                  {radioState.currentTrack.key && (
                    <span className="text-xs px-2 py-1 rounded-full bg-brand-purple/12 text-brand-purple">
                      {radioState.currentTrack.key}
                    </span>
                  )}
                  {radioState.currentTrack.mood &&
                    radioState.currentTrack.mood.map(function (m) {
                      return (
                        <span
                          key={m}
                          className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground"
                        >
                          {m}
                        </span>
                      );
                    })}
                </div>

                {/* Progress bar */}
                <div
                  className="mt-6 cursor-pointer group"
                  onClick={handleSeek}
                >
                  <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-orange to-brand-pink transition-[width] duration-100"
                      style={{ width: radioState.progress + "%" }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>{formatTime(radioState.currentTime)}</span>
                    <span>{formatTime(radioState.duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4 mt-4">
                  <button
                    onClick={handleToggleShuffle}
                    className={
                      "p-2 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors " +
                      (radioState.shuffle ? "text-brand-orange" : "text-muted-foreground hover:text-foreground")
                    }
                    title={t("radio.shuffle")}
                  >
                    <Shuffle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handlePrev}
                    className="p-2 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title={t("radio.previous")}
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleTogglePlay}
                    className="btn-brand w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                    title={radioState.isPlaying ? t("radio.pause") : t("radio.play")}
                  >
                    {radioState.isPlaying ? (
                      <Pause className="w-6 h-6" />
                    ) : (
                      <Play className="w-6 h-6 ml-0.5" />
                    )}
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-2 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title={t("radio.next")}
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleToggleRepeat}
                    className={
                      "p-2 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors " +
                      (radioState.repeat ? "text-brand-orange" : "text-muted-foreground hover:text-foreground")
                    }
                    title={t("radio.repeat")}
                  >
                    <Repeat className="w-5 h-5" />
                  </button>
                </div>

                {/* Crossfade selector */}
                <div className="mt-4 flex items-center gap-3 justify-center text-xs">
                  <span className="text-muted-foreground">{t("radio.crossfade", "Crossfade")}</span>
                  {[0, 3, 5, 8].map(function (val) {
                    return (
                      <button
                        key={val}
                        onClick={function () { setCrossfadeValue(val); }}
                        className={
                          "px-3 py-1.5 rounded-full min-h-[32px] transition-colors " +
                          (crossfadeValue === val
                            ? "bg-brand-orange text-white"
                            : "border border-border text-muted-foreground hover:text-foreground")
                        }
                      >
                        {val === 0 ? t("radio.off", "Off") : val + "s"}
                      </button>
                    );
                  })}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-center gap-3 mt-4">
                  <div className="relative">
                    <button
                      onClick={function () { setAddToPlaylistOpen(!addToPlaylistOpen); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-sm min-h-[44px] transition-colors"
                    >
                      <ListPlus className="w-4 h-4" />
                      {t("radio.addToPlaylist", "Add to Playlist")}
                    </button>

                    {/* Playlist dropdown */}
                    <AnimatePresence>
                      {addToPlaylistOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute z-50 mt-2 w-64 card-premium p-2 shadow-xl left-1/2 -translate-x-1/2 max-h-64 overflow-y-auto"
                        >
                          {playlists.length === 0 && (
                            <p className="text-xs text-muted-foreground p-2">
                              {t("radio.noPlaylists", "No playlists yet")}
                            </p>
                          )}
                          {playlists.map(function (pl) {
                            return (
                              <button
                                key={pl.id}
                                onClick={function () { handleAddToPlaylist(pl.id); }}
                                className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors truncate min-h-[40px]"
                              >
                                {pl.name}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    onClick={function () {
                      if (radioState.currentTrack) {
                        navigate("/track/" + radioState.currentTrack.uuid);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-sm min-h-[44px] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t("radio.viewTrack", "View Track")}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Queue section */}
        {radioState.currentTrack && (
          <div className="card-premium overflow-hidden">
            <button
              onClick={function () { setQueueOpen(!queueOpen); }}
              className="w-full flex items-center justify-between p-4 min-h-[44px] hover:bg-muted/50 transition-colors"
            >
              <span className="font-semibold flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-muted-foreground" />
                {t("radio.upNext", "Up Next")}
                <span className="text-xs bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-full">
                  {upcomingQueue.length}
                </span>
              </span>
              {queueOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            <AnimatePresence>
              {queueOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-1">
                    {upcomingQueue.length === 0 && (
                      <p className="text-sm text-muted-foreground py-3 text-center">
                        {t("radio.queueEmpty", "Queue is empty")}
                      </p>
                    )}
                    {upcomingQueue.map(function (qTrack, idx) {
                      return (
                        <div
                          key={qTrack.id + "-" + idx}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab" />
                          <img
                            src={qTrack.coverImage || DEFAULT_COVER}
                            alt={qTrack.title}
                            className="w-10 h-10 rounded-lg ring-1 ring-border/50 object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{qTrack.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{qTrack.artist}</p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{qTrack.duration}</span>
                          <button
                            onClick={function () { handleRemoveFromQueue(idx); }}
                            className="p-1.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center shrink-0"
                            title={t("radio.remove")}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Queue actions */}
                  <div className="flex gap-2 px-4 pb-4">
                    <button
                      onClick={handleClearQueue}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-xs min-h-[40px] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t("radio.clearQueue", "Clear Queue")}
                    </button>
                    <button
                      onClick={handleShuffleQueue}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-xs min-h-[40px] transition-colors"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      {t("radio.shuffleQueue", "Shuffle Queue")}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </PageShell>
  );
}
