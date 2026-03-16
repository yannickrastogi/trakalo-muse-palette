import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  downloadQuality?: "hi-res" | "low-res";
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
  var slug = "";
  for (var i = 0; i < 12; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
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
      setSharedLinks((data || []).map(function(row) {
        return mapRowToSharedLink(row as unknown as Record<string, unknown>);
      }));
    }
  }, [activeWorkspace, user]);

  useEffect(function() {
    fetchLinks();
  }, [fetchLinks]);

  var createSharedLink = useCallback(async function(link: SharedLink): Promise<SharedLink | null> {

    var slug = generateSlug();

    // Resolve track UUID from numeric trackId
    var trackUuid: string | null = null;
    if (link.trackId && link.shareType !== "playlist") {
      var matchedTrack = tracks.find(function(t) { return t.id === link.trackId; });
      if (matchedTrack) trackUuid = matchedTrack.uuid;
    }

    var hashedPassword: string | null = null;
    if (link.linkType === "secured" && link.password) {
      var hashRes = await fetch("https://xhmeitivkclbeziqavxw.supabase.co/functions/v1/hash-link-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik",
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik"
        },
        body: JSON.stringify({ password: link.password })
      });
      if (hashRes.ok) {
        var hashJson = await hashRes.json();
        hashedPassword = hashJson.hash || null;
      }
    }

    var { data, error } = await supabase
      .from("shared_links")
      .insert({
        workspace_id: activeWorkspace.id,
        created_by: user.id,
        share_type: link.shareType,
        track_id: trackUuid || null,
        playlist_id: link.playlistId || null,
        link_name: link.linkName,
        link_slug: slug,
        link_type: link.linkType,
        password_hash: hashedPassword,
        message: link.message || null,
        allow_download: link.allowDownload,
        download_quality: link.downloadQuality || null,
        expires_at: link.expirationDate || null,
        status: "active",
        pack_items: link.packItems ? link.packItems as unknown as Record<string, unknown> : null,
      })
      .select()
      .single();

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

    var { error } = await supabase
      .from("shared_links")
      .update({ status: status })
      .eq("id", id);

    if (error) {
      console.error("Error updating link status:", error);
    }
  }, []);

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
