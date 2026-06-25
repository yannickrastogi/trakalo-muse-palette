import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; isChunkError: boolean; }

// A stale lazy chunk (after a new deploy) fails to import. We detect those by
// message and auto-reload once per session, instead of crashing to a black screen.
function isChunkLoadError(error: Error | null | undefined): boolean {
  const m = ((error && error.message) || "").toLowerCase();
  return (
    m.includes("dynamically imported module") ||
    m.includes("chunkloaderror") ||
    m.includes("failed to fetch") ||
    m.includes("error loading dynamically imported module") ||
    m.includes("importing a module script failed") ||
    m.includes("networkerror when attempting to fetch resource") || // Firefox
    m.includes("load failed") ||                                    // Safari
    m.includes("loading chunk")                                     // Webpack compat
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    if (isChunkLoadError(error)) {
      // Reload up to 3 times per session (one per genuinely stale chunk). The
      // cap breaks an infinite loop if a chunk stays unavailable after reload.
      try {
        const reloads = parseInt(sessionStorage.getItem("trakalog-chunk-reloads") || "0", 10);
        if (reloads < 3) {
          sessionStorage.setItem("trakalog-chunk-reloads", String(reloads + 1));
          window.location.reload();
        }
      } catch { /* sessionStorage can throw (private mode) — fall through to UI */ }
    }
  }

  render() {
    // On ANY caught error we render the fallback rather than re-rendering the
    // throwing subtree (which would re-throw immediately and loop). For chunk
    // errors a reload is already in flight; the fallback just shows briefly.
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4 p-8">
            <p className="text-lg font-medium text-foreground">Something went wrong</p>
            <p className="text-sm text-muted-foreground">Please refresh the page to continue</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
