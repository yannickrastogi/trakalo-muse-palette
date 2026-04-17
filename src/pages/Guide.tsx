import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  HelpCircle, Play, ListChecks, Rocket, Dna, Music, ListMusic, Target,
  Shield, Users, PenTool, Building2, Lightbulb,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <AccordionItem value={title} className="border-b border-white/10">
      <AccordionTrigger className="px-4 py-4 hover:no-underline hover:bg-white/[0.03] rounded-lg transition-colors">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-brand-orange shrink-0" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-5">
        <div className="space-y-4 pl-8">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

function Entry({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{children}</p>
    </div>
  );
}

export default function Guide() {
  const navigate = useNavigate();
  const [checklistDismissed] = useState(() => localStorage.getItem("trakalog_checklist_dismissed") === "true");

  function handleReplayTour() {
    localStorage.setItem("trakalog_tour_complete", "false");
    navigate("/dashboard");
  }

  function handleShowChecklist() {
    localStorage.setItem("trakalog_checklist_dismissed", "false");
    navigate("/dashboard");
  }

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[900px]">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Help & Guide</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">Everything you need to know about Trakalog</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleReplayTour}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border border-border hover:bg-secondary/50 text-foreground transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Replay Tour
            </button>
            {checklistDismissed && (
              <button
                onClick={handleShowChecklist}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border border-border hover:bg-secondary/50 text-foreground transition-colors"
              >
                <ListChecks className="w-3.5 h-3.5" />
                Show Checklist
              </button>
            )}
          </div>
        </motion.div>

        {/* Accordion Sections */}
        <motion.div variants={item} className="card-premium overflow-hidden">
          <Accordion type="single" collapsible>
            {/* 1 — Getting Started */}
            <Section title="Getting Started" icon={Rocket}>
              <Entry title="What is Trakalog?">
                Trakalog is the intelligent nervous system for your music catalog. Upload your tracks, and Trakalog protects them with invisible audio watermarking, analyzes them with Sonic DNA, connects them to opportunities via Smart A&amp;R, and tracks every interaction on your shared links.
              </Entry>
              <Entry title="Setting up your workspace">
                Your workspace is your creative space — an artist project, a label, a studio. Customize it with your branding (hero image, logo, colors) in Settings → Branding.
              </Entry>
              <Entry title="Uploading your first track">
                Go to Tracks and click Upload Track. Use Quick Upload for instant bulk import, or go step-by-step to add full details (lyrics, stems, splits, metadata).
              </Entry>
            </Section>

            {/* 2 — Sonic DNA & Smart A&R */}
            <Section title="Sonic DNA & Smart A&R" icon={Dna}>
              <Entry title="What is Sonic DNA?">
                When you upload a track, Trakalog analyzes the audio and creates a unique fingerprint: BPM, key, energy curves, spectral characteristics (brightness, warmth), and structure. This powers the Smart A&amp;R matching.
              </Entry>
              <Entry title="How to maximize Sonic DNA">
                The more metadata you add (genre, mood tags, lyrics, language, type, gender), the better the AI understands your music and finds opportunities.
              </Entry>
              <Entry title="Using Smart A&R">
                Click the Smart A&amp;R icon in the header. Paste any brief or describe what you're looking for. Trakalog scans your entire catalog using Sonic DNA data to find the best matches.
              </Entry>
            </Section>

            {/* 3 — Catalog Management */}
            <Section title="Catalog Management" icon={Music}>
              <Entry title="Uploading tracks">
                Single or bulk upload. Quick Upload skips all details. Sonic DNA auto-detects BPM and key after upload.
              </Entry>
              <Entry title="Editing track details">
                Click any track to edit 17+ metadata fields: title, artist, genre, mood tags, BPM, key, language, type, ISRC, UPC, and more.
              </Entry>
              <Entry title="Managing stems">
                Upload stems (vocals, drums, bass, etc.) in the Stems tab of each track. Organize by type.
              </Entry>
              <Entry title="Track sections">
                Double-click on the waveform to add section markers (Intro, Verse, Chorus, Drop). Rename by double-clicking the label.
              </Entry>
              <Entry title="Lyrics">
                Add lyrics manually, import from PDF/TXT, or auto-transcribe with AI. Lyrics are synced to Sonic DNA for text-based matching.
              </Entry>
            </Section>

            {/* 4 — Playlists */}
            <Section title="Playlists" icon={ListMusic}>
              <Entry title="Creating playlists">
                Create themed playlists with custom gradient colors and mood/genre tags.
              </Entry>
              <Entry title="Sharing playlists">
                Share entire playlists with one branded link. Recipients see your branding.
              </Entry>
            </Section>

            {/* 5 — Pitching */}
            <Section title="Pitching" icon={Target}>
              <Entry title="Creating a pitch">
                Select tracks or a playlist, add contacts, write a message. Trakalog sends a branded email with a secure listening link.
              </Entry>
              <Entry title="Tracking engagement">
                {"See who opened your pitch, how long they listened, which sections they replayed. Pipeline view: Draft \u2192 Sent \u2192 Opened \u2192 Responded."}
              </Entry>
            </Section>

            {/* 6 — Sharing & Security */}
            <Section title="Sharing & Security" icon={Shield}>
              <Entry title="Shared links">
                Create secure links for tracks, playlists, stems, or full Trakalog Packs (ZIP with track, cover, lyrics PDF, splits PDF).
              </Entry>
              <Entry title="Gate screen">
                {"Every shared link has a gate screen that collects the visitor\u2019s name, email, role, and company before they can listen."}
              </Entry>
              <Entry title="Password protection">
                Optionally protect links with a password. Set expiration dates.
              </Entry>
              <Entry title="Audio watermarking">
                Every listener receives an invisibly watermarked version of your audio. Each watermark is unique per visitor.
              </Entry>
              <Entry title="Leak tracing">
                {"If your music leaks, go to Settings \u2192 Security \u2192 Leak Tracing. Upload the leaked file and Trakalog identifies exactly who received that version."}
              </Entry>
            </Section>

            {/* 7 — Contacts */}
            <Section title="Contacts" icon={Users}>
              <Entry title="How contacts are collected">
                Contacts are added automatically when someone listens to your shared links (gate screen), when collaborators scan your studio QR code, or when you add them manually.
              </Entry>
              <Entry title="Exporting contacts">
                Export your contact list to PDF, CSV, or Excel anytime.
              </Entry>
            </Section>

            {/* 8 — Splits & Signatures */}
            <Section title="Splits & Signatures" icon={PenTool}>
              <Entry title="Adding splits">
                {"In each track\u2019s details, add collaborators with their role (Songwriter, Producer, Artist, Musician), PRO, and IPI number. Auto-complete suggests contacts from your workspace."}
              </Entry>
              <Entry title="Digital signatures">
                Send splits for signature. Each collaborator signs on a dedicated page with a canvas signature. Download the signed PDF.
              </Entry>
              <Entry title="Studio QR code">
                Generate a QR code for your studio session. Collaborators scan it to fill in their info and contributions remotely.
              </Entry>
            </Section>

            {/* 9 — Workspace & Team */}
            <Section title="Workspace & Team" icon={Building2}>
              <Entry title="Multi-workspace">
                Create separate workspaces for different projects: your artist name, a label, a client. Switch between them with the workspace switcher.
              </Entry>
              <Entry title="Team permissions">
                Invite team members with 4 permission levels: Viewer (listen only), Pitcher (create playlists &amp; pitch), Editor (modify metadata &amp; stems), Admin (full control). Each member gets a professional title displayed on credits.
              </Entry>
              <Entry title="Catalog sharing">
                Share your entire catalog with another workspace (label, manager). They can pitch your tracks under their branding while you keep full control. Revoke access anytime.
              </Entry>
            </Section>

            {/* 10 — Tips & Best Practices */}
            <Section title="Tips & Best Practices" icon={Lightbulb}>
              <div className="space-y-3">
                {[
                  "The more metadata you add, the better Smart A&R matches your tracks to briefs.",
                  "Add mood tags — they help A&R professionals find exactly what they're looking for.",
                  "Add lyrics to unlock text-based search and matching.",
                  "Set up your branding before sharing links — first impressions matter.",
                  "Use Quick Upload for bulk imports, then add details later at your own pace.",
                  "Create sections on your waveform for professional track presentations.",
                  "Check your Shared Links dashboard regularly — see who's listening.",
                  "Use the Studio QR code during recording sessions to capture splits in real-time.",
                ].map((tip, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                    <span className="text-brand-orange shrink-0">•</span>
                    {tip}
                  </p>
                ))}
              </div>
            </Section>
          </Accordion>
        </motion.div>
      </motion.div>
    </PageShell>
  );
}
