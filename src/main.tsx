import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Auto-recover from stale lazy chunks after a new deploy. Vite fires
// `vite:preloadError` when a dynamically-imported chunk 404s; reload (up to 3×
// per session) instead of leaving a black screen. Only preventDefault when we
// actually take over the reload — past the cap we let Vite throw so the
// ErrorBoundary can show its fallback.
window.addEventListener("vite:preloadError", (event) => {
  try {
    const reloads = parseInt(sessionStorage.getItem("trakalog-chunk-reloads") || "0", 10);
    if (reloads < 3) {
      event.preventDefault();
      sessionStorage.setItem("trakalog-chunk-reloads", String(reloads + 1));
      window.location.reload();
    }
  } catch { /* sessionStorage unavailable (private mode) — let Vite handle it */ }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
