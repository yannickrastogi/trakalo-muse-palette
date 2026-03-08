import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  role: string;
  firstInteraction: string;
  lastDownload: string;
  tracksDownloaded: string[];
  totalDownloads: number;
}

interface ContactsContextValue {
  contacts: Contact[];
  addOrUpdateContact: (data: Omit<Contact, "id" | "firstInteraction" | "lastDownload" | "tracksDownloaded" | "totalDownloads"> & { trackName: string }) => void;
  getContact: (email: string) => Contact | undefined;
}

const ContactsContext = createContext<ContactsContextValue | null>(null);

export function ContactsProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([]);

  const addOrUpdateContact = useCallback((data: Omit<Contact, "id" | "firstInteraction" | "lastDownload" | "tracksDownloaded" | "totalDownloads"> & { trackName: string }) => {
    const now = new Date().toISOString();
    setContacts((prev) => {
      const existing = prev.find((c) => c.email.toLowerCase() === data.email.toLowerCase());
      if (existing) {
        return prev.map((c) =>
          c.email.toLowerCase() === data.email.toLowerCase()
            ? {
                ...c,
                firstName: data.firstName,
                lastName: data.lastName,
                organization: data.organization,
                role: data.role,
                lastDownload: now,
                tracksDownloaded: c.tracksDownloaded.includes(data.trackName)
                  ? c.tracksDownloaded
                  : [...c.tracksDownloaded, data.trackName],
                totalDownloads: c.totalDownloads + 1,
              }
            : c
        );
      }
      return [
        ...prev,
        {
          id: `contact-${Date.now()}`,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          organization: data.organization,
          role: data.role,
          firstInteraction: now,
          lastDownload: now,
          tracksDownloaded: [data.trackName],
          totalDownloads: 1,
        },
      ];
    });
  }, []);

  const getContact = useCallback((email: string) => {
    return contacts.find((c) => c.email.toLowerCase() === email.toLowerCase());
  }, [contacts]);

  return (
    <ContactsContext.Provider value={{ contacts, addOrUpdateContact, getContact }}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const ctx = useContext(ContactsContext);
  if (!ctx) throw new Error("useContacts must be used within ContactsProvider");
  return ctx;
}
