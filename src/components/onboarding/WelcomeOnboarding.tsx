import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

interface WelcomeOnboardingProps {
  onComplete: () => void;
}

export function WelcomeOnboarding({ onComplete }: WelcomeOnboardingProps) {
  const { user } = useAuth();
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();

  const [step, setStep] = useState(0);

  // Step 1 state
  const existingFirst = user?.user_metadata?.first_name || "";
  const existingLast = user?.user_metadata?.last_name || "";
  const existingFull = user?.user_metadata?.full_name || ((existingFirst + " " + existingLast).trim()) || "";
  const [fullName, setFullName] = useState(existingFull);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.user_metadata?.avatar_url || null);
  const avatarFileRef = useRef<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Step 2 state
  const [workspaceName, setWorkspaceName] = useState(activeWorkspace?.name || "");
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  function finish() {
    localStorage.setItem("trakalog_onboarding_complete", "true");
    onComplete();
  }

  function handleAvatarPick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png, image/jpeg, image/webp";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File too large (max 5MB)");
        return;
      }
      avatarFileRef.current = file;
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function handleProfileNext() {
    if (!user) return;
    setSavingProfile(true);

    const trimmed = fullName.trim();
    const spaceIdx = trimmed.indexOf(" ");
    const firstName = spaceIdx > 0 ? trimmed.slice(0, spaceIdx) : trimmed;
    const lastName = spaceIdx > 0 ? trimmed.slice(spaceIdx + 1) : "";

    let avatarUrl = user.user_metadata?.avatar_url || null;

    // Upload avatar if a new file was picked
    if (avatarFileRef.current) {
      const file = avatarFileRef.current;
      const ext = file.name.split(".").pop();
      const path = user.id + "/avatar." + ext;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadErr) {
        toast.error(uploadErr.message);
        setSavingProfile(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      avatarUrl = urlData.publicUrl + "?t=" + Date.now();
    }

    const { error } = await supabase.rpc("update_user_profile", {
      _user_id: user.id,
      _first_name: firstName || null,
      _last_name: lastName || null,
      _phone: user.user_metadata?.phone || null,
      _bio: user.user_metadata?.bio || null,
      _avatar_url: avatarUrl,
    });

    setSavingProfile(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setStep(2);
  }

  function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/[\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  }

  async function handleWorkspaceFinish() {
    if (!activeWorkspace) { finish(); return; }
    const trimmed = workspaceName.trim();
    if (!trimmed) { finish(); return; }

    setSavingWorkspace(true);
    const { error } = await supabase.rpc("update_workspace_name", {
      _user_id: user!.id,
      _workspace_id: activeWorkspace.id,
      _name: trimmed,
    });
    setSavingWorkspace(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Auto-update slug
    const newSlug = slugify(trimmed);
    if (newSlug) {
      await supabase.rpc("update_workspace_slug", {
        _user_id: user!.id,
        _workspace_id: activeWorkspace.id,
        _slug: newSlug,
      });
    }

    await refreshWorkspaces();
    finish();
  }

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <AnimatePresence mode="wait" custom={step}>
        {step === 0 && (
          <motion.div
            key="welcome"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-full max-w-lg bg-card border border-border rounded-2xl p-8 sm:p-10 text-center"
            style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}
          >
            {/* Logo */}
            <h1 className="text-3xl font-bold gradient-text tracking-tight">TRAKALOG</h1>
            <p className="text-xs tracking-widest text-muted-foreground uppercase mt-1">Catalog Manager</p>

            {/* Separator */}
            <div className="h-px bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 my-6" />

            <h2 className="text-2xl font-semibold text-foreground">Welcome to Trakalog</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
              Your intelligent catalog manager — manage, protect, pitch and connect your music.
            </p>

            <button
              onClick={() => setStep(1)}
              className="mt-8 w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 hover:from-orange-600 hover:via-pink-600 hover:to-purple-600 text-white transition-all"
            >
              Get Started
            </button>

            <button
              onClick={finish}
              className="block mx-auto mt-3 text-sm text-muted-foreground underline cursor-pointer hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="profile"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-full max-w-lg bg-card border border-border rounded-2xl p-8 sm:p-10"
            style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}
          >
            <h2 className="text-xl font-semibold text-foreground">Set up your profile</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This is how your collaborators and contacts will see you.
            </p>

            {/* Avatar */}
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={handleAvatarPick}
                className="relative w-20 h-20 rounded-full bg-secondary border-2 border-dashed border-border hover:border-brand-orange/50 transition-colors overflow-hidden group"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <Camera className="w-6 h-6 text-muted-foreground group-hover:text-brand-orange transition-colors" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </button>
            </div>

            {/* Full Name */}
            <div className="mt-5 space-y-1.5">
              <Label htmlFor="ob-name">Full Name</Label>
              <Input
                id="ob-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <button
              onClick={handleProfileNext}
              disabled={savingProfile}
              className="mt-6 w-full px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 hover:from-orange-600 hover:via-pink-600 hover:to-purple-600 text-white transition-all disabled:opacity-50"
            >
              {savingProfile ? "Saving..." : "Next \u2192"}
            </button>

            <button
              onClick={() => setStep(2)}
              className="block mx-auto mt-3 text-sm text-muted-foreground underline cursor-pointer hover:text-foreground transition-colors"
            >
              Skip
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="workspace"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-full max-w-lg bg-card border border-border rounded-2xl p-8 sm:p-10"
            style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}
          >
            <h2 className="text-xl font-semibold text-foreground">Name your workspace</h2>
            <p className="text-sm text-muted-foreground mt-1">
              A workspace is your creative space — your artist name, label, studio, or project.
            </p>

            <div className="mt-6 space-y-1.5">
              <Label htmlFor="ob-ws">Workspace Name</Label>
              <Input
                id="ob-ws"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. My Studio, Artist Name"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                You can create multiple workspaces later for different projects or clients.
              </p>
            </div>

            <button
              onClick={handleWorkspaceFinish}
              disabled={savingWorkspace}
              className="mt-6 w-full px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 hover:from-orange-600 hover:via-pink-600 hover:to-purple-600 text-white transition-all disabled:opacity-50"
            >
              {savingWorkspace ? "Saving..." : "Let\u2019s go! \u2192"}
            </button>

            <button
              onClick={finish}
              className="block mx-auto mt-3 text-sm text-muted-foreground underline cursor-pointer hover:text-foreground transition-colors"
            >
              Skip
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
