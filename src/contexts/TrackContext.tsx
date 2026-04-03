import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/constants";
import { detectChapters } from "@/lib/chapter-detection";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import type { WorkspaceScoped } from "@/types/workspace";

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
  genre: string;
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
  publisher: string;
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
  details: Record<string, string[]>;
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

// Helper: convert Supabase row to TrackData
export function mapRowToTrack(row: Record<string, unknown>, index: number, stems: TrackStem[] = []): TrackData {
  return {
    id: index + 1, // numeric id for frontend compatibility
    uuid: row.id as string,
    workspace_id: row.workspace_id as string,
    title: (row.title as string) || "",
    artist: (row.artist as string) || "",
    featuredArtists: (row.featuring as string)
      ? (row.featuring as string).split(",").map((s) => s.trim())
      : [],
    album: "",
    genre: (row.genre as string) || "",
    bpm: (row.bpm as number) || 0,
    key: (row.key as string) || "",
    duration: row.duration_sec
      ? formatDuration(row.duration_sec as number)
      : "0:00",
    mood: (row.mood as string[]) || [],
    voice: (row.gender as string) || "",
    status: mapStatus(row.status as string),
    isrc: (row.isrc as string) || "",
    upc: "",
    releaseDate: (row.released_at as string) || "",
    label: Array.isArray(row.labels) && (row.labels as string[]).length > 0
      ? (row.labels as string[])[0]
      : "",
    publisher: Array.isArray(row.publishers) && (row.publishers as string[]).length > 0
      ? (row.publishers as string[])[0]
      : "",
    writtenBy: [],
    producedBy: [],
    mixedBy: "",
    masteredBy: "",
    copyright: "",
    language: (row.language as string) || "",
    explicit: false,
    type: mapTrackType(row.track_type as string),
    coverIdx: 0,
    coverImage: (row.cover_url as string) || undefined,
    previewUrl: (row.audio_preview_url as string) || (row.audio_url as string) || undefined,
    previewFileUrl: (row.audio_preview_url as string) || undefined,
    originalFileUrl: (row.audio_url as string) || undefined,
    notes: (row.notes as string) || "",
    details: {},
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
  updateTrack: (id: number, updates: Partial<TrackData>) => void;
  updateTrackStatus: (id: number, newStatus: string, note: string) => void;
  updateTrackLyrics: (id: number, lyrics: string, lyricsSegments?: { start: number; end: number; text: string }[]) => void;
  updateTrackStems: (id: number, stems: TrackStem[]) => void;
  updateTrackSplits: (id: number, splits: TrackSplit[]) => void;
  deleteTrack: (uuid: string) => Promise<boolean>;
  refreshTracks: () => Promise<void>;
}

const TrackContext = createContext<TrackContextValue | null>(null);

export function TrackProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch tracks from Supabase when workspace changes
  const fetchTracks = useCallback(async () => {
    if (!activeWorkspace || !user) {
      // Don't clear tracks during transient auth/workspace revalidation
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch own tracks, stems, individual shares, and full catalog shares in parallel
      const [tracksRes, stemsRes, catalogSharesRes] = await Promise.all([
        supabase
          .from("tracks")
          .select("*")
          .eq("workspace_id", activeWorkspace.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("stems")
          .select("*")
          .eq("workspace_id", activeWorkspace.id)
          .order("created_at", { ascending: true }),
        // Fetch all active catalog shares TO this workspace via RPC (bypasses RLS)
        supabase.rpc("get_workspace_catalog_shares", { _workspace_id: activeWorkspace.id }),
      ]);

      // Split catalog shares into individual (track_id set) and full catalog (track_id null)
      const allShares = (!catalogSharesRes.error && catalogSharesRes.data) ? catalogSharesRes.data as any[] : [];
      const sharedRes = { error: catalogSharesRes.error, data: allShares.filter(function (s: any) { return s.track_id != null; }) };
      const fullCatalogRes = { error: catalogSharesRes.error, data: allShares.filter(function (s: any) { return s.track_id == null; }) };

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

        const mapped = (tracksRes.data || []).map((row, i) => {
          const r = row as unknown as Record<string, unknown>;
          const trackStems = stemsByTrack[r.id as string] || [];
          return mapRowToTrack(r, i, trackStems);
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
            const sourceIndividualRes = { data: sourceAllShares.filter(function (cs: any) { return cs.track_id != null; }) };
            const sourceFullCatalogRes = { data: sourceAllShares.filter(function (cs: any) { return cs.track_id == null; }) };

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

        // Resolve storage paths to signed URLs for audio (preview + original)
        const pathsToSign = new Set<string>();
        mapped.forEach((t) => {
          if (t.previewUrl && !t.previewUrl.startsWith("http")) pathsToSign.add(t.previewUrl);
          if (t.originalFileUrl && !t.originalFileUrl.startsWith("http")) pathsToSign.add(t.originalFileUrl);
        });
        if (pathsToSign.size > 0) {
          const { data: signedUrls } = await supabase.storage
            .from("tracks")
            .createSignedUrls(Array.from(pathsToSign), 3600);

          if (signedUrls) {
            const urlMap: Record<string, string> = {};
            signedUrls.forEach((entry) => {
              if (entry.signedUrl && !entry.error) {
                urlMap[entry.path || ""] = entry.signedUrl;
              }
            });
            mapped.forEach((t) => {
              if (t.previewUrl && !t.previewUrl.startsWith("http") && urlMap[t.previewUrl]) {
                t.previewUrl = urlMap[t.previewUrl];
              }
              if (t.originalFileUrl && !t.originalFileUrl.startsWith("http") && urlMap[t.originalFileUrl]) {
                t.originalFileUrl = urlMap[t.originalFileUrl];
              }
            });
          }
        }

        setTracks(mapped);
      }
    } catch (err) {
      console.error("Unexpected error fetching tracks:", err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, user]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const getTrack = useCallback(
    (id: number) => {
      const track = tracks.find((t) => t.id === id);
      if (track && !track.chapters) {
        return { ...track, chapters: detectChapters(track.type, track.bpm, track.id) };
      }
      return track;
    },
    [tracks]
  );

  const getTrackByUuid = useCallback(
    (uuid: string) => {
      const track = tracks.find((t) => t.uuid === uuid);
      if (track && !track.chapters) {
        return { ...track, chapters: detectChapters(track.type, track.bpm, track.id) };
      }
      return track;
    },
    [tracks]
  );

  const addTrack = useCallback(
    async (trackInput: Partial<TrackData> & { title: string; artist: string }): Promise<TrackData | null> => {
      if (!activeWorkspace || !user) return null;

      const { data, error } = await supabase
        .from("tracks")
        .insert({
          workspace_id: activeWorkspace.id,
          uploaded_by: user.id,
          title: trackInput.title,
          artist: trackInput.artist,
          featuring: trackInput.featuredArtists?.join(", ") || null,
          track_type: mapTrackTypeToDb(trackInput.type || "Song"),
          status: mapStatusToDb(trackInput.status || "Available"),
          bpm: trackInput.bpm || null,
          key: trackInput.key || null,
          duration_sec: trackInput.duration
            ? parseDurationToSeconds(trackInput.duration)
            : null,
          genre: trackInput.genre || null,
          mood: trackInput.mood || [],
          language: trackInput.language || null,
          gender: trackInput.voice?.toLowerCase().replace("n/a", "n_a") || null,
          labels: trackInput.label ? [trackInput.label] : [],
          publishers: trackInput.publisher ? [trackInput.publisher] : [],
          audio_url: trackInput.originalFileUrl || null,
          audio_preview_url: trackInput.previewFileUrl || null,
          cover_url: trackInput.coverImage || null,
          lyrics: trackInput.lyrics || null,
          notes: trackInput.notes || null,
          splits: trackInput.splits || [],
          isrc: trackInput.isrc || null,
          waveform_data: trackInput.waveformData || null,
          chapters: trackInput.chapters || null,
        } as any)
        .select()
        .single();

      if (error) {
        console.error("Error adding track:", error);
        return null;
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

      // Return the newly created track
      const newTrack = mapRowToTrack(data as unknown as Record<string, unknown>, tracks.length);
      return newTrack;
    },
    [activeWorkspace, user, fetchTracks, tracks.length]
  );

  const updateTrack = useCallback(
    async (id: number, updates: Partial<TrackData>) => {
      const track = tracks.find((t) => t.id === id);
      if (!track) return;

      // Update locally first for instant UI
      setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));

      // Build Supabase update payload
      const payload: Record<string, unknown> = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.artist !== undefined) payload.artist = updates.artist;
      if (updates.featuredArtists !== undefined) payload.featuring = updates.featuredArtists.join(", ");
      if (updates.type !== undefined) payload.track_type = mapTrackTypeToDb(updates.type);
      if (updates.status !== undefined) payload.status = mapStatusToDb(updates.status);
      if (updates.bpm !== undefined) payload.bpm = updates.bpm || null;
      if (updates.key !== undefined) payload.key = updates.key || null;
      if (updates.duration !== undefined) payload.duration_sec = parseDurationToSeconds(updates.duration);
      if (updates.genre !== undefined) payload.genre = updates.genre || null;
      if (updates.mood !== undefined) payload.mood = updates.mood;
      if (updates.language !== undefined) payload.language = updates.language || null;
      if (updates.voice !== undefined) payload.gender = updates.voice?.toLowerCase().replace("n/a", "n_a") || null;
      if (updates.label !== undefined) payload.labels = updates.label ? [updates.label] : [];
      if (updates.publisher !== undefined) payload.publishers = updates.publisher ? [updates.publisher] : [];
      if (updates.coverImage !== undefined) payload.cover_url = updates.coverImage || null;
      if (updates.originalFileUrl !== undefined) payload.audio_url = updates.originalFileUrl || null;
      if (updates.previewFileUrl !== undefined) payload.audio_preview_url = updates.previewFileUrl || null;
      if (updates.lyrics !== undefined) payload.lyrics = updates.lyrics || null;
      if (updates.notes !== undefined) payload.notes = updates.notes || null;
      if (updates.splits !== undefined) payload.splits = updates.splits;
      if (updates.isrc !== undefined) payload.isrc = updates.isrc || null;
      if (updates.chapters !== undefined) payload.chapters = updates.chapters || null;
      if (updates.waveformData !== undefined) payload.waveform_data = updates.waveformData || null;

      if (Object.keys(payload).length > 0) {
        const { error } = await supabase
          .from("tracks")
          .update(payload)
          .eq("id", track.uuid);

        if (error) {
          console.error("Error updating track:", error);
        }
      }
    },
    [tracks]
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
      const { error } = await supabase
        .from("tracks")
        .update({ status: mapStatusToDb(newStatus) })
        .eq("id", track.uuid);

      if (error) {
        console.error("Error updating track status:", error);
      }
    },
    [tracks]
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

      const { error } = await supabase
        .from("tracks")
        .update(updatePayload)
        .eq("id", track.uuid);

      if (error) {
        console.error("Error updating lyrics:", error);
      }
    },
    [tracks]
  );

  const updateTrackStems = useCallback(
    async (id: number, stems: TrackStem[]) => {
      const track = tracks.find((t) => t.id === id);
      if (!track || !activeWorkspace) return;

      // Update locally first
      setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, stems } : t)));

      // Delete existing stems for this track, then insert new ones
      const { error: delError } = await supabase
        .from("stems")
        .delete()
        .eq("track_id", track.uuid);

      if (delError) {
        console.error("Error clearing stems:", delError);
        return;
      }

      if (stems.length > 0) {
        const inserts = stems.map((s) => ({
          track_id: track.uuid,
          workspace_id: activeWorkspace.id,
          file_name: s.fileName,
          file_url: "",
          stem_type: s.type === "background vocal" ? "background_vocal" : s.type,
          uploaded_by: user?.id || null,
        }));

        const { error: insError } = await supabase
          .from("stems")
          .insert(inserts);

        if (insError) {
          console.error("Error inserting stems:", insError);
        }
      }
    },
    [tracks, activeWorkspace, user]
  );

  const updateTrackSplits = useCallback(
    async (id: number, splits: TrackSplit[]) => {
      const track = tracks.find((t) => t.id === id);
      if (!track) return;

      const normalized = splits.map((s) => ({ ...s, share: s.share || 0 }));

      setTracks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, splits: normalized } : t))
      );

      const { error } = await supabase
        .from("tracks")
        .update({ splits: normalized as unknown as Record<string, unknown> })
        .eq("id", track.uuid);

      if (error) {
        console.error("Error updating splits:", error);
      }
    },
    [tracks]
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
        await supabase.from("stems").delete().eq("track_id", uuid);
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
      const { error } = await supabase.from("tracks").delete().eq("id", uuid);
      if (error) {
        console.error("Error deleting track:", error);
        return false;
      }

      setTracks((prev) => prev.filter((t) => t.uuid !== uuid));
      return true;
    },
    [activeWorkspace]
  );

  return (
    <TrackContext.Provider
      value={{
        tracks,
        loading,
        getTrack,
        getTrackByUuid,
        addTrack,
        updateTrack,
        updateTrackStatus,
        updateTrackLyrics,
        updateTrackStems,
        updateTrackSplits,
        deleteTrack,
        refreshTracks: fetchTracks,
      }}
    >
      {children}
    </TrackContext.Provider>
  );
}

export function useTrack() {
  const ctx = useContext(TrackContext);
  if (!ctx) throw new Error("useTrack must be used within TrackProvider");
  return ctx;
}

