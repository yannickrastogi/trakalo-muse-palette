import { useState, useRef, useEffect, useCallback } from "react";
import { PageShell } from "@/components/PageShell";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTrack } from "@/contexts/TrackContext";
import { usePlaylists } from "@/contexts/PlaylistContext";
import { usePitches } from "@/contexts/PitchContext";
import { useAuth } from "@/contexts/AuthContext";
import { CreatePitchModal, type PitchEntry } from "@/components/CreatePitchModal";
import { ShareModal } from "@/components/ShareModal";
import type { NewPlaylistData } from "@/components/CreatePlaylistModal";
import { motion, AnimatePresence } from "framer-motion";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { DEFAULT_COVER } from "@/lib/constants";
import { useNavigate } from "react-router-dom";
import { Sparkles, Send, Loader2, Music, ListMusic, Pencil, Link2, Eye } from "lucide-react";

type Message = {
  id: string;
  role: "bot" | "user";
  content: string;
  type: "text" | "brief-input" | "track-count" | "loading" | "results" | "created" | "refine-input";
  data?: any;
};

var container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
var item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function makeId() {
  return crypto.randomUUID();
}

export default function SmartAR() {
  var { activeWorkspace } = useWorkspace();
  var { tracks } = useTrack();
  var { addPlaylist } = usePlaylists();
  var { addPitch } = usePitches();
  var { user } = useAuth();
  var navigate = useNavigate();

  var chatEndRef = useRef<HTMLDivElement>(null);

  var [messages, setMessages] = useState<Message[]>([
    {
      id: makeId(),
      role: "bot",
      content: "Hi! I'm your Smart A&R assistant. Paste an A&R brief, describe what you're looking for, or drop an email \u2014 I'll find the best tracks in your catalog.",
      type: "text",
    },
  ]);
  var [step, setStep] = useState<"brief" | "count" | "loading" | "results" | "created">("brief");
  var [brief, setBrief] = useState("");
  var [trackCount, setTrackCount] = useState<number | "all">(5);
  var [results, setResults] = useState<any>(null);
  var [playlistName, setPlaylistName] = useState("");
  var [createdPlaylistId, setCreatedPlaylistId] = useState<string | null>(null);

  var [pitchOpen, setPitchOpen] = useState(false);
  var [shareOpen, setShareOpen] = useState(false);

  useEffect(function () {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  var handleSubmitBrief = useCallback(function () {
    if (!brief.trim()) return;

    if (tracks.length === 0) {
      setMessages(function (prev) {
        return [
          ...prev,
          { id: makeId(), role: "user", content: brief, type: "text" },
          { id: makeId(), role: "bot", content: "Your catalog is empty! Upload some tracks first.", type: "text" },
        ];
      });
      setBrief("");
      return;
    }

    setMessages(function (prev) {
      return [
        ...prev,
        { id: makeId(), role: "user", content: brief, type: "text" },
        { id: makeId(), role: "bot", content: "Got it! How many tracks would you like in this playlist?", type: "track-count" },
      ];
    });
    setStep("count");
  }, [brief, tracks.length]);

  var handleSelectCount = useCallback(function (count: number | "all") {
    setTrackCount(count);
    var label = count === "all" ? "All matching tracks" : count + " tracks";
    var loadingId = makeId();

    setMessages(function (prev) {
      return [
        ...prev,
        { id: makeId(), role: "user", content: label, type: "text" },
        { id: loadingId, role: "bot", content: "Searching your catalog...", type: "loading" },
      ];
    });
    setStep("loading");

    fetch(SUPABASE_URL + "/functions/v1/smart-ar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
        "apikey": SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        brief: brief,
        track_count: count,
        workspace_id: activeWorkspace?.id,
      }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Edge function error: " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data.tracks || data.tracks.length === 0) {
          setMessages(function (prev) {
            return prev
              .filter(function (m) { return m.id !== loadingId; })
              .concat({
                id: makeId(),
                role: "bot",
                content: "I couldn't find any tracks matching this brief. Try a broader description or upload more tracks.",
                type: "text",
              });
          });
          setStep("brief");
          return;
        }

        var matchedTracks = data.tracks.map(function (rt: any) {
          var localTrack = tracks.find(function (t) { return t.uuid === rt.id; });
          return {
            id: rt.id,
            score: rt.score,
            reason: rt.reason,
            trackData: localTrack || null,
          };
        }).filter(function (rt: any) { return rt.trackData !== null; });

        if (matchedTracks.length === 0) {
          setMessages(function (prev) {
            return prev
              .filter(function (m) { return m.id !== loadingId; })
              .concat({
                id: makeId(),
                role: "bot",
                content: "I couldn't find any tracks matching this brief. Try a broader description or upload more tracks.",
                type: "text",
              });
          });
          setStep("brief");
          return;
        }

        var resultData = {
          playlist_name: data.playlist_name || "Smart A&R — " + brief.substring(0, 40),
          criteria: data.criteria || [],
          tracks: matchedTracks,
        };

        setResults(resultData);
        setPlaylistName(resultData.playlist_name);

        setMessages(function (prev) {
          return prev
            .filter(function (m) { return m.id !== loadingId; })
            .concat({
              id: makeId(),
              role: "bot",
              content: "I found " + matchedTracks.length + " tracks matching your brief:",
              type: "results",
              data: resultData,
            });
        });
        setStep("results");
      })
      .catch(function (err) {
        console.error("Smart A&R error:", err);
        setMessages(function (prev) {
          return prev
            .filter(function (m) { return m.id !== loadingId; })
            .concat({
              id: makeId(),
              role: "bot",
              content: "I couldn't find any tracks matching this brief. Try a broader description or upload more tracks.",
              type: "text",
            });
        });
        setStep("brief");
      });
  }, [brief, tracks, activeWorkspace]);

  var handleCreatePlaylist = useCallback(async function () {
    if (!results || !results.tracks || results.tracks.length === 0) return;

    var matchedTracks = results.tracks;

    var playlistData: NewPlaylistData = {
      id: crypto.randomUUID(),
      name: playlistName,
      description: "Created by Smart A&R from brief: " + brief.substring(0, 100),
      tracks: matchedTracks.length,
      duration: "0:00",
      updated: new Date().toISOString(),
      mood: "",
      coverIdxs: [],
      color: "",
      trackIds: matchedTracks.map(function (t: any) { return t.trackData.id; }),
      coverImage: matchedTracks[0]?.trackData.coverImage || undefined,
    };

    var createdId = await addPlaylist(playlistData);
    setCreatedPlaylistId(createdId || null);

    setMessages(function (prev) {
      return [
        ...prev,
        {
          id: makeId(),
          role: "bot",
          content: "Playlist \"" + playlistName + "\" created with " + matchedTracks.length + " tracks! What would you like to do next?",
          type: "created",
        },
      ];
    });
    setStep("created");
  }, [results, playlistName, brief, addPlaylist]);

  var handleRefine = useCallback(function () {
    setStep("brief");
    setBrief("");
    setResults(null);
    setMessages(function (prev) {
      return [
        ...prev,
        {
          id: makeId(),
          role: "bot",
          content: "No problem! Describe what you're looking for and I'll search again.",
          type: "text",
        },
      ];
    });
  }, []);

  var handleStartOver = useCallback(function () {
    setStep("brief");
    setBrief("");
    setResults(null);
    setCreatedPlaylistId(null);
    setPlaylistName("");
    setMessages(function (prev) {
      return [
        ...prev,
        {
          id: makeId(),
          role: "bot",
          content: "Ready for a new search! Describe the kind of tracks you're looking for.",
          type: "text",
        },
      ];
    });
  }, []);

  function renderMessage(msg: Message) {
    if (msg.type === "loading") {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{msg.content}</span>
        </div>
      );
    }

    if (msg.type === "track-count") {
      return (
        <div>
          <p className="mb-3">{msg.content}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={function () { handleSelectCount(3); }}
              className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm font-medium"
            >
              3 tracks
            </button>
            <button
              onClick={function () { handleSelectCount(5); }}
              className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm font-medium"
            >
              5 tracks
            </button>
            <button
              onClick={function () { handleSelectCount("all"); }}
              className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm font-medium"
            >
              All matching
            </button>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-2">3 to 5 tracks is usually ideal — you don't want to overwhelm the recipient.</p>
        </div>
      );
    }

    if (msg.type === "results" && msg.data) {
      var d = msg.data;
      return (
        <div>
          <p className="mb-3">{msg.content}</p>

          {d.criteria && d.criteria.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {d.criteria.map(function (c: string, i: number) {
                return (
                  <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                    {c}
                  </span>
                );
              })}
            </div>
          )}

          <div className="mb-4">
            <label className="text-xs text-muted-foreground mb-1 block">Playlist name</label>
            <div className="flex items-center gap-2">
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={playlistName}
                onChange={function (e) { setPlaylistName(e.target.value); }}
                className="flex-1 bg-transparent border-b border-border focus:border-primary outline-none text-sm py-1 transition-colors"
              />
            </div>
          </div>

          <motion.div variants={container} initial="hidden" animate="show" className="space-y-2 mb-4">
            {d.tracks.map(function (t: any) {
              var td = t.trackData;
              var scorePercent = Math.round((t.score || 0) * 100);
              return (
                <motion.div
                  key={t.id}
                  variants={item}
                  className="flex items-center gap-3 p-2 rounded-lg bg-card/50 border border-border/50"
                >
                  <img
                    src={td.coverImage || DEFAULT_COVER}
                    alt={td.title}
                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{td.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{td.artist}</p>
                  </div>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-semibold flex-shrink-0">
                    {scorePercent}%
                  </span>
                  {t.reason && (
                    <span className="text-xs text-muted-foreground hidden sm:block max-w-[160px] truncate">
                      {t.reason}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </motion.div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCreatePlaylist}
              className="btn-brand px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <ListMusic className="w-4 h-4" />
              Create Playlist
            </button>
            <button
              onClick={handleRefine}
              className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm font-medium"
            >
              Refine
            </button>
          </div>
        </div>
      );
    }

    if (msg.type === "created") {
      return (
        <div>
          <p className="mb-3">{msg.content}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={function () { setPitchOpen(true); }}
              className="btn-brand px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Pitch this playlist
            </button>
            <button
              onClick={function () { setShareOpen(true); }}
              className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Link2 className="w-4 h-4" />
              Create secure link
            </button>
            <button
              onClick={function () {
                if (createdPlaylistId) {
                  navigate("/playlist/" + createdPlaylistId);
                }
              }}
              className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              View playlist
            </button>
          </div>
          <button
            onClick={handleStartOver}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Start a new search
          </button>
        </div>
      );
    }

    return <p className="whitespace-pre-wrap">{msg.content}</p>;
  }

  return (
    <PageShell>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col h-full max-w-3xl mx-auto px-4 py-6"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Smart A&R
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Describe what you're looking for and let AI search your catalog.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
          <AnimatePresence initial={false}>
            {messages.map(function (msg) {
              var isBot = msg.role === "bot";
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className={"flex gap-3 " + (isBot ? "justify-start" : "justify-end")}
                >
                  {isBot && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm " +
                      (isBot
                        ? "bg-card border border-border text-foreground"
                        : "bg-primary text-primary-foreground")
                    }
                  >
                    {renderMessage(msg)}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>

        {(step === "brief" || step === "results" || step === "created") && (
          <div className="border-t border-border pt-4 mt-auto">
            <div className="flex items-end gap-2">
              <textarea
                value={brief}
                onChange={function (e) { setBrief(e.target.value); }}
                onKeyDown={function (e) {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitBrief();
                  }
                }}
                placeholder="Describe the tracks you're looking for..."
                rows={2}
                className="flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
              <button
                onClick={handleSubmitBrief}
                disabled={!brief.trim()}
                className="btn-brand p-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <CreatePitchModal
        open={pitchOpen}
        onOpenChange={setPitchOpen}
        onCreate={function (p: PitchEntry) { setPitchOpen(false); }}
      />

      <ShareModal
        open={shareOpen}
        onClose={function () { setShareOpen(false); }}
        shareType="playlist"
        playlistId={createdPlaylistId || undefined}
        playlistName={playlistName}
      />
    </PageShell>
  );
}
