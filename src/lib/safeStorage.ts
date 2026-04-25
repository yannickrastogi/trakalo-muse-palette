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
