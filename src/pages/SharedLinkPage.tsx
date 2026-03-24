import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { Lock, Play, Pause, Volume2, VolumeX, Music, AlertCircle, Clock, Disc3, Download, ListMusic, SkipBack, SkipForward, User, Send, X, ChevronDown, ChevronUp, FileText, Package, Loader2 } from "lucide-react";
import { DEFAULT_COVER } from "@/lib/constants";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
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
  pack_items: string[] | null;
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
  waveform_data: number[] | null;
  lyrics: string | null;
  lyrics_segments: { start: number; end: number; text: string }[] | null;
}

interface PlaylistData {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
}

interface TrackComment {
  id: string;
  track_id: string;
  shared_link_id: string | null;
  author_name: string;
  author_email: string | null;
  author_type: string;
  timestamp_sec: number;
  content: string;
  created_at: string;
}

function formatDuration(seconds: number): string {
  var m = Math.floor(seconds / 60);
  var s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function WaveformBar({ peaks, progress, onSeek, onDoubleClick }: { peaks: number[]; progress: number; onSeek: (e: React.MouseEvent<HTMLDivElement>) => void; onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void }) {
  var barCount = peaks.length;
  return (
    <div
      className="w-full cursor-pointer flex items-end gap-[1px]"
      style={{ height: 48 }}
      onClick={onSeek}
      onDoubleClick={onDoubleClick}
    >
      {peaks.map(function(peak, i) {
        var pct = (i / barCount) * 100;
        var active = pct < progress;
        return (
          <div
            key={i}
            className="rounded-sm flex-shrink-0"
            style={{
              width: 2,
              height: Math.max(2, peak * 48),
              background: active ? "#f97316" : "rgba(255,255,255,0.15)",
            }}
          />
        );
      })}
    </div>
  );
}

function CommentMarkers({ comments, totalDuration }: { comments: TrackComment[]; totalDuration: number }) {
  if (!totalDuration || comments.length === 0) return null;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ height: 48 }}>
      {comments.map(function(c) {
        var left = Math.min(100, (c.timestamp_sec / totalDuration) * 100);
        return (
          <div
            key={c.id}
            className="absolute top-0 bottom-0 group/marker pointer-events-auto"
            style={{ left: left + "%" }}
          >
            <div className="w-px h-full bg-brand-pink/40" />
            <div className="absolute -bottom-1 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-brand-pink border-2 border-card cursor-pointer hover:scale-150 transition-transform" />
            <div className="absolute bottom-4 -translate-x-1/2 hidden group-hover/marker:block z-50">
              <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-[11px] whitespace-nowrap max-w-[200px]">
                <p className="font-semibold text-foreground truncate">{c.author_name}</p>
                <p className="text-muted-foreground">{formatDuration(c.timestamp_sec)}</p>
                <p className="text-foreground/80 truncate mt-0.5">{c.content}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KaraokeLyrics({ segments, currentTime, isPlaying, onSeek, className }: {
  segments: { start: number; end: number; text: string }[];
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  className?: string;
}) {
  var [expanded, setExpanded] = useState(true);
  var containerRef = useRef<HTMLDivElement>(null);
  var activeLineRef = useRef<HTMLDivElement>(null);

  var activeSegmentIndex = useMemo(function() {
    if (!isPlaying) return -1;
    for (var i = segments.length - 1; i >= 0; i--) {
      if (currentTime >= segments[i].start && currentTime < segments[i].end) return i;
    }
    return -1;
  }, [isPlaying, currentTime, segments]);

  useEffect(function() {
    if (activeSegmentIndex >= 0 && activeLineRef.current && containerRef.current) {
      var container = containerRef.current;
      var activeLine = activeLineRef.current;
      var containerRect = container.getBoundingClientRect();
      var lineRect = activeLine.getBoundingClientRect();
      var offset = lineRect.top - containerRect.top - containerRect.height / 3;
      container.scrollBy({ top: offset, behavior: "smooth" });
    }
  }, [activeSegmentIndex]);

  return (
    <div className={className}>
      <button
        onClick={function() { setExpanded(!expanded); }}
        className="w-full flex items-center justify-between py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Lyrics
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div
          ref={containerRef}
          className="max-h-[400px] overflow-y-auto space-y-1 pb-4 scroll-smooth"
        >
          {segments.map(function(seg, i) {
            var isActive = isPlaying && currentTime >= seg.start && currentTime < seg.end;
            var isPast = isPlaying && !isActive && currentTime >= seg.end;
            var isFuture = !isPlaying || (!isActive && !isPast);
            return (
              <div
                key={i}
                ref={isActive ? activeLineRef : undefined}
                onClick={function() { onSeek(seg.start); }}
                className={
                  "py-1.5 px-2 rounded-md cursor-pointer text-sm leading-relaxed transition-all duration-300 " +
                  (isActive
                    ? "bg-brand-orange/10 font-semibold scale-[1.02] origin-left"
                    : "hover:bg-secondary/50") +
                  (isPast ? " text-foreground" : "") +
                  (isFuture && !isActive ? " text-muted-foreground" : "")
                }
              >
                {isActive ? (
                  <span className="bg-gradient-to-r from-brand-purple via-brand-pink to-brand-orange bg-clip-text text-transparent drop-shadow-[0_0_8px_hsl(var(--brand-orange)/0.4)]">
                    {seg.text}
                  </span>
                ) : (
                  seg.text
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Anon-only client: never picks up a stored user session, so RLS anon policies always apply
var anonSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export default function SharedLinkPage() {
  var { slug } = useParams<{ slug: string }>();

  var [loading, setLoading] = useState(true);
  var [linkData, setLinkData] = useState<SharedLinkData | null>(null);
  var [trackData, setTrackData] = useState<TrackData | null>(null);
  var [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  var [playlistTracks, setPlaylistTracks] = useState<TrackData[]>([]);
  var [error, setError] = useState<string | null>(null);

  // Gate state
  var [gateCompleted, setGateCompleted] = useState(false);
  var [visitorName, setVisitorName] = useState("");
  var [visitorEmail, setVisitorEmail] = useState("");
  var visitorEmailRef = useRef("");
  var [visitorRole, setVisitorRole] = useState("");
  var [visitorCompany, setVisitorCompany] = useState("");
  var [gateError, setGateError] = useState("");

  // Password state
  var [passwordInput, setPasswordInput] = useState("");
  var [passwordVerified, setPasswordVerified] = useState(false);
  var [passwordError, setPasswordError] = useState(false);

  // Audio player state
  var audioRef = useRef<HTMLAudioElement | null>(null);
  var loadedTrackIdRef = useRef<string | null>(null);
  var [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  var [isPlaying, setIsPlaying] = useState(false);
  var [currentTime, setCurrentTime] = useState(0);
  var [duration, setDuration] = useState(0);
  var [volume, setVolume] = useState(0.8);

  // Comments
  var [comments, setComments] = useState<TrackComment[]>([]);
  var [commentComposerOpen, setCommentComposerOpen] = useState(false);
  var [commentTimestamp, setCommentTimestamp] = useState(0);
  var [commentText, setCommentText] = useState("");
  var [submittingComment, setSubmittingComment] = useState(false);
  var commentInputRef = useRef<HTMLInputElement>(null);

  // Pack download state
  var [packDownloading, setPackDownloading] = useState(false);

  // Cache resolved audio URLs to avoid re-fetching
  var audioUrlCache = useRef<Record<string, string>>({});

  // Refs for access from onEnded callback (avoids stale closures)
  var playlistTracksRef = useRef<TrackData[]>([]);
  var loadAndPlayTrackRef = useRef<(track: TrackData) => void>(function() {});

  useEffect(function() { playlistTracksRef.current = playlistTracks; }, [playlistTracks]);

  // Fetch link data
  useEffect(function() {
    if (!slug) {
      setError("Invalid link");
      setLoading(false);
      return;
    }

    async function fetchLink() {
      var { data, error: fetchErr } = await anonSupabase
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

      if (link.status === "revoked") {
        setError("This link has been revoked.");
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
        var { data: pl } = await anonSupabase
          .from("playlists")
          .select("id, name, description, cover_url")
          .eq("id", link.playlist_id)
          .single();

        if (pl) {
          setPlaylistData(pl as unknown as PlaylistData);
        }

        // Fetch playlist tracks via playlist_tracks join
        var { data: ptRows } = await anonSupabase
          .from("playlist_tracks")
          .select("track_id, position")
          .eq("playlist_id", link.playlist_id)
          .order("position", { ascending: true });

        if (ptRows && ptRows.length > 0) {
          var trackIds = ptRows.map(function(r) { return r.track_id; });
          var { data: tracks } = await anonSupabase
            .from("tracks")
            .select("id, title, artist, featuring, genre, bpm, key, duration_sec, cover_url, audio_url, mood, waveform_data, lyrics, lyrics_segments")
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
        var { data: track } = await anonSupabase
          .from("tracks")
          .select("id, title, artist, featuring, genre, bpm, key, duration_sec, cover_url, audio_url, mood, waveform_data, lyrics, lyrics_segments")
          .eq("id", link.track_id)
          .single();

        if (track) {
          setTrackData(track as unknown as TrackData);
        }
      }

      setLoading(false);
    }

    fetchLink().catch(function() {
      setError("Failed to load this link. Please try again.");
      setLoading(false);
    });
  }, [slug]);

  // Setup audio element (single instance for lifetime of page)
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
      setIsPlaying(false);
      // Auto-play next track in playlist
      var tracks = playlistTracksRef.current;
      var currentId = loadedTrackIdRef.current;
      if (tracks.length > 0 && currentId) {
        var idx = tracks.findIndex(function(t) { return t.id === currentId; });
        if (idx >= 0 && idx < tracks.length - 1) {
          loadAndPlayTrackRef.current(tracks[idx + 1]);
          return;
        }
      }
      setCurrentTime(0);
      setDuration(0);
    };
    var onPlay = function() { setIsPlaying(true); };
    var onPause = function() { setIsPlaying(false); };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return function() {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.pause();
      audio.src = "";
    };
  }, []);

  var fetchAudioUrl = useCallback(async function(trackId: string, quality?: string): Promise<string | null> {
    var cacheKey = trackId + ":" + (quality || "original");
    if (audioUrlCache.current[cacheKey]) return audioUrlCache.current[cacheKey];
    try {
      var res = await fetch("https://xhmeitivkclbeziqavxw.supabase.co/functions/v1/get-audio-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik",
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik"
        },
        body: JSON.stringify({ slug: slug, track_id: trackId, quality: quality || "original" })
      });
      if (!res.ok) return null;
      var json = await res.json();
      if (json.url) {
        audioUrlCache.current[cacheKey] = json.url;
        return json.url;
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch audio URL:", err);
      return null;
    }
  }, [slug]);

  // Load a new track into the audio element and play it
  var loadAndPlayTrack = useCallback(function(track: TrackData) {
    var audio = audioRef.current;
    if (!audio) return;
    loadedTrackIdRef.current = track.id;
    setPlayingTrackId(track.id);
    setCurrentTime(0);
    setDuration(0);
    fetchAudioUrl(track.id, "preview").then(function(url) {
      if (!url) {
        console.error("No audio URL returned for track", track.id);
        loadedTrackIdRef.current = null;
        setPlayingTrackId(null);
        return;
      }
      audio.src = url;
      audio.play().catch(function(err) { console.error("Play error:", err); });
    }).catch(function (err) { console.error("Error:", err); });
  }, [fetchAudioUrl]);

  // Keep ref in sync so onEnded can call it without stale closure
  useEffect(function() { loadAndPlayTrackRef.current = loadAndPlayTrack; }, [loadAndPlayTrack]);

  // Toggle pause/resume on same track, or load+play a different track
  var handlePlayTrack = useCallback(function(track: TrackData) {
    var audio = audioRef.current;
    if (!audio) return;

    if (loadedTrackIdRef.current === track.id) {
      if (audio.paused) {
        audio.play().catch(function(err) { console.error("Play error:", err); });
      } else {
        audio.pause();
      }
      return;
    }

    loadAndPlayTrack(track);
    logEvent(track.id, "play");
  }, [loadAndPlayTrack]);

  var handleNextTrack = useCallback(function() {
    if (playlistTracks.length === 0 || !playingTrackId) return;
    var idx = playlistTracks.findIndex(function(t) { return t.id === playingTrackId; });
    if (idx >= 0 && idx < playlistTracks.length - 1) {
      loadAndPlayTrack(playlistTracks[idx + 1]);
    }
  }, [playlistTracks, playingTrackId, loadAndPlayTrack]);

  var handlePrevTrack = useCallback(function() {
    var audio = audioRef.current;
    if (!audio || playlistTracks.length === 0 || !playingTrackId) return;
    // If more than 3s in, restart current track
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    var idx = playlistTracks.findIndex(function(t) { return t.id === playingTrackId; });
    if (idx > 0) {
      loadAndPlayTrack(playlistTracks[idx - 1]);
    } else {
      audio.currentTime = 0;
    }
  }, [playlistTracks, playingTrackId, loadAndPlayTrack]);

  var handleSeek = useCallback(function(e: React.MouseEvent<HTMLDivElement>) {
    var audio = audioRef.current;
    if (!audio || !audio.duration) return;
    var rect = e.currentTarget.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  }, []);

  var handleVolumeChange = useCallback(function(e: React.ChangeEvent<HTMLInputElement>) {
    var vol = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.volume = vol;
    setVolume(vol);
  }, []);

  var handlePasswordSubmit = async function() {
    if (!linkData) return;
    try {
      var res = await fetch("https://xhmeitivkclbeziqavxw.supabase.co/functions/v1/verify-link-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik",
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik"
        },
        body: JSON.stringify({ slug: linkData.link_slug, password: passwordInput })
      });
      var json = await res.json();
      if (json.valid) {
        setPasswordVerified(true);
        setPasswordError(false);
      } else {
        setPasswordError(true);
      }
    } catch (err) {
      console.error("Password verification error:", err);
      setPasswordError(true);
    }
  };

  var handleGateSubmit = function() {
    if (!visitorName.trim()) {
      setGateError("Please enter your name.");
      return;
    }
    if (!visitorEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail.trim())) {
      setGateError("Please enter a valid email address.");
      return;
    }
    setGateError("");
    setGateCompleted(true);
    visitorEmailRef.current = visitorEmail;

    fetch("https://xhmeitivkclbeziqavxw.supabase.co/functions/v1/log-link-access", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik" },
      body: JSON.stringify({ slug: slug, name: visitorName.trim(), email: visitorEmail.trim(), role: visitorRole.trim(), company: visitorCompany.trim() }),
    }).catch(function(err) { console.error("Failed to log access:", err); });

    // Log view event
    logEvent(null, "view");
  };

  var logEvent = function(trackId: string | null, eventType: string) {
    fetch("https://xhmeitivkclbeziqavxw.supabase.co/functions/v1/log-link-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik",
      },
      body: JSON.stringify({ slug: slug, track_id: trackId, visitor_email: visitorEmailRef.current, event_type: eventType }),
    }).catch(function(err) { console.error("Failed to log event:", err); });
  };

  // Fetch comments for the current track
  var fetchComments = useCallback(function(trackId: string, linkId: string) {
    anonSupabase
      .from("track_comments")
      .select("*")
      .eq("track_id", trackId)
      .eq("shared_link_id", linkId)
      .order("timestamp_sec", { ascending: true })
      .then(function(res) {
        if (res.data) setComments(res.data as TrackComment[]);
      }).catch(function (err) { console.error("Error:", err); });
  }, []);

  // Fetch comments when gate is completed and track data is available
  useEffect(function() {
    if (!gateCompleted || !linkData) return;
    var tId = trackData?.id || (playingTrackId || null);
    if (tId) fetchComments(tId, linkData.id);
  }, [gateCompleted, linkData, trackData, playingTrackId, fetchComments]);

  var handleWaveformDoubleClick = useCallback(function(e: React.MouseEvent<HTMLDivElement>) {
    var audio = audioRef.current;
    if (!audio || !audio.duration) return;
    var rect = e.currentTarget.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    var seconds = pct * audio.duration;
    audio.currentTime = seconds;
    setCommentTimestamp(seconds);
    setCommentComposerOpen(true);
    setCommentText("");
    setTimeout(function() { commentInputRef.current?.focus(); }, 50);
  }, []);

  var handleSubmitComment = useCallback(function() {
    var tId = trackData?.id || playingTrackId;
    if (!tId || !linkData || !commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    anonSupabase
      .from("track_comments")
      .insert({
        track_id: tId,
        shared_link_id: linkData.id,
        author_name: visitorName || "Anonymous",
        author_email: visitorEmailRef.current || null,
        author_type: "guest_recipient",
        timestamp_sec: Math.round(commentTimestamp * 100) / 100,
        content: commentText.trim(),
      })
      .select()
      .single()
      .then(function(res) {
        setSubmittingComment(false);
        if (res.data) {
          setComments(function(prev) { return prev.concat([res.data as TrackComment]); });
          setCommentComposerOpen(false);
          setCommentText("");
        }
      }).catch(function (err) { console.error("Error:", err); });
  }, [trackData, playingTrackId, linkData, commentText, commentTimestamp, submittingComment, visitorName]);

  var handleDownloadPack = useCallback(async function() {
    if (!linkData || !trackData || packDownloading) return;
    var items = linkData.pack_items;
    if (!items || items.length === 0) return;
    setPackDownloading(true);
    logEvent(trackData.id, "download");

    try {
      var zip = new JSZip();
      var folderName = trackData.title + " - " + trackData.artist + " - Trakalog Pack";
      var root = zip.folder(folderName)!;

      // Track — real audio file
      if (items.indexOf("track") >= 0) {
        var audioUrl = await fetchAudioUrl(trackData.id, "original");
        if (audioUrl) {
          var audioBytes = await fetch(audioUrl).then(function(r) { return r.arrayBuffer(); });
          var ext = trackData.audio_url && trackData.audio_url.match(/\.\w+$/)?.[0] || ".mp3";
          root.folder("Track")!.file(trackData.title + ext, audioBytes);
        }
      }

      // Cover Art
      if (items.indexOf("cover") >= 0) {
        var coverUrl = trackData.cover_url || DEFAULT_COVER;
        var coverBytes = await fetch(coverUrl).then(function(r) { return r.arrayBuffer(); });
        var coverExt = trackData.cover_url ? (trackData.cover_url.match(/\.(jpe?g|png|webp)$/i)?.[0] || ".jpg") : ".png";
        root.folder("Cover Art")!.file(trackData.title + " - Cover Art" + coverExt, coverBytes);
      }

      // Lyrics — simple text file since we don't have pdf-generators on this page
      if (items.indexOf("lyrics") >= 0 && trackData.lyrics) {
        root.folder("Lyrics")!.file(trackData.title + " - Lyrics.txt", trackData.lyrics);
      }

      // Stems
      if (items.indexOf("stems") >= 0) {
        var { data: stems } = await anonSupabase
          .from("stems")
          .select("*")
          .eq("track_id", trackData.id);
        if (stems && stems.length > 0) {
          var stemsFolder = root.folder("Stems")!;
          for (var si = 0; si < stems.length; si++) {
            var stem = stems[si] as Record<string, unknown>;
            var stemPath = stem.file_path as string;
            if (!stemPath) continue;
            var { data: stemSigned } = await anonSupabase.storage
              .from("stems")
              .createSignedUrl(stemPath, 3600);
            if (stemSigned?.signedUrl) {
              var stemBytes = await fetch(stemSigned.signedUrl).then(function(r) { return r.arrayBuffer(); });
              stemsFolder.file((stem.file_name as string) || ("stem-" + si), stemBytes);
            }
          }
        }
      }

      // Metadata — text summary
      if (items.indexOf("metadata") >= 0) {
        var metaLines = [
          "Title: " + trackData.title,
          "Artist: " + trackData.artist,
          trackData.featuring ? "Featuring: " + trackData.featuring : "",
          trackData.genre ? "Genre: " + trackData.genre : "",
          trackData.bpm ? "BPM: " + trackData.bpm : "",
          trackData.key ? "Key: " + trackData.key : "",
          trackData.duration_sec ? "Duration: " + formatDuration(trackData.duration_sec) : "",
          trackData.mood && trackData.mood.length > 0 ? "Mood: " + trackData.mood.join(", ") : "",
        ].filter(function(l) { return l; });
        root.folder("Metadata")!.file(trackData.title + " - Metadata.txt", metaLines.join("\n"));
      }

      // Paperwork — real documents with TRAKALOG watermark on PDFs
      if (items.indexOf("paperwork") >= 0) {
        var { data: docs } = await anonSupabase
          .from("track_documents")
          .select("*")
          .eq("track_id", trackData.id);
        if (docs && docs.length > 0) {
          var paperworkFolder = root.folder("Paperwork")!;
          for (var di = 0; di < docs.length; di++) {
            var doc = docs[di] as Record<string, unknown>;
            var docPath = doc.file_path as string;
            if (!docPath) continue;
            var { data: docSigned } = await anonSupabase.storage
              .from("documents")
              .createSignedUrl(docPath, 3600);
            if (!docSigned?.signedUrl) continue;
            var docBytes = await fetch(docSigned.signedUrl).then(function(r) { return r.arrayBuffer(); });
            var mimeType = (doc.mime_type as string) || "";
            if (mimeType.indexOf("pdf") >= 0) {
              var pdfDoc = await PDFDocument.load(docBytes);
              var font = await pdfDoc.embedFont(StandardFonts.Helvetica);
              var pages = pdfDoc.getPages();
              for (var pi = 0; pi < pages.length; pi++) {
                var page = pages[pi];
                var sz = page.getSize();
                var fontSize = sz.width / 4;
                for (var y = sz.height * 0.2; y < sz.height; y += sz.height * 0.25) {
                  page.drawText("TRAKALOG", {
                    x: sz.width * 0.15, y: y, size: fontSize, font: font,
                    color: rgb(0.5, 0.5, 0.5), opacity: 0.08, rotate: degrees(45),
                  });
                }
              }
              var watermarkedBytes = await pdfDoc.save();
              paperworkFolder.file((doc.file_name as string) || ("document-" + di + ".pdf"), watermarkedBytes);
            } else {
              paperworkFolder.file((doc.file_name as string) || ("document-" + di), docBytes);
            }
          }
        }
      }

      var zipBlob = await zip.generateAsync({ type: "blob" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = folderName + ".zip";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Failed to generate Trakalog Pack:", err);
    } finally {
      setPackDownloading(false);
    }
  }, [linkData, trackData, packDownloading, fetchAudioUrl, slug]);

  var progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  var needsGate = linkData && !gateCompleted;
  var needsPassword = linkData && linkData.link_type === "secured" && !passwordVerified && gateCompleted;
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

  // Visitor gate
  if (needsGate) {
    return (
      <Shell>
        <div className="max-w-sm mx-auto py-12 px-4">
          <div className="rounded-2xl p-8 text-center" style={{ background: "linear-gradient(145deg, rgba(249,115,22,0.08), rgba(139,92,246,0.05), transparent)", border: "1px solid rgba(249,115,22,0.15)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(139,92,246,0.2))" }}>
              <User className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Welcome</h2>
            <p className="text-sm text-muted-foreground mt-1.5 mb-6">Please enter your details to access this content.</p>
            <div className="space-y-3 text-left">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Full Name <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={visitorName}
                  onChange={function(e) { setVisitorName(e.target.value); }}
                  placeholder="Your name"
                  maxLength={100}
                  className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Email <span className="text-destructive">*</span></label>
                <input
                  type="email"
                  value={visitorEmail}
                  onChange={function(e) { setVisitorEmail(e.target.value); }}
                  placeholder="your@email.com"
                  maxLength={255}
                  className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Role</label>
                <input
                  type="text"
                  value={visitorRole}
                  onChange={function(e) { setVisitorRole(e.target.value); }}
                  placeholder="e.g. A&R, Manager, DJ"
                  maxLength={100}
                  className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Company</label>
                <input
                  type="text"
                  value={visitorCompany}
                  onChange={function(e) { setVisitorCompany(e.target.value); }}
                  onKeyDown={function(e) { if (e.key === "Enter") handleGateSubmit(); }}
                  placeholder="Your company or label"
                  maxLength={100}
                  className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                />
              </div>
              {gateError && (
                <p className="text-xs text-destructive text-center">{gateError}</p>
              )}
              <button
                onClick={handleGateSubmit}
                className="w-full h-11 rounded-xl text-sm font-semibold btn-brand"
              >
                Continue
              </button>
            </div>
          </div>
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

          {linkData?.expires_at && (
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-orange/10 border border-brand-orange/20">
              <Clock className="w-3.5 h-3.5 text-brand-orange" />
              <p className="text-xs font-medium text-brand-orange">
                {"This link expires on " + new Date(linkData.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          )}

          {/* Playlist header */}
          <div className="rounded-2xl bg-card border border-border overflow-hidden" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 p-4 sm:p-6">
              <div className="w-full max-w-[200px] sm:w-28 md:w-36 aspect-square sm:h-28 md:h-36 rounded-xl overflow-hidden shrink-0 bg-secondary border border-border/50">
                <img src={playlistData.cover_url || DEFAULT_COVER} alt={playlistData.name} className="w-full h-full object-cover" />
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
                  var isAudioPlaying = isActive && isPlaying;
                  return (
                    <div
                      key={track.id}
                      onClick={function() { handlePlayTrack(track); }}
                      className={"flex items-center gap-3 px-6 py-3 border-b border-border/40 last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer select-none " + (isActive ? "bg-primary/5" : "")}
                    >
                      {/* Play button / track number */}
                      <div
                        className={"w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all " + (isAudioPlaying ? "btn-brand" : "bg-secondary/80 text-foreground hover:bg-primary/15 hover:text-primary")}
                      >
                        {isAudioPlaying ? (
                          <Pause className="w-3.5 h-3.5 text-primary-foreground" />
                        ) : (
                          <Play className="w-3.5 h-3.5 ml-0.5" />
                        )}
                      </div>

                      {/* Cover */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary border border-border/50">
                        <img src={track.cover_url || DEFAULT_COVER} alt="" className="w-full h-full object-cover" />
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

            {/* Player bar — prompt or active */}
            {!playingTrackId && playlistTracks.length > 0 && (
              <div className="border-t border-border px-6 py-4 bg-secondary/20">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Play className="w-4 h-4" />
                  <span className="text-xs font-medium">Select a track to start playback</span>
                </div>
              </div>
            )}
            {playingTrackId && (function() {
              var activeTrack = playlistTracks.find(function(t) { return t.id === playingTrackId; });
              var activeIdx = playlistTracks.findIndex(function(t) { return t.id === playingTrackId; });
              var hasPrev = activeIdx > 0;
              var hasNext = activeIdx >= 0 && activeIdx < playlistTracks.length - 1;
              return (
                <div className="border-t border-border px-6 py-4 space-y-3 bg-secondary/20">
                  {/* Now playing info */}
                  {activeTrack && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary border border-border/50">
                        <img src={activeTrack.cover_url || DEFAULT_COVER} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-foreground truncate">{activeTrack.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {activeTrack.artist}
                          {activeTrack.featuring ? " ft. " + activeTrack.featuring : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Progress bar / Waveform */}
                  <div className="relative">
                    {activeTrack && activeTrack.waveform_data ? (
                      <WaveformBar peaks={activeTrack.waveform_data} progress={progress} onSeek={handleSeek} onDoubleClick={handleWaveformDoubleClick} />
                    ) : (
                      <div
                        className="h-2 bg-secondary rounded-full cursor-pointer group relative"
                        onClick={handleSeek}
                        onDoubleClick={handleWaveformDoubleClick}
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
                    )}
                    <CommentMarkers comments={comments} totalDuration={duration} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/40 text-center">Double-click waveform to leave a comment</p>

                  {commentComposerOpen && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary/80 border border-border">
                      <span className="text-[11px] font-mono text-brand-pink whitespace-nowrap">{formatDuration(commentTimestamp)}</span>
                      <input
                        ref={commentInputRef}
                        type="text"
                        value={commentText}
                        onChange={function(e) { setCommentText(e.target.value); }}
                        onKeyDown={function(e) {
                          if (e.key === "Enter" && commentText.trim()) handleSubmitComment();
                          if (e.key === "Escape") { setCommentComposerOpen(false); setCommentText(""); }
                        }}
                        placeholder="Leave a comment..."
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                      />
                      <button
                        onClick={handleSubmitComment}
                        disabled={!commentText.trim() || submittingComment}
                        className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={function() { setCommentComposerOpen(false); setCommentText(""); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Controls row */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-10">
                      {formatDuration(currentTime)}
                    </span>

                    {/* Transport controls */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handlePrevTrack}
                        disabled={!hasPrev && (!audioRef.current || audioRef.current.currentTime < 1)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={function() { if (activeTrack) handlePlayTrack(activeTrack); }}
                        className="w-10 h-10 rounded-full btn-brand flex items-center justify-center"
                      >
                        {isPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5 ml-0.5" />}
                      </button>
                      <button
                        onClick={handleNextTrack}
                        disabled={!hasNext}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Volume + duration */}
                    <div className="flex items-center gap-1.5 w-10 justify-end sm:w-auto">
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
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-1.5 accent-primary cursor-pointer hidden sm:block"
                      />
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums ml-1 hidden sm:inline">
                        {formatDuration(duration)}
                      </span>
                    </div>
                  </div>

                  {activeTrack && activeTrack.lyrics_segments && activeTrack.lyrics_segments.length > 0 && (
                    <KaraokeLyrics
                      segments={activeTrack.lyrics_segments}
                      currentTime={currentTime}
                      isPlaying={isPlaying}
                      onSeek={function(time) { if (audioRef.current) { audioRef.current.currentTime = time; } }}
                      className="border-t border-border -mx-6 px-6 mt-2"
                    />
                  )}
                </div>
              );
            })()}
          </div>

          {linkData?.allow_download && playlistTracks.length > 0 && (
            <div className="rounded-2xl bg-card border border-border overflow-hidden p-4">
              <p className="text-xs text-muted-foreground mb-3">Download is enabled for this shared link</p>
              <div className="space-y-2">
                {playlistTracks.map(function(track) {
                  return (
                    <button
                      key={track.id}
                      onClick={function() {
                        logEvent(track.id, "download");
                        fetchAudioUrl(track.id, linkData.download_quality === "hi-res" ? "original" : "preview").then(function(url) {
                          if (!url) return;
                          fetch(url).then(function(res) { return res.blob(); }).then(function(blob) {
                            var blobUrl = URL.createObjectURL(blob);
                            var a = document.createElement("a");
                            a.href = blobUrl;
                            a.download = track.title + " - " + track.artist + (linkData.download_quality === "hi-res" ? ".wav" : ".mp3");
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(blobUrl);
                          }).catch(function (err) { console.error("Error:", err); });
                        }).catch(function (err) { console.error("Error:", err); });
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs border border-border bg-card hover:bg-secondary transition-colors"
                    >
                      <span className="font-medium text-foreground">{track.title} - {track.artist}</span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Download className="w-3.5 h-3.5" />
                        {linkData.download_quality === "hi-res" ? "Hi-Res" : "Low-Res"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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

        {linkData?.expires_at && (
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-orange/10 border border-brand-orange/20">
            <Clock className="w-3.5 h-3.5 text-brand-orange" />
            <p className="text-xs font-medium text-brand-orange">
              {"This link expires on " + new Date(linkData.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
        )}

        {trackData ? (
          <div className="rounded-2xl bg-card border border-border overflow-hidden" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 p-4 sm:p-6">
              <div className="w-full max-w-[200px] sm:w-28 md:w-36 aspect-square sm:h-28 md:h-36 rounded-xl overflow-hidden shrink-0 bg-secondary border border-border/50">
                <img src={trackData.cover_url || DEFAULT_COVER} alt={trackData.title} className="w-full h-full object-cover" />
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
                <div className="relative">
                  {trackData.waveform_data ? (
                    <WaveformBar peaks={trackData.waveform_data} progress={progress} onSeek={handleSeek} onDoubleClick={handleWaveformDoubleClick} />
                  ) : (
                    <div
                      className="h-2 bg-secondary rounded-full cursor-pointer group relative"
                      onClick={handleSeek}
                      onDoubleClick={handleWaveformDoubleClick}
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
                  )}
                  <CommentMarkers comments={comments} totalDuration={duration} />
                </div>
                <p className="text-[10px] text-muted-foreground/40 text-center">Double-click waveform to leave a comment</p>

                {commentComposerOpen && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary/80 border border-border">
                    <span className="text-[11px] font-mono text-brand-pink whitespace-nowrap">{formatDuration(commentTimestamp)}</span>
                    <input
                      ref={commentInputRef}
                      type="text"
                      value={commentText}
                      onChange={function(e) { setCommentText(e.target.value); }}
                      onKeyDown={function(e) {
                        if (e.key === "Enter" && commentText.trim()) handleSubmitComment();
                        if (e.key === "Escape") { setCommentComposerOpen(false); setCommentText(""); }
                      }}
                      placeholder="Leave a comment..."
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    />
                    <button
                      onClick={handleSubmitComment}
                      disabled={!commentText.trim() || submittingComment}
                      className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={function() { setCommentComposerOpen(false); setCommentText(""); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                    {formatDuration(currentTime)}
                  </span>
                  <button
                    onClick={function() { handlePlayTrack(trackData!); }}
                    className="w-11 h-11 rounded-full btn-brand flex items-center justify-center"
                  >
                    {playingTrackId === trackData.id && isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
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
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-20 h-1.5 accent-primary cursor-pointer hidden sm:block"
                    />
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums ml-1">
                      {formatDuration(duration)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {trackData.lyrics_segments && trackData.lyrics_segments.length > 0 && playingTrackId === trackData.id && (
              <KaraokeLyrics
                segments={trackData.lyrics_segments}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onSeek={function(time) { if (audioRef.current) { audioRef.current.currentTime = time; } }}
                className="border-t border-border px-6"
              />
            )}

            {linkData?.allow_download && (trackData.audio_url || slug) && linkData.share_type !== "pack" && (
              <div className="border-t border-border px-6 py-4">
                <button
                  onClick={function() {
                    logEvent(trackData!.id, "download");
                    fetchAudioUrl(trackData!.id, linkData.download_quality === "hi-res" ? "original" : "preview").then(function(url) {
                      if (!url) return;
                      fetch(url).then(function(res) { return res.blob(); }).then(function(blob) {
                        var blobUrl = URL.createObjectURL(blob);
                        var a = document.createElement("a");
                        a.href = blobUrl;
                        a.download = trackData!.title + " - " + trackData!.artist + (linkData.download_quality === "hi-res" ? ".wav" : ".mp3");
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                      }).catch(function (err) { console.error("Error:", err); });
                    }).catch(function (err) { console.error("Error:", err); });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold btn-brand"
                >
                  <Download className="w-4 h-4" />
                  {"Download " + (linkData.download_quality === "hi-res" ? "(Hi-Res)" : "(Low-Res)")}
                </button>
              </div>
            )}

            {linkData?.share_type === "pack" && linkData.pack_items && linkData.pack_items.length > 0 && (
              <div className="border-t border-border px-6 py-4">
                <button
                  onClick={handleDownloadPack}
                  disabled={packDownloading}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, hsl(24, 100%, 55%), hsl(330, 80%, 60%), hsl(270, 70%, 55%))" }}
                >
                  {packDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Pack...
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4" />
                      Download Trakalog Pack
                    </>
                  )}
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-3">
              <img src={trakalogLogo} alt="Trakalog" className="h-10" />
              <span className="text-xl font-bold tracking-wider uppercase" style={{ background: "linear-gradient(90deg, #f97316, #ec4899, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Trakalog</span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 mt-1">Catalog Manager</span>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="py-6 text-center">
        <a href="https://trakalog.com" target="_blank" rel="noopener noreferrer" className="text-[10px] hover:opacity-80 transition-opacity" style={{ color: "#f97316" }}>
          {"Powered by Trakalog \u2726"}
        </a>
      </footer>
    </div>
  );
}
