import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTrack } from "@/contexts/TrackContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { getStorageSignedUrl } from "@/lib/audio";
import { MiniWaveform } from "@/components/MiniWaveform";
import { GenreMultiSelect } from "@/components/GenreMultiSelect";
import { DEFAULT_COVER, KEYS, TRACK_TYPES, MOODS } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Compass, Search, Play, Pause, Sparkles, Inbox, X, Send, Mail, Loader2, Music,
} from "lucide-react";

// Plan-based daily search quota. -1 = unlimited.
const SEARCH_QUOTAS: Record<string, number> = { free: 10, starter: 25, pro: -1, business: -1 };
const PAGE_SIZE = 20;

interface MarketplaceTrack {
  id: string;
  title: string;
  artist: string;
  cover_url?: string | null;
  genre?: string[] | null;
  mood?: string[] | null;
  bpm?: number | null;
  key?: string | null;
  duration_sec?: number | null;
  track_type?: string | null;
  audio_preview_url?: string | null;
  workspace_name?: string | null;
  workspace_id?: string | null;
  // Brief-mode only
  score?: number;
  reason?: string;
}

function formatDur(sec?: number | null): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + (s < 10 ? "0" + s : String(s));
}

// Stable numeric id from a uuid (the global player keys by numeric id).
function uuidToNum(uuid: string): number {
  return Math.abs(uuid.split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0));
}

export default function Access() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { tracks } = useTrack();
  const { playTrack, currentTrack, isPlaying, togglePlay } = useAudioPlayer();
  const [searchParams] = useSearchParams();

  const hasPublicTracks = useMemo(() => tracks.some((tr) => tr.isMarketplacePublic), [tracks]);

  const initialTab = searchParams.get("tab") === "requests" ? "requests" : searchParams.get("tab") === "brief" ? "brief" : "browse";
  const [tab, setTab] = useState<"browse" | "brief" | "requests">(initialTab);

  // ── Search quota ──────────────────────────────────────────────
  const [plan, setPlan] = useState<string>("free");
  const [searchesUsed, setSearchesUsed] = useState(0);
  useEffect(() => {
    if (!user) return;
    supabase.from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.plan) setPlan(String(data.plan)); });
  }, [user]);
  const quota = SEARCH_QUOTAS[plan] ?? 10;
  const unlimited = quota < 0;
  const remaining = Math.max(0, quota - searchesUsed);

  // Returns true if the search is allowed (and counts it server-side).
  const consumeSearch = useCallback(async (): Promise<boolean> => {
    if (unlimited || !user) return true;
    const { data: ok } = await supabase.rpc("check_rate_limit", {
      _key: "access-search:" + user.id, _max_requests: quota, _window_seconds: 86400,
    });
    if (ok === false) {
      toast.error(t("access.upgradeForMore"));
      setSearchesUsed(quota);
      return false;
    }
    setSearchesUsed((n) => n + 1);
    return true;
  }, [unlimited, user, quota, t]);

  // ── "Already requested" set ───────────────────────────────────
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    supabase.from("marketplace_requests").select("track_id").eq("requester_user_id", user.id)
      .then(({ data }) => { if (data) setRequestedIds(new Set(data.map((r) => r.track_id as string))); });
  }, [user]);

  // ── Audio preview via the global player ───────────────────────
  const playPreview = useCallback(async (mt: MarketplaceTrack) => {
    const numId = uuidToNum(mt.id);
    if (currentTrack?.id === numId) { togglePlay(); return; }
    if (!mt.audio_preview_url) { toast.error(t("audioPlayer.noAudioFile")); return; }
    let url = mt.audio_preview_url;
    if (!/^https?:\/\//i.test(url)) {
      try { url = await getStorageSignedUrl("tracks", url, { expiresInSec: 3600 }); }
      catch { toast.error(t("audioPlayer.couldNotLoad")); return; }
    }
    playTrack({
      id: numId, uuid: mt.id, title: mt.title, artist: mt.artist || "",
      coverImage: mt.cover_url || undefined, previewUrl: url,
      genre: mt.genre || [], mood: mt.mood || [], bpm: mt.bpm || 0, key: mt.key || "",
      duration: formatDur(mt.duration_sec), stems: [], splits: [],
    } as any);
  }, [currentTrack, togglePlay, playTrack, t]);

  // ── Request modal ─────────────────────────────────────────────
  const [requestTarget, setRequestTarget] = useState<MarketplaceTrack | null>(null);

  return (
    <PageShell>
      <motion.div
        className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Compass className="w-7 h-7 text-brand-orange" />
            <span>{t("access.title")}</span>
          </h1>
          <p className="text-muted-foreground mt-1">{t("access.subtitle")}</p>
        </div>

        {/* Tabs */}
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border/50 flex-wrap">
          <TabBtn active={tab === "browse"} onClick={() => setTab("browse")} icon={<Search className="w-4 h-4" />} label={t("access.tabBrowse")} />
          <TabBtn active={tab === "brief"} onClick={() => setTab("brief")} icon={<Sparkles className="w-4 h-4" />} label={t("access.tabBrief")} />
          {hasPublicTracks && (
            <TabBtn active={tab === "requests"} onClick={() => setTab("requests")} icon={<Inbox className="w-4 h-4" />} label={t("access.tabRequests")} />
          )}
        </div>

        {tab === "browse" && (
          <BrowseTab
            consumeSearch={consumeSearch} unlimited={unlimited} remaining={remaining}
            requestedIds={requestedIds} playPreview={playPreview}
            currentTrackId={currentTrack?.id} isPlaying={isPlaying} onRequest={setRequestTarget}
          />
        )}
        {tab === "brief" && (
          <BriefTab
            consumeSearch={consumeSearch} unlimited={unlimited} remaining={remaining}
            workspaceId={activeWorkspace?.id} requestedIds={requestedIds} playPreview={playPreview}
            currentTrackId={currentTrack?.id} isPlaying={isPlaying} onRequest={setRequestTarget}
          />
        )}
        {tab === "requests" && hasPublicTracks && <RequestsTab workspaceId={activeWorkspace?.id} />}
      </motion.div>

      {requestTarget && (
        <RequestModal
          track={requestTarget}
          onClose={() => setRequestTarget(null)}
          onSent={(id) => { setRequestedIds((prev) => new Set(prev).add(id)); setRequestTarget(null); }}
        />
      )}
    </PageShell>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={"px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 " + (active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
    >
      {icon}{label}
    </button>
  );
}

function SearchCounter({ unlimited, remaining }: { unlimited: boolean; remaining: number }) {
  const { t } = useTranslation();
  return (
    <span className="text-xs text-muted-foreground shrink-0">
      {unlimited ? t("access.unlimitedSearches") : t("access.searchesRemaining", { count: remaining })}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// Browse tab
// ─────────────────────────────────────────────────────────────────
function BrowseTab({ consumeSearch, unlimited, remaining, requestedIds, playPreview, currentTrackId, isPlaying, onRequest }: {
  consumeSearch: () => Promise<boolean>; unlimited: boolean; remaining: number;
  requestedIds: Set<string>; playPreview: (t: MarketplaceTrack) => void;
  currentTrackId?: number; isPlaying: boolean; onRequest: (t: MarketplaceTrack) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<string[]>([]);
  const [mood, setMood] = useState("");
  const [bpmMin, setBpmMin] = useState("");
  const [bpmMax, setBpmMax] = useState("");
  const [keyF, setKeyF] = useState("");
  const [typeF, setTypeF] = useState("");
  const [results, setResults] = useState<MarketplaceTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (nextOffset: number) => {
    setLoading(true);
    const { data, error } = await supabase.rpc("search_marketplace_tracks", {
      _q: q.trim() || null,
      _genre: genre.length ? genre : null,
      _mood: mood ? [mood] : null,
      _bpm_min: bpmMin ? parseInt(bpmMin) : null,
      _bpm_max: bpmMax ? parseInt(bpmMax) : null,
      _key: keyF || null,
      _type: typeF ? typeF.toLowerCase() : null,
      _limit: PAGE_SIZE,
      _offset: nextOffset,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const rows = (data as MarketplaceTrack[]) || [];
    setResults((prev) => nextOffset === 0 ? rows : prev.concat(rows));
    setHasMore(rows.length === PAGE_SIZE);
    setOffset(nextOffset + rows.length);
  }, [q, genre, mood, bpmMin, bpmMax, keyF, typeF]);

  const onSearch = useCallback(async () => {
    if (!(await consumeSearch())) return;
    setSearched(true);
    runSearch(0);
  }, [consumeSearch, runSearch]);

  const clearFilters = () => {
    setQ(""); setGenre([]); setMood(""); setBpmMin(""); setBpmMax(""); setKeyF(""); setTypeF("");
  };

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="card-premium p-4 space-y-3" style={{ overflow: "visible" }}>
        <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-3.5 py-2.5 border border-border/50">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
            placeholder={t("access.searchPlaceholder")}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none w-full font-medium"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="col-span-2 sm:col-span-1"><GenreMultiSelect value={genre} onChange={setGenre} placeholder={t("catalog.genre")} /></div>
          <PlainSelect value={mood} onChange={setMood} label={t("playlistModal.filterMood", "Mood")} options={[...MOODS]} />
          <div className="flex items-center gap-1 h-10 px-2 rounded-xl border border-border bg-card">
            <input type="number" inputMode="numeric" value={bpmMin} onChange={(e) => setBpmMin(e.target.value)} placeholder="BPM" className="w-full bg-transparent text-[13px] outline-none text-center" />
            <span className="text-muted-foreground/40">—</span>
            <input type="number" inputMode="numeric" value={bpmMax} onChange={(e) => setBpmMax(e.target.value)} placeholder="max" className="w-full bg-transparent text-[13px] outline-none text-center" />
          </div>
          <PlainSelect value={keyF} onChange={setKeyF} label={t("catalog.key")} options={[...KEYS]} />
          <PlainSelect value={typeF} onChange={setTypeF} label={t("catalog.type")} options={[...TRACK_TYPES]} />
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={onSearch} disabled={loading} className="btn-brand px-5 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {t("access.tabBrowse")}
            </button>
            <button onClick={clearFilters} className="text-xs text-brand-orange hover:text-brand-pink font-semibold transition-colors">
              {t("playlistModal.clearFilters", "Clear filters")}
            </button>
          </div>
          <SearchCounter unlimited={unlimited} remaining={remaining} />
        </div>
      </div>

      {/* Results */}
      {searched && results.length === 0 && !loading && (
        <div className="card-premium p-10 text-center text-sm text-muted-foreground">
          <Music className="w-8 h-8 mx-auto mb-3 opacity-15" />
          {t("access.noTracksFound")}
        </div>
      )}
      {results.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((mt) => (
              <AccessCard key={mt.id} mt={mt} requested={requestedIds.has(mt.id)} onPlay={playPreview}
                playing={currentTrackId === uuidToNum(mt.id) && isPlaying} onRequest={onRequest} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              {/* Paginating an already-run search is free — only a new search (the
                  Search button) counts against the daily quota. */}
              <button onClick={() => runSearch(offset)} disabled={loading} className="px-5 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-sm font-medium transition-colors inline-flex items-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{t("access.loadMore")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Brief tab
// ─────────────────────────────────────────────────────────────────
function BriefTab({ consumeSearch, unlimited, remaining, workspaceId, requestedIds, playPreview, currentTrackId, isPlaying, onRequest }: {
  consumeSearch: () => Promise<boolean>; unlimited: boolean; remaining: number; workspaceId?: string;
  requestedIds: Set<string>; playPreview: (t: MarketplaceTrack) => void;
  currentTrackId?: number; isPlaying: boolean; onRequest: (t: MarketplaceTrack) => void;
}) {
  const { t } = useTranslation();
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MarketplaceTrack[] | null>(null);

  const onFind = useCallback(async () => {
    if (!brief.trim() || loading || !workspaceId) return;
    if (!(await consumeSearch())) return;
    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("smart-ar", {
        body: { brief: brief.trim(), track_count: "all", workspace_id: workspaceId, mode: "marketplace" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(Array.isArray(data?.tracks) ? data.tracks : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [brief, loading, workspaceId, consumeSearch]);

  return (
    <div className="space-y-5">
      <div className="card-premium p-4 space-y-3">
        <textarea
          value={brief} onChange={(e) => setBrief(e.target.value)} rows={4}
          placeholder={t("access.briefPlaceholder")}
          className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-brand-orange/30 transition-all resize-none leading-relaxed placeholder:text-muted-foreground/40"
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button onClick={onFind} disabled={loading || !brief.trim()} className="btn-brand px-5 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {t("access.findTracks")}
          </button>
          <SearchCounter unlimited={unlimited} remaining={remaining} />
        </div>
      </div>

      {loading && (
        <div className="card-premium p-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-brand-orange" /> {t("access.findTracks")}…
        </div>
      )}
      {results && results.length === 0 && !loading && (
        <div className="card-premium p-10 text-center text-sm text-muted-foreground">
          <Music className="w-8 h-8 mx-auto mb-3 opacity-15" />{t("access.noTracksFound")}
        </div>
      )}
      {results && results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((mt) => (
            <AccessCard key={mt.id} mt={mt} requested={requestedIds.has(mt.id)} onPlay={playPreview}
              playing={currentTrackId === uuidToNum(mt.id) && isPlaying} onRequest={onRequest} showScore />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Result card
// ─────────────────────────────────────────────────────────────────
function AccessCard({ mt, requested, onPlay, playing, onRequest, showScore }: {
  mt: MarketplaceTrack; requested: boolean; onPlay: (t: MarketplaceTrack) => void;
  playing: boolean; onRequest: (t: MarketplaceTrack) => void; showScore?: boolean;
}) {
  const { t } = useTranslation();
  const genres = Array.isArray(mt.genre) ? mt.genre.filter(Boolean) : [];
  const meta = [mt.bpm ? mt.bpm + " BPM" : null, mt.key || null, formatDur(mt.duration_sec) || null].filter(Boolean).join(" · ");
  return (
    <div className="card-premium p-3 flex flex-col gap-2.5">
      <div className="flex gap-3">
        <div className="relative w-16 h-16 shrink-0">
          <img src={mt.cover_url || DEFAULT_COVER} alt={mt.title} className="w-16 h-16 rounded-lg object-cover ring-1 ring-border/50" />
          <button onClick={() => onPlay(mt)} className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/55 opacity-0 hover:opacity-100 transition-opacity">
            {playing ? <Pause className="w-5 h-5 text-foreground" /> : <Play className="w-5 h-5 text-foreground" />}
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{mt.title}</p>
            {showScore && typeof mt.score === "number" && (
              <span className="shrink-0 text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                {t("access.matchScore", { score: Math.round(mt.score) })}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{mt.artist}</p>
          {mt.workspace_name && (
            <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-purple/10 text-brand-purple">{mt.workspace_name}</span>
          )}
        </div>
      </div>

      {meta && <p className="text-2xs font-mono text-muted-foreground/70 tabular-nums">{meta}</p>}
      {genres.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {genres.slice(0, 2).map((g) => (
            <span key={g} className="text-2xs px-1.5 py-0.5 rounded bg-accent/10 text-accent/70 font-medium">{g}</span>
          ))}
        </div>
      )}
      <MiniWaveform seed={uuidToNum(mt.id)} bars={32} />
      {showScore && mt.reason && <p className="text-2xs text-muted-foreground/70 italic line-clamp-2">{mt.reason}</p>}

      <div className="flex items-center gap-2 mt-auto pt-1">
        <button onClick={() => onPlay(mt)} className="w-9 h-9 shrink-0 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/15 transition-colors">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        {requested ? (
          <span className="flex-1 text-center text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-lg py-2">{t("access.alreadyRequested")}</span>
        ) : (
          <button onClick={() => onRequest(mt)} className="flex-1 text-sm font-semibold border border-border rounded-lg py-2 hover:bg-secondary transition-colors">
            {t("access.requestButton")}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Requests inbox
// ─────────────────────────────────────────────────────────────────
interface RequestRow {
  id: string; track_id: string; status: string; message: string | null;
  requester_name: string | null; requester_company: string | null; requester_email: string | null;
  created_at: string; tracks?: { title: string; artist: string; cover_url: string | null } | null;
}

function RequestsTab({ workspaceId }: { workspaceId?: string }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data } = await supabase
      .from("marketplace_requests")
      .select("*, tracks(title, artist, cover_url)")
      .eq("owner_workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setRows((data as RequestRow[]) || []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]);

  // Local session dismiss only. Persisting "ignored" would need a dedicated
  // SECURITY DEFINER RPC / UPDATE policy (marketplace_requests has none) — kept
  // client-side to avoid a silently-failing RLS write.
  const ignore = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading) return <div className="card-premium p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  const visible = rows.filter((r) => r.status !== "ignored");
  if (visible.length === 0) return <div className="card-premium p-10 text-center text-sm text-muted-foreground"><Inbox className="w-8 h-8 mx-auto mb-3 opacity-15" />{t("access.noRequests")}</div>;

  return (
    <div className="card-premium overflow-hidden divide-y divide-border/40">
      <div className="px-5 py-3 border-b border-border/50">
        <p className="text-sm font-semibold">{t("access.incomingRequests")}</p>
      </div>
      {visible.map((r) => {
        const date = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const mailto = r.requester_email
          ? "mailto:" + r.requester_email + "?subject=" + encodeURIComponent('Re: your interest in "' + (r.tracks?.title || "my track") + '"')
          : undefined;
        return (
          <div key={r.id} className="flex items-start gap-3 px-5 py-4">
            <img src={r.tracks?.cover_url || DEFAULT_COVER} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{r.tracks?.title || "—"}</p>
              <p className="text-xs text-muted-foreground">
                {t("access.requestTitle")}: <span className="text-foreground font-medium">{r.requester_name || "—"}</span>
                {r.requester_company ? " · " + r.requester_company : ""}
              </p>
              {r.message && <p className="text-xs text-muted-foreground/80 italic mt-1 line-clamp-2">"{r.message}"</p>}
              <p className="text-2xs text-muted-foreground/50 mt-1">{date}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => ignore(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">{t("access.ignore")}</button>
              {mailto && (
                <a href={mailto} className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />{t("access.replyByEmail")}
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Request modal
// ─────────────────────────────────────────────────────────────────
function RequestModal({ track, onClose, onSent }: { track: MarketplaceTrack; onClose: () => void; onSent: (trackId: string) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [name, setName] = useState((user?.user_metadata?.full_name as string) || "");
  const [company, setCompany] = useState(activeWorkspace?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || sending || !user || !activeWorkspace) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc("request_track_access", {
        _user_id: user.id, _workspace_id: activeWorkspace.id, _track_id: track.id,
        _message: message.trim() || null,
        _requester_name: name.trim(), _requester_company: company.trim() || null, _requester_email: email.trim(),
      });
      if (error) throw error;
      // Notify the owner by email (best-effort, non-blocking for the toast).
      supabase.functions.invoke("send-access-request-email", {
        body: { track_id: track.id, requester_name: name.trim(), requester_company: company.trim() || null, requester_email: email.trim(), message: message.trim() || null },
      }).catch(() => {});
      toast.success(t("access.requestSent"));
      onSent(track.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("access.requestTitle")}</DialogTitle>
          <DialogDescription className="text-xs">
            {track.title}{track.artist ? " · " + track.artist : ""}{track.workspace_name ? " · " + track.workspace_name : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <Field label={t("inviteMember.firstName", "Name") + " *"}>
            <input value={name} onChange={(e) => setName(e.target.value)} className="ac-input" />
          </Field>
          <Field label={t("contactDetail.organization", "Company")}>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="ac-input" />
          </Field>
          <Field label="Email *">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ac-input" />
          </Field>
          <Field label={t("access.requestMessage")}>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="ac-input resize-none" />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={onClose} disabled={sending} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">{t("common.cancel", "Cancel")}</button>
          <button onClick={submit} disabled={sending || !name.trim() || !email.trim()} className="btn-brand px-5 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{t("access.requestButton")}
          </button>
        </div>
      </DialogContent>
      <style>{`.ac-input{height:38px;width:100%;padding:0 12px;border-radius:10px;background:hsl(var(--secondary));border:1px solid hsl(var(--border));font-size:13px;color:hsl(var(--foreground));outline:none}.ac-input:focus{border-color:hsl(var(--brand-orange)/0.4)}textarea.ac-input{height:auto;padding:8px 12px}`}</style>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function PlainSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: string[] }) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full px-2.5 rounded-xl bg-card border border-border text-[13px] font-medium text-foreground outline-none focus:border-brand-orange/40 appearance-none cursor-pointer"
    >
      <option value="">{label}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
