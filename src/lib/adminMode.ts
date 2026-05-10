// Detect whether the app is running in admin mode.
// Production: hostname must be admin.trakalog.com.
// Dev: ?admin=1 in URL flips a localStorage flag (?admin=0 clears it),
// since hostname is localhost during development.

const ADMIN_HOST = "admin.trakalog.com";
const ADMIN_DEV_KEY = "trakalog_admin_dev_mode";

export function isAdminMode(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.hostname === ADMIN_HOST) return true;

  try {
    const params = new URLSearchParams(window.location.search);
    const param = params.get("admin");
    if (param === "1") {
      localStorage.setItem(ADMIN_DEV_KEY, "1");
      return true;
    }
    if (param === "0") {
      localStorage.removeItem(ADMIN_DEV_KEY);
      return false;
    }
    return localStorage.getItem(ADMIN_DEV_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearAdminDevMode(): void {
  try {
    localStorage.removeItem(ADMIN_DEV_KEY);
  } catch {
    // ignore
  }
}
