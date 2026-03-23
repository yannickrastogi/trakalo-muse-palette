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
  localStorage.setItem("trakalog-theme", mode);
}

export function applyAccent(accent: AccentPalette) {
  document.documentElement.setAttribute("data-accent", accent);
  localStorage.setItem("trakalog-accent", accent);
}

export function getStoredTheme(): ThemeMode {
  return (localStorage.getItem("trakalog-theme") as ThemeMode) || "dark";
}

export function getStoredAccent(): AccentPalette {
  return (localStorage.getItem("trakalog-accent") as AccentPalette) || "sunset";
}

// Listen for system theme changes when mode is "system"
export function watchSystemTheme(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
