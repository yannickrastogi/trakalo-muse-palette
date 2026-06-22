import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  HelpCircle, Play, ListChecks, Rocket, Dna, Music, ListMusic, Target,
  Shield, Users, PenTool, Building2, Lightbulb,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/components/PageShell";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { safeLocalStorage } from "@/lib/safeStorage";

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [checklistDismissed] = useState(() => safeLocalStorage.getItem("trakalog_checklist_dismissed") === "true");

  function handleReplayTour() {
    safeLocalStorage.removeItem("trakalog_tour_complete");
    navigate("/dashboard?replay_tour=true");
  }

  function handleShowChecklist() {
    safeLocalStorage.removeItem("trakalog_checklist_dismissed");
    navigate("/dashboard?show_checklist=true");
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
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("guide.header.title")}</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">{t("guide.header.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleReplayTour}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border border-border hover:bg-secondary/50 text-foreground transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {t("guide.header.replayTour")}
            </button>
            {checklistDismissed && (
              <button
                onClick={handleShowChecklist}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border border-border hover:bg-secondary/50 text-foreground transition-colors"
              >
                <ListChecks className="w-3.5 h-3.5" />
                {t("guide.header.showChecklist")}
              </button>
            )}
          </div>
        </motion.div>

        {/* Accordion Sections */}
        <motion.div variants={item} className="card-premium overflow-hidden">
          <Accordion type="single" collapsible>
            {/* 1 — Getting Started */}
            <Section title={t("guide.gettingStarted.title")} icon={Rocket}>
              <Entry title={t("guide.gettingStarted.whatIsTrakalog.title")}>
                {t("guide.gettingStarted.whatIsTrakalog.body")}
              </Entry>
              <Entry title={t("guide.gettingStarted.settingUpWorkspace.title")}>
                {t("guide.gettingStarted.settingUpWorkspace.body")}
              </Entry>
              <Entry title={t("guide.gettingStarted.uploadingFirstTrack.title")}>
                {t("guide.gettingStarted.uploadingFirstTrack.body")}
              </Entry>
            </Section>

            {/* 2 — Sonic DNA & Smart A&R */}
            <Section title={t("guide.sonicDna.title")} icon={Dna}>
              <Entry title={t("guide.sonicDna.whatIsSonicDna.title")}>
                {t("guide.sonicDna.whatIsSonicDna.body")}
              </Entry>
              <Entry title={t("guide.sonicDna.maximizeSonicDna.title")}>
                {t("guide.sonicDna.maximizeSonicDna.body")}
              </Entry>
              <Entry title={t("guide.sonicDna.usingSmartAr.title")}>
                {t("guide.sonicDna.usingSmartAr.body")}
              </Entry>
            </Section>

            {/* 3 — Catalog Management */}
            <Section title={t("guide.catalogManagement.title")} icon={Music}>
              <Entry title={t("guide.catalogManagement.uploadingTracks.title")}>
                {t("guide.catalogManagement.uploadingTracks.body")}
              </Entry>
              <Entry title={t("guide.catalogManagement.editingTrackDetails.title")}>
                {t("guide.catalogManagement.editingTrackDetails.body")}
              </Entry>
              <Entry title={t("guide.catalogManagement.managingStems.title")}>
                {t("guide.catalogManagement.managingStems.body")}
              </Entry>
              <Entry title={t("guide.catalogManagement.trackSections.title")}>
                {t("guide.catalogManagement.trackSections.body")}
              </Entry>
              <Entry title={t("guide.catalogManagement.lyrics.title")}>
                {t("guide.catalogManagement.lyrics.body")}
              </Entry>
            </Section>

            {/* 4 — Playlists */}
            <Section title={t("guide.playlists.title")} icon={ListMusic}>
              <Entry title={t("guide.playlists.creatingPlaylists.title")}>
                {t("guide.playlists.creatingPlaylists.body")}
              </Entry>
              <Entry title={t("guide.playlists.sharingPlaylists.title")}>
                {t("guide.playlists.sharingPlaylists.body")}
              </Entry>
            </Section>

            {/* 5 — Pitching */}
            <Section title={t("guide.pitching.title")} icon={Target}>
              <Entry title={t("guide.pitching.creatingPitch.title")}>
                {t("guide.pitching.creatingPitch.body")}
              </Entry>
              <Entry title={t("guide.pitching.trackingEngagement.title")}>
                {t("guide.pitching.trackingEngagement.body")}
              </Entry>
            </Section>

            {/* 6 — Sharing & Security */}
            <Section title={t("guide.sharingSecurity.title")} icon={Shield}>
              <Entry title={t("guide.sharingSecurity.sharedLinks.title")}>
                {t("guide.sharingSecurity.sharedLinks.body")}
              </Entry>
              <Entry title={t("guide.sharingSecurity.gateScreen.title")}>
                {t("guide.sharingSecurity.gateScreen.body")}
              </Entry>
              <Entry title={t("guide.sharingSecurity.passwordProtection.title")}>
                {t("guide.sharingSecurity.passwordProtection.body")}
              </Entry>
              <Entry title={t("guide.sharingSecurity.audioWatermarking.title")}>
                {t("guide.sharingSecurity.audioWatermarking.body")}
              </Entry>
              <Entry title={t("guide.sharingSecurity.leakTracing.title")}>
                {t("guide.sharingSecurity.leakTracing.body")}
              </Entry>
            </Section>

            {/* 7 — Contacts */}
            <Section title={t("guide.contacts.title")} icon={Users}>
              <Entry title={t("guide.contacts.howCollected.title")}>
                {t("guide.contacts.howCollected.body")}
              </Entry>
              <Entry title={t("guide.contacts.exportingContacts.title")}>
                {t("guide.contacts.exportingContacts.body")}
              </Entry>
            </Section>

            {/* 8 — Splits & Signatures */}
            <Section title={t("guide.splitsSignatures.title")} icon={PenTool}>
              <Entry title={t("guide.splitsSignatures.addingSplits.title")}>
                {t("guide.splitsSignatures.addingSplits.body")}
              </Entry>
              <Entry title={t("guide.splitsSignatures.digitalSignatures.title")}>
                {t("guide.splitsSignatures.digitalSignatures.body")}
              </Entry>
              <Entry title={t("guide.splitsSignatures.studioQrCode.title")}>
                {t("guide.splitsSignatures.studioQrCode.body")}
              </Entry>
            </Section>

            {/* 9 — Workspace & Team */}
            <Section title={t("guide.workspaceTeam.title")} icon={Building2}>
              <Entry title={t("guide.workspaceTeam.multiWorkspace.title")}>
                {t("guide.workspaceTeam.multiWorkspace.body")}
              </Entry>
              <Entry title={t("guide.workspaceTeam.teamPermissions.title")}>
                {t("guide.workspaceTeam.teamPermissions.body")}
              </Entry>
              <Entry title={t("guide.workspaceTeam.catalogSharing.title")}>
                {t("guide.workspaceTeam.catalogSharing.body")}
              </Entry>
            </Section>

            {/* 10 — Tips & Best Practices */}
            <Section title={t("guide.tipsBestPractices.title")} icon={Lightbulb}>
              <div className="space-y-3">
                {(t("guide.tipsBestPractices.tips", { returnObjects: true }) as string[]).map((tip, i) => (
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
