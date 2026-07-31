export const safeLocalStorage = {
  getItem(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* quota exceeded or private browsing */ }
  },
  removeItem(key: string): void {
    try { localStorage.removeItem(key); } catch { /* private browsing */ }
  },
};

// Same guarded wrapper over sessionStorage — values live only for the tab's
// lifetime (cleared on close). Used for shared-link password session tokens so
// access does not persist beyond the browsing session.
export const safeSessionStorage = {
  getItem(key: string): string | null {
    try { return sessionStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string): void {
    try { sessionStorage.setItem(key, value); } catch { /* quota exceeded or private browsing */ }
  },
  removeItem(key: string): void {
    try { sessionStorage.removeItem(key); } catch { /* private browsing */ }
  },
};
