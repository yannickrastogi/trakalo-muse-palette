import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { type PitchEntry } from "@/components/CreatePitchModal";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const demoPitches: PitchEntry[] = [
  { id: "p1", type: "track", itemName: "Velvet Hour", artist: "Kira Nomura", coverIdx: 0, recipientName: "Jamie Lin", recipientCompany: "Interscope Records", recipientEmail: "jamie.lin@interscope.com", date: "Mar 5, 2026", status: "Sent", notes: "Follow up next week if no response." },
  { id: "p2", type: "track", itemName: "Soft Landing", artist: "Marco Silva", coverIdx: 3, recipientName: "David Park", recipientCompany: "Atlantic Records", recipientEmail: "d.park@atlantic.com", date: "Mar 3, 2026", status: "Responded", notes: "Positive response — requesting stems." },
  { id: "p3", type: "playlist", itemName: "Summer EP — Final Selects", artist: "Various", coverIdx: 0, recipientName: "Sarah Cho", recipientCompany: "Republic Records", recipientEmail: "sarah.cho@republic.com", date: "Mar 1, 2026", status: "Opened", notes: "" },
  { id: "p4", type: "track", itemName: "Ghost Protocol", artist: "Dex Moraes × JVNE", coverIdx: 1, recipientName: "Marcus Webb", recipientCompany: "Anjunadeep", recipientEmail: "marcus@anjunadeep.com", date: "Feb 28, 2026", status: "Sent", notes: "" },
  { id: "p5", type: "track", itemName: "Paper Moons", artist: "Kira Nomura × AYA", coverIdx: 4, recipientName: "Lena Torres", recipientCompany: "Darkroom Management", recipientEmail: "lena@darkroom.mgmt", date: "Feb 25, 2026", status: "Responded", notes: "Placement confirmed for sync licensing." },
  { id: "p6", type: "track", itemName: "Golden Frequency", artist: "Alina Voss × Marco", coverIdx: 2, recipientName: "Tom Ellis", recipientCompany: "Method Management", recipientEmail: "tom@method.co", date: "Feb 22, 2026", status: "Opened", notes: "" },
  { id: "p7", type: "track", itemName: "Neon Pulse", artist: "JVNE × Alina Voss", coverIdx: 2, recipientName: "Rachel Kim", recipientCompany: "Warner Records", recipientEmail: "r.kim@warnerrecords.com", date: "Feb 18, 2026", status: "Responded", notes: "Interested — scheduling follow-up call." },
  { id: "p8", type: "playlist", itemName: "Late Night Sessions", artist: "Various", coverIdx: 3, recipientName: "André Moreau", recipientCompany: "Maison Records", recipientEmail: "andre@maisonrecords.fr", date: "Feb 15, 2026", status: "Draft", notes: "Need to finalize tracklist before sending." },
  { id: "p9", type: "track", itemName: "Daybreak", artist: "Kira Nomura", coverIdx: 0, recipientName: "Chris Patel", recipientCompany: "Columbia Records", recipientEmail: "c.patel@columbia.com", date: "Feb 12, 2026", status: "Draft", notes: "" },
];

interface PitchContextValue {
  pitches: PitchEntry[];
  addPitch: (pitch: PitchEntry) => void;
  getPitchesForTrack: (trackName: string) => PitchEntry[];
}

const PitchContext = createContext<PitchContextValue | null>(null);

export function PitchProvider({ children }: { children: ReactNode }) {
  const [pitches, setPitches] = useState<PitchEntry[]>(demoPitches);

  const addPitch = useCallback((pitch: PitchEntry) => {
    setPitches((prev) => [pitch, ...prev]);
  }, []);

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
