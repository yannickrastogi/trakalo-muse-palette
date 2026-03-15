import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import type { WorkspaceScoped } from "@/types/workspace";

export interface Contact extends WorkspaceScoped {
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
  addOrUpdateContact: (data: Omit<Contact, "id" | "workspace_id" | "firstInteraction" | "lastDownload" | "tracksDownloaded" | "totalDownloads"> & { trackName: string }) => void;
  getContact: (email: string) => Contact | undefined;
}

const ContactsContext = createContext<ContactsContextValue | null>(null);

function mapRowToContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    workspace_id: row.workspace_id as string,
    firstName: (row.first_name as string) || "",
    lastName: (row.last_name as string) || "",
    email: (row.email as string) || "",
    organization: (row.company as string) || "",
    role: (row.role as string) || "",
    firstInteraction: (row.created_at as string) || "",
    lastDownload: (row.updated_at as string) || "",
    tracksDownloaded: [],
    totalDownloads: 0,
  };
}

export function ContactsProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);

  const fetchContacts = useCallback(async () => {
    if (!activeWorkspace || !user) {
      setContacts([]);
      return;
    }

    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("workspace_id", activeWorkspace.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching contacts:", error);
      setContacts([]);
    } else {
      setContacts((data || []).map((row) => mapRowToContact(row as unknown as Record<string, unknown>)));
    }
  }, [activeWorkspace, user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const addOrUpdateContact = useCallback(
    async (data: Omit<Contact, "id" | "workspace_id" | "firstInteraction" | "lastDownload" | "tracksDownloaded" | "totalDownloads"> & { trackName: string }) => {
      if (!activeWorkspace || !user) return;

      // Check if a contact with this email already exists in this workspace
      const existing = contacts.find(
        (c) => c.email.toLowerCase() === data.email.toLowerCase()
      );

      if (existing) {
        // Update existing contact
        const { error } = await supabase
          .from("contacts")
          .update({
            first_name: data.firstName,
            last_name: data.lastName,
            company: data.organization,
            role: data.role,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) {
          console.error("Error updating contact:", error);
          return;
        }
      } else {
        // Insert new contact
        const { error } = await supabase
          .from("contacts")
          .insert({
            workspace_id: activeWorkspace.id,
            created_by: user.id,
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email,
            company: data.organization,
            role: data.role,
          });

        if (error) {
          console.error("Error adding contact:", error);
          return;
        }
      }

      // Refresh contacts from Supabase
      await fetchContacts();
    },
    [activeWorkspace, user, contacts, fetchContacts]
  );

  const getContact = useCallback(
    (email: string) => {
      return contacts.find((c) => c.email.toLowerCase() === email.toLowerCase());
    },
    [contacts]
  );

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
