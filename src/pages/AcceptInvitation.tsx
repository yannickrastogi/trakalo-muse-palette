import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/constants";
import { AlertCircle, Mail, Users, Loader2, CheckCircle2 } from "lucide-react";
import trakalogLogo from "@/assets/trakalog-logo.png";

interface InvitationData {
  id: string;
  workspace_id: string;
  invited_by: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  token: string;
  status: string;
  created_at: string;
  expires_at: string | null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-3">
              <img src={trakalogLogo} alt="Trakalog" className="h-10" />
              <span className="text-xl font-bold tracking-wider uppercase" style={{ background: "linear-gradient(90deg, #f97316, #ec4899, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Trakalog</span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 mt-1">Catalog Manager</span>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="py-6 text-center">
        <a href="https://trakalog.com" target="_blank" rel="noopener noreferrer" className="text-[10px] hover:opacity-80 transition-opacity" style={{ color: "#f97316" }}>
          {"Powered by Trakalog \u2726"}
        </a>
      </footer>
    </div>
  );
}

export default function AcceptInvitation() {
  var anonSupabase = useRef(createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })).current;
  var { token } = useParams<{ token: string }>();
  var navigate = useNavigate();

  var [loading, setLoading] = useState(true);
  var [error, setError] = useState<string | null>(null);
  var [invitation, setInvitation] = useState<InvitationData | null>(null);
  var [session, setSession] = useState<any>(null);
  var [accepting, setAccepting] = useState(false);
  var [accepted, setAccepted] = useState(false);

  useEffect(function () {
    loadInvitation();
    checkSession();
  }, [token]);

  async function checkSession() {
    try {
      var backup = localStorage.getItem("trakalog_session_backup");
      if (backup) {
        var parsed = JSON.parse(backup);
        if (parsed && parsed.user) {
          setSession(parsed);
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  async function loadInvitation() {
    if (!token) {
      setError("Invalid invitation link.");
      setLoading(false);
      return;
    }

    try {
      var { data, error: fetchError } = await anonSupabase
        .from("invitations")
        .select("*")
        .eq("token", token)
        .single();

      if (fetchError || !data) {
        setError("This invitation was not found. It may have been revoked.");
        setLoading(false);
        return;
      }

      setInvitation(data as InvitationData);

      if (data.status === "accepted") {
        setError("This invitation has already been accepted.");
      } else if (data.status === "revoked") {
        setError("This invitation has been revoked.");
      } else if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError("This invitation has expired.");
      }
    } catch (e: any) {
      setError("Failed to load invitation.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!invitation || !session) return;
    setAccepting(true);

    try {
      var res = await fetch(SUPABASE_URL + "/functions/v1/accept-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ token: invitation.token, user_id: session.user.id }),
      });
      var data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to accept invitation");
        setAccepting(false);
        return;
      }

      setAccepted(true);
    } catch (e: any) {
      setError("Failed to accept invitation.");
      setAccepting(false);
    }
  }

  function handleSignUp() {
    navigate("/auth?invite=" + token);
  }

  // Loading state
  if (loading) {
    return (
      <Shell>
        <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </Shell>
    );
  }

  // Error state (no invitation data or expired/accepted/revoked)
  if (error && !invitation) {
    return (
      <Shell>
        <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold text-foreground">Invitation Unavailable</h2>
          <p className="text-muted-foreground text-center">{error}</p>
        </div>
      </Shell>
    );
  }

  // Accepted success state
  if (accepted) {
    return (
      <Shell>
        <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center gap-4">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <h2 className="text-xl font-semibold text-foreground">You're in!</h2>
          <p className="text-muted-foreground text-center">
            {"You've joined the workspace as " + invitation?.role + "."}
          </p>
          <button
            onClick={function () { navigate("/dashboard"); }}
            className="mt-4 inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold btn-brand"
          >
            Go to Dashboard
          </button>
        </div>
      </Shell>
    );
  }

  // Invitation details
  var inviteeName = [invitation?.first_name, invitation?.last_name].filter(Boolean).join(" ") || null;
  var roleName = invitation?.role || "member";

  return (
    <Shell>
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-card border border-border rounded-xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">You're Invited</h1>
            <p className="text-muted-foreground">
              {"You've been invited to join a workspace on Trakalog."}
            </p>
          </div>

          <div className="space-y-3">
            {inviteeName && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Users className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Invited as</p>
                  <p className="font-medium text-foreground">{inviteeName}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium text-muted-foreground w-5 h-5 flex items-center justify-center shrink-0">@</span>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium text-foreground capitalize">{roleName}</p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : session ? (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold btn-brand disabled:opacity-50"
            >
              {accepting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Accepting...
                </>
              ) : (
                "Accept Invitation"
              )}
            </button>
          ) : (
            <button
              onClick={handleSignUp}
              className="w-full inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold btn-brand"
            >
              Sign up to accept
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}
