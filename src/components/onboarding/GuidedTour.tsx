import { useMemo } from "react";
import { Joyride, type Step, type CallBackProps, STATUS, ACTIONS, EVENTS } from "react-joyride";
import { useIsMobile } from "@/hooks/use-mobile";

interface GuidedTourProps {
  run: boolean;
  onFinish: () => void;
  onUploadClick?: () => void;
}

const sidebarSteps: Step[] = [
  {
    target: '[data-tour="sidebar-dashboard"]',
    title: "Dashboard",
    content: "Your command center. See your catalog stats, recent activity, and quick actions at a glance.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="sidebar-tracks"]',
    title: "Your Catalog",
    content: "Upload and manage all your tracks here. Each track is automatically analyzed by Sonic DNA to detect BPM, key, and audio characteristics.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="sidebar-playlists"]',
    title: "Playlists",
    content: "Organize your tracks into themed playlists for pitching. Share entire playlists with one branded link.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="sidebar-pitch"]',
    title: "Pitch",
    content: "Send your tracks to A&R, labels, supervisors, and publishers. Trakalog tracks every interaction — opens, listens, and engagement time.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="sidebar-contacts"]',
    title: "Contacts",
    content: "Your industry network, built automatically. Contacts are captured when people listen to your shared links or scan your studio QR code.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="sidebar-shared-links"]',
    title: "Shared Links",
    content: "Create secure links to share tracks, playlists, or full packs. Password-protect them, set expiration dates, and track engagement in real-time.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="sidebar-approvals"]',
    title: "Approvals",
    content: "Review and approve changes submitted by your team members.",
    disableBeacon: true,
  },
];

const headerSteps: Step[] = [
  {
    target: '[data-tour="header-smart-ar"]',
    title: "Smart A&R",
    content: "Your AI-powered music matchmaker. Paste any brief and Trakalog analyzes your entire catalog using Sonic DNA to find the perfect tracks.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="header-radio"]',
    title: "Trakalog Radio",
    content: "Shuffle through your catalog with crossfade. Filter by genre and mood. Rediscover forgotten gems.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="header-notifications"]',
    title: "Notifications",
    content: "Stay informed when someone listens to your shared links, leaves comments, signs splits, or joins your workspace.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="header-profile"]',
    title: "Your Profile",
    content: "Access your settings, security options, appearance preferences, and workspace management from here.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="workspace-switcher"]',
    title: "Workspace Switcher",
    content: "Switch between your workspaces — artist projects, label accounts, or client catalogs. Each workspace has its own catalog, branding, and team.",
    disableBeacon: true,
  },
];

const commonSteps: Step[] = [
  {
    target: '[data-tour="upload-button"]',
    title: "Upload Tracks",
    content: "Upload your music here. Use Quick Upload for instant bulk import, or go step-by-step to add full details. Sonic DNA will automatically analyze BPM, key, energy, and more.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="search-bar"]',
    title: "Search",
    content: "Search your entire catalog by title, artist, genre, or any metadata.",
    disableBeacon: true,
  },
  {
    target: "body",
    title: "Workspace Branding",
    content: "Customize your shared links and pitches with your brand — hero image, logo, colors, and social links. Find it in Settings \u2192 Branding.",
    placement: "center" as const,
    disableBeacon: true,
  },
  {
    target: "body",
    title: "Security Built-in",
    content: "Every shared link is invisibly audio-watermarked. If your music leaks, upload the file in Settings \u2192 Security \u2192 Leak Tracing to identify the source.",
    placement: "center" as const,
    disableBeacon: true,
  },
  {
    target: "body",
    title: "Splits & Signatures",
    content: "Document who wrote and produced each track. Send for digital signature. Use the studio QR code to capture contributions in real-time.",
    placement: "center" as const,
    disableBeacon: true,
  },
  {
    target: "body",
    title: "You're all set! \ud83c\udf89",
    content: "The more metadata you add to your tracks, the smarter Trakalog becomes. Start by uploading your first track!",
    placement: "center" as const,
    disableBeacon: true,
  },
];

const joyrideStyles = {
  options: {
    zIndex: 10000,
    overlayColor: "rgba(0, 0, 0, 0.75)",
  },
  tooltip: {
    backgroundColor: "#1a1a1e",
    color: "white",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    padding: "20px 24px",
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: 600,
  },
  tooltipContent: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    padding: "8px 0 0",
  },
  buttonNext: {
    backgroundColor: "#f97316",
    color: "white",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 20px",
  },
  buttonBack: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },
  buttonSkip: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },
  spotlight: {
    borderRadius: 12,
  },
  beacon: {
    display: "none" as const,
  },
  beaconInner: {
    display: "none" as const,
  },
  beaconOuter: {
    display: "none" as const,
  },
};

export function GuidedTour({ run, onFinish, onUploadClick }: GuidedTourProps) {
  const isMobile = useIsMobile();

  // Compute steps synchronously — avoids empty-steps render that can confuse Joyride
  const steps = useMemo<Step[]>(() => {
    if (isMobile) {
      return [
        {
          target: '[data-tour="header-notifications"]',
          title: "Notifications",
          content: "Stay informed when someone listens to your shared links, leaves comments, signs splits, or joins your workspace.",
          disableBeacon: true,
        },
        {
          target: '[data-tour="header-profile"]',
          title: "Your Profile",
          content: "Access your settings, security options, appearance preferences, and workspace management from here.",
          disableBeacon: true,
        },
        ...commonSteps,
      ];
    }
    return [...sidebarSteps, ...headerSteps, ...commonSteps];
  }, [isMobile]);

  // Filter out steps whose target is not in the DOM (hidden by permissions).
  // Depends on `run` so it recalculates after the delay when DOM is ready.
  const visibleSteps = useMemo(() => {
    return steps.filter((step) => {
      if (typeof step.target === "string" && step.target !== "body") {
        return document.querySelector(step.target) !== null;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, run]);

  function handleCallback(data: CallBackProps) {
    const { status, action, index, type } = data;

    // Tour completed all steps or user clicked "Skip Tour"
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      if (status === STATUS.FINISHED && onUploadClick && index === visibleSteps.length - 1 && action === ACTIONS.NEXT) {
        onUploadClick();
      }
      onFinish();
      return;
    }

    // User clicked X on a tooltip — only treat as skip if it's a real user close (STEP_AFTER)
    if (action === ACTIONS.CLOSE && type === EVENTS.STEP_AFTER) {
      onFinish();
    }
  }

  if (visibleSteps.length === 0) return null;

  return (
    <Joyride
      steps={visibleSteps}
      run={run}
      continuous
      showProgress
      showSkipButton
      disableOverlayClose
      disableCloseOnEsc={false}
      scrollToFirstStep
      spotlightClicks={false}
      floaterProps={{ disableAnimation: true }}
      callback={handleCallback}
      styles={joyrideStyles}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish",
        next: "Next",
        skip: "Skip Tour",
      }}
    />
  );
}
