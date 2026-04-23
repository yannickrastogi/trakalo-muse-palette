import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
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
  pro: string;
  ipi: string;
  publisher: string;
  firstInteraction: string;
  lastDownload: string;
  tracksDownloaded: string[];
  totalDownloads: number;
}

interface ContactsContextValue {
  contacts: Contact[];
  addOrUpdateContact: (data: Omit<Contact, "id" | "workspace_id" | "firstInteraction" | "lastDownload" | "tracksDownloaded" | "totalDownloads"> & { trackName: string }) => void;
  getContact: (email: string) => Contact | undefined;
  upsertCollaborator: (data: { firstName: string; lastName: string; email?: string; pro?: string; ipi?: string; publisher?: string }) => void;
  refreshContacts: () => Promise<void>;
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
    pro: Array.isArray(row.pro) ? (row.pro as string[]).join(", ") : (row.pro as string) || "",
    ipi: (row.ipi as string) || "",
    publisher: (row.publisher as string) || "",
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

      var proArr = data.pro ? data.pro.split(", ").filter(Boolean) : null;
      const { error } = await supabase.rpc("upsert_contact", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _first_name: data.firstName,
        _last_name: data.lastName,
        _email: data.email,
        _role: data.role || null,
        _company: data.organization || null,
        _phone: null,
        _pro: proArr,
        _ipi: data.ipi || null,
        _publisher: data.publisher || null,
      });

      if (error) {
        console.error("Error upserting contact:", error);
        return;
      }

      await fetchContacts();
    },
    [activeWorkspace, user, fetchContacts]
  );

  const upsertCollaborator = useCallback(
    async (data: { firstName: string; lastName: string; email?: string; pro?: string; ipi?: string; publisher?: string }) => {
      if (!activeWorkspace || !user) return;
      var fullName = ((data.firstName || "") + " " + (data.lastName || "")).trim();
      if (!fullName) return;

      // Find existing contact by name (case-insensitive)
      var existing = contacts.find(function (c) {
        var cFull = ((c.firstName || "") + " " + (c.lastName || "")).trim().toLowerCase();
        return cFull === fullName.toLowerCase();
      });

      // Use upsert RPC — handles insert-or-update by email
      var proArray = data.pro ? data.pro.split(", ").filter(Boolean) : null;
      await supabase.rpc("upsert_contact", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _first_name: data.firstName,
        _last_name: data.lastName,
        _email: data.email || null,
        _role: null,
        _company: null,
        _phone: null,
        _pro: proArray,
        _ipi: data.ipi || null,
        _publisher: data.publisher || null,
      });
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
    <ContactsContext.Provider value={useMemo(() => ({ contacts, addOrUpdateContact, getContact, upsertCollaborator, refreshContacts: fetchContacts }), [contacts, addOrUpdateContact, getContact, upsertCollaborator, fetchContacts])}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const ctx = useContext(ContactsContext);
  if (!ctx) throw new Error("useContacts must be used within ContactsProvider");
  return ctx;
}
