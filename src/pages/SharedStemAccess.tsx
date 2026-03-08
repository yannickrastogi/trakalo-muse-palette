import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Download, Music, Layers, User, Mail, Building2, Briefcase, Package } from "lucide-react";
import { useSharedLinks } from "@/contexts/SharedLinksContext";
import { useContacts } from "@/contexts/ContactsContext";
import { toast } from "sonner";
import trakalogLogo from "@/assets/trakalog-logo.png";

const roleOptions = ["Admin", "Manager", "Producer", "Viewer", "Other"];

export default function SharedStemAccess() {
  const { linkId } = useParams();
  const { getSharedLink, addDownloadEvent } = useSharedLinks();
  const { addOrUpdateContact } = useContacts();

  const [password, setPassword] = useState("");
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [formCompleted, setFormCompleted] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const link = linkId ? getSharedLink(linkId) : undefined;

  if (!link) {
    return (
      <ExternalShell>
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Link Not Found</h2>
          <p className="text-sm text-muted-foreground mt-1">This share link doesn't exist or has been removed.</p>
        </div>
      </ExternalShell>
    );
  }

  if (link.status === "expired" || link.status === "disabled") {
    return (
      <ExternalShell>
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {link.status === "expired" ? "Link Expired" : "Link Disabled"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">This share link is no longer active.</p>
        </div>
      </ExternalShell>
    );
  }

  const needsPassword = link.linkType === "secured" && !passwordVerified;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === link.password) {
      setPasswordVerified(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !organization.trim() || !role) {
      toast.error("Please fill in all fields");
      return;
    }
    addOrUpdateContact({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      organization: organization.trim(),
      role,
      trackName: link.trackTitle,
    });
    setFormCompleted(true);
  };

  const handleDownload = (stemFileName: string) => {
    const event = {
      id: `dl-${Date.now()}`,
      linkId: link.id,
      downloaderName: `${firstName} ${lastName}`,
      downloaderEmail: email,
      organization,
      role,
      trackName: link.trackTitle,
      stemsDownloaded: [stemFileName],
      downloadedAt: new Date().toISOString(),
    };
    addDownloadEvent(link.id, event);
    addOrUpdateContact({
      firstName, lastName, email, organization, role,
      trackName: link.trackTitle,
    });
    toast.success(`Downloading ${stemFileName}`);
  };

  const handleDownloadAll = () => {
    const allFiles = link.stems.map((s) => s.fileName);
    const event = {
      id: `dl-${Date.now()}`,
      linkId: link.id,
      downloaderName: `${firstName} ${lastName}`,
      downloaderEmail: email,
      organization,
      role,
      trackName: link.trackTitle,
      stemsDownloaded: allFiles,
      downloadedAt: new Date().toISOString(),
    };
    addDownloadEvent(link.id, event);
    addOrUpdateContact({
      firstName, lastName, email, organization, role,
      trackName: link.trackTitle,
    });
    toast.success(`Downloading ${link.trackTitle}_Stems.zip`);
  };

  // Password gate
  if (needsPassword) {
    return (
      <ExternalShell>
        <div className="max-w-sm mx-auto py-12">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl icon-brand flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Password Required</h2>
            <p className="text-sm text-muted-foreground mt-1">Enter the password to access these stems.</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
              placeholder="Enter password"
              className={`h-11 w-full px-4 rounded-xl bg-secondary border text-sm text-foreground outline-none transition-all ${
                passwordError ? "border-destructive" : "border-border focus:border-primary/30"
              }`}
              autoFocus
            />
            {passwordError && <p className="text-xs text-destructive">Incorrect password. Please try again.</p>}
            <button type="submit" className="w-full h-11 rounded-xl text-sm font-semibold btn-brand">
              Access Stems
            </button>
          </form>
        </div>
      </ExternalShell>
    );
  }

  // Access form
  if (!formCompleted) {
    return (
      <ExternalShell>
        <div className="max-w-md mx-auto py-8">
          <div className="text-center mb-8">
            {link.trackCover ? (
              <img src={link.trackCover} alt={link.trackTitle} className="w-20 h-20 rounded-xl object-cover mx-auto mb-4" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-brand-purple/30 via-brand-pink/20 to-brand-orange/30 flex items-center justify-center mx-auto mb-4">
                <Music className="w-8 h-8 text-foreground/20" />
              </div>
            )}
            <h2 className="text-lg font-semibold text-foreground">{link.trackTitle}</h2>
            <p className="text-sm text-muted-foreground">{link.trackArtist}</p>
            {link.message && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-secondary/50 border border-border text-xs text-foreground/80 italic">
                "{link.message}"
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-sm font-semibold text-foreground mb-4">Enter your details to access stems</h3>
            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">First Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name"
                      className="h-10 w-full pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Last Name *</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name"
                    className="h-10 w-full px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                    className="h-10 w-full pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Organization *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Your company"
                    className="h-10 w-full pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">Role *</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <select value={role} onChange={(e) => setRole(e.target.value)}
                    className="h-10 w-full pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all appearance-none cursor-pointer">
                    <option value="">Select role…</option>
                    {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full h-11 rounded-xl text-sm font-semibold btn-brand mt-2">
                Access Stems
              </button>
            </form>
          </div>
        </div>
      </ExternalShell>
    );
  }

  // Download page
  return (
    <ExternalShell>
      <div className="max-w-lg mx-auto py-8">
        {/* Track header */}
        <div className="text-center mb-8">
          {link.trackCover ? (
            <img src={link.trackCover} alt={link.trackTitle} className="w-24 h-24 rounded-xl object-cover mx-auto mb-4 shadow-lg" />
          ) : (
            <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-brand-purple/30 via-brand-pink/20 to-brand-orange/30 flex items-center justify-center mx-auto mb-4">
              <Music className="w-10 h-10 text-foreground/20" />
            </div>
          )}
          <h2 className="text-xl font-bold text-foreground">{link.trackTitle}</h2>
          <p className="text-sm text-muted-foreground">{link.trackArtist}</p>
          {link.message && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-secondary/50 border border-border text-xs text-foreground/80 italic max-w-sm mx-auto">
              "{link.message}"
            </div>
          )}
        </div>

        {/* Download All */}
        <button onClick={handleDownloadAll} className="w-full h-12 rounded-xl text-sm font-semibold btn-brand flex items-center justify-center gap-2 mb-6">
          <Package className="w-4 h-4" />
          Download All as ZIP
        </button>

        {/* Stems list */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">{link.stems.length} Stems</span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {link.stems.map((stem) => (
              <div key={stem.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Music className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{stem.fileName}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{stem.type} · {stem.fileSize}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(stem.fileName)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ExternalShell>
  );
}

function ExternalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-3">
          <img src={trakalogLogo} alt="Trakalog" className="w-8 h-8 rounded-lg object-contain" />
          <span className="text-sm font-bold tracking-tight gradient-text">TRAKALOG</span>
        </div>
      </div>
      <div className="px-4">{children}</div>
    </div>
  );
}
