import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Auto-recover from stale lazy chunks after a new deploy. Vite fires
// `vite:preloadError` when a dynamically-imported chunk 404s; reload once
// (guarded against loops) instead of leaving a black screen.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  try {
    if (!sessionStorage.getItem("trakalog-chunk-reloaded")) {
      sessionStorage.setItem("trakalog-chunk-reloaded", "1");
      window.location.reload();
    }
  } catch { /* sessionStorage unavailable (private mode) — ignore */ }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
