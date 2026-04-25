import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/constants";
import {
  Lock, Download, Music, Layers, User, Mail, Building2, Briefcase,
  Package, ListMusic, Clock, Play, Pause, FileText, PieChart,
  Tag, Disc, Globe, Hash, Calendar, Headphones, ShieldOff, MessageSquare,
  AlertCircle, MoreHorizontal, Edit3, Trash2, Send, Loader2
} from "lucide-react";
import { DEFAULT_COVER } from "@/lib/constants";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrackWaveformPlayer } from "@/components/TrackWaveformPlayer";
import { CommentMarkerLayer } from "@/components/CommentMarkerLayer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import trakalogLogo from "@/assets/trakalog-logo.png";

var roleOptions = ["Artist", "Manager", "Producer", "A&R", "Music Director", "Publisher", "Sync Agent", "Songwriter", "Musician", "Assistant", "Mix Engineer", "Mastering Engineer", "PR", "Video Director", "Other"];

interface SharedLinkRow {
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

interface TrackRow {
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
  voice: string | null;
  language: string | null;
  release_date: string | null;
  isrc: string | null;
  upc: string | null;
  label: string | null;
  publisher: string | null;
  copyright: string | null;
  written_by: string[] | null;
  produced_by: string[] | null;
  mixed_by: string | null;
  mastered_by: string | null;
  type: string | null;
  explicit: boolean | null;
  status: string | null;
}

interface StemRow {
  id: string;
  file_name: string;
  stem_type: string;
  file_size_bytes: number | null;
}

interface CommentRow {
  id: string;
  track_id: string;
  shared_link_id: string | null;
  author_name: string;
  author_email: string | null;
  author_type: string;
  timestamp_sec: number;
  content: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDuration(seconds: number): string {
  var m = Math.floor(seconds / 60);
  var s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function formatTimestamp(seconds: number): string {
  var m = Math.floor(seconds / 60);
  var s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

export default function SharedStemAccess() {
  var anonSupabase = useRef(createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })).current;
  var { linkId } = useParams();

  var [loading, setLoading] = useState(true);
  var [error, setError] = useState<string | null>(null);
  var [link, setLink] = useState<SharedLinkRow | null>(null);
  var [trackData, setTrackData] = useState<TrackRow | null>(null);
  var [stems, setStems] = useState<StemRow[]>([]);
  var [playlistTracks, setPlaylistTracks] = useState<TrackRow[]>([]);
  var [playlistName, setPlaylistName] = useState("");
  var [playlistCover, setPlaylistCover] = useState<string | null>(null);

  var [password, setPassword] = useState("");
  var [passwordVerified, setPasswordVerified] = useState(false);
  var [passwordError, setPasswordError] = useState(false);
  var [formCompleted, setFormCompleted] = useState(false);
  var [firstName, setFirstName] = useState("");
  var [lastName, setLastName] = useState("");
  var [email, setEmail] = useState("");
  var [organization, setOrganization] = useState("");
  var [role, setRole] = useState("");

  // Comments
  var [comments, setComments] = useState<CommentRow[]>([]);

  // Fetch link data on mount
  useEffect(function() {
    var isMounted = true;

    if (!linkId) {
      setError("Invalid link.");
      setLoading(false);
      return;
    }

    async function fetchData() {
      // Fetch shared link by id
      var { data: linkRow, error: linkErr } = await anonSupabase
        .from("shared_links")
        .select("*")
        .eq("id", linkId!)
        .single();

      if (!isMounted) return;

      if (linkErr || !linkRow) {
        setError("This link does not exist or has been removed.");
        setLoading(false);
        return;
      }

      var sl = linkRow as unknown as SharedLinkRow;

      if (sl.status === "disabled" || sl.status === "revoked") {
        setError("This link has been " + sl.status + ".");
        setLoading(false);
        return;
      }

      if (sl.status === "expired" || (sl.expires_at && new Date(sl.expires_at) < new Date())) {
        setError("This link has expired.");
        setLoading(false);
        return;
      }

      setLink(sl);

      if (sl.share_type === "playlist" && sl.playlist_id) {
        // Fetch playlist metadata
        var { data: pl } = await anonSupabase
          .from("playlists")
          .select("id, name, description, cover_url")
          .eq("id", sl.playlist_id)
          .single();

        if (!isMounted) return;

        if (pl) {
          setPlaylistName(pl.name || "");
          setPlaylistCover(pl.cover_url || null);
        }

        // Fetch playlist tracks
        var { data: ptRows } = await anonSupabase
          .from("playlist_tracks")
          .select("track_id, position")
          .eq("playlist_id", sl.playlist_id)
          .order("position", { ascending: true });

        if (!isMounted) return;

        if (ptRows && ptRows.length > 0) {
          var trackIds = ptRows.map(function(r) { return r.track_id; });
          var { data: tracks } = await anonSupabase
            .from("tracks")
            .select("*")
            .in("id", trackIds);

          if (!isMounted) return;

          if (tracks) {
            var trackMap: Record<string, TrackRow> = {};
            tracks.forEach(function(t) { trackMap[t.id] = t as unknown as TrackRow; });
            var sorted = trackIds
              .map(function(tid) { return trackMap[tid]; })
              .filter(function(t) { return !!t; });
            setPlaylistTracks(sorted);
          }
        }
      } else if (sl.track_id) {
        // Fetch single track
        var { data: track } = await anonSupabase
          .from("tracks")
          .select("*")
          .eq("id", sl.track_id)
          .single();

        if (!isMounted) return;

        if (track) {
          setTrackData(track as unknown as TrackRow);
        }

        // Fetch stems for this track
        var { data: stemRows } = await anonSupabase
          .from("stems")
          .select("id, file_name, stem_type, file_size_bytes")
          .eq("track_id", sl.track_id)
          .order("created_at", { ascending: true });

        if (!isMounted) return;

        if (stemRows) {
          setStems(stemRows as StemRow[]);
        }
      }

      setLoading(false);
    }

    fetchData().catch(function() {
      if (isMounted) {
        setError("Failed to load this link. Please try again.");
        setLoading(false);
      }
    });

    return function () { isMounted = false; };
  }, [linkId]);

  // Fetch comments when form is completed
  useEffect(function() {
    if (!formCompleted || !link || !trackData) return;
    anonSupabase
      .from("track_comments")
      .select("*")
      .eq("track_id", trackData.id)
      .eq("shared_link_id", link.id)
      .is("deleted_at", null)
      .order("timestamp_sec", { ascending: true })
      .then(function(res) {
        if (res.data) setComments(res.data as CommentRow[]);
      }).catch(function (err) { console.error("Error:", err); });
  }, [formCompleted, link, trackData]);

  var handlePasswordSubmit = async function(e: React.FormEvent) {
    e.preventDefault();
    if (!link) return;
    try {
      var res = await fetch(SUPABASE_URL + "/functions/v1/verify-link-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
          "apikey": SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({ slug: link.link_slug, password: password })
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

  var handleFormSubmit = function(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !organization.trim() || !role) {
      toast.error("Please fill in all fields");
      return;
    }
    setFormCompleted(true);

    // Log access event
    if (link) {
      fetch(SUPABASE_URL + "/functions/v1/log-link-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({
          slug: link.link_slug,
          name: firstName.trim() + " " + lastName.trim(),
          email: email.trim(),
          role: role,
          company: organization.trim()
        }),
      }).catch(function(err) { console.error("Failed to log access:", err); });
    }
  };

  var handleDownloadItem = function(fileName: string) {
    if (!link || !link.allow_download) return;
    toast.success("Downloading " + fileName + " (" + (link.download_quality === "hi-res" ? "Hi-Res" : "Low-Res") + ")");
  };

  var handleDownloadAll = function() {
    if (!link || !link.allow_download) return;
    var shareType = link.share_type || "stems";
    var displayTitle = shareType === "playlist" ? playlistName : (trackData?.title || "Track");
    var zipName = shareType === "playlist"
      ? displayTitle + "_Playlist.zip"
      : shareType === "stems"
      ? displayTitle + "_Stems.zip"
      : displayTitle + ".zip";
    toast.success("Downloading " + zipName + " (" + (link.download_quality === "hi-res" ? "Hi-Res" : "Low-Res") + ")");
  };

  // Derived values
  var shareType = link?.share_type || "stems";
  var displayTitle = shareType === "playlist"
    ? (playlistName || trackData?.title || "Playlist")
    : (trackData?.title || "Track");
  var displaySubtitle = shareType === "playlist"
    ? playlistTracks.length + " tracks"
    : (trackData?.artist || "");
  var displayCover = shareType === "playlist"
    ? (playlistCover || trackData?.cover_url)
    : trackData?.cover_url;
  var accessLabel = shareType === "stems" ? "stems" : shareType === "track" ? "this track" : "this playlist";
  var needsPassword = link && link.link_type === "secured" && !passwordVerified;

  // Loading
  if (loading) {
    return (
      <ExternalShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ExternalShell>
    );
  }

  // Error
  if (error || !link) {
    return (
      <ExternalShell>
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Link Unavailable</h2>
          <p className="text-sm text-muted-foreground mt-1">{error || "This share link doesn't exist or has been removed."}</p>
        </div>
      </ExternalShell>
    );
  }

  // Password gate
  if (needsPassword) {
    return (
      <ExternalShell>
        <div className="max-w-sm mx-auto py-12">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl icon-brand flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Password Required</h2>
            <p className="text-sm text-muted-foreground mt-1">Enter the password to access {accessLabel}.</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={function(e) { setPassword(e.target.value); setPasswordError(false); }}
              placeholder="Enter password"
              className={"h-11 w-full px-4 rounded-xl bg-secondary border text-sm text-foreground outline-none transition-all " +
                (passwordError ? "border-destructive" : "border-border focus:border-primary/30")}
              autoFocus
            />
            {passwordError && <p className="text-xs text-destructive">Incorrect password. Please try again.</p>}
            <button type="submit" className="w-full h-11 rounded-xl text-sm font-semibold btn-brand">
              Access Content
            </button>
          </form>
        </div>
      </ExternalShell>
    );
  }

  // Access form
  if (!formCompleted) {
    return (
      <ExternalShell>
        <div className="max-w-md mx-auto py-8">
          <div className="text-center mb-8">
            {displayCover ? (
              <img src={displayCover} alt={displayTitle} className="w-20 h-20 rounded-xl object-cover mx-auto mb-4" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-brand-purple/30 via-brand-pink/20 to-brand-orange/30 flex items-center justify-center mx-auto mb-4">
                {shareType === "playlist" ? <ListMusic className="w-8 h-8 text-foreground/20" /> : <Music className="w-8 h-8 text-foreground/20" />}
              </div>
            )}
            <h2 className="text-lg font-semibold text-foreground">{displayTitle}</h2>
            <p className="text-sm text-muted-foreground">{displaySubtitle}</p>
            {link.message && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-secondary/50 border border-border text-xs text-foreground/80 italic">
                "{link.message}"
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-sm font-semibold text-foreground mb-4">Enter your details to access {accessLabel}</h3>
            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">First Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input value={firstName} onChange={function(e) { setFirstName(e.target.value); }} placeholder="First name"
                      className="h-10 w-full pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Last Name *</label>
                  <input value={lastName} onChange={function(e) { setLastName(e.target.value); }} placeholder="Last name"
                    className="h-10 w-full px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input type="email" value={email} onChange={function(e) { setEmail(e.target.value); }} placeholder="you@company.com"
                    className="h-10 w-full pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Organization *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={organization} onChange={function(e) { setOrganization(e.target.value); }} placeholder="Your company"
                    className="h-10 w-full pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Role *</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <select value={role} onChange={function(e) { setRole(e.target.value); }}
                    className="h-10 w-full pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all appearance-none cursor-pointer">
                    <option value="">Select role...</option>
                    {roleOptions.map(function(r) { return <option key={r} value={r}>{r}</option>; })}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full h-11 rounded-xl text-sm font-semibold btn-brand mt-2">
                Access Content
              </button>
            </form>
          </div>
        </div>
      </ExternalShell>
    );
  }

  // ── Main content view ──
  return (
    <ExternalShell>
      <div className="max-w-2xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-8">
          {displayCover ? (
            <img src={displayCover} alt={displayTitle} className="w-24 h-24 rounded-xl object-cover mx-auto mb-4 shadow-lg" />
          ) : (
            <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-brand-purple/30 via-brand-pink/20 to-brand-orange/30 flex items-center justify-center mx-auto mb-4">
              {shareType === "playlist" ? <ListMusic className="w-10 h-10 text-foreground/20" /> : <Music className="w-10 h-10 text-foreground/20" />}
            </div>
          )}
          <h2 className="text-xl font-bold text-foreground">{displayTitle}</h2>
          <p className="text-sm text-muted-foreground">{displaySubtitle}</p>
          {link.message && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-secondary/50 border border-border text-xs text-foreground/80 italic max-w-sm mx-auto">
              "{link.message}"
            </div>
          )}
        </div>

        {/* Download section */}
        {link.allow_download ? (
          <button onClick={handleDownloadAll} className="w-full h-12 rounded-xl text-sm font-semibold btn-brand flex items-center justify-center gap-2 mb-6">
            <Package className="w-4 h-4" />
            {shareType === "track" ? "Download Track" : "Download All as ZIP"}
            <span className="text-[10px] opacity-70 ml-1">({link.download_quality === "hi-res" ? "Hi-Res" : "Low-Res"})</span>
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary/50 border border-border mb-6">
            <ShieldOff className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Downloads are not enabled for this shared link</span>
          </div>
        )}

        {/* Content */}
        {shareType === "playlist" && playlistTracks.length > 0 ? (
          <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">{playlistTracks.length} Tracks</span>
              </div>
            </div>
            <div className="divide-y divide-border">
              {playlistTracks.map(function(track, i) {
                return (
                  <div key={track.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[11px] text-muted-foreground font-mono w-5 text-right shrink-0">{i + 1}</span>
                      <img src={track.cover_url || DEFAULT_COVER} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{track.title}</p>
                        <p className="text-[11px] text-muted-foreground">{track.artist} {track.duration_sec ? " · " + formatDuration(track.duration_sec) : ""}</p>
                      </div>
                    </div>
                    {link.allow_download && (
                      <button onClick={function() { handleDownloadItem(track.title); }} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Download">
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : trackData ? (
          <TrackDetailTabs
            trackData={trackData}
            stems={stems}
            link={link}
            comments={comments}
            setComments={setComments}
            allowDownload={link.allow_download}
            onDownloadItem={handleDownloadItem}
            recipientName={firstName + " " + lastName}
            recipientEmail={email}
          />
        ) : (
          <SimpleContentList
            stems={stems}
            shareType={shareType}
            trackData={trackData}
            allowDownload={link.allow_download}
            onDownloadItem={handleDownloadItem}
          />
        )}
      </div>
    </ExternalShell>
  );
}

// ── Track Detail Tabs (fully autonomous, no context hooks) ──
function TrackDetailTabs({
  trackData,
  stems,
  link,
  comments,
  setComments,
  allowDownload,
  onDownloadItem,
  recipientName,
  recipientEmail,
}: {
  trackData: TrackRow;
  stems: StemRow[];
  link: SharedLinkRow;
  comments: CommentRow[];
  setComments: React.Dispatch<React.SetStateAction<CommentRow[]>>;
  allowDownload: boolean;
  onDownloadItem: (name: string) => void;
  recipientName: string;
  recipientEmail: string;
}) {
  var [progress, setProgress] = useState(35);
  var [isPlaying, setIsPlaying] = useState(false);

  var totalDurationSeconds = trackData.duration_sec || 0;

  var handleSeek = function(seconds: number) {
    if (totalDurationSeconds > 0) {
      var pct = (seconds / totalDurationSeconds) * 100;
      setProgress(pct);
    }
  };

  var availableTabs = [
    { id: "overview", label: "Overview" },
    ...(trackData.lyrics ? [{ id: "lyrics", label: "Lyrics" }] : []),
    ...(stems.length > 0 ? [{ id: "stems", label: "Stems" }] : []),
    { id: "metadata", label: "Metadata" },
    { id: "review", label: "Review" },
    { id: "status", label: "Status" },
  ];

  return (
    <div className="space-y-4">
      {/* Mini player with waveform */}
      <div className="bg-card border border-border rounded-2xl p-4" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={function() { setIsPlaying(!isPlaying); }}
            className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div className="flex-1 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>{formatTimestamp((progress / 100) * totalDurationSeconds)}</span>
            <span>{formatDuration(totalDurationSeconds)}</span>
          </div>
        </div>
        <div className="relative">
          <TrackWaveformPlayer
            seed={trackData.id}
            progress={progress}
            onSeek={setProgress}
            onDoubleClick={function(pct) { setProgress(pct); }}
            chapters={[]}
            isPlaying={isPlaying}
          />
          <CommentMarkerLayer
            comments={comments.map(function(c) {
              return {
                id: c.id,
                trackId: 0,
                authorName: c.author_name,
                commentText: c.content,
                timestampSeconds: c.timestamp_sec,
                timestampLabel: formatTimestamp(c.timestamp_sec),
                createdAt: c.created_at,
                updatedAt: c.updated_at || c.created_at,
                isEdited: false,
                authorType: c.author_type as any,
                sourceContext: "recipient_review" as any,
              };
            })}
            totalDurationSeconds={totalDurationSeconds}
            onMarkerClick={function(seconds) { handleSeek(seconds); }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground/40 mt-2 text-center">Double-click waveform to jump to a moment</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full bg-secondary/50 border border-border rounded-xl p-1 flex flex-wrap gap-1 h-auto">
          {availableTabs.map(function(tab) {
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="text-xs rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm flex-1 min-w-[70px]">
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={Disc} label="Genre" value={trackData.genre || "—"} />
              <InfoRow icon={Hash} label="BPM" value={trackData.bpm ? String(trackData.bpm) : "—"} />
              <InfoRow icon={Music} label="Key" value={trackData.key || "—"} />
              <InfoRow icon={Clock} label="Duration" value={totalDurationSeconds > 0 ? formatDuration(totalDurationSeconds) : "—"} />
              <InfoRow icon={Headphones} label="Voice" value={trackData.voice || "—"} />
              <InfoRow icon={Globe} label="Language" value={trackData.language || "—"} />
              <InfoRow icon={Tag} label="Mood" value={trackData.mood?.join(", ") || "—"} />
              <InfoRow icon={Calendar} label="Release" value={trackData.release_date || "—"} />
            </div>
            {trackData.featuring && (
              <div className="pt-2 border-t border-border">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Featured Artists</p>
                <p className="text-sm text-foreground">{trackData.featuring}</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Lyrics */}
        {trackData.lyrics && (
          <TabsContent value="lyrics" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Lyrics</span>
              </div>
              <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
                {trackData.lyrics}
              </pre>
            </div>
          </TabsContent>
        )}

        {/* Stems */}
        {stems.length > 0 && (
          <TabsContent value="stems" className="mt-4">
            <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="px-5 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">{stems.length} Stems</span>
                </div>
              </div>
              <div className="divide-y divide-border">
                {stems.map(function(stem) {
                  var stemType = stem.stem_type === "background_vocal" ? "background vocal" : stem.stem_type;
                  return (
                    <div key={stem.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <Music className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{stem.file_name}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">{stemType} · {formatFileSize(stem.file_size_bytes)}</p>
                        </div>
                      </div>
                      {allowDownload && (
                        <button onClick={function() { onDownloadItem(stem.file_name); }} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        )}

        {/* Metadata */}
        <TabsContent value="metadata" className="mt-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Track Metadata</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <MetaRow label="ISRC" value={trackData.isrc || "—"} />
              <MetaRow label="UPC" value={trackData.upc || "—"} />
              <MetaRow label="Label" value={trackData.label || "—"} />
              <MetaRow label="Publisher" value={trackData.publisher || "—"} />
              <MetaRow label="Copyright" value={trackData.copyright || "—"} />
              <MetaRow label="Written By" value={trackData.written_by?.join(", ") || "—"} />
              <MetaRow label="Produced By" value={trackData.produced_by?.join(", ") || "—"} />
              <MetaRow label="Mixed By" value={trackData.mixed_by || "—"} />
              <MetaRow label="Mastered By" value={trackData.mastered_by || "—"} />
              <MetaRow label="Type" value={trackData.type || "—"} />
              <MetaRow label="Explicit" value={trackData.explicit ? "Yes" : "No"} />
            </div>
          </div>
        </TabsContent>

        {/* Status */}
        <TabsContent value="status" className="mt-4">
          <div className="bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Current Status</span>
              <span className="ml-auto px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                {trackData.status || "—"}
              </span>
            </div>
          </div>
        </TabsContent>

        {/* Review — inline, no RecipientReviewPlayer */}
        <TabsContent value="review" className="mt-4">
          <AutonomousReviewPanel
            trackId={trackData.id}
            linkId={link.id}
            recipientName={recipientName}
            recipientEmail={recipientEmail}
            comments={comments}
            setComments={setComments}
            progress={progress}
            totalDurationSeconds={totalDurationSeconds}
            onSeek={handleSeek}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Autonomous Review Panel (replaces RecipientReviewPlayer) ──
function AutonomousReviewPanel({
  trackId,
  linkId,
  recipientName,
  recipientEmail,
  comments,
  setComments,
  progress,
  totalDurationSeconds,
  onSeek,
}: {
  trackId: string;
  linkId: string;
  recipientName: string;
  recipientEmail: string;
  comments: CommentRow[];
  setComments: React.Dispatch<React.SetStateAction<CommentRow[]>>;
  progress: number;
  totalDurationSeconds: number;
  onSeek: (seconds: number) => void;
}) {
  var [composerOpen, setComposerOpen] = useState(false);
  var [commentText, setCommentText] = useState("");
  var [submitting, setSubmitting] = useState(false);
  var [editingId, setEditingId] = useState<string | null>(null);
  var [editText, setEditText] = useState("");
  var [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  var [openMenuId, setOpenMenuId] = useState<string | null>(null);

  var currentSeconds = (progress / 100) * totalDurationSeconds;
  var myComments = useMemo(function() {
    return comments.filter(function(c) { return c.author_name === recipientName; });
  }, [comments, recipientName]);

  var handleSubmit = function() {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    anonSupabase
      .from("track_comments")
      .insert({
        track_id: trackId,
        shared_link_id: linkId,
        author_name: recipientName,
        author_email: recipientEmail || null,
        author_type: "recipient",
        timestamp_sec: Math.round(currentSeconds * 100) / 100,
        content: commentText.trim(),
      })
      .select()
      .single()
      .then(function(res) {
        setSubmitting(false);
        if (res.data) {
          setComments(function(prev) { return prev.concat([res.data as CommentRow]); });
          setComposerOpen(false);
          setCommentText("");
        }
      }).catch(function (err) { console.error("Error:", err); });
  };

  var handleEdit = function(commentId: string, newText: string) {
    anonSupabase
      .from("track_comments")
      .update({ content: newText, updated_at: new Date().toISOString() })
      .eq("id", commentId)
      .then(function() {
        setComments(function(prev) {
          return prev.map(function(c) {
            if (c.id === commentId) return Object.assign({}, c, { content: newText, updated_at: new Date().toISOString() });
            return c;
          });
        });
        setEditingId(null);
      }).catch(function (err) { console.error("Error:", err); });
  };

  var handleDelete = function() {
    if (!deleteConfirmId) return;
    var id = deleteConfirmId;
    anonSupabase
      .from("track_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .then(function() {
        setComments(function(prev) { return prev.filter(function(c) { return c.id !== id; }); });
        setDeleteConfirmId(null);
      }).catch(function (err) { console.error("Error:", err); });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Your Feedback</h3>
          {myComments.length > 0 && (
            <span className="text-[10px] text-muted-foreground">({myComments.length})</span>
          )}
        </div>
        <button
          onClick={function() { setComposerOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand"
        >
          <MessageSquare className="w-3 h-3" /> Add Comment
        </button>
      </div>

      {composerOpen && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="font-mono">{formatTimestamp(currentSeconds)}</span>
          </div>
          <textarea
            value={commentText}
            onChange={function(e) { setCommentText(e.target.value); }}
            placeholder="Share your feedback on this moment..."
            className="w-full p-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 resize-none min-h-[60px]"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={submitting || !commentText.trim()} className="px-4 py-1.5 rounded-lg text-xs font-semibold btn-brand flex items-center gap-1.5">
              {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Send
            </button>
            <button onClick={function() { setComposerOpen(false); setCommentText(""); }} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {myComments.length === 0 && !composerOpen ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No feedback yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Click the button above to leave timecoded feedback</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border/50" style={{ boxShadow: "var(--shadow-card)" }}>
          {myComments.map(function(comment) {
            var isEditing = editingId === comment.id;
            return (
              <div key={comment.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors group">
                <div className="flex items-start gap-3">
                  <button
                    onClick={function() { onSeek(comment.timestamp_sec); }}
                    className="shrink-0 px-2 py-1 rounded-md bg-secondary hover:bg-primary/15 text-xs font-mono font-bold text-primary transition-colors mt-0.5"
                  >
                    {formatTimestamp(comment.timestamp_sec)}
                  </button>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={function(e) { setEditText(e.target.value); }}
                          className="w-full p-2 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 resize-none min-h-[50px]"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button onClick={function() { handleEdit(comment.id, editText.trim()); }} className="px-3 py-1 rounded-lg text-xs font-semibold btn-brand">Save</button>
                          <button onClick={function() { setEditingId(null); }} className="px-3 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-[13px] text-foreground/80 leading-relaxed">{comment.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground/50">
                            {new Date(comment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          {comment.updated_at && comment.updated_at !== comment.created_at && <span className="text-[9px] text-muted-foreground/40 italic">Edited</span>}
                        </div>
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="relative shrink-0">
                      <button
                        onClick={function() { setOpenMenuId(openMenuId === comment.id ? null : comment.id); }}
                        className="p-1 rounded-lg text-muted-foreground/30 hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                      {openMenuId === comment.id && (
                        <div className="absolute right-0 top-7 z-20 w-28 bg-popover border border-border rounded-lg shadow-lg py-1" style={{ boxShadow: "var(--shadow-elevated)" }}>
                          <button onClick={function() { setEditingId(comment.id); setEditText(comment.content); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors">
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                          <button onClick={function() { setDeleteConfirmId(comment.id); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={function(open) { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Fallback simple content list ──
function SimpleContentList({ stems, shareType, trackData, allowDownload, onDownloadItem }: {
  stems: StemRow[];
  shareType: string;
  trackData: TrackRow | null;
  allowDownload: boolean;
  onDownloadItem: (name: string) => void;
}) {
  if (shareType === "stems" && stems.length > 0) {
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">{stems.length} Stems</span>
          </div>
        </div>
        <div className="divide-y divide-border">
          {stems.map(function(stem) {
            var stemType = stem.stem_type === "background_vocal" ? "background vocal" : stem.stem_type;
            return (
              <div key={stem.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Music className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{stem.file_name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{stemType} · {formatFileSize(stem.file_size_bytes)}</p>
                  </div>
                </div>
                {allowDownload && (
                  <button onClick={function() { onDownloadItem(stem.file_name); }} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Download">
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Track</span>
        </div>
      </div>
      <div className="flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          {trackData?.cover_url ? (
            <img src={trackData.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Music className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{trackData?.title || "Track"}</p>
            <p className="text-[11px] text-muted-foreground">{trackData?.artist || ""}</p>
          </div>
        </div>
        {allowDownload && (
          <button onClick={function() { onDownloadItem(trackData?.title || "Track"); }} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Download">
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Helper components ──
function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground w-16 shrink-0">{label}</span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-1">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  );
}

function ExternalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-3">
          <img src={trakalogLogo} alt="Trakalog" className="w-8 h-8 rounded-lg object-contain" />
          <span className="text-sm font-bold tracking-tight gradient-text">TRAKALOG</span>
        </div>
      </div>
      <div className="px-4">{children}</div>
    </div>
  );
}
