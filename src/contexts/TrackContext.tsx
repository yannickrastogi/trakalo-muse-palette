import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/constants";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import type { WorkspaceScoped } from "@/types/workspace";
import type { ProductionStage } from "@/lib/constants";
import { toast } from "sonner";
import i18n from "@/i18n";
import { safeLocalStorage } from "@/lib/safeStorage";

export interface TrackStem {
  id: string;
  fileName: string;
  type: string;
  key?: string;
  fileSize: string;
  uploadDate: string;
  color: string;
}

export interface TrackSplit {
  id: string;
  name: string;
  stage_name?: string;
  email?: string;
  role: string;
  share: number;
  pro: string;
  ipi: string;
  publisher: string;
}

export interface TrackChapter {
  id: string;
  label: string;
  startPercent: number;
  endPercent: number;
  startSec?: number;
  endSec?: number;
  color: string;
}

export interface TrackVersion {
  id: string;
  track_id: string;
  version_number: number;
  version_name: string;
  audio_url: string | null;
  audio_preview_url: string | null;
  // deno-lint-ignore no-explicit-any
  waveform_data: any | null;
  // deno-lint-ignore no-explicit-any
  sonic_dna: any | null;
  duration_sec: number | null;
  is_active: boolean;
  notes: string | null;
  chapters: TrackChapter[] | null;
  created_at: string;
}

export interface TrackStatusEntry {
  status: string;
  date: string;
  note: string;
}

export interface TrackData extends WorkspaceScoped {
  id: number;
  uuid: string; // Supabase UUID
  title: string;
  artist: string;
  featuredArtists: string[];
  album: string;
  genre: string[];
  bpm: number;
  key: string;
  duration: string;
  mood: string[];
  voice: string;
  status: string;
  isrc: string;
  upc: string;
  releaseDate: string;
  label: string;
  publishers: string[];
  writtenBy: string[];
  producedBy: string[];
  mixedBy: string;
  masteredBy: string;
  copyright: string;
  language: string;
  explicit: boolean;
  type: string;
  coverIdx: number;
  coverImage?: string;
  previewUrl?: string;
  previewFileUrl?: string;
  originalFileUrl?: string;
  originalFileName?: string;
  originalFileSize?: number;
  notes: string;
  credits: Record<string, string[]>;
  stems: TrackStem[];
  splits: TrackSplit[];
  lyrics?: string;
  lyricsSegments?: { start: number; end: number; text: string }[];
  waveformData?: number[];
  chapters?: TrackChapter[];
  createdAt?: string;
  statusHistory: TrackStatusEntry[];
  // Catalog sharing fields
  isShared?: boolean;
  sharedFrom?: string;
  shareAccessLevel?: string;
  shareId?: string;
  // deno-lint-ignore no-explicit-any
  sonicDna?: Record<string, any>;
  // deno-lint-ignore no-explicit-any
  tags?: Record<string, any>;
  productionStage?: ProductionStage;
  ratingStats?: RatingStats;
  videoUrl?: string | null;
  videoFilename?: string | null;
  videoVisibleOnShare?: boolean;
  hasVersions?: boolean;
  versionCount?: number;
  isMarketplacePublic?: boolean;
}

export interface RatingStats {
  average: number;       // 0..5
  count: number;         // total ratings
  myRating: number | null;
}

const stemTypeColors: Record<string, string> = {
  vocal: "text-brand-pink",
  background_vocal: "text-brand-purple",
  drums: "text-primary",
  kick: "text-primary",
  snare: "text-primary",
  bass: "text-chart-4",
  synth: "text-brand-orange",
  guitar: "text-chart-5",
  fx: "text-accent",
  other: "text-muted-foreground",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "0 MB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function mapStemRow(row: Record<string, unknown>): TrackStem {
  const stemType = (row.stem_type as string) || "other";
  return {
    id: row.id as string,
    fileName: (row.file_name as string) || "",
    type: stemType === "background_vocal" ? "background vocal" : stemType,
    fileSize: formatFileSize(row.file_size_bytes as number | null),
    uploadDate: (row.created_at as string) || "",
    color: stemTypeColors[stemType] || "text-muted-foreground",
  };
}

// Helper: format a track's genre (text[] or legacy text) as a display string
export function formatGenre(genre: unknown): string {
  if (Array.isArray(genre)) return genre.filter((g) => typeof g === "string" && g.trim()).join(", ");
  if (typeof genre === "string") return genre;
  return "";
}

// Helper: convert Supabase row to TrackData
export function mapRowToTrack(row: Record<string, unknown>, index: number, stems: TrackStem[] = []): TrackData {
  // Writer credits are stored in the `credits` jsonb (snake_case) since `tracks` has no
  // written_by/produced_by/mixed_by/mastered_by columns. Read from there, falling back to
  // the legacy top-level row.* (which never resolved) for safety.
  const rowCredits = (row.credits as Record<string, unknown> | null) || {};
  return {
    id: index + 1, // numeric id for frontend compatibility
    uuid: row.id as string,
    workspace_id: row.workspace_id as string,
    title: (row.title as string) || "",
    artist: (row.artist as string) || "",
    featuredArtists: (row.featuring as string)
      ? (row.featuring as string).split(",").map((s) => s.trim())
      : [],
    album: (row.album as string) || "",
    genre: Array.isArray(row.genre)
      ? (row.genre as string[]).filter((g) => typeof g === "string" && g.trim() !== "")
      : (row.genre as string)
        ? [(row.genre as string).trim()]
        : [],
    bpm: (row.bpm as number) || 0,
    key: (row.key as string) || "",
    duration: row.duration_sec
      ? formatDuration(row.duration_sec as number)
      : "0:00",
    mood: (row.mood as string[]) || [],
    voice: (row.gender as string) || "",
    status: mapStatus(row.status as string),
    isrc: (row.isrc as string) || "",
    upc: (row.upc as string) || "",
    releaseDate: (row.released_at as string) || "",
    label: Array.isArray(row.labels) && (row.labels as string[]).length > 0
      ? (row.labels as string[])[0]
      : "",
    publishers: Array.isArray(row.publishers) ? (row.publishers as string[]) : [],
    writtenBy: ((rowCredits.written_by ?? row.written_by) as string) ? String(rowCredits.written_by ?? row.written_by).split(",").map((s) => s.trim()).filter(Boolean) : [],
    producedBy: ((rowCredits.produced_by ?? row.produced_by) as string) ? String(rowCredits.produced_by ?? row.produced_by).split(",").map((s) => s.trim()).filter(Boolean) : [],
    mixedBy: ((rowCredits.mixed_by ?? row.mixed_by) as string) || "",
    masteredBy: ((rowCredits.mastered_by ?? row.mastered_by) as string) || "",
    copyright: (row.copyright as string) || "",
    language: (row.language as string) || "",
    explicit: (row.explicit as boolean) || false,
    type: mapTrackType(row.track_type as string),
    coverIdx: 0,
    coverImage: (row.cover_url as string) || undefined,
    previewUrl: (row.audio_preview_url as string) || (row.audio_url as string) || undefined,
    previewFileUrl: (row.audio_preview_url as string) || undefined,
    originalFileUrl: (row.audio_url as string) || undefined,
    notes: (row.notes as string) || "",
    credits: (row.credits as Record<string, string[]>) || {},
    stems,
    splits: (row.splits as TrackSplit[]) || [],
    lyrics: (row.lyrics as string) || undefined,
    lyricsSegments: Array.isArray(row.lyrics_segments) ? (row.lyrics_segments as { start: number; end: number; text: string }[]) : undefined,
    waveformData: Array.isArray(row.waveform_data)
      ? (row.waveform_data as number[])
      : row.waveform_data && typeof row.waveform_data === "object" && Array.isArray((row.waveform_data as any).peaks)
        ? ((row.waveform_data as any).peaks as number[])
        : undefined,
    chapters: Array.isArray(row.chapters) ? (row.chapters as TrackChapter[]) : undefined,
    createdAt: (row.created_at as string) || undefined,
    statusHistory: [],
    sonicDna: row.sonic_dna ? (row.sonic_dna as Record<string, any>) : undefined,
    tags: row.tags ? (row.tags as Record<string, any>) : {},
    productionStage: (row.production_stage === "finished" || row.production_stage === "work_in_progress")
      ? (row.production_stage as ProductionStage)
      : undefined,
    videoUrl: (row.video_url as string) || null,
    videoFilename: (row.video_filename as string) || null,
    videoVisibleOnShare: (row.video_visible_on_share as boolean) || false,
    hasVersions: (row.has_versions as boolean) || false,
    versionCount: typeof row.version_count === "number" ? (row.version_count as number) : 1,
    isMarketplacePublic: (row.is_marketplace_public as boolean) || false,
  };
}

function mapStatus(status: string): string {
  switch (status) {
    case "available": return "Available";
    case "on_hold": return "On Hold";
    case "released": return "Released";
    default: return "Available";
  }
}

function mapStatusToDb(status: string): string {
  switch (status) {
    case "Available": return "available";
    case "On Hold": return "on_hold";
    case "Released": return "released";
    default: return "available";
  }
}

function mapTrackType(type: string): string {
  switch (type) {
    case "instrumental": return "Instrumental";
    case "sample": return "Sample";
    case "acapella": return "Acapella";
    case "song": return "Song";
    default: return "Song";
  }
}

function mapTrackTypeToDb(type: string): string {
  switch (type) {
    case "Instrumental": return "instrumental";
    case "Sample": return "sample";
    case "Acapella": return "acapella";
    case "Song": return "song";
    default: return "song";
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseDurationToSeconds(dur: string): number {
  const parts = dur.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

interface TrackContextValue {
  tracks: TrackData[];
  loading: boolean;
  getTrack: (id: number) => TrackData | undefined;
  getTrackByUuid: (uuid: string) => TrackData | undefined;
  addTrack: (track: Partial<TrackData> & { title: string; artist: string }) => Promise<TrackData | null>;
  updateTrack: (id: number, updates: Partial<TrackData>) => Promise<boolean>;
  bulkUpdateTracks: (ids: number[], updates: Partial<TrackData>) => Promise<number>;
  updateTrackStatus: (id: number, newStatus: string, note: string) => void;
  updateTrackLyrics: (id: number, lyrics: string, lyricsSegments?: { start: number; end: number; text: string }[]) => void;
  updateTrackStems: (id: number, stems: TrackStem[]) => void;
  updateTrackSplits: (id: number, splits: TrackSplit[]) => Promise<boolean>;
  deleteTrack: (uuid: string) => Promise<boolean>;
  refreshTracks: () => Promise<void>;
  submitRating: (id: number, rating: number) => Promise<void>;
  fetchTrackVersions: (trackUuid: string) => Promise<TrackVersion[]>;
  queueSonicDnaAnalysis: (trackUuid: string, storagePath: string) => void;
}

const TrackContext = createContext<TrackContextValue | null>(null);

export function TrackProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace, endWorkspaceSwitch } = useWorkspace();
  const { user } = useAuth();
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [loading, setLoading] = useState(true);

  // Sonic DNA sequential queue to prevent Railway OOM on bulk uploads
  const sonicDnaQueueRef = useRef<Array<{ track_id: string; storage_path: string }>>([]);
  const sonicDnaProcessingRef = useRef(false);
  const fetchTracksRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // Monotonic id: only the latest fetchTracks run is allowed to write state, so a
  // slow shared-catalog cascade from a previous workspace can't clobber a newer load.
  const fetchSeqRef = useRef(0);

  // Fetch tracks from Supabase when workspace changes
  const fetchTracks = useCallback(async () => {
    if (!activeWorkspace || !user) {
      // Don't clear tracks during transient auth/workspace revalidation
      setLoading(false);
      endWorkspaceSwitch();
      return;
    }

    const mySeq = ++fetchSeqRef.current;
    const isCurrent = () => fetchSeqRef.current === mySeq;

    setLoading(true);
    try {
      // Fetch own tracks, stems, ratings, individual shares, and full catalog shares in parallel
      const [tracksRes, stemsRes, ratingsRes, catalogSharesRes] = await Promise.all([
        // Own catalog read goes through get_workspace_tracks (SECURITY DEFINER):
        // identical columns to SELECT *, ordered by created_at DESC, but splits are
        // sanitized server-side for pitcher/viewer (share/ipi/pro/email/publisher
        // stripped). RLS can't filter a single column, hence the RPC. Not yet in the
        // generated types → local cast, same pattern as useWorkspaceSeats.
        (supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }>)(
          "get_workspace_tracks",
          { _workspace_id: activeWorkspace.id, _user_id: user.id },
        ),
        supabase
          .from("stems")
          .select("*")
          .eq("workspace_id", activeWorkspace.id)
          .order("created_at", { ascending: true }),
        // All ratings in the current workspace (RLS allows members to read peers' ratings).
        // We aggregate client-side: avg, count and myRating per track.
        supabase
          .from("track_ratings")
          .select("track_id, user_id, rating")
          .eq("workspace_id", activeWorkspace.id),
        // Fetch all active catalog shares TO this workspace via RPC (bypasses RLS)
        supabase.rpc("get_workspace_catalog_shares", { _workspace_id: activeWorkspace.id }),
      ]);

      // Split catalog shares into individual (track_id set) and full catalog (track_id null)
      const allShares = (!catalogSharesRes.error && catalogSharesRes.data) ? catalogSharesRes.data as any[] : [];
      const sharedRes = { error: catalogSharesRes.error, data: allShares.filter(function (s: any) { return s.track_id !== null && s.track_id !== undefined; }) };
      const fullCatalogRes = { error: catalogSharesRes.error, data: allShares.filter(function (s: any) { return s.track_id === null || s.track_id === undefined; }) };

      if (tracksRes.error) {
        console.error("Error fetching tracks:", tracksRes.error);
      } else {
        // Group stems by track_id
        const stemsByTrack: Record<string, TrackStem[]> = {};
        for (const row of stemsRes.data || []) {
          const tid = row.track_id as string;
          if (!stemsByTrack[tid]) stemsByTrack[tid] = [];
          stemsByTrack[tid].push(mapStemRow(row as unknown as Record<string, unknown>));
        }

        // Aggregate ratings per track (sum, count, current-user value).
        const ratingAgg: Record<string, { sum: number; count: number; myRating: number | null }> = {};
        if (!ratingsRes.error && Array.isArray(ratingsRes.data)) {
          for (const row of ratingsRes.data as Array<{ track_id: string; user_id: string; rating: number }>) {
            const agg = ratingAgg[row.track_id] || { sum: 0, count: 0, myRating: null };
            agg.sum += row.rating;
            agg.count += 1;
            if (user && row.user_id === user.id) agg.myRating = row.rating;
            ratingAgg[row.track_id] = agg;
          }
        }

        const mapped = (tracksRes.data || []).map((row, i) => {
          const r = row as unknown as Record<string, unknown>;
          const trackStems = stemsByTrack[r.id as string] || [];
          const track = mapRowToTrack(r, i, trackStems);
          const agg = ratingAgg[r.id as string];
          if (agg && agg.count > 0) {
            track.ratingStats = {
              average: Math.round((agg.sum / agg.count) * 10) / 10,
              count: agg.count,
              myRating: agg.myRating,
            };
          } else {
            track.ratingStats = { average: 0, count: 0, myRating: null };
          }
          return track;
        });

        // Collect share info and pre-fetched track row data
        const shareInfoMap: Record<string, { sharedFrom: string; accessLevel: string; shareId: string }> = {};
        const sharedTrackIds: string[] = [];
        // Store already-fetched row data from full catalog cascade (avoids RLS issues on re-fetch)
        const prefetchedRows: Record<string, Record<string, unknown>> = {};

        // Individual shares
        if (!sharedRes.error && sharedRes.data && sharedRes.data.length > 0) {
          for (const share of sharedRes.data) {
            const s = share as any;
            sharedTrackIds.push(s.track_id);
            shareInfoMap[s.track_id] = {
              sharedFrom: s.source_workspace_name || "",
              accessLevel: s.access_level || "viewer",
              shareId: s.id,
            };
          }
        }

        // Progressive render (P0): own catalog is the first useful view of
        // Dashboard/Tracks. Paint it NOW instead of waiting for the shared-catalog
        // cascade below (which can be 8-10 requests). Shared tracks are appended
        // once their heavier fetches resolve. Only worth an extra paint when there
        // is own content to show AND shared work is actually pending.
        const hasSharedWork =
          (!sharedRes.error && sharedRes.data && sharedRes.data.length > 0) ||
          (!fullCatalogRes.error && fullCatalogRes.data && fullCatalogRes.data.length > 0);
        if (hasSharedWork && mapped.length > 0 && isCurrent()) {
          setTracks(mapped.slice());
          setLoading(false);
        }

        // Full catalog shares — all tracks from source workspaces
        // Includes: own tracks of source + tracks shared TO source (1 level cascade, no infinite loops)
        if (!fullCatalogRes.error && fullCatalogRes.data && fullCatalogRes.data.length > 0) {
          const fullCatalogFetches = fullCatalogRes.data.map(async function (share) {
            const s = share as any;
            const sourceWsId = s.source_workspace_id as string;
            const sourceWsName = s.source_workspace_name || "";
            const accessLevel = s.access_level || "viewer";
            const shareId = s.id;

            // Fetch in parallel: own tracks + shares to source (for cascade, via RPC)
            const [ownTracksRes, sourceCatalogSharesRes] = await Promise.all([
              // 1. Own tracks of source workspace (via RPC to bypass RLS)
              supabase.rpc("get_shared_workspace_tracks", {
                _source_workspace_id: sourceWsId,
                _target_workspace_id: activeWorkspace.id,
              }),
              // 2+3. All active catalog shares TO the source workspace via RPC
              supabase.rpc("get_workspace_catalog_shares", { _workspace_id: sourceWsId }),
            ]);

            // Split source shares into individual (track_id set) and full catalog (track_id null)
            const sourceAllShares = (!sourceCatalogSharesRes.error && sourceCatalogSharesRes.data) ? sourceCatalogSharesRes.data as any[] : [];
            const sourceIndividualRes = { data: sourceAllShares.filter(function (cs: any) { return cs.track_id !== null && cs.track_id !== undefined; }) };
            const sourceFullCatalogRes = { data: sourceAllShares.filter(function (cs: any) { return cs.track_id === null || cs.track_id === undefined; }) };

            // All rows we collect, with their original workspace name
            var collectedRows: { row: Record<string, unknown>; originalWsName: string }[] = [];

            // 1. Own tracks of source — badge shows source workspace name
            for (const row of (ownTracksRes.data || [])) {
              collectedRows.push({ row: row as any, originalWsName: sourceWsName });
            }

            // 2. Individual shares TO source — fetch track rows
            var cascadeTrackIds: string[] = [];
            var cascadeOriginalWs: Record<string, string> = {};
            if (sourceIndividualRes.data) {
              for (const cs of sourceIndividualRes.data) {
                const csd = cs as any;
                if (csd.track_id) {
                  cascadeTrackIds.push(csd.track_id);
                  cascadeOriginalWs[csd.track_id] = csd.source_workspace_name || "";
                }
              }
            }

            // 3. Full catalog shares TO source — collect upstream workspace IDs
            var cascadeFullWsIds: { wsId: string; wsName: string }[] = [];
            if (sourceFullCatalogRes.data) {
              for (const cs of sourceFullCatalogRes.data) {
                const csd = cs as any;
                // Prevent loop: don't cascade back to our own workspace
                if (csd.source_workspace_id !== activeWorkspace.id) {
                  cascadeFullWsIds.push({ wsId: csd.source_workspace_id, wsName: csd.source_workspace_name || "" });
                }
              }
            }

            // Fetch cascade track rows in parallel
            var cascadeFetches: Promise<void>[] = [];
            if (cascadeTrackIds.length > 0) {
              cascadeFetches.push(
                supabase
                  .from("tracks")
                  .select("*")
                  .in("id", cascadeTrackIds)
                  .then(function (res) {
                    for (const row of (res.data || [])) {
                      var tid = (row as any).id as string;
                      collectedRows.push({ row: row as any, originalWsName: cascadeOriginalWs[tid] || "" });
                    }
                  })
              );
            }
            for (const cfw of cascadeFullWsIds) {
              cascadeFetches.push(
                supabase
                  .from("tracks")
                  .select("*")
                  .eq("workspace_id", cfw.wsId)
                  .then(function (res) {
                    for (const row of (res.data || [])) {
                      collectedRows.push({ row: row as any, originalWsName: cfw.wsName });
                    }
                  })
              );
            }
            if (cascadeFetches.length > 0) {
              await Promise.all(cascadeFetches);
            }

            return { collected: collectedRows, accessLevel: accessLevel, shareId: shareId };
          });

          const fullCatalogResults = await Promise.all(fullCatalogFetches);
          const seenTrackIds = new Set<string>();
          for (const result of fullCatalogResults) {
            for (const item of result.collected) {
              const trackId = item.row.id as string;
              if (seenTrackIds.has(trackId)) continue;
              seenTrackIds.add(trackId);

              // Store the pre-fetched row so we don't need to re-fetch later
              prefetchedRows[trackId] = item.row;

              if (!shareInfoMap[trackId]) {
                shareInfoMap[trackId] = {
                  sharedFrom: item.originalWsName,
                  accessLevel: result.accessLevel,
                  shareId: result.shareId,
                };
              }
              if (!sharedTrackIds.includes(trackId)) {
                sharedTrackIds.push(trackId);
              }
            }
          }
        }

        // Build shared tracks from pre-fetched data + re-fetch any missing ones
        if (sharedTrackIds.length > 0) {
          const ownTrackIds = new Set(mapped.map(function (t) { return t.uuid; }));
          const idsToFetch = sharedTrackIds.filter(function (id) { return !ownTrackIds.has(id); });

          if (idsToFetch.length > 0) {
            // Split into already-fetched (from full catalog cascade) and needs-fetch (individual shares)
            var alreadyHaveRows: Record<string, unknown>[] = [];
            var needFetchIds: string[] = [];
            for (const id of idsToFetch) {
              if (prefetchedRows[id]) {
                alreadyHaveRows.push(prefetchedRows[id]);
              } else {
                needFetchIds.push(id);
              }
            }

            // Re-fetch only tracks we don't already have row data for
            var fetchedRows: Record<string, unknown>[] = [];
            if (needFetchIds.length > 0) {
              const { data: sharedTrackRows } = await supabase
                .from("tracks")
                .select("*")
                .in("id", needFetchIds);
              fetchedRows = (sharedTrackRows || []) as any[];
            }

            var allSharedRows = alreadyHaveRows.concat(fetchedRows);

            if (allSharedRows.length > 0) {
              var allSharedIds = allSharedRows.map(function (r) { return (r as any).id as string; });

              // Fetch stems for shared tracks
              const { data: sharedStemsData } = await supabase
                .from("stems")
                .select("*")
                .in("track_id", allSharedIds)
                .order("created_at", { ascending: true });

              const sharedStemsByTrack: Record<string, TrackStem[]> = {};
              for (const row of sharedStemsData || []) {
                const tid = row.track_id as string;
                if (!sharedStemsByTrack[tid]) sharedStemsByTrack[tid] = [];
                sharedStemsByTrack[tid].push(mapStemRow(row as unknown as Record<string, unknown>));
              }

              const baseIndex = mapped.length;
              for (let i = 0; i < allSharedRows.length; i++) {
                const r = allSharedRows[i] as Record<string, unknown>;
                const trackId = r.id as string;
                const trackStems = sharedStemsByTrack[trackId] || [];
                const sharedTrack = mapRowToTrack(r, baseIndex + i, trackStems);
                const info = shareInfoMap[trackId];
                if (info) {
                  sharedTrack.isShared = true;
                  sharedTrack.sharedFrom = info.sharedFrom;
                  sharedTrack.shareAccessLevel = info.accessLevel;
                  sharedTrack.shareId = info.shareId;
                }
                mapped.push(sharedTrack);
              }
            }
          }
        }

        // Phase 5 — audio URLs are NOT signed upfront here.
        // previewUrl / originalFileUrl now stay as raw storage paths and are
        // resolved lazily by AudioPlayerContext.resolveAudioUrl, crossfadePlayer,
        // and any other consumer via src/lib/audio.ts (get-audio-url EF / R2 routed).
        // This removes a per-workspace-load batch of up to ~N createSignedUrls
        // calls and centralises signing through the storage abstraction.
        //
        // Legacy Supabase-direct batch sign (kept here as comment for Phase 5 rollback reference):
        //   const { data: signedUrls } = await supabase.storage
        //     .from("tracks").createSignedUrls(Array.from(pathsToSign), 3600);

        // Final paint with own + shared tracks. Skip if a newer fetch superseded
        // this one (workspace switched mid-cascade) so we never clobber it.
        if (isCurrent()) setTracks(mapped);
      }
    } catch (err) {
      console.error("Unexpected error fetching tracks:", err);
    } finally {
      if (isCurrent()) {
        setLoading(false);
        // Core data for the (possibly switched) workspace is ready — clear the switch overlay
        endWorkspaceSwitch();
      }
    }
  }, [activeWorkspace, user, endWorkspaceSwitch]);

  // Keep ref in sync so the long-running queue always calls the latest fetchTracks
  fetchTracksRef.current = fetchTracks;

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  // Process Sonic DNA queue sequentially — one at a time
  const processSonicDnaQueue = useCallback(async () => {
    if (sonicDnaProcessingRef.current) return;
    sonicDnaProcessingRef.current = true;
    try {
      while (sonicDnaQueueRef.current.length > 0) {
        const task = sonicDnaQueueRef.current.shift()!;
        let succeeded = false;
        // analyze-sonic-dna now requires an authenticated editor (verify_jwt + IDOR
        // guard). Send the real session access_token; fail closed to the anon key.
        const { data: sessData } = await supabase.auth.getSession();
        const accessToken = sessData.session?.access_token || SUPABASE_PUBLISHABLE_KEY;
        // Try twice (one auto-retry) — the analysis API can transiently timeout.
        for (let attempt = 0; attempt < 2 && !succeeded; attempt++) {
          try {
            const res = await fetch(SUPABASE_URL + "/functions/v1/analyze-sonic-dna", {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": "Bearer " + accessToken },
              body: JSON.stringify({ track_id: task.track_id, storage_path: task.storage_path }),
              signal: AbortSignal.timeout(120000),
            });
            const dnaResult = await res.json();
            if (dnaResult?.success) {
              succeeded = true;
              await fetchTracksRef.current();
            } else {
              // Non-2xx / { success:false } doesn't throw — log the real reason so
              // failures aren't silent (the catch below only fires on network/timeout).
              console.error('[SonicDNA] Non-success for', task.track_id, '(attempt', attempt + 1, '):', dnaResult?.error || ('HTTP ' + res.status));
            }
          } catch (err) {
            console.error('[SonicDNA] Error for', task.track_id, '(attempt', attempt + 1, '):', err);
          }
        }
        // Persist a failure marker so the UI can surface it + offer a retry,
        // instead of leaving the track silently without BPM/Key. Merge into the
        // existing sonic_dna so we never clobber a prior successful analysis.
        if (!succeeded) {
          try {
            const { data: sess } = await supabase.auth.getSession();
            const uid = sess.session?.user?.id;
            if (uid) {
              const { data: row } = await supabase.from("tracks").select("sonic_dna").eq("id", task.track_id).single();
              const existing = (row?.sonic_dna as Record<string, unknown>) || {};
              await supabase.rpc("update_track", {
                _user_id: uid,
                _track_id: task.track_id,
                _updates: { sonic_dna: { ...existing, status: "failed" } },
              });
              await fetchTracksRef.current();
            }
          } catch (e) {
            console.error('[SonicDNA] Failed to persist failure marker for', task.track_id, ':', e);
          }
        }
      }
    } finally {
      sonicDnaProcessingRef.current = false;
    }
  }, []);

  const getTrack = useCallback(
    (id: number) => {
      return tracks.find((t) => t.id === id);
    },
    [tracks]
  );

  const getTrackByUuid = useCallback(
    (uuid: string) => {
      return tracks.find((t) => t.uuid === uuid);
    },
    [tracks]
  );

  const addTrack = useCallback(
    async (trackInput: Partial<TrackData> & { title: string; artist: string }): Promise<TrackData | null> => {
      if (!activeWorkspace || !user) return null;

      const { data, error } = await supabase.rpc("insert_track", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _title: trackInput.title,
        _artist: trackInput.artist,
        _featuring: trackInput.featuredArtists?.join(", ") || null,
        _type: mapTrackTypeToDb(trackInput.type || "Song"),
        _status: mapStatusToDb(trackInput.status || "Available"),
        _bpm: trackInput.bpm || null,
        _key: trackInput.key || null,
        _duration_sec: trackInput.duration ? parseDurationToSeconds(trackInput.duration) : null,
        _genre: trackInput.genre && trackInput.genre.length > 0 ? trackInput.genre : null,
        _mood: trackInput.mood || [],
        _language: trackInput.language || null,
        _gender: trackInput.voice?.toLowerCase().replace("n/a", "n_a") || null,
        _labels: trackInput.label ? [trackInput.label] : [],
        _publishers: trackInput.publishers?.length ? trackInput.publishers : [],
        _audio_url: trackInput.originalFileUrl || null,
        _audio_preview_url: trackInput.previewFileUrl || null,
        _cover_art_url: trackInput.coverImage || null,
        _lyrics: trackInput.lyrics || null,
        _notes: trackInput.notes || null,
        _splits: trackInput.splits || [],
        _isrc: trackInput.isrc || null,
        _waveform_data: trackInput.waveformData || null,
        _released_at: null,
      });

      if (error) {
        console.error("Error adding track:", error);
        return null;
      }

      // RPC returns uuid directly — wrap in object for downstream compat
      const trackUuid = data as unknown as string;

      // Save metadata fields via update_track after creation (not in insert_track signature)
      if (trackUuid) {
        const metaPayload: Record<string, unknown> = {};
        // writer/producer/mixer/masterer credits have NO matching columns on `tracks`
        // (passing them top-level makes update_track roll back the whole UPDATE) — nest
        // them in the `credits` jsonb: snake_case keys + comma-joined strings, mirroring
        // UploadTrackModal (commit 965a323) so all upload paths store credits identically.
        const writerCredits: Record<string, unknown> = {};
        if (trackInput.writtenBy?.length) writerCredits.written_by = trackInput.writtenBy.join(", ");
        if (trackInput.producedBy?.length) writerCredits.produced_by = trackInput.producedBy.join(", ");
        if (trackInput.mixedBy) writerCredits.mixed_by = trackInput.mixedBy;
        if (trackInput.masteredBy) writerCredits.mastered_by = trackInput.masteredBy;
        if (trackInput.copyright) metaPayload.copyright = trackInput.copyright;
        if (trackInput.explicit) metaPayload.explicit = trackInput.explicit;
        if (trackInput.chapters) metaPayload.chapters = trackInput.chapters;
        if (trackInput.productionStage) metaPayload.production_stage = trackInput.productionStage;
        const mergedCredits = { ...(trackInput.credits || {}), ...writerCredits };
        if (Object.keys(mergedCredits).length > 0) metaPayload.credits = mergedCredits;
        if (trackInput.tags && Object.keys(trackInput.tags).length > 0) metaPayload.tags = trackInput.tags;
        if (Object.keys(metaPayload).length > 0) {
          await supabase.rpc("update_track", {
            _user_id: user.id,
            _track_id: trackUuid,
            _updates: metaPayload,
          });
        }

        // Trakalog Access opt-in. Uses the dedicated RPC (not update_track, which
        // rolls back on non-whitelisted columns). Only when explicitly enabled —
        // the column defaults to false.
        if (trackInput.isMarketplacePublic) {
          const { error: mpError } = await supabase.rpc("set_track_marketplace_public", {
            _user_id: user.id,
            _track_id: trackUuid,
            _workspace_id: activeWorkspace.id,
            _public: true,
          });
          if (mpError) console.error("set_track_marketplace_public failed:", mpError);
        }
      }

      // Send notification to workspace owner if uploader is not the owner
      if (activeWorkspace.owner_id && activeWorkspace.owner_id !== user.id) {
        fetch(SUPABASE_URL + "/functions/v1/send-notification-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({
            event_type: "track_upload",
            user_id: activeWorkspace.owner_id,
            data: {
              track_title: trackInput.title,
              uploader_name: (user.user_metadata?.full_name || user.user_metadata?.first_name || user.email || "A member"),
              uploader_email: user.email || "",
            },
          }),
        }).catch(() => {});
      }

      // Refresh tracks to get the new one with correct index
      await fetchTracks();

      // Queue Sonic DNA analysis — processed sequentially to prevent Railway OOM
      if (trackUuid && trackInput.originalFileUrl) {
        sonicDnaQueueRef.current.push({ track_id: trackUuid, storage_path: trackInput.originalFileUrl });
        toast.info(i18n.t("trackContext.analyzingAudio"), { duration: 5000 });
        processSonicDnaQueue();
      }

      // Return the newly created track from the refreshed list
      const newTrack = tracks.find((t) => t.uuid === trackUuid) || {
        id: tracks.length + 1,
        uuid: trackUuid,
        title: trackInput.title,
        artist: trackInput.artist,
      } as TrackData;
      return newTrack;
    },
    [activeWorkspace, user, fetchTracks, processSonicDnaQueue, tracks.length]
  );

  // Resolve a reliable user id for DB writes. AuthContext `user` can be
  // momentarily null on unstable sessions (auth.uid() → NULL), which would make
  // an update silently no-op. Mirror the ensureSession pattern: refreshSession →
  // getSession → localStorage backup. Returns null only if truly signed out.
  const resolveUserId = useCallback(async (): Promise<string | null> => {
    if (user?.id) return user.id;
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session?.user?.id) return refreshed.session.user.id;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
    try {
      const backup = safeLocalStorage.getItem("trakalog_session_backup");
      if (backup) {
        const parsed = JSON.parse(backup);
        const accessToken = parsed?.access_token || parsed?.currentSession?.access_token;
        const refreshToken = parsed?.refresh_token || parsed?.currentSession?.refresh_token;
        if (accessToken && refreshToken) {
          const { data: restored } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (restored?.session?.user?.id) return restored.session.user.id;
        }
      }
    } catch { /* ignore */ }
    return null;
  }, [user]);

  const updateTrack = useCallback(
    async (id: number, updates: Partial<TrackData>): Promise<boolean> => {
      const track = tracks.find((t) => t.id === id);
      if (!track) return false;

      // Update locally first for instant UI
      setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));

      // Build Supabase update payload
      const payload: Record<string, unknown> = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.album !== undefined) payload.album = updates.album || null;
      if (updates.artist !== undefined) payload.artist = updates.artist;
      if (updates.featuredArtists !== undefined) payload.featuring = updates.featuredArtists.join(", ");
      if (updates.type !== undefined) payload.track_type = mapTrackTypeToDb(updates.type);
      if (updates.status !== undefined) payload.status = mapStatusToDb(updates.status);
      if (updates.bpm !== undefined) payload.bpm = updates.bpm || null;
      if (updates.key !== undefined) payload.key = updates.key || null;
      if (updates.duration !== undefined) payload.duration_sec = parseDurationToSeconds(updates.duration);
      if (updates.genre !== undefined) payload.genre = updates.genre && updates.genre.length > 0 ? updates.genre : null;
      if (updates.mood !== undefined) payload.mood = updates.mood;
      if (updates.language !== undefined) payload.language = updates.language || null;
      if (updates.voice !== undefined) payload.gender = updates.voice?.toLowerCase().replace("n/a", "n_a") || null;
      if (updates.label !== undefined) payload.labels = updates.label ? [updates.label] : [];
      if (updates.publishers !== undefined) payload.publishers = updates.publishers;
      if (updates.coverImage !== undefined) payload.cover_url = updates.coverImage || null;
      if (updates.originalFileUrl !== undefined) payload.audio_url = updates.originalFileUrl || null;
      if (updates.previewFileUrl !== undefined) payload.audio_preview_url = updates.previewFileUrl || null;
      if (updates.lyrics !== undefined) payload.lyrics = updates.lyrics || null;
      if (updates.notes !== undefined) payload.notes = updates.notes || null;
      if (updates.splits !== undefined) payload.splits = updates.splits;
      if (updates.isrc !== undefined) payload.isrc = updates.isrc || null;
      if (updates.upc !== undefined) payload.upc = updates.upc || null;
      if (updates.releaseDate !== undefined) payload.released_at = updates.releaseDate || null;
      if (updates.chapters !== undefined) payload.chapters = updates.chapters || null;
      if (updates.waveformData !== undefined) payload.waveform_data = updates.waveformData || null;
      if (updates.copyright !== undefined) payload.copyright = updates.copyright || null;
      if (updates.explicit !== undefined) payload.explicit = updates.explicit || false;
      // writer credits live in the `credits` jsonb (snake_case, joined strings) — same as
      // addTrack / UploadTrackModal. MERGE into existing credits so editing a writer field
      // never clobbers customPerformers / customProduction already stored on the track.
      const hasWriterEdit =
        updates.writtenBy !== undefined || updates.producedBy !== undefined ||
        updates.mixedBy !== undefined || updates.masteredBy !== undefined;
      if (updates.credits !== undefined || hasWriterEdit) {
        const mergedCredits: Record<string, unknown> = {
          ...((track.credits as Record<string, unknown>) || {}),
          ...((updates.credits as Record<string, unknown>) || {}),
        };
        if (updates.writtenBy !== undefined) mergedCredits.written_by = updates.writtenBy.length ? updates.writtenBy.join(", ") : null;
        if (updates.producedBy !== undefined) mergedCredits.produced_by = updates.producedBy.length ? updates.producedBy.join(", ") : null;
        if (updates.mixedBy !== undefined) mergedCredits.mixed_by = updates.mixedBy || null;
        if (updates.masteredBy !== undefined) mergedCredits.mastered_by = updates.masteredBy || null;
        payload.credits = mergedCredits;
      }
      if (updates.tags !== undefined) payload.tags = updates.tags;
      if (updates.productionStage !== undefined) payload.production_stage = updates.productionStage || "work_in_progress";

      if (Object.keys(payload).length > 0) {
        const userId = await resolveUserId();
        if (!userId) {
          console.error("Error updating track: no auth session");
          toast.error(i18n.t("trackContext.failedSaveUpdate"));
          return false;
        }
        const { error } = await supabase.rpc("update_track", {
          _user_id: userId,
          _track_id: track.uuid,
          _updates: payload,
        });

        if (error) {
          console.error("Error updating track:", error);
          toast.error(i18n.t("trackContext.failedSaveUpdate"));
          return false;
        }
      }
      return true;
    },
    [tracks, resolveUserId]
  );

  // Bulk-edit the SAME field value across many tracks via the atomic
  // bulk_update_tracks RPC (server enforces the same whitelist + editor/pitcher
  // access check as update_track). Shared/uneditable tracks are skipped client-
  // side (the RPC would reject them anyway). Returns the number of tracks updated.
  const bulkUpdateTracks = useCallback(
    async (ids: number[], updates: Partial<TrackData>): Promise<number> => {
      // Resolve editable UUIDs (never touch catalog-shared tracks from other ws).
      const uuids: string[] = [];
      for (const id of ids) {
        const track = tracks.find((t) => t.id === id);
        if (track && track.uuid && !track.isShared) uuids.push(track.uuid);
      }
      if (uuids.length === 0) {
        toast.error(i18n.t("trackContext.failedSaveUpdate"));
        return 0;
      }

      // Map to DB columns exactly like update_track (same whitelist).
      const payload: Record<string, unknown> = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.artist !== undefined) payload.artist = updates.artist;
      if (updates.status !== undefined) payload.status = mapStatusToDb(updates.status);
      if (updates.genre !== undefined) payload.genre = updates.genre && updates.genre.length > 0 ? updates.genre : null;
      if (updates.mood !== undefined) payload.mood = updates.mood;
      if (updates.language !== undefined) payload.language = updates.language || null;
      if (updates.productionStage !== undefined) payload.production_stage = updates.productionStage || "work_in_progress";
      if (Object.keys(payload).length === 0) return 0;

      // Optimistic local update for instant UI.
      const idSet = new Set(ids);
      setTracks((prev) => prev.map((t) => (idSet.has(t.id) && !t.isShared ? { ...t, ...updates } : t)));

      const userId = await resolveUserId();
      if (!userId) {
        console.error("Bulk update: no auth session");
        toast.error(i18n.t("trackContext.failedSaveUpdate"));
        return 0;
      }
      const { data, error } = await supabase.rpc("bulk_update_tracks", {
        _user_id: userId,
        _track_ids: uuids,
        _updates: payload,
      });
      if (error) {
        console.error("Error bulk-updating tracks:", error);
        toast.error(i18n.t("trackContext.failedSaveUpdate"));
        await fetchTracks(); // re-sync after a rolled-back (atomic) failure
        return 0;
      }
      await fetchTracks();
      return typeof data === "number" ? data : uuids.length;
    },
    [tracks, resolveUserId, fetchTracks]
  );

  const updateTrackStatus = useCallback(
    async (id: number, newStatus: string, note: string) => {
      const track = tracks.find((t) => t.id === id);
      if (!track) return;

      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

      // Update locally
      setTracks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status: newStatus,
                statusHistory: [...(t.statusHistory || []), { status: newStatus, date: dateStr, note }],
              }
            : t
        )
      );

      // Persist status to Supabase
      if (user) {
        const { error } = await supabase.rpc("update_track", {
          _user_id: user.id,
          _track_id: track.uuid,
          _updates: { status: mapStatusToDb(newStatus) },
        });

        if (error) {
          console.error("Error updating track status:", error);
        }
      }
    },
    [tracks, user]
  );

  const updateTrackLyrics = useCallback(
    async (id: number, lyrics: string, lyricsSegments?: { start: number; end: number; text: string }[]) => {
      const track = tracks.find((t) => t.id === id);
      if (!track) return;

      setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, lyrics, lyricsSegments: lyricsSegments ?? t.lyricsSegments } : t)));

      const updatePayload: Record<string, unknown> = { lyrics };
      if (lyricsSegments !== undefined) {
        updatePayload.lyrics_segments = lyricsSegments;
      }

      if (user) {
        const { error } = await supabase.rpc("update_track", {
          _user_id: user.id,
          _track_id: track.uuid,
          _updates: updatePayload,
        });

        if (error) {
          console.error("Error updating lyrics:", error);
        }
      }
    },
    [tracks, user]
  );

  const updateTrackStems = useCallback(
    async (id: number, stems: TrackStem[]) => {
      const track = tracks.find((t) => t.id === id);
      if (!track || !activeWorkspace) return;

      // Update locally first
      setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, stems } : t)));

      // Delete existing stems for this track, then insert new ones
      if (!user) return;

      // Fetch existing stem IDs to delete them via RPC
      const { data: existingStems } = await supabase
        .from("stems")
        .select("id")
        .eq("track_id", track.uuid);

      for (const s of existingStems || []) {
        await supabase.rpc("delete_stem", { _user_id: user.id, _stem_id: s.id });
      }

      if (stems.length > 0) {
        for (const s of stems) {
          await supabase.rpc("insert_stem", {
            _user_id: user.id,
            _track_id: track.uuid,
            _name: s.fileName,
            _file_url: "",
            _file_size: 0,
            _stem_type: s.type === "background vocal" ? "background_vocal" : s.type,
          });
        }
      }
    },
    [tracks, activeWorkspace, user]
  );

  const updateTrackSplits = useCallback(
    async (id: number, splits: TrackSplit[]): Promise<boolean> => {
      const track = tracks.find((t) => t.id === id);
      if (!track) return false;

      const normalized = splits.map((s) => ({ ...s, share: s.share || 0 }));

      setTracks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, splits: normalized } : t))
      );

      const userId = await resolveUserId();
      if (!userId) {
        console.error("Error updating splits: no auth session");
        toast.error(i18n.t("trackContext.failedSaveUpdate"));
        return false;
      }
      const { error } = await supabase.rpc("update_track", {
        _user_id: userId,
        _track_id: track.uuid,
        _updates: { splits: normalized },
      });

      if (error) {
        console.error("Error updating splits:", error);
        toast.error(i18n.t("trackContext.failedSaveUpdate"));
        return false;
      }
      return true;
    },
    [tracks, resolveUserId]
  );

  const deleteTrack = useCallback(
    async (uuid: string): Promise<boolean> => {
      if (!activeWorkspace) return false;

      // Delete stems from storage + DB
      const { data: stemRows } = await supabase
        .from("stems")
        .select("id, storage_path")
        .eq("track_id", uuid);

      if (stemRows && stemRows.length > 0) {
        const stemPaths = stemRows
          .map((s: Record<string, unknown>) => s.storage_path as string)
          .filter(Boolean);
        if (stemPaths.length > 0) {
          await supabase.storage.from("stems").remove(stemPaths);
        }
        if (user) {
          for (const s of stemRows) {
            await supabase.rpc("delete_stem", { _user_id: user.id, _stem_id: (s as any).id });
          }
        }
      }

      // Delete audio file from storage
      const { data: trackRow } = await supabase
        .from("tracks")
        .select("storage_path")
        .eq("id", uuid)
        .single();

      if (trackRow?.storage_path) {
        await supabase.storage.from("tracks").remove([trackRow.storage_path]);
      }

      // Delete cover from storage
      const coverPath = activeWorkspace.id + "/" + uuid + ".jpg";
      await supabase.storage.from("covers").remove([coverPath]);

      // Delete the track row
      if (!user) return false;
      const { error } = await supabase.rpc("delete_track", { _user_id: user.id, _track_id: uuid });
      if (error) {
        console.error("Error deleting track:", error);
        return false;
      }

      setTracks((prev) => prev.filter((t) => t.uuid !== uuid));
      return true;
    },
    [activeWorkspace, user]
  );

  const submitRating = useCallback(
    async (id: number, rating: number) => {
      const track = tracks.find((t) => t.id === id);
      if (!track || !user || !activeWorkspace) return;
      if (rating < 1 || rating > 5) return;

      const prev = track.ratingStats || { average: 0, count: 0, myRating: null };
      // Optimistic update — recompute the rolling sum from previous avg×count.
      const prevSum = prev.average * prev.count;
      const next = prev.myRating == null
        ? { count: prev.count + 1, sum: prevSum + rating }
        : { count: prev.count, sum: prevSum - prev.myRating + rating };
      const nextStats: RatingStats = {
        count: next.count,
        average: next.count > 0 ? Math.round((next.sum / next.count) * 10) / 10 : 0,
        myRating: rating,
      };
      setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ratingStats: nextStats } : t)));

      const { error } = await supabase.rpc("upsert_track_rating", {
        _user_id: user.id,
        _track_id: track.uuid,
        _workspace_id: activeWorkspace.id,
        _rating: rating,
      });

      if (error) {
        // Don't revert: rapid successive clicks would race the optimistic state.
        // Toast and let the user retry; the next fetchTracks resync will reconcile.
        console.error("Error saving rating:", error);
        toast.error(i18n.t("trackContext.failedSaveRating"));
      }
    },
    [tracks, user, activeWorkspace]
  );

  const fetchTrackVersions = useCallback(async (trackUuid: string): Promise<TrackVersion[]> => {
    const { data, error } = await supabase
      .from("track_versions")
      .select("*")
      .eq("track_id", trackUuid)
      .order("version_number", { ascending: true });
    if (error) {
      console.error("Error fetching track versions:", error);
      return [];
    }
    return (data || []) as TrackVersion[];
  }, []);

  const queueSonicDnaAnalysis = useCallback((trackUuid: string, storagePath: string) => {
    if (!trackUuid || !storagePath) return;
    sonicDnaQueueRef.current.push({ track_id: trackUuid, storage_path: storagePath });
    processSonicDnaQueue();
  }, [processSonicDnaQueue]);

  const contextValue = useMemo(() => ({
    tracks,
    loading,
    getTrack,
    getTrackByUuid,
    addTrack,
    updateTrack,
    bulkUpdateTracks,
    updateTrackStatus,
    updateTrackLyrics,
    updateTrackStems,
    updateTrackSplits,
    deleteTrack,
    refreshTracks: fetchTracks,
    submitRating,
    fetchTrackVersions,
    queueSonicDnaAnalysis,
  }), [tracks, loading, getTrack, getTrackByUuid, addTrack, updateTrack, bulkUpdateTracks, updateTrackStatus, updateTrackLyrics, updateTrackStems, updateTrackSplits, deleteTrack, fetchTracks, submitRating, fetchTrackVersions, queueSonicDnaAnalysis]);

  return (
    <TrackContext.Provider value={contextValue}>
      {children}
    </TrackContext.Provider>
  );
}

export function useTrack() {
  const ctx = useContext(TrackContext);
  if (!ctx) throw new Error("useTrack must be used within TrackProvider");
  return ctx;
}

