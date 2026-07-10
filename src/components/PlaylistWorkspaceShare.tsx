import { useState, useRef, useEffect } from "react";
import { ArrowRightLeft, ChevronDown, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePlaylists } from "@/contexts/PlaylistContext";

const ACCESS_LEVELS = ["viewer", "pitcher", "editor"] as const;

/**
 * Admin-only control (source workspace) to share a whole playlist with another
 * workspace, and to manage/revoke this playlist's outgoing shares. Rendering is
 * gated by the caller (canManageTeam); the RPCs also enforce admin server-side.
 */
export function PlaylistWorkspaceShare({ playlistId, playlistName }: { playlistId: string; playlistName: string }) {
  const { activeWorkspace, workspaces } = useWorkspace();
  const { sharedPlaylists, sharePlaylistWithWorkspace, revokePlaylistShare } = usePlaylists();
  const [open, setOpen] = useState(false);
  const [accessLevel, setAccessLevel] = useState<string>("pitcher");
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Outgoing shares FOR THIS playlist, and the set of workspaces already shared with.
  const outgoing = sharedPlaylists.filter((s) => s.direction === "outgoing" && s.playlist_id === playlistId && s.status === "active");
  const alreadyShared = new Set(outgoing.map((s) => s.target_workspace_id));
  const available = workspaces.filter((w) => w.id !== activeWorkspace?.id && !alreadyShared.has(w.id));

  const handleShare = async (targetId: string, targetName: string) => {
    setBusy(targetId);
    const ok = await sharePlaylistWithWorkspace(playlistId, targetId, accessLevel);
    setBusy(null);
    if (ok) { toast.success("Playlist shared with " + targetName); setOpen(false); }
  };

  const handleRevoke = async (shareId: string, targetName: string) => {
    setBusy(shareId);
    const ok = await revokePlaylistShare(shareId);
    setBusy(null);
    if (ok) toast.success("Stopped sharing with " + targetName);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px]"
      >
        <ArrowRightLeft className="w-4 h-4" /> Share to workspace
        {outgoing.length > 0 && <span className="text-2xs px-1.5 py-0.5 rounded-full bg-brand-orange/15 text-brand-orange">{outgoing.length}</span>}
        <ChevronDown className={"w-3.5 h-3.5 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 rounded-xl border border-border/30 bg-card/95 backdrop-blur-md shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-semibold text-foreground">Share “{playlistName}”</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Share the whole playlist with another workspace</p>
            </div>
            <select
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value)}
              className="text-[11px] rounded-md bg-secondary border border-border/40 px-1.5 py-1 text-foreground outline-none"
            >
              {ACCESS_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
            </select>
          </div>

          {/* Target workspace picker */}
          {available.length === 0 ? (
            <div className="px-4 py-5 text-center"><p className="text-[12px] text-muted-foreground/50">No other workspaces available</p></div>
          ) : (
            <div className="max-h-52 overflow-y-auto py-1">
              {available.map((ws) => (
                <div key={ws.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-orange/20 to-brand-purple/20 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-foreground">{(ws.name || "W").charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-[13px] font-medium text-foreground truncate">{ws.name}</span>
                  </div>
                  <button
                    onClick={() => handleShare(ws.id, ws.name)}
                    disabled={busy === ws.id}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                    style={{ background: "var(--gradient-brand-horizontal)" }}
                  >
                    {busy === ws.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Share
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Current outgoing shares for this playlist */}
          {outgoing.length > 0 && (
            <div className="border-t border-border/20 py-1">
              <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/50">Shared with</p>
              {outgoing.map((s) => (
                <div key={s.share_id} className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-foreground truncate">{s.target_workspace_name} <span className="text-muted-foreground/40">· {s.access_level}</span></span>
                  <button
                    onClick={() => handleRevoke(s.share_id, s.target_workspace_name)}
                    disabled={busy === s.share_id}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] text-destructive/60 hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    {busy === s.share_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
