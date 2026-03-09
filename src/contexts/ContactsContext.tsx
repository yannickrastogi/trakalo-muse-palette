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

const demoContacts: Contact[] = [
  { id: "c-1", firstName: "Jamie", lastName: "Lin", email: "jamie@atlantic.com", organization: "Atlantic Records", role: "A&R", firstInteraction: "2026-03-09T06:00:00", lastDownload: "2026-03-09T12:12:00", tracksDownloaded: ["Velvet Hour", "Ghost Protocol"], totalDownloads: 5 },
  { id: "c-2", firstName: "Sarah", lastName: "Chen", email: "sarah@sonymusic.com", organization: "Sony Music", role: "A&R Manager", firstInteraction: "2026-03-07T18:22:00", lastDownload: "2026-03-07T18:22:00", tracksDownloaded: ["Velvet Hour", "Burning Chrome"], totalDownloads: 4 },
  { id: "c-3", firstName: "Marcus", lastName: "Webb", email: "marcus@interscope.com", organization: "Interscope Records", role: "Head of A&R", firstInteraction: "2026-03-05T14:30:00", lastDownload: "2026-03-05T14:30:00", tracksDownloaded: ["Velvet Hour", "Burning Chrome"], totalDownloads: 4 },
  { id: "c-4", firstName: "Diana", lastName: "Rossi", email: "diana@warnermusic.com", organization: "Warner Music", role: "Music Supervisor", firstInteraction: "2026-03-03T10:15:00", lastDownload: "2026-03-04T12:30:00", tracksDownloaded: ["Velvet Hour", "Soft Landing", "Burning Chrome"], totalDownloads: 3 },
  { id: "c-5", firstName: "Alex", lastName: "Turner", email: "alex@republic.com", organization: "Republic Records", role: "A&R", firstInteraction: "2026-03-01T16:45:00", lastDownload: "2026-03-06T16:00:00", tracksDownloaded: ["Velvet Hour", "Soft Landing"], totalDownloads: 1 },
  { id: "c-6", firstName: "Kenji", lastName: "Mori", email: "kenji@88rising.com", organization: "88rising", role: "Artist Manager", firstInteraction: "2026-02-20T11:20:00", lastDownload: "2026-03-06T11:20:00", tracksDownloaded: ["Ghost Protocol"], totalDownloads: 1 },
  { id: "c-7", firstName: "Lisa", lastName: "Park", email: "lisa@hybe.com", organization: "HYBE", role: "Creative Director", firstInteraction: "2026-02-15T15:00:00", lastDownload: "2026-03-04T15:00:00", tracksDownloaded: ["Ghost Protocol"], totalDownloads: 1 },
  { id: "c-8", firstName: "Tom", lastName: "Richards", email: "tom@umg.com", organization: "Universal Music", role: "Sync Licensing", firstInteraction: "2026-02-10T09:00:00", lastDownload: "2026-02-10T09:00:00", tracksDownloaded: ["Paper Moons"], totalDownloads: 1 },
  { id: "c-9", firstName: "Elena", lastName: "Vasquez", email: "elena@bmg.com", organization: "BMG Rights", role: "Publisher", firstInteraction: "2026-01-25T14:00:00", lastDownload: "2026-01-25T14:00:00", tracksDownloaded: ["Burning Chrome"], totalDownloads: 1 },
  { id: "c-10", firstName: "Ryan", lastName: "Cooper", email: "ryan@kobalt.com", organization: "Kobalt Music", role: "A&R Scout", firstInteraction: "2026-01-10T10:00:00", lastDownload: "2026-01-10T10:00:00", tracksDownloaded: ["Soft Landing"], totalDownloads: 1 },
  { id: "c-11", firstName: "Mia", lastName: "Zhang", email: "mia@netease.com", organization: "NetEase Music", role: "Playlist Curator", firstInteraction: "2025-12-20T08:00:00", lastDownload: "2025-12-20T08:00:00", tracksDownloaded: ["Velvet Hour"], totalDownloads: 1 },
  { id: "c-12", firstName: "David", lastName: "Kim", email: "david@spotify.com", organization: "Spotify", role: "Editorial Curator", firstInteraction: "2025-12-01T12:00:00", lastDownload: "2025-12-01T12:00:00", tracksDownloaded: ["Ghost Protocol"], totalDownloads: 1 },
];

export function ContactsProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>(demoContacts);

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
