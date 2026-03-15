import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type PitchEntry } from "@/components/CreatePitchModal";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";

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

      const { error } = await supabase
        .from("pitches")
        .insert({
          workspace_id: activeWorkspace.id,
          sent_by: user.id,
          recipient_name: pitch.recipientName,
          recipient_email: pitch.recipientEmail,
          recipient_company: pitch.recipientCompany,
          subject: pitch.itemName,
          message: pitch.notes || null,
          track_ids: [],
          status: dbStatus,
          sent_at: dbStatus === "sent" ? now : null,
        });

      if (error) {
        console.error("Error adding pitch:", error);
        return;
      }

      await fetchPitches();
    },
    [activeWorkspace, user, fetchPitches]
  );

  const getPitchesForTrack = useCallback(
    (trackName: string) => pitches.filter((p) => p.type === "track" && p.itemName === trackName),
    [pitches]
  );

  return (
    <PitchContext.Provider value={{ pitches, addPitch, getPitchesForTrack }}>
      {children}
    </PitchContext.Provider>
  );
}

export function usePitches() {
  const ctx = useContext(PitchContext);
  if (!ctx) throw new Error("usePitches must be used within PitchProvider");
  return ctx;
}
