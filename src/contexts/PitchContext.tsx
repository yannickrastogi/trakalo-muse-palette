import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { type PitchEntry } from "@/components/CreatePitchModal";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTrack } from "@/contexts/TrackContext";

function mapStatusFromDb(status: string): string {
  switch (status) {
    case "draft": return "Draft";
    case "sent": return "Sent";
    case "opened": return "Opened";
    case "declined": return "Declined";
    case "accepted": return "Responded";
    default: return "Draft";
  }
}

function mapStatusToDb(status: string): string {
  switch (status) {
    case "Draft": return "draft";
    case "Sent": return "sent";
    case "Opened": return "opened";
    case "Declined": return "declined";
    case "Responded": return "accepted";
    default: return "draft";
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function mapRowToPitch(row: Record<string, unknown>): PitchEntry {
  const trackIds = (row.track_ids as string[]) || [];
  return {
    id: row.id as string,
    workspace_id: row.workspace_id as string,
    type: trackIds.length === 1 ? "track" : "playlist",
    itemName: (row.subject as string) || "",
    artist: "",
    coverIdx: 0,
    trackUuid: trackIds.length > 0 ? trackIds[0] : undefined,
    recipientName: (row.recipient_name as string) || "",
    recipientCompany: (row.recipient_company as string) || "",
    recipientEmail: (row.recipient_email as string) || "",
    date: formatDate((row.sent_at as string) || (row.created_at as string) || ""),
    status: mapStatusFromDb((row.status as string) || "draft"),
    notes: (row.response_note as string) || (row.message as string) || "",
  };
}

interface PitchContextValue {
  pitches: PitchEntry[];
  addPitch: (pitch: PitchEntry) => void;
  getPitchesForTrack: (trackName: string) => PitchEntry[];
}

const PitchContext = createContext<PitchContextValue | null>(null);

export function PitchProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { tracks } = useTrack();
  const [pitches, setPitches] = useState<PitchEntry[]>([]);

  const fetchPitches = useCallback(async () => {
    if (!activeWorkspace || !user) {
      setPitches([]);
      return;
    }

    const { data, error } = await supabase
      .from("pitches")
      .select("*")
      .eq("workspace_id", activeWorkspace.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pitches:", error);
      setPitches([]);
    } else {
      setPitches((data || []).map((row) => mapRowToPitch(row as unknown as Record<string, unknown>)));
    }
  }, [activeWorkspace, user]);

  useEffect(() => {
    fetchPitches();
  }, [fetchPitches]);

  const addPitch = useCallback(
    async (pitch: PitchEntry) => {
      if (!activeWorkspace || !user) return;

      const now = new Date().toISOString();
      const dbStatus = mapStatusToDb(pitch.status);

      // Multi-track selection → auto-create a playlist, then pitch the playlist.
      var shareType = pitch.type === "playlist" ? "playlist" : "track";
      var trackUuid = pitch.trackUuid || null;
      var playlistUuid = pitch.playlistUuid || null;
      var pitchTrackIds: string[] = pitch.trackUuid ? [pitch.trackUuid] : [];

      if (pitch.newPlaylistTrackUuids && pitch.newPlaylistTrackUuids.length > 0) {
        const { data: newPlaylistId, error: plError } = await supabase.rpc("create_playlist", {
          _user_id: user.id,
          _workspace_id: activeWorkspace.id,
          _name: pitch.newPlaylistName || pitch.itemName,
          _description: "",
          _cover_url: null,
        });

        if (plError || !newPlaylistId) {
          console.error("Error creating pitch playlist:", plError);
          return;
        }

        playlistUuid = newPlaylistId as unknown as string;
        await supabase.rpc("add_playlist_tracks", {
          _user_id: user.id,
          _playlist_id: playlistUuid,
          _track_ids: pitch.newPlaylistTrackUuids,
        });

        shareType = "playlist";
        trackUuid = null;
        pitchTrackIds = pitch.newPlaylistTrackUuids;
      }

      const { data: pitchId, error } = await supabase.rpc("create_pitch", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _recipient_name: pitch.recipientName,
        _recipient_email: pitch.recipientEmail,
        _recipient_company: pitch.recipientCompany || "",
        _subject: pitch.itemName,
        _message: pitch.notes || null,
        _track_ids: pitchTrackIds,
        _status: dbStatus,
        _sent_at: dbStatus === "sent" ? now : null,
      });

      if (error) {
        console.error("Error adding pitch:", error);
        return;
      }

      // Generate a shared link for this pitch
      var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      var slug = "";
      for (var i = 0; i < 12; i++) {
        slug += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      var hashedPassword = null;
      if (pitch.linkType === "secured" && pitch.password) {
        var hashRes = await fetch(SUPABASE_URL + "/functions/v1/hash-link-password", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ password: pitch.password }),
        });
        if (hashRes.ok) { var hj = await hashRes.json(); hashedPassword = hj.hash || null; }
      }

      var { data: linkData, error: linkError } = await supabase.rpc("create_shared_link", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _share_type: shareType,
        _track_id: trackUuid,
        _playlist_id: playlistUuid,
        _link_name: pitch.itemName,
        _link_slug: slug,
        _link_type: pitch.linkType || "public",
        _password_hash: hashedPassword,
        _message: null,
        _allow_download: pitch.allowDownload || false,
        _allow_save: false,
        _download_quality: pitch.downloadQuality || null,
        _expires_at: null,
        _pack_items: null,
        _watermarking_enabled: pitch.watermarkEnabled !== false,
      });

      if (linkError) {
        console.error("Error creating shared link for pitch:", linkError);
      }

      var linkId = (linkData && typeof linkData === "object") ? (linkData as { id?: string }).id || null : null;

      // Upsert the recipient into the workspace contact book (DB carnet).
      var contactId: string | null = null;
      if (pitch.recipientName && pitch.recipientName.trim()) {
        var nameParts = pitch.recipientName.trim().split(/\s+/);
        var firstName = nameParts[0] || pitch.recipientName.trim();
        var lastName = nameParts.slice(1).join(" ") || "";
        const { data: cId, error: contactError } = await supabase.rpc("upsert_contact", {
          _user_id: user.id,
          _workspace_id: activeWorkspace.id,
          _first_name: firstName,
          _last_name: lastName,
          _email: pitch.recipientEmail || null,
          _stage_name: null,
          _role: pitch.recipientRole || null,
          _company: pitch.recipientCompany || null,
          _phone: pitch.recipientPhone || null,
          _city: null,
          _country: null,
          _pro: null,
          _ipi: null,
          _publisher: null,
        });
        if (contactError) {
          console.error("upsert_contact failed:", contactError);
        } else if (cId) {
          contactId = (cId as unknown as string) || null;
        }
      }

      // Link the pitch to its shared link + contact so engagement can be isolated per recipient.
      if (pitchId && (linkId || contactId)) {
        var { error: linkPitchError } = await supabase.rpc("update_pitch_share_link", {
          _user_id: user.id,
          _pitch_id: pitchId,
          _workspace_id: activeWorkspace.id,
          _share_link_id: linkId,
          _contact_id: contactId,
        });
        if (linkPitchError) {
          console.error("Error linking pitch to shared link:", linkPitchError);
        }
      }

      var shareLink = window.location.origin + "/share/" + slug;

      // send-pitch-email now requires an authenticated pitcher — send the real
      // session access_token (fail closed to the anon key, which the EF rejects).
      const { data: pitchSess } = await supabase.auth.getSession();
      const pitchToken = pitchSess.session?.access_token || SUPABASE_PUBLISHABLE_KEY;
      fetch(SUPABASE_URL + "/functions/v1/send-pitch-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_PUBLISHABLE_KEY,
          "Authorization": "Bearer " + pitchToken,
        },
        body: JSON.stringify({
          to_email: pitch.recipientEmail,
          to_name: pitch.recipientName,
          subject: pitch.itemName || "New Pitch from Trakalog",
          message: pitch.notes || "",
          tracks: [{ title: pitch.itemName, artist: pitch.artist }],
          share_link: shareLink,
          workspace_id: activeWorkspace.id,
        }),
      }).catch(function(err) { console.error("Failed to send pitch email:", err); });

      await fetchPitches();
    },
    [activeWorkspace, user, fetchPitches]
  );

  const getPitchesForTrack = useCallback(
    (trackName: string) => pitches.filter((p) => p.type === "track" && p.itemName === trackName),
    [pitches]
  );

  return (
    <PitchContext.Provider value={useMemo(() => ({ pitches, addPitch, getPitchesForTrack }), [pitches, addPitch, getPitchesForTrack])}>
      {children}
    </PitchContext.Provider>
  );
}

export function usePitches() {
  const ctx = useContext(PitchContext);
  if (!ctx) throw new Error("usePitches must be used within PitchProvider");
  return ctx;
}
