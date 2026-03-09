import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, Download, Music, Layers, User, Mail, Building2, Briefcase,
  Package, ListMusic, Clock, Play, Pause, FileText, PieChart, Users,
  Tag, Disc, Globe, Hash, Calendar, Headphones, ShieldOff, MessageSquare
} from "lucide-react";
import { useSharedLinks } from "@/contexts/SharedLinksContext";
import { useTrack } from "@/contexts/TrackContext";
import { useContacts } from "@/contexts/ContactsContext";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecipientReviewPlayer } from "@/components/RecipientReviewPlayer";
import { TrackWaveformPlayer } from "@/components/TrackWaveformPlayer";
import { CommentMarkerLayer } from "@/components/CommentMarkerLayer";
import { useTrackReview, formatTimestamp } from "@/contexts/TrackReviewContext";
import trakalogLogo from "@/assets/trakalog-logo.png";

const roleOptions = ["Admin", "Manager", "Producer", "Viewer", "Other"];

export default function SharedStemAccess() {
  const { linkId } = useParams();
  const { getSharedLink, addDownloadEvent } = useSharedLinks();
  const { tracks } = useTrack();
  const { addOrUpdateContact } = useContacts();

  const [password, setPassword] = useState("");
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [formCompleted, setFormCompleted] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const link = linkId ? getSharedLink(linkId) : undefined;

  // Get full track data for detail display
  const trackData = useMemo(() => {
    if (!link) return null;
    return tracks.find(t => t.id === link.trackId) || null;
  }, [link, tracks]);

  if (!link) {
    return (
      <ExternalShell>
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Link Not Found</h2>
          <p className="text-sm text-muted-foreground mt-1">This share link doesn't exist or has been removed.</p>
        </div>
      </ExternalShell>
    );
  }

  if (link.status === "expired" || link.status === "disabled") {
    return (
      <ExternalShell>
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {link.status === "expired" ? "Link Expired" : "Link Disabled"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">This share link is no longer active.</p>
        </div>
      </ExternalShell>
    );
  }

  const needsPassword = link.linkType === "secured" && !passwordVerified;
  const shareType = link.shareType || "stems";
  const displayTitle = shareType === "playlist" ? (link.playlistName || link.trackTitle) : link.trackTitle;
  const displaySubtitle = shareType === "playlist"
    ? `${link.playlistTracks?.length || 0} tracks`
    : link.trackArtist;
  const displayCover = shareType === "playlist" ? (link.playlistCover || link.trackCover) : link.trackCover;
  const accessLabel = shareType === "stems" ? "stems" : shareType === "track" ? "this track" : "this playlist";

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === link.password) {
      setPasswordVerified(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !organization.trim() || !role) {
      toast.error("Please fill in all fields");
      return;
    }
    addOrUpdateContact({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), organization: organization.trim(), role, trackName: displayTitle });
    setFormCompleted(true);
  };

  const createDownloadEvent = (filesDownloaded: string[]) => ({
    id: `dl-${Date.now()}`,
    linkId: link.id,
    downloaderName: `${firstName} ${lastName}`,
    downloaderEmail: email,
    organization,
    role,
    trackName: displayTitle,
    stemsDownloaded: filesDownloaded,
    downloadedAt: new Date().toISOString(),
  });

  const handleDownloadItem = (fileName: string) => {
    if (!link.allowDownload) return;
    addDownloadEvent(link.id, createDownloadEvent([fileName]));
    addOrUpdateContact({ firstName, lastName, email, organization, role, trackName: displayTitle });
    toast.success(`Downloading ${fileName} (${link.downloadQuality === "hi-res" ? "Hi-Res" : "Low-Res"})`);
  };

  const handleDownloadAll = () => {
    if (!link.allowDownload) return;
    const allFiles = shareType === "stems"
      ? link.stems.map((s) => s.fileName)
      : shareType === "track"
      ? [link.trackTitle]
      : (link.playlistTracks || []).map((t) => t.title);
    addDownloadEvent(link.id, createDownloadEvent(allFiles));
    addOrUpdateContact({ firstName, lastName, email, organization, role, trackName: displayTitle });
    const zipName = shareType === "playlist"
      ? `${link.playlistName}_Playlist.zip`
      : shareType === "stems"
      ? `${link.trackTitle}_Stems.zip`
      : `${link.trackTitle}.zip`;
    toast.success(`Downloading ${zipName} (${link.downloadQuality === "hi-res" ? "Hi-Res" : "Low-Res"})`);
  };

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
              onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
              placeholder="Enter password"
              className={`h-11 w-full px-4 rounded-xl bg-secondary border text-sm text-foreground outline-none transition-all ${
                passwordError ? "border-destructive" : "border-border focus:border-primary/30"
              }`}
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
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name"
                      className="h-10 w-full pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Last Name *</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name"
                    className="h-10 w-full px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                    className="h-10 w-full pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Organization *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Your company"
                    className="h-10 w-full pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Role *</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <select value={role} onChange={(e) => setRole(e.target.value)}
                    className="h-10 w-full pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all appearance-none cursor-pointer">
                    <option value="">Select role…</option>
                    {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
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
        {link.allowDownload ? (
          <button onClick={handleDownloadAll} className="w-full h-12 rounded-xl text-sm font-semibold btn-brand flex items-center justify-center gap-2 mb-6">
            <Package className="w-4 h-4" />
            {shareType === "track" ? "Download Track" : "Download All as ZIP"}
            <span className="text-[10px] opacity-70 ml-1">({link.downloadQuality === "hi-res" ? "Hi-Res" : "Low-Res"})</span>
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary/50 border border-border mb-6">
            <ShieldOff className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Downloads are not enabled for this shared link</span>
          </div>
        )}

        {/* Tabbed content — only shows relevant tabs */}
        {shareType === "playlist" && link.playlistTracks ? (
          /* Playlist view — list of tracks */
          <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">{link.playlistTracks.length} Tracks</span>
              </div>
            </div>
            <div className="divide-y divide-border">
              {link.playlistTracks.map((track, i) => (
                <div key={track.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] text-muted-foreground font-mono w-5 text-right shrink-0">{i + 1}</span>
                    {track.coverImage ? (
                      <img src={track.coverImage} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <Music className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{track.title}</p>
                      <p className="text-[11px] text-muted-foreground">{track.artist} · {track.duration}</p>
                    </div>
                  </div>
                  {link.allowDownload && (
                    <button onClick={() => handleDownloadItem(track.title)} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Download">
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : trackData ? (
          /* Track/Stems view with detailed tabs */
          <TrackDetailTabs
            trackData={trackData}
            link={link}
            allowDownload={link.allowDownload}
            onDownloadItem={handleDownloadItem}
          />
        ) : (
          /* Fallback: simple stems/track list */
          <SimpleContentList link={link} onDownloadItem={handleDownloadItem} />
        )}
      </div>
    </ExternalShell>
  );
}

// ── Track Detail Tabs (read-only, no paperwork/engagement) ──
function TrackDetailTabs({
  trackData,
  link,
  allowDownload,
  onDownloadItem,
}: {
  trackData: any;
  link: any;
  allowDownload: boolean;
  onDownloadItem: (name: string) => void;
}) {
  const { getCommentsForTrack } = useTrackReview();
  const [progress, setProgress] = useState(35);
  const [isPlaying, setIsPlaying] = useState(false);

  const parseDuration = (dur: string): number => {
    const parts = dur.split(":").map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
  };
  const totalDurationSeconds = parseDuration(trackData.duration);
  const trackComments = getCommentsForTrack(trackData.id);

  const recipientName = link._recipientName || "Recipient";
  const recipientEmail = link._recipientEmail || "";

  const handleSeek = (seconds: number, _total: number) => {
    const pct = (seconds / totalDurationSeconds) * 100;
    setProgress(pct);
  };

  const availableTabs = [
    { id: "overview", label: "Overview" },
    ...(trackData.lyrics ? [{ id: "lyrics", label: "Lyrics" }] : []),
    ...(trackData.stems?.length ? [{ id: "stems", label: "Stems" }] : []),
    ...(trackData.splits?.length ? [{ id: "splits", label: "Splits" }] : []),
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
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div className="flex-1 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>{formatTimestamp((progress / 100) * totalDurationSeconds)}</span>
            <span>{trackData.duration}</span>
          </div>
        </div>
        <div className="relative">
          <TrackWaveformPlayer
            seed={trackData.id}
            progress={progress}
            onSeek={setProgress}
            onDoubleClick={(pct) => {
              // Jump there; the recipient review player handles comment creation
              setProgress(pct);
            }}
            chapters={trackData.chapters || []}
            isPlaying={isPlaying}
          />
          <CommentMarkerLayer
            comments={trackComments}
            totalDurationSeconds={totalDurationSeconds}
            onMarkerClick={(seconds) => handleSeek(seconds, totalDurationSeconds)}
          />
        </div>
        <p className="text-[10px] text-muted-foreground/40 mt-2 text-center">Double-click waveform to jump to a moment</p>
      </div>

    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full bg-secondary/50 border border-border rounded-xl p-1 flex flex-wrap gap-1 h-auto">
        {availableTabs.map(tab => (
          <TabsTrigger key={tab.id} value={tab.id} className="text-xs rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm flex-1 min-w-[70px]">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Overview */}
      <TabsContent value="overview" className="mt-4">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={Disc} label="Genre" value={trackData.genre} />
            <InfoRow icon={Hash} label="BPM" value={String(trackData.bpm)} />
            <InfoRow icon={Music} label="Key" value={trackData.key} />
            <InfoRow icon={Clock} label="Duration" value={trackData.duration} />
            <InfoRow icon={Headphones} label="Voice" value={trackData.voice} />
            <InfoRow icon={Globe} label="Language" value={trackData.language} />
            <InfoRow icon={Tag} label="Mood" value={trackData.mood?.join(", ")} />
            <InfoRow icon={Calendar} label="Release" value={trackData.releaseDate || "—"} />
          </div>
          {trackData.featuredArtists?.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Featured Artists</p>
              <p className="text-sm text-foreground">{trackData.featuredArtists.join(", ")}</p>
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
      {trackData.stems?.length > 0 && (
        <TabsContent value="stems" className="mt-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">{trackData.stems.length} Stems</span>
              </div>
            </div>
            <div className="divide-y divide-border">
              {trackData.stems.map((stem: any) => (
                <div key={stem.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Music className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{stem.fileName}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{stem.type} · {stem.fileSize}</p>
                    </div>
                  </div>
                  {allowDownload && (
                    <button onClick={() => onDownloadItem(stem.fileName)} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Download">
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      )}

      {/* Splits */}
      {trackData.splits?.length > 0 && (
        <TabsContent value="splits" className="mt-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Publishing Splits</span>
              </div>
            </div>
            <div className="divide-y divide-border">
              {trackData.splits.map((split: any) => (
                <div key={split.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{split.name}</p>
                    <p className="text-[11px] text-muted-foreground">{split.role} · {split.pro}</p>
                  </div>
                  <span className="text-sm font-bold text-primary shrink-0">{split.share}%</span>
                </div>
              ))}
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
            <MetaRow label="Written By" value={trackData.writtenBy?.join(", ") || "—"} />
            <MetaRow label="Produced By" value={trackData.producedBy?.join(", ") || "—"} />
            <MetaRow label="Mixed By" value={trackData.mixedBy || "—"} />
            <MetaRow label="Mastered By" value={trackData.masteredBy || "—"} />
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
              {trackData.status}
            </span>
          </div>
          {trackData.statusHistory?.length > 0 && (
            <div className="space-y-3 border-t border-border pt-3">
              {trackData.statusHistory.map((entry: any, i: number) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    {i < trackData.statusHistory.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-xs font-semibold text-foreground">{entry.status}</p>
                    <p className="text-[11px] text-muted-foreground">{entry.date}</p>
                    {entry.note && <p className="text-[11px] text-foreground/70 mt-0.5">{entry.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ── Fallback simple content list ──
function SimpleContentList({ link, onDownloadItem }: { link: any; onDownloadItem: (name: string) => void }) {
  if (link.shareType === "stems") {
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">{link.stems.length} Stems</span>
          </div>
        </div>
        <div className="divide-y divide-border">
          {link.stems.map((stem: any) => (
            <div key={stem.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <Music className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{stem.fileName}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{stem.type} · {stem.fileSize}</p>
                </div>
              </div>
              {link.allowDownload && (
                <button onClick={() => onDownloadItem(stem.fileName)} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Download">
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
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
          {link.trackCover ? (
            <img src={link.trackCover} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Music className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{link.trackTitle}</p>
            <p className="text-[11px] text-muted-foreground">{link.trackArtist}</p>
          </div>
        </div>
        {link.allowDownload && (
          <button onClick={() => onDownloadItem(link.trackTitle)} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Download">
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
