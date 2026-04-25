const STORAGE_KEY = "trakalog-saved-contacts";

export interface SavedContact {
  name: string;
  company: string;
  email: string;
  lastUsed: number;
}

export function getSavedContacts(): SavedContact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveContact(contact: Omit<SavedContact, "lastUsed">) {
  const contacts = getSavedContacts();
  const idx = contacts.findIndex(
    (c) => c.email.toLowerCase() === contact.email.toLowerCase()
  );
  const entry: SavedContact = { ...contact, lastUsed: Date.now() };
  if (idx >= 0) {
    contacts[idx] = entry;
  } else {
    contacts.push(entry);
  }
  // Keep max 50 contacts, sorted by most recent
  contacts.sort((a, b) => b.lastUsed - a.lastUsed);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts.slice(0, 50))); } catch { /* quota exceeded or private browsing */ }
}
