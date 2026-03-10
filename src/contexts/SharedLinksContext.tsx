import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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
  createSharedLink: (link: SharedLink) => void;
  getSharedLink: (id: string) => SharedLink | undefined;
  updateLinkStatus: (id: string, status: SharedLink["status"]) => void;
  addDownloadEvent: (linkId: string, event: DownloadEvent) => void;
  notifications: DownloadEvent[];
  clearNotification: (id: string) => void;
}

const SharedLinksContext = createContext<SharedLinksContextValue | null>(null);

export function SharedLinksProvider({ children }: { children: ReactNode }) {
  const [sharedLinks, setSharedLinks] = useState<SharedLink[]>([]);
  const [notifications, setNotifications] = useState<DownloadEvent[]>([]);

  const createSharedLink = useCallback((link: SharedLink) => {
    setSharedLinks((prev) => [link, ...prev]);
  }, []);

  const getSharedLink = useCallback((id: string) => {
    const link = sharedLinks.find((l) => l.id === id);
    if (link && link.expirationDate && new Date(link.expirationDate) < new Date() && link.status === "active") {
      return { ...link, status: "expired" as const };
    }
    return link;
  }, [sharedLinks]);

  const updateLinkStatus = useCallback((id: string, status: SharedLink["status"]) => {
    setSharedLinks((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
  }, []);

  const addDownloadEvent = useCallback((linkId: string, event: DownloadEvent) => {
    setSharedLinks((prev) =>
      prev.map((l) => l.id === linkId ? { ...l, downloads: [...l.downloads, event] } : l)
    );
    setNotifications((prev) => [event, ...prev]);
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <SharedLinksContext.Provider value={{ sharedLinks, createSharedLink, getSharedLink, updateLinkStatus, addDownloadEvent, notifications, clearNotification }}>
      {children}
    </SharedLinksContext.Provider>
  );
}

export function useSharedLinks() {
  const ctx = useContext(SharedLinksContext);
  if (!ctx) throw new Error("useSharedLinks must be used within SharedLinksProvider");
  return ctx;
}
