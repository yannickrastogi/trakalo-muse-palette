import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import trakalogLogo from "@/assets/trakalog-logo.png";

const ROLES = [
  "Producer",
  "Songwriter",
  "Artist",
  "Manager",
  "A&R",
  "Publisher",
  "Mix Engineer",
  "Mastering Engineer",
  "Other",
];

export default function Onboarding() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const googleName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";
  const [name, setName] = useState(googleName);
  const [workspaceName, setWorkspaceName] = useState(googleName ? googleName + "'s Workspace" : "");
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [wsManuallyEdited, setWsManuallyEdited] = useState(false);
  const [role, setRole] = useState("");
  const [roleOpen, setRoleOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [showButton, setShowButton] = useState(false);
  const [checkingWorkspace, setCheckingWorkspace] = useState(true);

  // Check if user already has a workspace → redirect to dashboard
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Wait 3 seconds for session to stabilize before giving up
      const timeout = setTimeout(() => {
        setCheckingWorkspace(false);
        window.location.href = "/auth";
      }, 3000);
      return () => clearTimeout(timeout);
    }
    supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .then(function (res) {
        if (res.data && res.data.length > 0) {
          navigate("/dashboard", { replace: true });
        } else {
          setCheckingWorkspace(false);
        }
      });
  }, [user, authLoading, navigate]);

  // Auto-update workspace name when typing name (unless manually edited)
  const handleNameChange = (value: string) => {
    setName(value);
    setNameManuallyEdited(true);
    if (!wsManuallyEdited) {
      setWorkspaceName(value ? value + "'s Workspace" : "");
    }
  };

  const handleWsNameChange = (value: string) => {
    setWorkspaceName(value);
    setWsManuallyEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !workspaceName.trim() || submitting) return;
    setSubmitting(true);

    // 1. Update user profile if name changed
    if (name.trim() !== googleName) {
      await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    }

    // 2. Create workspace via RPC
    const { data, error } = await supabase.rpc("create_workspace_with_member", {
      _name: workspaceName.trim(),
      _description: null,
    });

    if (error) {
      console.error("Error creating workspace:", error);
      setSubmitting(false);
      return;
    }

    // 3. Check for return URL or pending auto-save
    const returnUrl = searchParams.get("return");
    const pendingAutoSave = localStorage.getItem("trakalog_auto_save");
    if (returnUrl) {
      setSubmitting(false);
      window.location.href = returnUrl;
      return;
    }
    if (pendingAutoSave) {
      setSubmitting(false);
      window.location.href = "/share/" + pendingAutoSave;
      return;
    }

    // 4. Show success step
    setStep("success");
    setSubmitting(false);
    setTimeout(() => setShowButton(true), 1500);
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard", { replace: true });
  };

  if (checkingWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(24_100%_55%/0.03)] via-transparent to-[hsl(270_70%_55%/0.03)]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-1">
          <img
            src={trakalogLogo}
            alt="Trakalog"
            className="w-[60px] h-[60px] rounded-xl object-contain"
          />
          <h1 className="text-2xl font-bold tracking-tight gradient-text font-[Sora] mt-2">
            TRAKALOG
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-medium">
            CATALOG MANAGER
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-foreground">Welcome to Trakalog ✦</h2>
                <p className="text-muted-foreground text-sm mt-2">Let's set up your personal workspace in seconds</p>
              </div>

              {/* Form card */}
              <div className="card-premium p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="onb-name">Your Name</Label>
                    <Input
                      id="onb-name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="onb-ws">Workspace Name</Label>
                    <Input
                      id="onb-ws"
                      type="text"
                      placeholder="My Workspace"
                      value={workspaceName}
                      onChange={(e) => handleWsNameChange(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Your Role <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setRoleOpen(!roleOpen)}
                        className="flex items-center justify-between w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <span className={role ? "text-foreground" : "text-muted-foreground"}>
                          {role || "Select a role"}
                        </span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {roleOpen && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-[200px] overflow-y-auto">
                          {ROLES.map((r) => (
                            <button
                              key={r}
                              type="button"
                              className={"w-full text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors " + (role === r ? "bg-secondary font-medium" : "")}
                              onClick={() => { setRole(r); setRoleOpen(false); }}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !name.trim() || !workspaceName.trim()}
                    className="btn-brand w-full h-12 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create my Trakalog"
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <div className="card-premium p-8">
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="flex flex-col items-center text-center"
                >
                  {/* Animated check */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.1, type: "spring", stiffness: 200 }}
                    className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-5"
                  >
                    <Check className="w-8 h-8 text-emerald-400" />
                  </motion.div>

                  <h2 className="text-2xl font-bold text-foreground">Your Trakalog is ready! 🎉</h2>
                  <p className="text-muted-foreground text-sm mt-2">You're all set to manage your music catalog</p>

                  <AnimatePresence>
                    {showButton && (
                      <motion.button
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={handleGoToDashboard}
                        className="btn-brand w-full h-12 rounded-lg text-sm font-semibold mt-8"
                      >
                        Go to Dashboard
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
