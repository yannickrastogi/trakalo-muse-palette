import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { TrackData } from "@/contexts/TrackContext";
import type { Workspace } from "@/types/workspace";
import { safeLocalStorage } from "@/lib/safeStorage";

interface ChecklistProps {
  user: { user_metadata?: Record<string, unknown> } | null;
  workspace: Workspace | null;
  tracks: TrackData[];
  playlistCount: number;
  contactCount: number;
  pitchCount: number;
  sharedLinkCount: number;
  memberCount: number;
  onUpload: () => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  route?: string;
  onClick?: () => void;
  bonus?: boolean;
}

function getMotivation(done: number): string {
  if (done <= 3) return "Let\u2019s get started! \ud83d\ude80";
  if (done <= 6) return "Great progress! Keep going \ud83d\udcaa";
  if (done <= 9) return "Almost there! \ud83d\udd25";
  return "You\u2019ve mastered Trakalog! \ud83c\udf89";
}

function isAutoName(name: string): boolean {
  if (!name) return true;
  const lower = name.toLowerCase();
  return lower === "my workspace" || lower.endsWith("'s workspace") || lower.endsWith("\u2019s workspace") || lower.endsWith("s workspace");
}

export function OnboardingChecklist({
  user,
  workspace,
  tracks,
  playlistCount,
  contactCount,
  pitchCount,
  sharedLinkCount,
  memberCount,
  onUpload,
}: ChecklistProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("trakalog_checklist_dismissed") === "true");

  const meta = user?.user_metadata || {};
  const hasProfile = !!(meta.full_name || (meta.first_name && meta.last_name)) && !!meta.avatar_url;
  const hasWorkspaceName = workspace ? !isAutoName(workspace.name) : false;
  const hasBranding = !!(workspace?.hero_image_url || workspace?.logo_url);
  const hasTrack = tracks.length > 0;
  const hasMood = tracks.some((t) => t.mood && t.mood.length > 0);
  const hasLyrics = tracks.some((t) => t.lyrics && t.lyrics.trim() !== "");

  const items: ChecklistItem[] = [
    { id: "profile", label: "Complete your profile", completed: hasProfile, route: "/settings" },
    { id: "workspace-name", label: "Name your workspace", completed: hasWorkspaceName, route: "/workspace-settings" },
    { id: "branding", label: "Set up workspace branding", completed: hasBranding, route: "/workspace-settings" },
    { id: "upload", label: "Upload your first track", completed: hasTrack, onClick: onUpload },
    { id: "mood", label: "Add mood tags to a track", completed: hasMood, route: "/tracks" },
    { id: "lyrics", label: "Add lyrics to a track", completed: hasLyrics, route: "/tracks" },
    { id: "playlist", label: "Create a playlist", completed: playlistCount > 0, route: "/playlists" },
    { id: "shared-link", label: "Create a shared link", completed: sharedLinkCount > 0, route: "/tracks" },
    { id: "pitch", label: "Send your first pitch", completed: pitchCount > 0, route: "/pitch" },
    { id: "contact", label: "Add a contact", completed: contactCount > 0, route: "/contacts" },
    { id: "invite", label: "Invite a team member", completed: memberCount > 1, route: "/workspace-settings", bonus: true },
  ];

  const doneCount = items.filter((i) => i.completed).length;
  const total = items.length;
  const percent = Math.round((doneCount / total) * 100);

  // Don't show if dismissed or all done
  if (dismissed || doneCount === total) return null;

  // Don't show if onboarding not started yet
  const onboardingDone = safeLocalStorage.getItem("trakalog_onboarding_complete") === "true";
  const isSharedLinkUser = safeLocalStorage.getItem("trakalog_first_save_done") === "true";
  if (!onboardingDone && !isSharedLinkUser) return null;

  function handleDismiss() {
    setDismissed(true);
    safeLocalStorage.setItem("trakalog_checklist_dismissed", "true");
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.3 }}
          className="border border-white/10 bg-card rounded-xl p-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-foreground">Getting Started</h3>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: percent + "%" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {doneCount} of {total} completed — {getMotivation(doneCount)}
          </p>

          {/* Items */}
          <div className="mt-4 space-y-1">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.completed) return;
                  if (item.onClick) item.onClick();
                  else if (item.route) navigate(item.route);
                }}
                disabled={item.completed}
                className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors " + (item.completed ? "opacity-50" : "hover:bg-white/5")}
              >
                {/* Checkbox circle */}
                <div className="relative w-5 h-5 shrink-0">
                  <AnimatePresence mode="wait">
                    {item.completed ? (
                      <motion.div
                        key="done"
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ duration: 0.3 }}
                        className="w-5 h-5 rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-white" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty"
                        className="w-5 h-5 rounded-full border border-white/20"
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* Label */}
                <span className={"text-sm flex-1 " + (item.completed ? "text-muted-foreground line-through" : "text-foreground")}>
                  {item.label}
                  {item.bonus && (
                    <span className="ml-2 text-xs text-orange-400 font-medium">bonus</span>
                  )}
                </span>

                {/* Chevron for incomplete */}
                {!item.completed && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                )}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
