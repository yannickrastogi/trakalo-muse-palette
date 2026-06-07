import { safeLocalStorage } from "@/lib/safeStorage";

export type ThemeMode = "dark" | "light" | "system";
export type AccentPalette = "sunset" | "ocean" | "mint" | "violet" | "mono";

function getResolvedTheme(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  const resolved = getResolvedTheme(mode);
  document.documentElement.className = document.documentElement.className
    .replace(/\b(dark|light)\b/g, "")
    .trim() + " " + resolved;
  document.documentElement.className = document.documentElement.className.replace(/\s+/g, " ").trim();
  safeLocalStorage.setItem("trakalog-theme", mode);
}

export function applyAccent(accent: AccentPalette) {
  document.documentElement.setAttribute("data-accent", accent);
  safeLocalStorage.setItem("trakalog-accent", accent);
}

export function getStoredTheme(): ThemeMode {
  return (safeLocalStorage.getItem("trakalog-theme") as ThemeMode) || "dark";
}

export function getStoredAccent(): AccentPalette {
  return (safeLocalStorage.getItem("trakalog-accent") as AccentPalette) || "sunset";
}

// Listen for system theme changes when mode is "system"
export function watchSystemTheme(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

// ── Layout preferences ──

export function applyCompactMode(on: boolean) {
  document.documentElement.classList.toggle("compact", on);
  safeLocalStorage.setItem("trakalog-compact", on ? "1" : "0");
}

export function applyReduceMotion(off: boolean) {
  document.documentElement.classList.toggle("reduce-motion", off);
  safeLocalStorage.setItem("trakalog-reduce-motion", off ? "1" : "0");
}

export function setSidebarCollapsed(on: boolean) {
  safeLocalStorage.setItem("trakalog-sidebar-collapsed", on ? "1" : "0");
  window.dispatchEvent(new CustomEvent("trakalog-sidebar", { detail: on }));
}

export function getStoredCompact(): boolean {
  return safeLocalStorage.getItem("trakalog-compact") === "1";
}

export function getStoredReduceMotion(): boolean {
  const stored = safeLocalStorage.getItem("trakalog-reduce-motion");
  if (stored !== null) return stored === "1";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function getStoredSidebarCollapsed(): boolean {
  return safeLocalStorage.getItem("trakalog-sidebar-collapsed") === "1";
}
