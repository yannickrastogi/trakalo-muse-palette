import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTrack } from "@/contexts/TrackContext";
import type { WorkspaceScoped } from "@/types/workspace";

export interface DownloadEvent {
  id: string;
  linkId: string;
  downloaderName: string;
  downloaderEmail: string;
  organization: string;
  role: string;
  trackName: string;
  stemsDownloaded: string[];
  downloadedAt: string;
}

export type ShareType = "stems" | "track" | "playlist" | "pack";

export interface SharedLinkTrack {
  id: number;
  title: string;
  artist: string;
  duration: string;
  genre: string;
  coverImage?: string;
}

export interface SharedLink extends WorkspaceScoped {
  id: string;
  shareType: ShareType;
  trackId: number;
  trackUuid?: string;
  trackTitle: string;
  trackArtist: string;
  trackCover?: string;
  linkName: string;
  linkSlug?: string;
  linkType: "public" | "secured";
  password?: string;
  message?: string;
  expirationDate?: string;
  createdAt: string;
  status: "active" | "expired" | "disabled";
  downloads: DownloadEvent[];
  stems: { id: string; fileName: string; type: string; fileSize: string }[];
  // For playlist sharing
  playlistId?: string;
  playlistName?: string;
  playlistCover?: string;
  playlistTracks?: SharedLinkTrack[];
  // For pack sharing
  packItems?: string[];
  // Download permissions
  allowDownload: boolean;
  allowSave?: boolean;
  downloadQuality?: "hi-res" | "low-res";
  // Event stats
  views?: number;
  plays?: number;
  downloadCount?: number;
  saveCount?: number;
}

interface SharedLinksContextValue {
  sharedLinks: SharedLink[];
  createSharedLink: (link: SharedLink) => Promise<SharedLink | null>;
  getSharedLink: (id: string) => SharedLink | undefined;
  getSharedLinkBySlug: (slug: string) => SharedLink | undefined;
  updateLinkStatus: (id: string, status: SharedLink["status"]) => void;
  addDownloadEvent: (linkId: string, event: DownloadEvent) => void;
  notifications: DownloadEvent[];
  clearNotification: (id: string) => void;
}

const SharedLinksContext = createContext<SharedLinksContextValue | null>(null);

function generateSlug(): string {
  var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  var bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  var slug = "";
  for (var i = 0; i < 12; i++) {
    slug += chars.charAt(bytes[i] % chars.length);
  }
  return slug;
}

function mapRowToSharedLink(row: Record<string, unknown>): SharedLink {
  var packItems = row.pack_items as Record<string, unknown> | null;
  return {
    id: row.id as string,
    workspace_id: row.workspace_id as string,
    shareType: (row.share_type as ShareType) || "track",
    trackId: 0,
    trackTitle: (row.link_name as string) || "",
    trackArtist: "",
    linkName: (row.link_name as string) || "",
    linkSlug: (row.link_slug as string) || "",
    linkType: (row.link_type as "public" | "secured") || "public",
    password: undefined,
    message: (row.message as string) || undefined,
    expirationDate: (row.expires_at as string) || undefined,
    createdAt: (row.created_at as string) || "",
    status: (row.status as "active" | "expired" | "disabled") || "active",
    downloads: [],
    stems: [],
    playlistId: (row.playlist_id as string) || undefined,
    packItems: packItems && Array.isArray(packItems) ? packItems as unknown as string[] : undefined,
    allowDownload: (row.allow_download as boolean) || false,
    allowSave: (row.allow_save as boolean) !== false,
    downloadQuality: (row.download_quality as "hi-res" | "low-res") || undefined,
  };
}

export function SharedLinksProvider({ children }: { children: ReactNode }) {
  var { activeWorkspace } = useWorkspace();
  var { user } = useAuth();
  var { tracks } = useTrack();
  var [sharedLinks, setSharedLinks] = useState<SharedLink[]>([]);
  var [notifications, setNotifications] = useState<DownloadEvent[]>([]);

  var fetchLinks = useCallback(async () => {
    if (!activeWorkspace || !user) {
      setSharedLinks([]);
      return;
    }

    var { data, error } = await supabase
      .from("shared_links")
      .select("*")
      .eq("workspace_id", activeWorkspace.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching shared links:", error);
      setSharedLinks([]);
    } else {
      var linkIds = (data || []).map(function(r) { return r.id; });
      var statsMap: Record<string, { views: number; plays: number; downloads: number; saves: number }> = {};

      if (linkIds.length > 0) {
        var { data: events } = await supabase
          .from("link_events")
          .select("link_id, event_type")
          .in("link_id", linkIds);

        (events || []).forEach(function(e: { link_id: string; event_type: string }) {
          if (!statsMap[e.link_id]) statsMap[e.link_id] = { views: 0, plays: 0, downloads: 0, saves: 0 };
          if (e.event_type === "view") statsMap[e.link_id].views++;
          if (e.event_type === "play") statsMap[e.link_id].plays++;
          if (e.event_type === "download") statsMap[e.link_id].downloads++;
          if (e.event_type === "save") statsMap[e.link_id].saves++;
        });
      }

      setSharedLinks((data || []).map(function(row) {
        var link = mapRowToSharedLink(row as unknown as Record<string, unknown>);
        var stats = statsMap[row.id] || { views: 0, plays: 0, downloads: 0, saves: 0 };
        link.views = stats.views;
        link.plays = stats.plays;
        link.downloadCount = stats.downloads;
        link.saveCount = stats.saves;
        return link;
      }));
    }
  }, [activeWorkspace, user]);

  useEffect(function() {
    fetchLinks();
  }, [fetchLinks]);

  var createSharedLink = useCallback(async function(link: SharedLink): Promise<SharedLink | null> {

    var slug = generateSlug();

    // Resolve track UUID — prefer direct UUID if provided, fall back to numeric ID lookup
    var trackUuid: string | null = link.trackUuid || null;
    if (!trackUuid && link.trackId && link.shareType !== "playlist") {
      var matchedTrack = tracks.find(function(t) { return t.id === link.trackId; });
      if (matchedTrack) {
        trackUuid = matchedTrack.uuid;
      } else {
        console.error("SharedLinksContext: could not resolve trackId", link.trackId, "to UUID. Available tracks:", tracks.length);
      }
    }

    var hashedPassword: string | null = null;
    if (link.linkType === "secured" && link.password) {
      var hashRes = await fetch(SUPABASE_URL + "/functions/v1/hash-link-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
          "apikey": SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({ password: link.password })
      });
      if (hashRes.ok) {
        var hashJson = await hashRes.json();
        hashedPassword = hashJson.hash || null;
      }
    }

    var { data, error } = await supabase.rpc("create_shared_link", {
      _user_id: user.id,
      _workspace_id: activeWorkspace.id,
      _share_type: link.shareType,
      _track_id: trackUuid || null,
      _playlist_id: link.playlistId || null,
      _link_name: link.linkName,
      _link_slug: slug,
      _link_type: link.linkType,
      _password_hash: hashedPassword,
      _message: link.message || null,
      _allow_download: link.allowDownload,
      _allow_save: link.allowSave !== false,
      _download_quality: link.downloadQuality || null,
      _expires_at: link.expirationDate || null,
      _pack_items: link.packItems ? JSON.stringify(link.packItems) : null,
    });

    if (error) {
      console.error("Error creating shared link:", error);
      return null;
    }

    var created = mapRowToSharedLink(data as unknown as Record<string, unknown>);
    // Preserve UI fields from the original link
    created.trackId = link.trackId;
    created.trackTitle = link.trackTitle;
    created.trackArtist = link.trackArtist;
    created.trackCover = link.trackCover;
    created.stems = link.stems;
    created.playlistName = link.playlistName;
    created.playlistCover = link.playlistCover;
    created.playlistTracks = link.playlistTracks;

    setSharedLinks(function(prev) { return [created].concat(prev); });
    return created;
  }, [activeWorkspace, user, tracks]);

  var getSharedLink = useCallback(function(id: string) {
    var link = sharedLinks.find(function(l) { return l.id === id; });
    if (link && link.expirationDate && new Date(link.expirationDate) < new Date() && link.status === "active") {
      return Object.assign({}, link, { status: "expired" as const });
    }
    return link;
  }, [sharedLinks]);

  var getSharedLinkBySlug = useCallback(function(slug: string) {
    return sharedLinks.find(function(l) { return l.linkSlug === slug; });
  }, [sharedLinks]);

  var updateLinkStatus = useCallback(async function(id: string, status: SharedLink["status"]) {
    setSharedLinks(function(prev) {
      return prev.map(function(l) { return l.id === id ? Object.assign({}, l, { status: status }) : l; });
    });

    if (!user) return;
    var { error } = await supabase.rpc("update_shared_link_status", {
      _user_id: user.id,
      _link_id: id,
      _disabled: status === "disabled",
    });

    if (error) {
      console.error("Error updating link status:", error);
    }
  }, [user]);

  var addDownloadEvent = useCallback(function(linkId: string, event: DownloadEvent) {
    setSharedLinks(function(prev) {
      return prev.map(function(l) {
        return l.id === linkId ? Object.assign({}, l, { downloads: l.downloads.concat([event]) }) : l;
      });
    });
    setNotifications(function(prev) { return [event].concat(prev); });
  }, []);

  var clearNotification = useCallback(function(id: string) {
    setNotifications(function(prev) { return prev.filter(function(n) { return n.id !== id; }); });
  }, []);

  return (
    <SharedLinksContext.Provider value={{ sharedLinks, createSharedLink, getSharedLink, getSharedLinkBySlug, updateLinkStatus, addDownloadEvent, notifications, clearNotification }}>
      {children}
    </SharedLinksContext.Provider>
  );
}

export function useSharedLinks() {
  var ctx = useContext(SharedLinksContext);
  if (!ctx) throw new Error("useSharedLinks must be used within SharedLinksProvider");
  return ctx;
}
