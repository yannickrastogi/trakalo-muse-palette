import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Play, Pause, Volume2, VolumeX, Music, AlertCircle, Clock, Disc3, Download, ListMusic } from "lucide-react";
import trakalogLogo from "@/assets/trakalog-logo.png";

interface SharedLinkData {
  id: string;
  share_type: string;
  track_id: string | null;
  playlist_id: string | null;
  link_name: string;
  link_slug: string;
  link_type: string;
  password_hash: string | null;
  message: string | null;
  allow_download: boolean;
  download_quality: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
}

interface TrackData {
  id: string;
  title: string;
  artist: string;
  featuring: string | null;
  genre: string | null;
  bpm: number | null;
  key: string | null;
  duration_sec: number | null;
  cover_url: string | null;
  audio_url: string | null;
  mood: string[] | null;
}

interface PlaylistData {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
}

function formatDuration(seconds: number): string {
  var m = Math.floor(seconds / 60);
  var s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

export default function SharedLinkPage() {
  var { slug } = useParams<{ slug: string }>();

  var [loading, setLoading] = useState(true);
  var [linkData, setLinkData] = useState<SharedLinkData | null>(null);
  var [trackData, setTrackData] = useState<TrackData | null>(null);
  var [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  var [playlistTracks, setPlaylistTracks] = useState<TrackData[]>([]);
  var [error, setError] = useState<string | null>(null);

  // Password state
  var [passwordInput, setPasswordInput] = useState("");
  var [passwordVerified, setPasswordVerified] = useState(false);
  var [passwordError, setPasswordError] = useState(false);

  // Audio player state — track the currently playing track id
  var audioRef = useRef<HTMLAudioElement | null>(null);
  var [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  var [currentTime, setCurrentTime] = useState(0);
  var [duration, setDuration] = useState(0);
  var [volume, setVolume] = useState(0.8);

  // Cache resolved audio URLs to avoid re-fetching
  var audioUrlCache = useRef<Record<string, string>>({});

  // Fetch link data
  useEffect(function() {
    if (!slug) {
      setError("Invalid link");
      setLoading(false);
      return;
    }

    async function fetchLink() {
      var { data, error: fetchErr } = await supabase
        .from("shared_links")
        .select("*")
        .eq("link_slug", slug!)
        .single();

      if (fetchErr || !data) {
        setError("This link does not exist or has been removed.");
        setLoading(false);
        return;
      }

      var link = data as unknown as SharedLinkData;

      if (link.status === "disabled") {
        setError("This link has been disabled.");
        setLoading(false);
        return;
      }

      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        setError("This link has expired.");
        setLoading(false);
        return;
      }

      if (link.status === "expired") {
        setError("This link has expired.");
        setLoading(false);
        return;
      }

      setLinkData(link);

      if (link.share_type === "playlist" && link.playlist_id) {
        // Fetch playlist metadata
        var { data: pl } = await supabase
          .from("playlists")
          .select("id, name, description, cover_url")
          .eq("id", link.playlist_id)
          .single();

        if (pl) {
          setPlaylistData(pl as unknown as PlaylistData);
        }

        // Fetch playlist tracks via playlist_tracks join
        var { data: ptRows } = await supabase
          .from("playlist_tracks")
          .select("track_id, position")
          .eq("playlist_id", link.playlist_id)
          .order("position", { ascending: true });

        if (ptRows && ptRows.length > 0) {
          var trackIds = ptRows.map(function(r) { return r.track_id; });
          var { data: tracks } = await supabase
            .from("tracks")
            .select("id, title, artist, featuring, genre, bpm, key, duration_sec, cover_url, audio_url, mood")
            .in("id", trackIds);

          if (tracks) {
            // Sort tracks by playlist position
            var trackMap: Record<string, TrackData> = {};
            tracks.forEach(function(t) { trackMap[t.id] = t as unknown as TrackData; });
            var sorted = trackIds
              .map(function(tid) { return trackMap[tid]; })
              .filter(function(t) { return !!t; });
            setPlaylistTracks(sorted);
          }
        }
      } else if (link.track_id) {
        // Single track
        var { data: track } = await supabase
          .from("tracks")
          .select("id, title, artist, featuring, genre, bpm, key, duration_sec, cover_url, audio_url, mood")
          .eq("id", link.track_id)
          .single();

        if (track) {
          setTrackData(track as unknown as TrackData);
        }
      }

      setLoading(false);
    }

    fetchLink();
  }, [slug]);

  // Setup audio element
  useEffect(function() {
    var audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    var onTimeUpdate = function() {
      setCurrentTime(audio.currentTime);
    };
    var onLoadedMetadata = function() {
      setDuration(audio.duration);
    };
    var onEnded = function() {
      setPlayingTrackId(null);
      setCurrentTime(0);
      setDuration(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return function() {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
    };
  }, []);

  var fetchAudioUrl = useCallback(async function(trackId: string): Promise<string | null> {
    if (audioUrlCache.current[trackId]) return audioUrlCache.current[trackId];
    try {
      var res = await fetch("https://xhmeitivkclbeziqavxw.supabase.co/functions/v1/get-audio-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug, track_id: trackId })
      });
      if (!res.ok) return null;
      var json = await res.json();
      if (json.url) {
        audioUrlCache.current[trackId] = json.url;
        return json.url;
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch audio URL:", err);
      return null;
    }
  }, [slug]);

  var handlePlayTrack = useCallback(function(track: TrackData) {
    var audio = audioRef.current;
    if (!audio) return;

    if (playingTrackId === track.id) {
      // Toggle pause/play
      if (audio.paused) {
        audio.play().catch(function(err) { console.error("Play error:", err); });
      } else {
        audio.pause();
      }
      if (!audio.paused) {
        setPlayingTrackId(track.id);
      } else {
        setPlayingTrackId(null);
      }
      return;
    }

    // New track — fetch signed URL from edge function
    setPlayingTrackId(track.id);
    setCurrentTime(0);
    setDuration(0);
    fetchAudioUrl(track.id).then(function(url) {
      if (!url) {
        console.error("No audio URL returned for track", track.id);
        setPlayingTrackId(null);
        return;
      }
      audio.src = url;
      audio.play().catch(function(err) { console.error("Play error:", err); });
    });
  }, [playingTrackId, fetchAudioUrl]);

  var handleSeek = useCallback(function(e: React.MouseEvent<HTMLDivElement>) {
    var audio = audioRef.current;
    if (!audio || !audio.duration) return;
    var rect = e.currentTarget.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  }, []);

  var handleVolume = useCallback(function(e: React.MouseEvent<HTMLDivElement>) {
    var rect = e.currentTarget.getBoundingClientRect();
    var vol = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audioRef.current) audioRef.current.volume = vol;
    setVolume(vol);
  }, []);

  var handlePasswordSubmit = function() {
    if (!linkData) return;
    if (passwordInput === linkData.password_hash) {
      setPasswordVerified(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  var progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  var needsPassword = linkData && linkData.link_type === "secured" && !passwordVerified;
  var isPlaylist = linkData?.share_type === "playlist";

  // Loading
  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </Shell>
    );
  }

  // Error
  if (error) {
    return (
      <Shell>
        <div className="text-center py-16 px-4">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Link Unavailable</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">{error}</p>
        </div>
      </Shell>
    );
  }

  // Password gate
  if (needsPassword) {
    return (
      <Shell>
        <div className="max-w-sm mx-auto text-center py-12 px-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Protected Link</h2>
          <p className="text-sm text-muted-foreground mt-1.5 mb-6">Enter the password to access this content.</p>
          <div className="space-y-3">
            <input
              type="password"
              value={passwordInput}
              onChange={function(e) { setPasswordInput(e.target.value); }}
              onKeyDown={function(e) { if (e.key === "Enter") handlePasswordSubmit(); }}
              placeholder="Password"
              className={"w-full h-11 px-4 rounded-xl bg-secondary border text-sm text-foreground outline-none transition-all " + (passwordError ? "border-destructive" : "border-border focus:border-primary/40")}
            />
            {passwordError && (
              <p className="text-xs text-destructive">Incorrect password. Please try again.</p>
            )}
            <button
              onClick={handlePasswordSubmit}
              className="w-full h-11 rounded-xl text-sm font-semibold btn-brand"
            >
              Access Content
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Playlist view ──
  if (isPlaylist && playlistData) {
    var totalDuration = playlistTracks.reduce(function(sum, t) { return sum + (t.duration_sec || 0); }, 0);
    return (
      <Shell>
        <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
          {linkData?.message && (
            <div className="px-4 py-3 rounded-xl bg-secondary/50 border border-border">
              <p className="text-sm text-muted-foreground italic">{linkData.message}</p>
            </div>
          )}

          {/* Playlist header */}
          <div className="rounded-2xl bg-card border border-border overflow-hidden" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <div className="flex items-start gap-5 p-6">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden shrink-0 bg-secondary border border-border/50">
                {playlistData.cover_url ? (
                  <img src={playlistData.cover_url} alt={playlistData.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-purple/10 via-transparent to-brand-orange/10">
                    <ListMusic className="w-12 h-12 text-foreground/15" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">Playlist</p>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-tight">
                  {playlistData.name}
                </h1>
                {playlistData.description && (
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{playlistData.description}</p>
                )}
                <div className="flex items-center gap-3 mt-3 text-muted-foreground">
                  <span className="flex items-center gap-1 text-xs font-medium">
                    <Music className="w-3.5 h-3.5" />
                    {playlistTracks.length + " tracks"}
                  </span>
                  {totalDuration > 0 && (
                    <>
                      <span className="w-px h-3.5 bg-border" />
                      <span className="flex items-center gap-1 text-xs font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(totalDuration)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Track list */}
            {playlistTracks.length > 0 && (
              <div className="border-t border-border">
                {playlistTracks.map(function(track, idx) {
                  var isActive = playingTrackId === track.id;
                  var isAudioPlaying = isActive && audioRef.current != null && !audioRef.current.paused;
                  return (
                    <div
                      key={track.id}
                      className={"flex items-center gap-3 px-6 py-3 border-b border-border/40 last:border-0 hover:bg-secondary/30 transition-colors " + (isActive ? "bg-primary/5" : "")}
                    >
                      {/* Play button / track number */}
                      <button
                        onClick={function() { handlePlayTrack(track); }}
                        className={"w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all " + (isAudioPlaying ? "btn-brand" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}
                        disabled={!track.audio_url && !slug}
                      >
                        {isAudioPlaying ? (
                          <Pause className="w-3.5 h-3.5 text-primary-foreground" />
                        ) : (
                          <span className="text-xs font-mono">{(track.audio_url || slug) ? "" : (idx + 1)}</span>
                        )}
                        {!isAudioPlaying && (track.audio_url || slug) && <Play className="w-3.5 h-3.5 ml-0.5" />}
                      </button>

                      {/* Cover */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary border border-border/50">
                        {track.cover_url ? (
                          <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Disc3 className="w-5 h-5 text-foreground/15" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className={"text-[13px] font-semibold truncate " + (isActive ? "text-primary" : "text-foreground")}>{track.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {track.artist}
                          {track.featuring ? " ft. " + track.featuring : ""}
                        </p>
                      </div>

                      {/* Duration */}
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0">
                        {track.duration_sec ? formatDuration(track.duration_sec) : "--:--"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Player bar for active track */}
            {playingTrackId && (
              <div className="border-t border-border px-6 py-4 space-y-3 bg-secondary/20">
                {/* Progress */}
                <div
                  className="h-1.5 bg-secondary rounded-full cursor-pointer group relative"
                  onClick={handleSeek}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-100 ease-linear"
                    style={{ width: progress + "%", background: "var(--gradient-brand-horizontal)" }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    style={{ left: "calc(" + progress + "% - 6px)" }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                    {formatDuration(currentTime)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={function() {
                        var newVol = volume === 0 ? 0.8 : 0;
                        if (audioRef.current) audioRef.current.volume = newVol;
                        setVolume(newVol);
                      }}
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <div
                      className="w-16 h-1.5 bg-secondary rounded-full cursor-pointer hidden sm:block"
                      onClick={handleVolume}
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-75"
                        style={{ width: (volume * 100) + "%" }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums ml-1">
                      {formatDuration(duration)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-[10px] text-muted-foreground/60">
            {"Shared via Trakalog on " + new Date(linkData?.created_at || "").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </Shell>
    );
  }

  // ── Single track view ──
  return (
    <Shell>
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
        {linkData?.message && (
          <div className="px-4 py-3 rounded-xl bg-secondary/50 border border-border">
            <p className="text-sm text-muted-foreground italic">{linkData.message}</p>
          </div>
        )}

        {trackData ? (
          <div className="rounded-2xl bg-card border border-border overflow-hidden" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <div className="flex items-start gap-5 p-6">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden shrink-0 bg-secondary border border-border/50">
                {trackData.cover_url ? (
                  <img src={trackData.cover_url} alt={trackData.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-purple/10 via-transparent to-brand-orange/10">
                    <Disc3 className="w-12 h-12 text-foreground/15" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
                  {linkData?.share_type === "stems" ? "Stems" : linkData?.share_type === "pack" ? "Pack" : "Track"}
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-tight truncate">
                  {trackData.title}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {trackData.artist}
                  {trackData.featuring ? " ft. " + trackData.featuring : ""}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {trackData.genre && (
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-muted-foreground">{trackData.genre}</span>
                  )}
                  {trackData.bpm && (
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-muted-foreground font-mono">{trackData.bpm + " BPM"}</span>
                  )}
                  {trackData.key && (
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-muted-foreground">{trackData.key}</span>
                  )}
                  {trackData.duration_sec && (
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-muted-foreground">
                      <Clock className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                      {formatDuration(trackData.duration_sec)}
                    </span>
                  )}
                </div>
                {trackData.mood && trackData.mood.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {trackData.mood.map(function(m) {
                      return (
                        <span key={m} className="px-2 py-0.5 rounded-md bg-primary/10 text-[10px] font-medium text-primary">{m}</span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Player */}
            {(trackData.audio_url || slug) && (
              <div className="border-t border-border px-6 py-4 space-y-3">
                <div
                  className="h-1.5 bg-secondary rounded-full cursor-pointer group relative"
                  onClick={handleSeek}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-100 ease-linear"
                    style={{ width: progress + "%", background: "var(--gradient-brand-horizontal)" }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    style={{ left: "calc(" + progress + "% - 6px)" }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                    {formatDuration(currentTime)}
                  </span>
                  <button
                    onClick={function() { handlePlayTrack(trackData!); }}
                    className="w-11 h-11 rounded-full btn-brand flex items-center justify-center"
                  >
                    {playingTrackId === trackData.id && audioRef.current && !audioRef.current.paused ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={function() {
                        var newVol = volume === 0 ? 0.8 : 0;
                        if (audioRef.current) audioRef.current.volume = newVol;
                        setVolume(newVol);
                      }}
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <div
                      className="w-16 h-1.5 bg-secondary rounded-full cursor-pointer hidden sm:block"
                      onClick={handleVolume}
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-75"
                        style={{ width: (volume * 100) + "%" }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums ml-1">
                      {formatDuration(duration)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {linkData?.allow_download && (trackData.audio_url || slug) && (
              <div className="border-t border-border px-6 py-4">
                <button
                  onClick={function() {
                    fetchAudioUrl(trackData!.id).then(function(url) {
                      if (!url) return;
                      var a = document.createElement("a");
                      a.href = url;
                      a.download = trackData!.title + " - " + trackData!.artist;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border border-border bg-card text-foreground hover:bg-secondary transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {"Download " + (linkData.download_quality === "hi-res" ? "(Hi-Res)" : "(Low-Res)")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <Music className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{linkData?.link_name || "Shared Content"}</h2>
            <p className="text-sm text-muted-foreground mt-1.5">No track data available.</p>
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground/60">
          {"Shared via Trakalog on " + new Date(linkData?.created_at || "").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-center">
          <img src={trakalogLogo} alt="Trakalog" className="h-6 opacity-80" />
        </div>
      </header>
      {children}
    </div>
  );
}
