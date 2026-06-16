import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/constants";
import { Lock, Play, Pause, Volume2, VolumeX, Music, AlertCircle, Clock, Disc3, Download, ListMusic, SkipBack, SkipForward, User, Send, X, ChevronDown, ChevronUp, FileText, Package, Loader2, MessageSquare, Bookmark, ShieldCheck, Award } from "lucide-react";
import { DEFAULT_COVER, INDUSTRY_ROLES, COUNTRIES } from "@/lib/constants";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import {
  generateLyricsPdf,
  generateMetadataPdf,
  generateSplitsPdf,
  generateCreditsPdf,
  generateSignedAgreementPdf,
} from "@/lib/pdf-generators";
import { TrackWaveformPlayer } from "@/components/TrackWaveformPlayer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { normalizeSocialUrl } from "@/lib/social-urls";
import { safeLocalStorage } from "@/lib/safeStorage";
import type { TrackChapter } from "@/contexts/TrackContext";

interface SharedLinkData {
  id: string;
  share_type: string;
  track_id: string | null;
  playlist_id: string | null;
  link_name: string;
  link_slug: string;
  link_type: string;
  has_password: boolean;
  message: string | null;
  allow_download: boolean;
  allow_save: boolean;
  download_quality: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
  pack_items: string[] | null;
  workspace_id: string;
  watermarking_enabled: boolean;
  gate_screen_enabled: boolean;
}

interface WorkspaceBranding {
  name: string | null;
  hero_image_url: string | null;
  hero_position: number | null;
  hero_focal_point: string | null;
  logo_url: string | null;
  brand_color: string | null;
  social_instagram: string | null;
  social_tiktok: string | null;
  social_youtube: string | null;
  social_facebook: string | null;
  social_x: string | null;
  social_website: string | null;
  bio: string | null;
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
  splits: { name: string; stage_name?: string; role: string; share: number; pro: string; ipi: string; publisher: string }[] | null;
  isrc: string | null;
  labels: string[] | null;
  publishers: string[] | null;
  language: string | null;
  gender: string | null;
  released_at: string | null;
  chapters: TrackChapter[] | null;
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

function parseWaveform(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && Array.isArray((raw as any).peaks)) return (raw as any).peaks;
  if (typeof raw === "string") {
    try { var parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed; } catch (_e) { /* ignore */ }
  }
  return null;
}

function hashId(id: string): number {
  var h = 0;
  for (var i = 0; i < id.length; i++) { h = ((h << 5) - h + id.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

function CommentMarkers({ comments, totalDuration }: { comments: TrackComment[]; totalDuration: number }) {
  if (!totalDuration || comments.length === 0) return null;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ height: 56 }}>
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

function ChapterPills({ chapters, duration, onSeek, dark }: {
  chapters: TrackChapter[] | null | undefined;
  duration: number;
  onSeek: (percent: number) => void;
  dark: boolean;
}) {
  if (!Array.isArray(chapters) || chapters.length === 0) return null;
  // Audio metadata may not be loaded yet (watermark prep can take seconds on shared links).
  // Without a known duration, handleSeekPercent silently no-ops — disable the pills until ready.
  var ready = duration > 0;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mt-3 scrollbar-hide" role="list" aria-label="Track chapters">
      {chapters.map(function(ch) {
        var hasSec = typeof ch.startSec === "number" || ready;
        var sec = typeof ch.startSec === "number"
          ? ch.startSec
          : (ch.startPercent / 100) * duration;
        return (
          <button
            key={ch.id}
            type="button"
            disabled={!ready}
            onClick={function() { onSeek(ch.startPercent); }}
            className={"flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-wait " + (dark
              ? "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white"
              : "bg-secondary/80 hover:bg-secondary text-foreground/80 hover:text-foreground border border-border")}
            aria-label={hasSec ? ("Jump to " + ch.label + " at " + formatDuration(sec)) : ("Jump to " + ch.label)}
          >
            {hasSec && (
              <span className={(dark ? "text-white/40" : "text-muted-foreground") + " mr-1"}>{formatDuration(sec)}</span>
            )}
            {ch.label}
          </button>
        );
      })}
    </div>
  );
}

function KaraokeLyrics({ segments, currentTime, isPlaying, onSeek, className, darkBg }: {
  segments: { start: number; end: number; text: string }[];
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  className?: string;
  darkBg?: boolean;
}) {
  const { t } = useTranslation();
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
          {t("sharedLink.lyrics")}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div
          ref={containerRef}
          className={"max-h-[400px] overflow-y-auto space-y-1 pb-4 scroll-smooth" + (darkBg ? " bg-black/30 backdrop-blur-sm rounded-lg p-2" : "")}
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

function setVisitorCookie(data: { name: string; email: string; role: string; company: string }) {
  var value = JSON.stringify({ name: data.name, email: data.email, role: data.role, company: data.company, timestamp: Date.now() });
  document.cookie = "trakalog_visitor=" + encodeURIComponent(value) + "; max-age=172800; path=/; SameSite=Lax; Secure";
}

function getVisitorCookie(): { name: string; email: string; role: string; company: string } | null {
  var match = document.cookie.match(/trakalog_visitor=([^;]+)/);
  if (!match) return null;
  try {
    var data = JSON.parse(decodeURIComponent(match[1]));
    if (Date.now() - data.timestamp > 172800000) return null;
    return { name: data.name, email: data.email, role: data.role, company: data.company };
  } catch { return null; }
}

export default function SharedLinkPage() {
  const { t, i18n } = useTranslation();
  var REST_URL = SUPABASE_URL + "/rest/v1";
  var STORAGE_URL = SUPABASE_URL + "/storage/v1";
  var SB_HEADERS: Record<string, string> = { "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY };
  var { slug } = useParams<{ slug: string }>();

  var [loading, setLoading] = useState(true);
  var [linkData, setLinkData] = useState<SharedLinkData | null>(null);
  var [trackData, setTrackData] = useState<TrackData | null>(null);
  var [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  var [playlistTracks, setPlaylistTracks] = useState<TrackData[]>([]);
  var [error, setError] = useState<string | null>(null);

  // Gate state — pre-fill from cookie if available
  var savedVisitor = useMemo(function() { return getVisitorCookie(); }, []);
  var [gateCompleted, setGateCompleted] = useState(false);
  var [visitorName, setVisitorName] = useState(savedVisitor?.name || "");
  var [visitorEmail, setVisitorEmail] = useState(savedVisitor?.email || "");
  var visitorEmailRef = useRef(savedVisitor?.email || "");
  var [visitorRole, setVisitorRole] = useState(savedVisitor?.role || "");
  var [visitorCompany, setVisitorCompany] = useState(savedVisitor?.company || "");
  var [visitorCity, setVisitorCity] = useState("");
  var [visitorCountry, setVisitorCountry] = useState("");
  var [showLocationOptional, setShowLocationOptional] = useState(false);
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
  var prevVolumeRef = useRef(0.8);
  var [isWatermarked, setIsWatermarked] = useState(false);

  // Audio loading
  var [audioLoading, setAudioLoading] = useState(false);
  // Media-load error surface (null = no error).
  //   "fallback" = watermarked stream failed, now playing the original audio
  //   "error"    = playback failed entirely
  var [watermarkError, setWatermarkError] = useState<string | null>(null);

  // Refs used by the media-error recovery path (see handleWatermarkFailover).
  var originalUrlRef = useRef<string | null>(null);   // current track's non-watermarked URL (fallback)
  var watermarkActiveRef = useRef<boolean>(false);    // is the currently-loaded src the watermarked one?
  var loadWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Comments
  var [comments, setComments] = useState<TrackComment[]>([]);
  var [commentComposerOpen, setCommentComposerOpen] = useState(false);
  var [commentTimestamp, setCommentTimestamp] = useState(0);
  var [commentText, setCommentText] = useState("");
  var [submittingComment, setSubmittingComment] = useState(false);
  var commentInputRef = useRef<HTMLInputElement>(null);

  // Credits
  var [creditsOpen, setCreditsOpen] = useState(false);

  // Pack download state
  var [packDownloading, setPackDownloading] = useState(false);
  var [savedToTrakalog, setSavedToTrakalog] = useState(false);
  var [savingToTrakalog, setSavingToTrakalog] = useState(false);
  var [currentUserSession, setCurrentUserSession] = useState<any>(null);
  var [currentUserWorkspace, setCurrentUserWorkspace] = useState<string | null>(null);
  var [userHasNoWorkspace, setUserHasNoWorkspace] = useState(false);
  var wsCheckedRef = useRef(false);

  // Workspace branding
  var [branding, setBranding] = useState<WorkspaceBranding | null>(null);

  // Cache resolved audio URLs to avoid re-fetching
  var audioUrlCache = useRef<Record<string, string>>({});

  // Refs for access from onEnded callback (avoids stale closures)
  var playlistTracksRef = useRef<TrackData[]>([]);
  var loadAndPlayTrackRef = useRef<(track: TrackData) => void>(function() {});

  useEffect(function() { playlistTracksRef.current = playlistTracks; }, [playlistTracks]);

  // Prevent horizontal overflow on mobile
  useEffect(function() {
    var html = document.documentElement;
    var prevOverflow = html.style.overflowX;
    html.style.overflowX = "hidden";
    return function() { html.style.overflowX = prevOverflow; };
  }, []);

  // Fetch link data
  useEffect(function() {
    if (!slug) {
      setError(t("sharedLink.error.invalidLink"));
      setLoading(false);
      return;
    }

    async function fetchLink() {
      // RPC SECURITY DEFINER — replaces direct SELECT (CRIT-01). password_hash is
      // never exposed to the client; presence is reflected via has_password boolean.
      var slRes = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_shared_link_by_slug", {
        method: "POST",
        headers: { ...SB_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ _slug: slug }),
      });
      var rows = slRes.ok ? await slRes.json() : null;
      var data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      var fetchErr = slRes.ok ? null : { message: slRes.statusText };

      if (fetchErr || !data) {
        setError(t("sharedLink.error.linkNotFound"));
        setLoading(false);
        return;
      }

      var link = data as unknown as SharedLinkData;

      if (link.status === "disabled") {
        setError(t("sharedLink.linkDisabled"));
        setLoading(false);
        return;
      }

      if (link.status === "revoked") {
        setError(t("sharedLink.linkRevoked"));
        setLoading(false);
        return;
      }

      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        setError(t("sharedLink.error.linkExpired"));
        setLoading(false);
        return;
      }

      if (link.status === "expired") {
        setError(t("sharedLink.error.linkExpired"));
        setLoading(false);
        return;
      }

      setLinkData(link);

      if (link.share_type === "playlist" && link.playlist_id) {
        // P0 (post-CRIT-01): call the SECURITY DEFINER RPC directly, aligned
        // with the track branch below. The previous code gated this RPC behind
        // a `GET /rest/v1/playlist_tracks` pre-check, which silently returns
        // [] for anon ever since CRIT-01 stripped the anon SELECT policy on
        // shared_links (the playlist_tracks anon policy depends on it via a
        // sub-SELECT). Result: the RPC was never invoked → playlist render
        // fell through to "no track data available".
        var tracksRes = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_playlist_tracks_for_shared_link", {
          method: "POST",
          headers: { ...SB_HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify({ _slug: slug }),
        });
        var tracks = tracksRes.ok ? await tracksRes.json() : null;
        if (!tracksRes.ok) {
          console.error("Failed to fetch playlist tracks for shared link:", tracksRes.status, "slug:", slug);
        }
        if (Array.isArray(tracks) && tracks.length > 0) {
          // RPC already returns rows ordered by playlist position
          setPlaylistTracks(tracks as unknown as TrackData[]);
        }

        // Playlist metadata is best-effort: the direct REST call hits an anon
        // RLS gap (same root cause as above) and 406s. Fall back on the
        // shared link's own name + first track's cover so the playlist render
        // branch still has something to display.
        var plRes = await fetch(REST_URL + "/playlists?select=id,name,description,cover_url&id=eq." + encodeURIComponent(link.playlist_id), { headers: { ...SB_HEADERS, "Accept": "application/vnd.pgrst.object+json" } });
        var pl = plRes.ok ? await plRes.json() : null;
        var fallbackCover: string | null = null;
        if (Array.isArray(tracks) && tracks.length > 0 && tracks[0] && typeof tracks[0].cover_url === "string") {
          fallbackCover = tracks[0].cover_url as string;
        }
        setPlaylistData((pl as unknown as PlaylistData) || {
          id: link.playlist_id,
          name: link.link_name || "",
          description: null,
          cover_url: fallbackCover,
        });
      } else if (link.track_id) {
        // Single track (also used by stems and pack share types).
        // P0-04: SECURITY DEFINER RPC scoped to this shared link's slug.
        var trackRes = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_track_for_shared_link", {
          method: "POST",
          headers: { ...SB_HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify({ _slug: slug }),
        });
        var trackRows = trackRes.ok ? await trackRes.json() : null;
        var track = Array.isArray(trackRows) && trackRows.length > 0 ? trackRows[0] : null;
        var trackErr = trackRes.ok ? null : { message: trackRes.statusText };

        if (trackErr) {
          console.error("Failed to fetch track for shared link:", trackErr, "track_id:", link.track_id, "share_type:", link.share_type);
        }
        if (track) {
          setTrackData(track as unknown as TrackData);
        }
      } else {
        console.error("Shared link has no track_id or playlist_id:", link.share_type, link.id);
      }

      setLoading(false);
    }

    fetchLink().catch(function() {
      setError(t("sharedLink.error.loadFailed"));
      setLoading(false);
    });
  }, [slug]);

  // Detect if visitor is a logged-in Trakalog user (runs once, no retry on failure)
  useEffect(function() {
    if (!linkData?.allow_save) return;
    if (wsCheckedRef.current) return;
    var backup = safeLocalStorage.getItem("trakalog_session_backup");
    if (!backup) return;
    var backupSession: any;
    try {
      backupSession = JSON.parse(backup);
    } catch (_e) {
      return;
    }
    if (!backupSession || !backupSession.user || !backupSession.user.id || !backupSession.access_token) return;
    wsCheckedRef.current = true;
    var userId = backupSession.user.id;
    var token = backupSession.access_token;
    setCurrentUserSession(backupSession);
    var pendingAutoSave = safeLocalStorage.getItem("trakalog_auto_save");
    var autoSave = pendingAutoSave === slug;
    var rpcHeaders = { "Content-Type": "application/json", "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": "Bearer " + token };
    fetch(SUPABASE_URL + "/rest/v1/rpc/get_user_workspaces", {
      method: "POST",
      headers: rpcHeaders,
      body: JSON.stringify({ _user_id: userId }),
    }).then(function(res) {
      if (!res.ok) throw new Error("get_user_workspaces failed: " + res.status);
      return res.json();
    }).then(function(workspaces: any[]) {
      var personalWs = workspaces.find(function(w: any) { return w.is_personal === true; });
      var ws = personalWs || (workspaces.length > 0 ? workspaces[0] : null);
      if (ws) {
        setCurrentUserWorkspace(ws.id);
        if (autoSave && linkData!.track_id) {
          setSavingToTrakalog(true);
          fetch(SUPABASE_URL + "/rest/v1/rpc/save_track_to_trakalog", {
            method: "POST",
            headers: rpcHeaders,
            body: JSON.stringify({ _track_id: linkData!.track_id, _source_workspace_id: linkData!.workspace_id, _target_workspace_id: ws.id, _user_id: userId }),
          }).then(function(saveRes) {
            if (saveRes.ok) {
              safeLocalStorage.removeItem("trakalog_auto_save");
              fetch(SUPABASE_URL + "/rest/v1/rpc/write_audit_log", {
                method: "POST",
                headers: rpcHeaders,
                body: JSON.stringify({ _user_id: userId, _workspace_id: ws.id, _action: "track.saved_from_share", _entity_type: "track", _entity_id: linkData!.track_id }),
              }).catch(function(err) { console.error("Audit log error:", err); });
              setSavedToTrakalog(true);
            }
            setSavingToTrakalog(false);
          }).catch(function(err) { console.error("Save to trakalog error:", err); setSavingToTrakalog(false); });
        }
      } else {
        if (autoSave) {
          window.location.href = "/onboarding?return=" + encodeURIComponent("/share/" + slug);
          return;
        }
        setUserHasNoWorkspace(true);
      }
    }).catch(function(err) { console.error("Auto-save workspace check failed:", err); setSavingToTrakalog(false); });
  }, [linkData]);

  // Auto-skip gate screen if valid visitor cookie exists
  useEffect(function() {
    if (!linkData || gateCompleted) return;
    if (!savedVisitor) return;
    // Skip the gate (both public and secured — secured will still show password screen)
    setGateCompleted(true);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    visitorEmailRef.current = savedVisitor.email;
    // Log access with cookie data
    fetch(SUPABASE_URL + "/functions/v1/log-link-access", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ slug: slug, name: savedVisitor.name, email: savedVisitor.email, role: savedVisitor.role, company: savedVisitor.company }),
    }).catch(function(err) { console.error("Failed to log access:", err); });
    logEvent(null, "view");
  }, [linkData]);

  // Auto-skip gate when disabled by sender
  useEffect(function() {
    if (!linkData || gateCompleted) return;
    if (linkData.gate_screen_enabled !== false) return;
    setGateCompleted(true);
    logEvent(null, "view");
  }, [linkData]);

  // Fetch workspace branding via SECURITY DEFINER RPC scoped to this shared
  // link's slug. The previous code did a direct `GET /rest/v1/workspaces`,
  // which 406s for anon since no SELECT policy exists on `workspaces` for the
  // anon role — exactly the same anon-RLS gap that broke the playlist branch.
  useEffect(function() {
    if (!slug || !linkData) return;
    fetch(SUPABASE_URL + "/rest/v1/rpc/get_workspace_branding_for_shared_link", {
      method: "POST",
      headers: { ...SB_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ _slug: slug }),
    })
      .then(function(r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(function(rows) {
        var data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        if (data) setBranding(data as WorkspaceBranding);
      })
      .catch(function(err) { console.error("Failed to fetch workspace branding:", err); });
  }, [slug, linkData]);

  // Recover from a media-element failure. Falls back from the watermarked stream
  // to the original audio when possible, otherwise surfaces an error. ALWAYS clears
  // the loading state so the "Preparing your secure copy" UI can never hang forever.
  // Logs are prefixed [watermark-audio] and only ever include the URL host (never
  // the signed query string / token).
  var handleWatermarkFailover = useCallback(function(context: string) {
    var audio = audioRef.current;
    if (loadWatchdogRef.current) { clearTimeout(loadWatchdogRef.current); loadWatchdogRef.current = null; }
    var host = "";
    try { host = audio && audio.currentSrc ? new URL(audio.currentSrc).hostname : ""; } catch (e) { host = ""; }
    var mediaErr = audio && audio.error ? audio.error : null;
    console.error(
      "[watermark-audio] " + context +
      " code=" + (mediaErr ? mediaErr.code : "n/a") +
      " message=" + (mediaErr && mediaErr.message ? mediaErr.message : "") +
      " host=" + host +
      " watermarked=" + watermarkActiveRef.current
    );
    if (audio && watermarkActiveRef.current && originalUrlRef.current) {
      // Watermarked stream failed → play the original so the visitor can still listen.
      watermarkActiveRef.current = false;
      setIsWatermarked(false);
      setWatermarkError("fallback");
      audio.src = originalUrlRef.current;
      audio.play().catch(function(e) {
        console.error("[watermark-audio] fallback play failed:", e && e.name, e && e.message);
        setAudioLoading(false);
        setWatermarkError("error");
      });
    } else {
      // No watermarked source involved, or the original also failed → stop spinner, show error.
      setAudioLoading(false);
      setWatermarkError("error");
    }
  }, []);

  // Setup audio element (single instance for lifetime of page)
  useEffect(function() {
    var audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    var clearWatchdog = function() {
      if (loadWatchdogRef.current) { clearTimeout(loadWatchdogRef.current); loadWatchdogRef.current = null; }
    };

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
    var onPlay = function() { setIsPlaying(true); setAudioLoading(false); clearWatchdog(); };
    var onPause = function() { setIsPlaying(false); };
    var onWaiting = function() { setAudioLoading(true); };
    var onCanPlay = function() { setAudioLoading(false); clearWatchdog(); };
    // Surface and recover from <audio> load/decode failures (e.g. a watermarked
    // stream that won't play) instead of leaving the "Preparing" spinner forever.
    var onError = function() { handleWatermarkFailover("audio element error event"); };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);

    return function() {
      // Remove the error listener FIRST so clearing src below doesn't trigger failover.
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      clearWatchdog();
      audio.pause();
      audio.src = "";
    };
  }, []);

  var fetchAudioUrl = useCallback(async function(trackId: string, quality?: string): Promise<string | null> {
    var cacheKey = trackId + ":" + (quality || "original");
    if (audioUrlCache.current[cacheKey]) return audioUrlCache.current[cacheKey];
    try {
      var res = await fetch(SUPABASE_URL + "/functions/v1/get-audio-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
          "apikey": SUPABASE_PUBLISHABLE_KEY
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
    setIsWatermarked(false);
    setWatermarkError(null);
    watermarkActiveRef.current = false;
    originalUrlRef.current = null;
    if (loadWatchdogRef.current) { clearTimeout(loadWatchdogRef.current); loadWatchdogRef.current = null; }
    fetchAudioUrl(track.id, "preview").then(function(url) {
      if (!url) {
        console.error("[watermark-audio] no audio URL returned for track", track.id);
        loadedTrackIdRef.current = null;
        setPlayingTrackId(null);
        setAudioLoading(false);
        setWatermarkError("error");
        return;
      }
      originalUrlRef.current = url;
      // Watchdog: if the chosen source never reaches playback (silent stall, no
      // "error" event), recover anyway so "Preparing" can't hang forever.
      var armLoadWatchdog = function() {
        if (loadWatchdogRef.current) clearTimeout(loadWatchdogRef.current);
        loadWatchdogRef.current = setTimeout(function() {
          var a = audioRef.current;
          if (loadedTrackIdRef.current === track.id && a && a.paused && a.currentTime === 0) {
            handleWatermarkFailover("media load watchdog (no playback within 25s)");
          }
        }, 25000);
      };
      // Try to get watermarked version first, wait up to 5s, then fallback to original
      var storagePath = track.audio_url;
      var currentLinkId = linkData?.id;
      var currentVisitorEmail = visitorEmailRef.current;
      var currentVisitorName = visitorName;
      var watermarkingOn = linkData?.watermarking_enabled !== false;
      if (watermarkingOn && storagePath && currentLinkId && currentVisitorEmail) {
        var wmAbort = new AbortController();
        var wmTimeout = setTimeout(function() { wmAbort.abort(); }, 30000);
        fetch(SUPABASE_URL + "/functions/v1/get-watermarked-audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_PUBLISHABLE_KEY
          },
          body: JSON.stringify({
            storage_path: storagePath,
            link_id: currentLinkId,
            visitor_email: currentVisitorEmail,
            visitor_name: currentVisitorName || ""
          }),
          signal: wmAbort.signal
        }).then(function(wmRes) {
          clearTimeout(wmTimeout);
          if (!wmRes.ok) throw new Error("Watermark request failed");
          return wmRes.json();
        }).then(function(wmJson) {
          if (wmJson.url && loadedTrackIdRef.current === track.id) {
            audio.src = wmJson.url;
            watermarkActiveRef.current = true;
            setIsWatermarked(true);
          } else {
            audio.src = url;
            watermarkActiveRef.current = false;
          }
          armLoadWatchdog();
          audio.play().catch(function(err) { console.error("[watermark-audio] play error:", err && err.name, err && err.message); setAudioLoading(false); });
        }).catch(function(wmErr) {
          clearTimeout(wmTimeout);
          console.warn("[watermark-audio] watermark request unavailable, using original audio:", wmErr && wmErr.name, wmErr && wmErr.message);
          if (loadedTrackIdRef.current === track.id) {
            audio.src = url;
            watermarkActiveRef.current = false;
            setWatermarkError("fallback");
            armLoadWatchdog();
            audio.play().catch(function(err) { console.error("[watermark-audio] play error:", err && err.name, err && err.message); setAudioLoading(false); });
          }
        });
      } else {
        // No watermark possible, play original directly
        audio.src = url;
        watermarkActiveRef.current = false;
        armLoadWatchdog();
        audio.play().catch(function(err) { console.error("[watermark-audio] play error:", err && err.name, err && err.message); setAudioLoading(false); });
      }
    }).catch(function (err) {
      console.error("[watermark-audio] loadAndPlayTrack error:", err && err.name, err && err.message);
      setAudioLoading(false);
      setWatermarkError("error");
    });
  }, [fetchAudioUrl, linkData, visitorName, handleWatermarkFailover]);

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

    setAudioLoading(true);
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

  var handleSeekPercent = useCallback(function(percent: number) {
    var audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = (percent / 100) * audio.duration;
  }, []);

  var handleVolumeChange = useCallback(function(e: React.ChangeEvent<HTMLInputElement>) {
    var vol = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.volume = vol;
    setVolume(vol);
  }, []);

  var handlePasswordSubmit = async function() {
    if (!linkData) return;
    try {
      var res = await fetch(SUPABASE_URL + "/functions/v1/verify-link-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
          "apikey": SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({ slug: linkData.link_slug, password: passwordInput })
      });
      var json = await res.json();
      if (json.valid) {
        setPasswordVerified(true);
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
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
      setGateError(t("sharedLink.gate.errorName"));
      return;
    }
    if (!visitorEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail.trim())) {
      setGateError(t("sharedLink.gate.errorEmail"));
      return;
    }
    setGateError("");
    setGateCompleted(true);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    visitorEmailRef.current = visitorEmail;
    setVisitorCookie({ name: visitorName.trim(), email: visitorEmail.trim(), role: visitorRole.trim(), company: visitorCompany.trim() });

    fetch(SUPABASE_URL + "/functions/v1/log-link-access", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({
        slug: slug,
        name: visitorName.trim(),
        email: visitorEmail.trim(),
        role: visitorRole.trim(),
        company: visitorCompany.trim(),
        city: visitorCity.trim(),
        country: visitorCountry,
      }),
    }).catch(function(err) { console.error("Failed to log access:", err); });

    // Log view event
    logEvent(null, "view");
  };

  var logEvent = function(trackId: string | null, eventType: string) {
    fetch(SUPABASE_URL + "/functions/v1/log-link-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ slug: slug, track_id: trackId, visitor_email: visitorEmailRef.current, event_type: eventType }),
    }).catch(function(err) { console.error("Failed to log event:", err); });
  };

  var handleSaveToTrakalog = async function() {
    if (!currentUserSession || !currentUserWorkspace || !linkData?.track_id) return;
    setSavingToTrakalog(true);
    try {
      var res = await fetch(SUPABASE_URL + "/rest/v1/rpc/save_track_to_trakalog", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": "Bearer " + currentUserSession.access_token },
        body: JSON.stringify({ _track_id: linkData.track_id, _source_workspace_id: linkData.workspace_id, _target_workspace_id: currentUserWorkspace, _user_id: currentUserSession.user.id }),
      });
      if (res.ok) {
        setSavedToTrakalog(true);
        safeLocalStorage.removeItem("trakalog_auto_save");
        logEvent(linkData.track_id, "save");
      }
    } catch (_e) { /* silent */ }
    setSavingToTrakalog(false);
  };

  // Fetch comments for the current track
  var fetchComments = useCallback(function(trackId: string, linkId: string) {
    fetch(REST_URL + "/track_comments?select=*&track_id=eq." + encodeURIComponent(trackId) + "&shared_link_id=eq." + encodeURIComponent(linkId) + "&order=timestamp_sec.asc", { headers: SB_HEADERS })
      .then(function(r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(function(data) {
        if (data) setComments(data as TrackComment[]);
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

  var handleWaveformDoubleClickPercent = useCallback(function(percent: number) {
    var audio = audioRef.current;
    var dur = (audio && audio.duration) || (trackData?.duration_sec) || (playlistTracks.length > 0 && playlistTracks[0]?.duration_sec) || 0;
    if (!dur) return;
    var seconds = (percent / 100) * dur;
    if (audio && audio.duration) audio.currentTime = seconds;
    setCommentTimestamp(seconds);
    setCommentComposerOpen(true);
    setCommentText("");
    setTimeout(function() { commentInputRef.current?.focus(); }, 50);
  }, [trackData, playlistTracks]);

  var handleSubmitComment = useCallback(function() {
    var tId = trackData?.id || playingTrackId;
    if (!tId || !linkData || !commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    fetch(REST_URL + "/track_comments", {
      method: "POST",
      headers: { ...SB_HEADERS, "Content-Type": "application/json", "Prefer": "return=representation", "Accept": "application/vnd.pgrst.object+json" },
      body: JSON.stringify({
        track_id: tId,
        shared_link_id: linkData.id,
        author_name: visitorName || "Anonymous",
        author_email: visitorEmailRef.current || null,
        author_type: "guest_recipient",
        timestamp_sec: Math.round(commentTimestamp * 100) / 100,
        content: commentText.trim(),
      })
    })
      .then(function(r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(function(data) {
        if (data) {
          setComments(function(prev) { return prev.concat([data as TrackComment]); });
          setCommentComposerOpen(false);
          setCommentText("");
        }
      }).catch(function (err) { console.error("Error:", err); })
      .finally(function () { setSubmittingComment(false); });
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
          var audioBytes = await fetch(audioUrl).then(function(r) { if (!r.ok) throw new Error("Failed to fetch audio"); return r.arrayBuffer(); });
          var fileName = (trackData.audio_url && trackData.audio_url.split("/").pop()) || (trackData.title + ".mp3");
          root.folder("Track")!.file(fileName, audioBytes);
        }
      }

      // Cover Art — real image
      if (items.indexOf("cover") >= 0) {
        var coverUrl = trackData.cover_url || DEFAULT_COVER;
        var coverBytes = await fetch(coverUrl).then(function(r) { if (!r.ok) throw new Error("Failed to fetch cover"); return r.arrayBuffer(); });
        var coverExt = trackData.cover_url ? (trackData.cover_url.match(/\.(jpe?g|png|webp)$/i)?.[0] || ".jpg") : ".png";
        root.folder("Cover Art")!.file(trackData.title + " - Cover Art" + coverExt, coverBytes);
      }

      // Lyrics — branded PDF
      if (items.indexOf("lyrics") >= 0 && trackData.lyrics) {
        var lyricsBlob = generateLyricsPdf(trackData.title, trackData.artist, trackData.lyrics, true) as Blob;
        root.folder("Lyrics")!.file(trackData.title + " - Lyrics.pdf", lyricsBlob);
      }

      // Stems — real files from storage
      if (items.indexOf("stems") >= 0) {
        var stemsRes = await fetch(REST_URL + "/stems?select=*&track_id=eq." + encodeURIComponent(trackData.id), { headers: SB_HEADERS });
        var stems = stemsRes.ok ? await stemsRes.json() : null;
        if (stems && stems.length > 0) {
          var stemsFolder = root.folder("Stems")!;
          for (var si = 0; si < stems.length; si++) {
            var stem = stems[si] as Record<string, unknown>;
            var stemPath = stem.file_path as string;
            if (!stemPath) continue;
            var stemSignRes = await fetch(STORAGE_URL + "/object/sign/stems/" + stemPath, { method: "POST", headers: { ...SB_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 3600 }) });
            var stemSignJson = stemSignRes.ok ? await stemSignRes.json() : null;
            var stemSigned = stemSignJson ? { signedUrl: SUPABASE_URL + "/storage/v1" + stemSignJson.signedURL } : null;
            if (stemSigned?.signedUrl) {
              var stemBytes = await fetch(stemSigned.signedUrl).then(function(r) { if (!r.ok) throw new Error("Failed to fetch stem"); return r.arrayBuffer(); });
              stemsFolder.file((stem.file_name as string) || ("stem-" + si), stemBytes);
            }
          }
        }
      }

      // Metadata — branded PDF
      if (items.indexOf("metadata") >= 0) {
        var meta: { label: string; value: string }[] = [
          { label: "Genre", value: (Array.isArray(trackData.genre) ? trackData.genre.join(", ") : trackData.genre) || "\u2014" },
          { label: "BPM", value: trackData.bpm ? String(trackData.bpm) : "\u2014" },
          { label: "Key", value: trackData.key || "\u2014" },
          { label: "Duration", value: trackData.duration_sec ? formatDuration(trackData.duration_sec) : "\u2014" },
          { label: "Mood", value: Array.isArray(trackData.mood) && trackData.mood.length > 0 ? trackData.mood.join(", ") : "\u2014" },
          { label: "Label", value: trackData.labels && trackData.labels.length > 0 ? trackData.labels[0] : "\u2014" },
          { label: "Publisher", value: trackData.publishers && trackData.publishers.length > 0 ? trackData.publishers.join(", ") : "\u2014" },
          { label: "ISRC", value: trackData.isrc || "\u2014" },
          { label: "Language", value: trackData.language || "\u2014" },
          { label: "Release Date", value: trackData.released_at || "\u2014" },
        ];
        var metaBlob = generateMetadataPdf(trackData.title, trackData.artist, meta, undefined, undefined, true) as Blob;
        root.folder("Metadata")!.file(trackData.title + " - Metadata.pdf", metaBlob);
      }

      // Splits — branded PDF (included with metadata, same as owner pack)
      if (items.indexOf("metadata") >= 0 && Array.isArray(trackData.splits) && trackData.splits.length > 0) {
        var totalShares = trackData.splits.reduce(function(sum, s) { return sum + (s.share || 0); }, 0);
        var splitsBlob = generateSplitsPdf(trackData.title, trackData.artist, trackData.splits, totalShares, true) as Blob;
        root.folder("Metadata")!.file(trackData.title + " - Splits.pdf", splitsBlob);
      }

      // Signed Split Agreement
      if (items.indexOf("metadata") >= 0 && trackData.id) {
        var sigRes = await fetch(REST_URL + "/signature_requests?select=collaborator_name,collaborator_email,status,signed_at,signature_data,split_share&track_id=eq." + encodeURIComponent(trackData.id), { headers: SB_HEADERS });
        var signatures = sigRes.ok ? await sigRes.json() : null;

        if (signatures) {
          var signedEntries = signatures
            .filter(function(sig) { return sig.status === "signed"; })
            .map(function(sig) {
              return {
                name: sig.collaborator_name,
                role: "",
                share: sig.split_share || 0,
                pro: "",
                ipi: "",
                publisher: "",
                signatureData: sig.signature_data,
                signedAt: sig.signed_at,
              };
            });

          if (signedEntries.length > 0) {
            var signedBlob = generateSignedAgreementPdf(trackData.title, trackData.artist, signedEntries, true) as Blob;
            root.folder("Metadata")!.file(trackData.title + " - Split Agreement (Signed).pdf", signedBlob);
          }
        }
      }

      // Credits — branded PDF
      if (items.indexOf("credits") >= 0) {
        var topLevel: { label: string; value: string }[] = [
          { label: "Artist", value: trackData.artist },
          { label: "Featuring", value: trackData.featuring || "\u2014" },
        ];
        var creditsBlob = generateCreditsPdf(trackData.title, trackData.artist, topLevel, [], [], true) as Blob;
        if (creditsBlob) {
          root.folder("Credits")!.file(trackData.title + " - Credits.pdf", creditsBlob);
        }
      }

      // Paperwork — real documents with TRAKALOG watermark on PDFs
      if (items.indexOf("paperwork") >= 0) {
        var docsRes = await fetch(REST_URL + "/track_documents?select=*&track_id=eq." + encodeURIComponent(trackData.id), { headers: SB_HEADERS });
        var docs = docsRes.ok ? await docsRes.json() : null;
        if (docs && docs.length > 0) {
          var paperworkFolder = root.folder("Paperwork")!;
          for (var di = 0; di < docs.length; di++) {
            var doc = docs[di] as Record<string, unknown>;
            var docPath = doc.file_path as string;
            if (!docPath) continue;
            var docSignRes = await fetch(STORAGE_URL + "/object/sign/documents/" + docPath, { method: "POST", headers: { ...SB_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 3600 }) });
            var docSignJson = docSignRes.ok ? await docSignRes.json() : null;
            var docSigned = docSignJson ? { signedUrl: SUPABASE_URL + "/storage/v1" + docSignJson.signedURL } : null;
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
  var effectiveDuration = duration || (trackData?.duration_sec) || 0;
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
            <h2 className="text-lg font-semibold text-foreground">{t("sharedLink.gate.welcome")}</h2>
            <p className="text-sm text-muted-foreground mt-1.5 mb-6">{t("sharedLink.gate.instruction")}</p>
            <div className="space-y-3 text-left">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t("sharedLink.gate.fullNameLabel")} <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={visitorName}
                  onChange={function(e) { setVisitorName(e.target.value); }}
                  placeholder={t("sharedLink.gate.namePlaceholder")}
                  maxLength={100}
                  className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t("sharedLink.gate.emailLabel")} <span className="text-destructive">*</span></label>
                <input
                  type="email"
                  value={visitorEmail}
                  onChange={function(e) { setVisitorEmail(e.target.value); }}
                  placeholder={t("sharedLink.gate.emailPlaceholder")}
                  maxLength={255}
                  className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t("sharedLink.gate.roleLabel")}</label>
                <select
                  value={visitorRole}
                  onChange={function(e) { setVisitorRole(e.target.value); }}
                  className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium appearance-none cursor-pointer"
                >
                  <option value="">{t("sharedLink.gate.selectRole")}</option>
                  {INDUSTRY_ROLES.map(function(r) { return <option key={r} value={r}>{r}</option>; })}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t("sharedLink.gate.companyLabel")}</label>
                <input
                  type="text"
                  value={visitorCompany}
                  onChange={function(e) { setVisitorCompany(e.target.value); }}
                  onKeyDown={function(e) { if (e.key === "Enter") handleGateSubmit(); }}
                  placeholder={t("sharedLink.gate.companyPlaceholder")}
                  maxLength={100}
                  className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                />
              </div>
              {/* Optional location — collapsed by default to keep the gate compact */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={function() { setShowLocationOptional(!showLocationOptional); }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <span>{showLocationOptional ? "−" : "+"}</span>
                  <span>Add your location (optional)</span>
                </button>
                {showLocationOptional && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input
                      type="text"
                      value={visitorCity}
                      onChange={function(e) { setVisitorCity(e.target.value); }}
                      placeholder="City"
                      maxLength={100}
                      className="h-11 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                    />
                    <select
                      value={visitorCountry}
                      onChange={function(e) { setVisitorCountry(e.target.value); }}
                      className="h-11 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium appearance-none cursor-pointer"
                    >
                      <option value="">Country</option>
                      {COUNTRIES.map(function(c) { return <option key={c} value={c}>{c}</option>; })}
                    </select>
                  </div>
                )}
              </div>
              {gateError && (
                <p className="text-xs text-destructive text-center">{gateError}</p>
              )}
              <button
                onClick={handleGateSubmit}
                className="w-full h-11 rounded-xl text-sm font-semibold btn-brand"
              >
                {t("sharedLink.gate.continueButton")}
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
          <h2 className="text-lg font-semibold text-foreground">{t("sharedLink.password.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1.5 mb-6">{t("sharedLink.password.instruction")}</p>
          <div className="space-y-3">
            <input
              type="password"
              value={passwordInput}
              onChange={function(e) { setPasswordInput(e.target.value); }}
              onKeyDown={function(e) { if (e.key === "Enter") handlePasswordSubmit(); }}
              placeholder={t("sharedLink.password.placeholder")}
              className={"w-full h-11 px-4 rounded-xl bg-secondary border text-sm text-foreground outline-none transition-all " + (passwordError ? "border-destructive" : "border-border focus:border-primary/40")}
            />
            {passwordError && (
              <p className="text-xs text-destructive">{t("sharedLink.password.error")}</p>
            )}
            <button
              onClick={handlePasswordSubmit}
              className="w-full h-11 rounded-xl text-sm font-semibold btn-brand"
            >
              {t("sharedLink.password.accessButton")}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Playlist view ──
  if (isPlaylist && playlistData) {
    var totalDuration = playlistTracks.reduce(function(sum, t) { return sum + (t.duration_sec || 0); }, 0);
    var plImmersive = !!branding?.hero_image_url;
    return (
      <Shell branding={branding}>
        <div className="max-w-2xl mx-auto py-8 px-4 space-y-6" style={branding?.brand_color ? { "--brand-accent": branding.brand_color } as React.CSSProperties : undefined}>
          {linkData?.message && (
            plImmersive ? (
              <div className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 px-6 py-5">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-brand-orange via-brand-pink to-brand-purple rounded-full" />
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5">{t("sharedLink.messageFromSender")}</p>
                    <p className="text-sm text-white leading-relaxed font-medium">{linkData.message}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-brand-orange/15 bg-gradient-to-br from-brand-orange/5 via-brand-pink/5 to-brand-purple/5 px-6 py-5">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-brand-orange via-brand-pink to-brand-purple rounded-full" />
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-brand-orange uppercase tracking-wider mb-1.5">{t("sharedLink.messageFromSender")}</p>
                    <p className="text-sm text-foreground leading-relaxed font-medium">{linkData.message}</p>
                  </div>
                </div>
              </div>
            )
          )}

          {linkData?.expires_at && (
            <div className={"flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl " + (plImmersive ? "bg-white/5 backdrop-blur border border-white/10" : "bg-brand-orange/10 border border-brand-orange/20")}>
              <Clock className={"w-3.5 h-3.5 " + (plImmersive ? "text-white/60" : "text-brand-orange")} />
              <p className={"text-xs font-medium " + (plImmersive ? "text-white/60" : "text-brand-orange")}>
                {t("sharedLink.expiresOn", { date: new Date(linkData.expires_at).toLocaleDateString(i18n.language, { month: "long", day: "numeric", year: "numeric" }) })}
              </p>
            </div>
          )}

          {/* Playlist header card */}
          <div className={plImmersive ? "rounded-2xl p-px bg-gradient-to-br from-brand-orange/15 via-brand-pink/15 to-brand-purple/15 hover:from-brand-orange/25 hover:via-brand-pink/25 hover:to-brand-purple/25 transition-all duration-500" : ""}>
          <div className={"rounded-2xl overflow-hidden " + (plImmersive ? "bg-white/8 backdrop-blur-xl border border-white/10" : "bg-card border border-border")} style={plImmersive ? { boxShadow: "0 0 40px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.4)" } : { boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 p-4 sm:p-6">
              <div className={"w-full max-w-[220px] sm:w-32 md:w-40 aspect-square sm:h-32 md:h-40 rounded-xl overflow-hidden shrink-0 bg-secondary border border-border/50 " + (plImmersive ? "ring-1 ring-white/20 shadow-xl" : "")}>
                <img src={playlistData.cover_url || DEFAULT_COVER} alt={playlistData.name} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <p className={"text-[10px] uppercase tracking-wider font-semibold mb-1 " + (plImmersive ? "text-white/60" : "text-primary")}>{t("sharedLink.playlistLabel")}</p>
                <h1 className={"text-xl sm:text-2xl font-bold tracking-tight leading-tight " + (plImmersive ? "text-white" : "text-foreground")}>
                  {playlistData.name}
                </h1>
                {playlistData.description && (
                  <p className={"text-sm mt-1.5 leading-relaxed " + (plImmersive ? "text-white/60" : "text-muted-foreground")}>{playlistData.description}</p>
                )}
                <div className={"flex items-center gap-3 mt-3 " + (plImmersive ? "text-white/50" : "text-muted-foreground")}>
                  <span className="flex items-center gap-1 text-xs font-medium">
                    <Music className="w-3.5 h-3.5" />
                    {t("common.trackCount", { count: playlistTracks.length })}
                  </span>
                  {totalDuration > 0 && (
                    <>
                      <span className={"w-px h-3.5 " + (plImmersive ? "bg-white/20" : "bg-border")} />
                      <span className="flex items-center gap-1 text-xs font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(totalDuration)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Sticky player — active when a track is playing */}
          {playingTrackId && (function() {
              var activeTrack = playlistTracks.find(function(t) { return t.id === playingTrackId; });
              var activeIdx = playlistTracks.findIndex(function(t) { return t.id === playingTrackId; });
              var hasPrev = activeIdx > 0;
              var hasNext = activeIdx >= 0 && activeIdx < playlistTracks.length - 1;
              return (
                <div className="sticky top-0 z-30">
                <div className={"rounded-2xl overflow-hidden " + (plImmersive ? "bg-black/80 backdrop-blur-xl border border-white/15" : "bg-card/95 backdrop-blur-md border border-border")} style={plImmersive ? { boxShadow: "0 8px 32px rgba(0,0,0,0.45)" } : { boxShadow: "0 8px 24px rgba(0,0,0,0.14)" }}>
                <div className={"px-6 py-4 space-y-3"}>
                  {/* Now playing info */}
                  {activeTrack && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary border border-border/50">
                        <img src={activeTrack.cover_url || DEFAULT_COVER} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={"text-[13px] font-semibold truncate " + (plImmersive ? "text-white" : "text-foreground")}>{activeTrack.title}</p>
                        <p className={"text-[11px] truncate " + (plImmersive ? "text-white/50" : "text-muted-foreground")}>
                          {activeTrack.artist}
                          {activeTrack.featuring ? " ft. " + activeTrack.featuring : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Progress bar / Waveform */}
                  <div className="relative">
                    <TrackWaveformPlayer
                      seed={activeTrack ? hashId(activeTrack.id) : 0}
                      peaks={activeTrack ? parseWaveform(activeTrack.waveform_data) || undefined : undefined}
                      progress={progress}
                      onSeek={handleSeekPercent}
                      onDoubleClick={handleWaveformDoubleClickPercent}
                      isPlaying={isPlaying}
                      unplayedColor={plImmersive ? "rgba(255,255,255,0.3)" : undefined}
                    />
                    <CommentMarkers comments={comments} totalDuration={effectiveDuration} />
                  </div>
                  <ChapterPills
                    chapters={activeTrack ? activeTrack.chapters : null}
                    duration={effectiveDuration || (activeTrack?.duration_sec || 0)}
                    onSeek={handleSeekPercent}
                    dark={plImmersive}
                  />
                  <p className={"text-[10px] text-center " + (plImmersive ? "text-white/40" : "text-muted-foreground/40")}>{t("sharedLink.doubleClickHint")}</p>

                  {commentComposerOpen && (
                    <div className={"flex items-center gap-2 px-3 py-2.5 rounded-xl " + (plImmersive ? "bg-white/10 backdrop-blur border border-white/10" : "bg-secondary/80 border border-border")}>
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
                        placeholder={t("sharedLink.commentPlaceholder")}
                        className={"flex-1 bg-transparent text-sm outline-none " + (plImmersive ? "text-white placeholder:text-white/40" : "text-foreground placeholder:text-muted-foreground")}
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
                        className={"p-1.5 rounded-lg transition-colors " + (plImmersive ? "text-white/40 hover:text-white" : "text-muted-foreground hover:text-foreground")}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {audioLoading && !watermarkError && playingTrackId && linkData?.watermarking_enabled !== false && (
                    <div className={"flex items-start gap-2.5 px-3 py-2.5 rounded-xl " + (plImmersive ? "bg-white/8 backdrop-blur border border-white/10" : "bg-muted/40 border border-border")}>
                      <ShieldCheck className={"w-4 h-4 mt-0.5 shrink-0 animate-pulse " + (plImmersive ? "text-white/80" : "text-primary")} />
                      <div className="min-w-0 flex-1">
                        <p className={"text-xs font-semibold " + (plImmersive ? "text-white" : "text-foreground")}>{t("sharedLink.watermark.preparing")}</p>
                        <p className={"text-[10px] mt-0.5 " + (plImmersive ? "text-white/55" : "text-muted-foreground")}>{t("sharedLink.watermark.explanation")}</p>
                      </div>
                    </div>
                  )}

                  {watermarkError && playingTrackId && (
                    <div className={"flex items-start gap-2.5 px-3 py-2.5 rounded-xl " + (plImmersive ? "bg-amber-500/10 border border-amber-400/25" : "bg-destructive/10 border border-destructive/25")}>
                      <AlertCircle className={"w-4 h-4 mt-0.5 shrink-0 " + (plImmersive ? "text-amber-300" : "text-destructive")} />
                      <div className="min-w-0 flex-1">
                        <p className={"text-xs font-semibold " + (plImmersive ? "text-white" : "text-foreground")}>
                          {watermarkError === "fallback" ? "Protection unavailable" : "Playback failed"}
                        </p>
                        <p className={"text-[10px] mt-0.5 " + (plImmersive ? "text-white/55" : "text-muted-foreground")}>
                          {watermarkError === "fallback" ? "Playing the original audio instead." : "Couldn't load this track — please try again."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Controls row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-[40px]">
                      <span className={"text-[11px] font-mono tabular-nums " + (plImmersive ? "text-white/50" : "text-muted-foreground")}>
                        {formatDuration(currentTime)}
                      </span>
                      {isWatermarked && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={"inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full cursor-help " + (plImmersive ? "bg-white/10 text-white/50" : "bg-muted text-muted-foreground")}>
                              <ShieldCheck className="w-3 h-3" />
                              {t("sharedLink.watermark.protected")}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[260px]">
                            {t("sharedLink.watermark.tooltip")}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Transport controls */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handlePrevTrack}
                        disabled={!hasPrev && (!audioRef.current || audioRef.current.currentTime < 1)}
                        className={"p-1.5 rounded-lg transition-colors disabled:opacity-30 " + (plImmersive ? "text-white/50 hover:text-white" : "text-muted-foreground hover:text-foreground")}
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={function() { if (activeTrack) handlePlayTrack(activeTrack); }}
                        className="w-10 h-10 rounded-full btn-brand flex items-center justify-center"
                        style={branding?.brand_color ? { background: branding.brand_color } : undefined}
                      >
                        {audioLoading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : isPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5 ml-0.5" />}
                      </button>
                      <button
                        onClick={handleNextTrack}
                        disabled={!hasNext}
                        className={"p-1.5 rounded-lg transition-colors disabled:opacity-30 " + (plImmersive ? "text-white/50 hover:text-white" : "text-muted-foreground hover:text-foreground")}
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Volume + duration */}
                    <div className="flex items-center gap-1.5 w-10 justify-end sm:w-auto">
                      <button
                        onClick={function() {
                          if (volume === 0) {
                            var restore = prevVolumeRef.current || 0.8;
                            if (audioRef.current) audioRef.current.volume = restore;
                            setVolume(restore);
                          } else {
                            prevVolumeRef.current = volume;
                            if (audioRef.current) audioRef.current.volume = 0;
                            setVolume(0);
                          }
                        }}
                        className={"p-1 rounded-lg transition-colors " + (plImmersive ? "text-white/50 hover:text-white" : "text-muted-foreground hover:text-foreground")}
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
                      <span className={"text-[11px] font-mono tabular-nums ml-1 hidden sm:inline " + (plImmersive ? "text-white/50" : "text-muted-foreground")}>
                        {formatDuration(duration)}
                      </span>
                    </div>
                  </div>
                  {isWatermarked && !audioLoading && (
                    <p className={"text-[10px] text-center " + (plImmersive ? "text-white/40" : "text-muted-foreground/60")}>
                      {t("sharedLink.watermark.confirmation")}
                    </p>
                  )}

                  {activeTrack && Array.isArray(activeTrack.lyrics_segments) && activeTrack.lyrics_segments.length > 0 && (
                    <KaraokeLyrics
                      segments={activeTrack.lyrics_segments}
                      currentTime={currentTime}
                      isPlaying={isPlaying}
                      onSeek={function(time) { if (audioRef.current) { audioRef.current.currentTime = time; } }}
                      darkBg={plImmersive}
                      className={(plImmersive ? "border-t border-white/10" : "border-t border-border") + " -mx-6 px-6 mt-2"}
                    />
                  )}
                </div>
                </div>
                </div>
              );
            })()}

          {/* Track list card */}
          {playlistTracks.length > 0 && (
            <div className={plImmersive ? "rounded-2xl p-px bg-gradient-to-br from-brand-orange/15 via-brand-pink/15 to-brand-purple/15 hover:from-brand-orange/25 hover:via-brand-pink/25 hover:to-brand-purple/25 transition-all duration-500" : ""}>
            <div className={"rounded-2xl overflow-hidden " + (plImmersive ? "bg-white/8 backdrop-blur-xl border border-white/10" : "bg-card border border-border")} style={plImmersive ? { boxShadow: "0 0 40px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.4)" } : { boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
              <div>
                {playlistTracks.map(function(track) {
                  var isActive = playingTrackId === track.id;
                  var isAudioPlaying = isActive && isPlaying;
                  return (
                    <div
                      key={track.id}
                      onClick={function() { handlePlayTrack(track); }}
                      className={"flex items-center gap-3 px-6 py-3 last:border-0 transition-colors cursor-pointer select-none " + (plImmersive ? "border-b border-white/5 hover:bg-white/5 " : "border-b border-border/40 hover:bg-secondary/30 ") + (isActive ? (plImmersive ? "bg-white/10" : "bg-primary/5") : "")}
                    >
                      {/* Play button / track number */}
                      <div
                        className={"w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all " + (isAudioPlaying ? "btn-brand" : (plImmersive ? "bg-white/10 text-white hover:bg-white/20" : "bg-secondary/80 text-foreground hover:bg-primary/15 hover:text-primary"))}
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
                        <p className={"text-[13px] font-semibold truncate " + (isActive ? "text-primary" : (plImmersive ? "text-white" : "text-foreground"))}>{track.title}</p>
                        <p className={"text-[11px] truncate " + (plImmersive ? "text-white/50" : "text-muted-foreground")}>
                          {track.artist}
                          {track.featuring ? " ft. " + track.featuring : ""}
                        </p>
                      </div>

                      {/* Duration */}
                      <span className={"text-[11px] font-mono tabular-nums shrink-0 " + (plImmersive ? "text-white/40" : "text-muted-foreground")}>
                        {track.duration_sec ? formatDuration(track.duration_sec) : "--:--"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {!playingTrackId && (
                <div className={(plImmersive ? "border-t border-white/10 bg-white/5" : "border-t border-border bg-secondary/20") + " px-6 py-4"}>
                  <div className={"flex items-center justify-center gap-2 " + (plImmersive ? "text-white/50" : "text-muted-foreground")}>
                    <Play className="w-4 h-4" />
                    <span className="text-xs font-medium">{t("sharedLink.selectTrackPrompt")}</span>
                  </div>
                </div>
              )}
            </div>
            </div>
          )}

          {linkData?.allow_download && playlistTracks.length > 0 && (
            <div className={"rounded-2xl overflow-hidden p-4 " + (plImmersive ? "bg-white/5 backdrop-blur-xl border border-white/10" : "bg-card border border-border")}>
              <p className={"text-xs mb-3 " + (plImmersive ? "text-white/50" : "text-muted-foreground")}>Download is enabled for this shared link</p>
              <div className="space-y-2">
                {playlistTracks.map(function(track) {
                  return (
                    <button
                      key={track.id}
                      onClick={function() {
                        logEvent(track.id, "download");
                        fetchAudioUrl(track.id, linkData.download_quality === "hi-res" ? "original" : "preview").then(function(url) {
                          if (!url) return;
                          fetch(url).then(function(res) { if (!res.ok) throw new Error("Download failed: " + res.status); return res.blob(); }).then(function(blob) {
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
                      className={"w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs transition-colors " + (plImmersive ? "border border-white/10 bg-white/5 hover:bg-white/10" : "border border-border bg-card hover:bg-secondary")}
                    >
                      <span className={"font-medium " + (plImmersive ? "text-white" : "text-foreground")}>{track.title} - {track.artist}</span>
                      <span className={"flex items-center gap-1.5 " + (plImmersive ? "text-white/50" : "text-muted-foreground")}>
                        <Download className="w-3.5 h-3.5" />
                        {t(linkData.download_quality === "hi-res" ? "sharedLink.qualityHiRes" : "sharedLink.qualityLowRes")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className={"text-center text-[10px] " + (plImmersive ? "text-white/40" : "text-muted-foreground/60")}>
            {t("sharedLink.sharedVia", { date: new Date(linkData?.created_at || "").toLocaleDateString(i18n.language, { month: "long", day: "numeric", year: "numeric" }) })}
          </p>
        </div>
      </Shell>
    );
  }

  // ── Single track view ──
  var immersive = !!branding?.hero_image_url;
  return (
    <Shell branding={branding}>
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6" style={branding?.brand_color ? { "--brand-accent": branding.brand_color } as React.CSSProperties : undefined}>
        {linkData?.message && (
          immersive ? (
            <div className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 px-6 py-5">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-brand-orange via-brand-pink to-brand-purple rounded-full" />
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5">{t("sharedLink.messageFromSender")}</p>
                  <p className="text-sm text-white leading-relaxed font-medium">{linkData.message}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border border-brand-orange/15 bg-gradient-to-br from-brand-orange/5 via-brand-pink/5 to-brand-purple/5 px-6 py-5">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-brand-orange via-brand-pink to-brand-purple rounded-full" />
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-brand-orange uppercase tracking-wider mb-1.5">{t("sharedLink.messageFromSender")}</p>
                  <p className="text-sm text-foreground leading-relaxed font-medium">{linkData.message}</p>
                </div>
              </div>
            </div>
          )
        )}

        {linkData?.expires_at && (
          <div className={"flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl " + (immersive ? "bg-white/5 backdrop-blur border border-white/10" : "bg-brand-orange/10 border border-brand-orange/20")}>
            <Clock className={"w-3.5 h-3.5 " + (immersive ? "text-white/60" : "text-brand-orange")} />
            <p className={"text-xs font-medium " + (immersive ? "text-white/60" : "text-brand-orange")}>
              {t("sharedLink.expiresOn", { date: new Date(linkData.expires_at).toLocaleDateString(i18n.language, { month: "long", day: "numeric", year: "numeric" }) })}
            </p>
          </div>
        )}

        {trackData ? (
          <div className={immersive ? "rounded-2xl p-px bg-gradient-to-br from-brand-orange/15 via-brand-pink/15 to-brand-purple/15 hover:from-brand-orange/25 hover:via-brand-pink/25 hover:to-brand-purple/25 transition-all duration-500" : ""}>
          <div className={"rounded-2xl overflow-hidden " + (immersive ? "bg-white/8 backdrop-blur-xl border border-white/10" : "bg-card border border-border")} style={immersive ? { boxShadow: "0 0 40px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.4)" } : { boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 p-4 sm:p-6">
              <div className={"w-full max-w-[150px] sm:w-32 md:w-40 aspect-square sm:h-32 md:h-40 rounded-xl overflow-hidden shrink-0 bg-secondary border border-border/50 " + (immersive ? "ring-1 ring-white/20 shadow-xl" : "")}>
                <img src={trackData.cover_url || DEFAULT_COVER} alt={trackData.title} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <p className={"text-[10px] uppercase tracking-wider font-semibold mb-1 flex items-center " + (immersive ? "" : "text-primary")} style={!immersive && branding?.brand_color ? { color: branding.brand_color } : undefined}>
                  {immersive && <span className="inline-block w-6 h-0.5 bg-gradient-to-r from-brand-orange to-brand-pink rounded-full mr-2" />}
                  <span className={immersive ? "bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple bg-clip-text text-transparent" : ""}>{t(linkData?.share_type === "stems" ? "sharedLink.shareType.stems" : linkData?.share_type === "pack" ? "sharedLink.shareType.pack" : "sharedLink.shareType.track")}</span>
                </p>
                <h1 className={"text-xl sm:text-2xl font-bold tracking-tight leading-tight " + (immersive ? "text-white" : "text-foreground truncate")}>
                  {trackData.title}
                </h1>
                <p className={"text-sm mt-1 " + (immersive ? "text-white/60" : "text-muted-foreground")}>
                  {trackData.artist}
                  {trackData.featuring ? " ft. " + trackData.featuring : ""}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {trackData.genre && (Array.isArray(trackData.genre) ? trackData.genre.length > 0 : true) && (
                    <span className={"px-2 py-0.5 rounded-md text-[10px] font-medium " + (immersive ? "bg-white/12 border border-white/15 text-white/90" : "bg-secondary text-muted-foreground")} style={!immersive && branding?.brand_color ? { backgroundColor: branding.brand_color + "18", color: branding.brand_color } : undefined}>{Array.isArray(trackData.genre) ? trackData.genre.join(", ") : trackData.genre}</span>
                  )}
                  {trackData.bpm && (
                    <span className={"px-2 py-0.5 rounded-md text-[10px] font-medium font-mono " + (immersive ? "bg-white/12 border border-white/15 text-white/90" : "bg-secondary text-muted-foreground")} style={!immersive && branding?.brand_color ? { backgroundColor: branding.brand_color + "18", color: branding.brand_color } : undefined}>{trackData.bpm + " BPM"}</span>
                  )}
                  {trackData.key && (
                    <span className={"px-2 py-0.5 rounded-md text-[10px] font-medium " + (immersive ? "bg-white/12 border border-white/15 text-white/90" : "bg-secondary text-muted-foreground")} style={!immersive && branding?.brand_color ? { backgroundColor: branding.brand_color + "18", color: branding.brand_color } : undefined}>{trackData.key}</span>
                  )}
                  {trackData.duration_sec && (
                    <span className={"px-2 py-0.5 rounded-md text-[10px] font-medium " + (immersive ? "bg-white/12 border border-white/15 text-white/90" : "bg-secondary text-muted-foreground")} style={!immersive && branding?.brand_color ? { backgroundColor: branding.brand_color + "18", color: branding.brand_color } : undefined}>
                      <Clock className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                      {formatDuration(trackData.duration_sec)}
                    </span>
                  )}
                </div>
                {Array.isArray(trackData.mood) && trackData.mood.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {trackData.mood.map(function(m) {
                      return (
                        <span key={m} className={"px-2 py-0.5 rounded-md text-[10px] font-medium " + (immersive ? "bg-white/12 border border-white/15 text-white/90" : "bg-primary/10 text-primary")}>{m}</span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Credits */}
            {(() => {
              if (!trackData.splits || trackData.splits.length === 0) return null;
              var creditEntries: { label: string; names: string }[] = [];
              var formatName = function (s: { name: string; stage_name?: string }) { return s.stage_name ? s.name + " (" + s.stage_name + ")" : s.name; };
              // Build credits map from splits
              var creditsMap: Record<string, string[]> = {};
              for (var ci = 0; ci < trackData.splits.length; ci++) {
                var sp = trackData.splits[ci];
                if (!sp.name) continue;
                var displayName = formatName(sp);
                // Read roles: support both role (comma string) and roles (array)
                var splitRoles: string[] = [];
                if (Array.isArray((sp as any).roles) && (sp as any).roles.length > 0) {
                  splitRoles = (sp as any).roles;
                } else if (sp.role) {
                  splitRoles = sp.role.split(",").map(function (r) { return r.trim(); }).filter(function (r) { return r !== ""; });
                }
                for (var ri = 0; ri < splitRoles.length; ri++) {
                  var rl = splitRoles[ri].toLowerCase();
                  var cat = "";
                  if (rl.indexOf("songwriter") >= 0 || rl.indexOf("writer") >= 0) cat = "WRITTEN BY";
                  else if (rl.indexOf("producer") >= 0) cat = "PRODUCED BY";
                  else if (rl.indexOf("artist") >= 0) cat = "PERFORMED BY";
                  else if (rl.indexOf("musician") >= 0) cat = "MUSICIANS";
                  if (cat) {
                    if (!creditsMap[cat]) creditsMap[cat] = [];
                    if (creditsMap[cat].indexOf(displayName) < 0) creditsMap[cat].push(displayName);
                  }
                }
              }
              var categoryOrder = ["WRITTEN BY", "PRODUCED BY", "PERFORMED BY", "MUSICIANS"];
              for (var oi = 0; oi < categoryOrder.length; oi++) {
                if (creditsMap[categoryOrder[oi]]) creditEntries.push({ label: categoryOrder[oi], names: creditsMap[categoryOrder[oi]].join(", ") });
              }
              if (creditEntries.length === 0) return null;
              return (
                <div className="px-6 pt-3">
                  <button onClick={function () { setCreditsOpen(!creditsOpen); }} className={"flex items-center gap-1.5 text-sm transition-colors " + (immersive ? "text-white/50 hover:text-white" : "text-muted-foreground hover:text-foreground")}>
                    <Award className="w-3.5 h-3.5" />
                    Credits
                    {creditsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {creditsOpen && (
                    <div className={"mt-2 rounded-lg p-4 space-y-2.5 " + (immersive ? "bg-white/5" : "bg-secondary/50")}>
                      {creditEntries.map(function (entry) {
                        return (
                          <div key={entry.label}>
                            <p className={"text-[10px] uppercase tracking-wider font-semibold " + (immersive ? "text-white/40" : "text-muted-foreground")}>{entry.label}</p>
                            <p className={"text-sm " + (immersive ? "text-white" : "text-foreground")}>{entry.names}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Player */}
            {(trackData.audio_url || slug) && (
              <>
              {immersive && <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-6" />}
              <div className={"px-6 py-4 space-y-3 " + (immersive ? "" : "border-t border-border")}>
                <div className="relative">
                  <TrackWaveformPlayer
                    seed={hashId(trackData.id)}
                    peaks={parseWaveform(trackData.waveform_data) || undefined}
                    progress={progress}
                    onSeek={handleSeekPercent}
                    onDoubleClick={handleWaveformDoubleClickPercent}
                    isPlaying={isPlaying}
                    unplayedColor={immersive ? "rgba(255,255,255,0.3)" : undefined}
                  />
                  <CommentMarkers comments={comments} totalDuration={effectiveDuration} />
                </div>
                <ChapterPills
                  chapters={trackData.chapters}
                  duration={effectiveDuration || (trackData.duration_sec || 0)}
                  onSeek={handleSeekPercent}
                  dark={immersive}
                />
                <p className={"text-[10px] text-center " + (immersive ? "text-white/40" : "text-muted-foreground/40")}>Double-click waveform to leave a comment</p>

                {commentComposerOpen && (
                  <div className={"flex items-center gap-2 px-3 py-2.5 rounded-xl " + (immersive ? "bg-white/10 backdrop-blur border border-white/10" : "bg-secondary/80 border border-border")}>
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
                      className={"flex-1 bg-transparent text-sm outline-none " + (immersive ? "text-white placeholder:text-white/40" : "text-foreground placeholder:text-muted-foreground")}
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
                      className={"p-1.5 rounded-lg transition-colors " + (immersive ? "text-white/40 hover:text-white" : "text-muted-foreground hover:text-foreground")}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {audioLoading && !watermarkError && playingTrackId === trackData.id && linkData?.watermarking_enabled !== false && (
                  <div className={"flex items-start gap-2.5 px-3 py-2.5 rounded-xl " + (immersive ? "bg-white/8 backdrop-blur border border-white/10" : "bg-muted/40 border border-border")}>
                    <ShieldCheck className={"w-4 h-4 mt-0.5 shrink-0 animate-pulse " + (immersive ? "text-white/80" : "text-primary")} />
                    <div className="min-w-0 flex-1">
                      <p className={"text-xs font-semibold " + (immersive ? "text-white" : "text-foreground")}>{t("sharedLink.watermark.preparing")}</p>
                      <p className={"text-[10px] mt-0.5 " + (immersive ? "text-white/55" : "text-muted-foreground")}>{t("sharedLink.watermark.explanation")}</p>
                    </div>
                  </div>
                )}

                {watermarkError && playingTrackId === trackData.id && (
                  <div className={"flex items-start gap-2.5 px-3 py-2.5 rounded-xl " + (immersive ? "bg-amber-500/10 border border-amber-400/25" : "bg-destructive/10 border border-destructive/25")}>
                    <AlertCircle className={"w-4 h-4 mt-0.5 shrink-0 " + (immersive ? "text-amber-300" : "text-destructive")} />
                    <div className="min-w-0 flex-1">
                      <p className={"text-xs font-semibold " + (immersive ? "text-white" : "text-foreground")}>
                        {watermarkError === "fallback" ? "Protection unavailable" : "Playback failed"}
                      </p>
                      <p className={"text-[10px] mt-0.5 " + (immersive ? "text-white/55" : "text-muted-foreground")}>
                        {watermarkError === "fallback" ? "Playing the original audio instead." : "Couldn't load this track — please try again."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={"text-[11px] font-mono tabular-nums " + (immersive ? "text-white/50" : "text-muted-foreground")}>
                      {formatDuration(currentTime)}
                    </span>
                    {isWatermarked && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={"inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full cursor-help " + (immersive ? "bg-white/10 text-white/50" : "bg-muted text-muted-foreground")}>
                            <ShieldCheck className="w-3 h-3" />
                            {t("sharedLink.watermark.protected")}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[260px]">
                          {t("sharedLink.watermark.tooltip")}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <button
                    onClick={function() { handlePlayTrack(trackData!); }}
                    className="w-11 h-11 rounded-full btn-brand flex items-center justify-center"
                    style={branding?.brand_color ? { background: branding.brand_color } : undefined}
                  >
                    {audioLoading && playingTrackId === trackData.id ? <Loader2 className="w-5 h-5 animate-spin" /> : playingTrackId === trackData.id && isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={function() {
                        if (volume === 0) {
                          var restore = prevVolumeRef.current || 0.8;
                          if (audioRef.current) audioRef.current.volume = restore;
                          setVolume(restore);
                        } else {
                          prevVolumeRef.current = volume;
                          if (audioRef.current) audioRef.current.volume = 0;
                          setVolume(0);
                        }
                      }}
                      className={"p-1 rounded-lg transition-colors " + (immersive ? "text-white/50 hover:text-white" : "text-muted-foreground hover:text-foreground")}
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
                    <span className={"text-[11px] font-mono tabular-nums ml-1 " + (immersive ? "text-white/50" : "text-muted-foreground")}>
                      {formatDuration(duration)}
                    </span>
                  </div>
                </div>
                {isWatermarked && !audioLoading && (
                  <p className={"text-[10px] text-center " + (immersive ? "text-white/40" : "text-muted-foreground/60")}>
                    {t("sharedLink.watermark.confirmation")}
                  </p>
                )}
              </div>
            </>
            )}

            {Array.isArray(trackData.lyrics_segments) && trackData.lyrics_segments.length > 0 && playingTrackId === trackData.id && (
              <KaraokeLyrics
                segments={trackData.lyrics_segments}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onSeek={function(time) { if (audioRef.current) { audioRef.current.currentTime = time; } }}
                darkBg={immersive}
                className={(immersive ? "border-t border-white/10" : "border-t border-border") + " px-6"}
              />
            )}

            {linkData?.allow_download && (trackData.audio_url || slug) && linkData.share_type !== "pack" && (
              <div className={"px-6 py-4 " + (immersive ? "border-t border-white/10" : "border-t border-border")}>
                <button
                  onClick={function() {
                    logEvent(trackData!.id, "download");
                    fetchAudioUrl(trackData!.id, linkData.download_quality === "hi-res" ? "original" : "preview").then(function(url) {
                      if (!url) return;
                      fetch(url).then(function(res) { if (!res.ok) throw new Error("Download failed: " + res.status); return res.blob(); }).then(function(blob) {
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
                  {t("sharedLink.downloadButton", { quality: t(linkData.download_quality === "hi-res" ? "sharedLink.qualityHiRes" : "sharedLink.qualityLowRes") })}
                </button>
              </div>
            )}

            {linkData?.track_id && (
              <div className={"px-6 py-4 " + (immersive ? "border-t border-white/10" : "border-t border-border")}>
                {savedToTrakalog ? (
                  <div className={"inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold " + (immersive ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : "bg-emerald-500/10 text-emerald-500")}>
                    <Bookmark className="w-4 h-4" />
                    {t("sharedLink.save.saved")}
                  </div>
                ) : currentUserSession && !userHasNoWorkspace ? (
                  <button
                    onClick={handleSaveToTrakalog}
                    disabled={savingToTrakalog}
                    className={"inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[44px] " + (immersive ? "bg-white/10 backdrop-blur-xl border border-white/15 text-white hover:bg-white/20" : "btn-brand")}
                  >
                    <Bookmark className="w-4 h-4" />
                    {savingToTrakalog ? t("sharedLink.save.saving") : t("sharedLink.save.button")}
                  </button>
                ) : currentUserSession && userHasNoWorkspace ? (
                  <a
                    href="/onboarding"
                    onClick={function() { safeLocalStorage.setItem("trakalog_auto_save", JSON.stringify({ slug: slug!, track_id: linkData?.track_id, source_workspace_id: linkData?.workspace_id })); }}
                    className={"inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[44px] " + (immersive ? "bg-white/10 backdrop-blur-xl border border-white/15 text-white hover:bg-white/20" : "btn-brand")}
                  >
                    <Bookmark className="w-4 h-4" />
                    {t("sharedLink.save.button")}
                  </a>
                ) : (
                  <a
                    href="/auth"
                    onClick={function() { safeLocalStorage.setItem("trakalog_auto_save", JSON.stringify({ slug: slug!, track_id: linkData?.track_id, source_workspace_id: linkData?.workspace_id })); }}
                    className={"inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[44px] " + (immersive ? "bg-white/10 backdrop-blur-xl border border-white/15 text-white hover:bg-white/20" : "border border-border bg-card text-foreground hover:bg-secondary")}
                  >
                    <Bookmark className="w-4 h-4" />
                    {t("sharedLink.save.signUpButton")}
                  </a>
                )}
              </div>
            )}

            {linkData?.share_type === "pack" && linkData.pack_items && linkData.pack_items.length > 0 && (
              <div className={"px-6 py-4 " + (immersive ? "border-t border-white/10" : "border-t border-border")}>
                <button
                  onClick={handleDownloadPack}
                  disabled={packDownloading}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, hsl(24, 100%, 55%), hsl(330, 80%, 60%), hsl(270, 70%, 55%))" }}
                >
                  {packDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("sharedLink.pack.generating")}
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4" />
                      {t("sharedLink.pack.downloadButton")}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className={"w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 " + (immersive ? "bg-white/10" : "bg-secondary")}>
              <Music className={"w-6 h-6 " + (immersive ? "text-white/60" : "text-muted-foreground")} />
            </div>
            <h2 className={"text-lg font-semibold " + (immersive ? "text-white" : "text-foreground")}>{linkData?.link_name || t("sharedLink.fallback.sharedContent")}</h2>
            <p className={"text-sm mt-1.5 " + (immersive ? "text-white/50" : "text-muted-foreground")}>{t("sharedLink.fallback.noTrackData")}</p>
          </div>
        )}

        <p className={"text-center text-[10px] " + (immersive ? "text-white/40" : "text-muted-foreground/60")}>
          {t("sharedLink.sharedVia", { date: new Date(linkData?.created_at || "").toLocaleDateString(i18n.language, { month: "long", day: "numeric", year: "numeric" }) })}
        </p>
      </div>
    </Shell>
  );
}

function SocialIcons({ branding, immersive }: { branding?: WorkspaceBranding | null; immersive: boolean }) {
  if (!branding) return null;
  var iconSize = 28;
  var links: { url: string; platform: "instagram" | "tiktok" | "youtube" | "facebook" | "x" | "website"; icon: React.ReactNode }[] = [];
  var igUrl = branding.social_instagram ? normalizeSocialUrl(branding.social_instagram, "instagram") : null;
  if (igUrl) links.push({ url: igUrl, platform: "instagram", icon: <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="url(#trakalog-grad)"><defs><linearGradient id="trakalog-grad-ig" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f97316"/><stop offset="50%" stopColor="#ec4899"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs><path fill="url(#trakalog-grad-ig)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> });
  var ttUrl = branding.social_tiktok ? normalizeSocialUrl(branding.social_tiktok, "tiktok") : null;
  if (ttUrl) links.push({ url: ttUrl, platform: "tiktok", icon: <svg width={iconSize} height={iconSize} viewBox="0 0 24 24"><defs><linearGradient id="trakalog-grad-tt" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f97316"/><stop offset="50%" stopColor="#ec4899"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs><path fill="url(#trakalog-grad-tt)" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.6a8.22 8.22 0 004.77 1.52V6.69h-1z"/></svg> });
  var ytUrl = branding.social_youtube ? normalizeSocialUrl(branding.social_youtube, "youtube") : null;
  if (ytUrl) links.push({ url: ytUrl, platform: "youtube", icon: <svg width={iconSize} height={iconSize} viewBox="0 0 24 24"><defs><linearGradient id="trakalog-grad-yt" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f97316"/><stop offset="50%" stopColor="#ec4899"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs><path fill="url(#trakalog-grad-yt)" d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> });
  var fbUrl = branding.social_facebook ? normalizeSocialUrl(branding.social_facebook, "facebook") : null;
  if (fbUrl) links.push({ url: fbUrl, platform: "facebook", icon: <svg width={iconSize} height={iconSize} viewBox="0 0 24 24"><defs><linearGradient id="trakalog-grad-fb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f97316"/><stop offset="50%" stopColor="#ec4899"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs><path fill="url(#trakalog-grad-fb)" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> });
  var xUrl = branding.social_x ? normalizeSocialUrl(branding.social_x, "x") : null;
  if (xUrl) links.push({ url: xUrl, platform: "x", icon: <svg width={iconSize} height={iconSize} viewBox="0 0 24 24"><defs><linearGradient id="trakalog-grad-x" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f97316"/><stop offset="50%" stopColor="#ec4899"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs><path fill="url(#trakalog-grad-x)" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> });
  if (branding.social_website && (branding.social_website.startsWith("https://") || branding.social_website.startsWith("http://"))) links.push({ url: branding.social_website, platform: "website", icon: <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="url(#trakalog-grad-web)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><defs><linearGradient id="trakalog-grad-web" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f97316"/><stop offset="50%" stopColor="#ec4899"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> });
  if (links.length === 0) return null;
  return (
    <div className="mt-4">
      <div
        className="inline-flex items-center gap-4 px-5 py-3 rounded-2xl border backdrop-blur-md"
        style={{
          background: immersive
            ? "rgba(0, 0, 0, 0.45)"
            : "rgba(255, 255, 255, 0.06)",
          borderColor: immersive
            ? "rgba(255, 255, 255, 0.12)"
            : "rgba(0, 0, 0, 0.08)",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        }}
      >
        {links.map(function(l) {
          return (
            <a
              key={l.platform}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-all duration-250 hover:scale-[1.18] hover:drop-shadow-[0_0_8px_rgba(249,115,22,0.4)] opacity-85 hover:opacity-100"
            >
              {l.icon}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function Shell({ children, branding }: { children: React.ReactNode; branding?: WorkspaceBranding | null }) {
  const { t } = useTranslation();
  var heroUrl = branding?.hero_image_url || null;
  var heroFocalPoint = branding?.hero_focal_point || "50% 50%";
  var logoUrl = branding?.logo_url || null;
  var immersive = !!heroUrl;

  if (immersive) {
    return (
      <div className="min-h-screen overflow-x-hidden max-w-[100vw]">
        {/* Fixed full-page background image */}
        <img
          src={heroUrl!}
          alt=""
          className="fixed inset-0 w-full h-full object-cover"
          style={{ objectPosition: heroFocalPoint, zIndex: 0 }}
        />
        {/* Dark overlay for readability */}
        <div className="fixed inset-0" style={{ backgroundColor: "rgba(0,0,0,0.35)", zIndex: 1 }} />
        {/* All content floats above */}
        <div className="relative min-h-screen flex flex-col" style={{ zIndex: 2 }}>
          {/* Trakalog brand strip — overlay at very top */}
          <div className="absolute top-0 left-0 right-0 pt-4 md:pt-6 flex justify-center pointer-events-none" style={{ zIndex: 3 }}>
            <a
              href="https://trakalog.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center pointer-events-auto transition-opacity hover:opacity-90"
              style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.8))" }}
            >
              <span className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple bg-clip-text text-transparent">TRAKALOG</span>
              <span className="text-[8px] md:text-[10px] tracking-[0.2em] text-white/60 font-medium block mt-0.5">{t("sharedLink.catalogManagerTagline")}</span>
            </a>
          </div>
          {/* Logo header — pushed down to leave hero image visible */}
          <header className="pt-[35vh] md:pt-[25vh] pb-4">
            <div className="flex flex-col items-center gap-1">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="object-contain max-h-[100px] md:max-h-[150px]" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.8))" }} />
              ) : (
                <div className="flex flex-col items-center" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.8))" }}>
                  <span className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple bg-clip-text text-transparent">TRAKALOG</span>
                  <span className="text-[10px] md:text-xs tracking-[0.2em] text-white/50 font-medium block mt-1">{t("sharedLink.catalogManagerTagline")}</span>
                </div>
              )}
              <SocialIcons branding={branding} immersive={true} />
              {branding?.bio && (
                <p className="mt-2 max-w-md text-xs md:text-sm text-white/50 italic text-center" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{branding.bio}</p>
              )}
              <div className="text-center mt-4">
                <a href="https://trakalog.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/30 hover:text-white/50 transition-colors">
                  <span>{t("sharedLink.sentVia")}</span>
                  <span className="font-semibold tracking-wider">TRAKALOG</span>
                </a>
              </div>
            </div>
          </header>
          <div className="flex-1">{children}</div>
          <footer className="py-6 text-center">
            <a href="https://trakalog.com" target="_blank" rel="noopener noreferrer" className="text-[10px] hover:opacity-80 transition-opacity" style={{ color: "#f97316" }}>
              {t("sharedLink.poweredBy")}
            </a>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden max-w-[100vw]" data-drm="protected" onContextMenu={(e) => e.preventDefault()}>
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-center relative z-10 py-5">
          <div className="flex flex-col items-center">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="object-contain max-h-[100px] sm:max-h-[150px]" />
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple bg-clip-text text-transparent">TRAKALOG</span>
                <span className="text-[10px] sm:text-xs tracking-[0.2em] text-muted-foreground/60 font-medium block mt-1">{t("sharedLink.catalogManagerTagline")}</span>
              </div>
            )}
            <SocialIcons branding={branding} immersive={false} />
            {branding?.bio && (
              <p className="mt-2 max-w-md text-xs sm:text-sm text-muted-foreground/50 italic text-center">{branding.bio}</p>
            )}
            <div className="text-center mt-4">
              <a href="https://trakalog.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors">
                <span>{t("sharedLink.sentVia")}</span>
                <span className="font-semibold tracking-wider">TRAKALOG</span>
              </a>
            </div>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="py-6 text-center">
        <a href="https://trakalog.com" target="_blank" rel="noopener noreferrer" className="text-[10px] hover:opacity-80 transition-opacity" style={{ color: "#f97316" }}>
          {t("sharedLink.poweredBy")}
        </a>
      </footer>
    </div>
  );
}
