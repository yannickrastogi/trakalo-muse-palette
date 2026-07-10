import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Pause, ListMusic, Users, Loader2 } from "lucide-react";
import { usePlaylists } from "@/contexts/PlaylistContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import type { TrackData } from "@/contexts/TrackContext";
import { PageShell } from "@/components/PageShell";
import { DEFAULT_COVER } from "@/lib/constants";
import { toast } from "sonner";

// Read-only viewer for a playlist shared INTO the active workspace by another
// workspace. Tracks are playable via the global player but nothing is editable —
// this is a view, not an owned playlist.
export default function SharedPlaylistView() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const { sharedPlaylists, getSharedPlaylistTracks } = usePlaylists();
  const { playTrack, togglePlay, isTrackPlaying, currentTrack, isPlaying, setQueue } = useAudioPlayer();
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const share = sharedPlaylists.find((s) => s.playlist_id === playlistId && s.direction === "incoming");

  useEffect(() => {
    let cancelled = false;
    if (!playlistId) return;
    setLoading(true);
    setLoadError(false);
    getSharedPlaylistTracks(playlistId)
      .then((rows) => { if (!cancelled) setTracks(rows); })
      .catch((err) => {
        console.error("Error loading shared playlist:", err);
        if (!cancelled) { setLoadError(true); toast.error("Could not load this shared playlist. Your access may have been revoked."); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [playlistId, getSharedPlaylistTracks]);

  const playFrom = (track: TrackData) => {
    if (currentTrack?.id === track.id) { togglePlay(); return; }
    setQueue(tracks);
    playTrack(track);
  };

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <button onClick={() => navigate("/playlists")} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Playlists
        </button>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-purple/20 to-brand-pink/10 flex items-center justify-center shrink-0">
            <ListMusic className="w-7 h-7 text-brand-purple" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">{share?.playlist_name || "Shared playlist"}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple font-medium">
                <Users className="w-3 h-3" /> Shared from {share?.source_workspace_name || "another workspace"}
              </span>
              <span>· {tracks.length} tracks · view only</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : loadError ? (
          <div className="text-center py-16 text-sm text-muted-foreground">This shared playlist couldn't be loaded — your access may have been revoked.</div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">This shared playlist has no tracks.</div>
        ) : (
          <div className="space-y-1">
            {tracks.map((track, idx) => {
              const playing = isTrackPlaying(track.id);
              return (
                <div key={track.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/40 transition-colors group">
                  <span className="w-5 text-center text-xs text-muted-foreground/50 tabular-nums">{idx + 1}</span>
                  <button
                    onClick={() => playFrom(track)}
                    className="w-9 h-9 rounded-lg overflow-hidden shrink-0 relative"
                    style={{ backgroundImage: `url(${track.coverImage || DEFAULT_COVER})`, backgroundSize: "cover", backgroundPosition: "center" }}
                    aria-label={playing && isPlaying ? "Pause" : "Play"}
                  >
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      {playing && isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
                    </span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={"text-sm font-medium truncate " + (playing ? "text-brand-orange" : "text-foreground")}>{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                  </div>
                  {track.duration && <span className="text-xs text-muted-foreground/50 tabular-nums shrink-0">{track.duration}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}
