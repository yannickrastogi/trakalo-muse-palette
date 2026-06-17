import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import type { WorkspaceScoped } from "@/types/workspace";
import { toast } from "sonner";

export interface Contact extends WorkspaceScoped {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  role: string;
  stageName: string;
  pro: string;
  ipi: string;
  publisher: string;
  phone: string;
  city: string;
  country: string;
  firstInteraction: string;
  lastDownload: string;
  tracksDownloaded: string[];
  totalDownloads: number;
}

export interface ArtistAlias {
  id: string;
  workspace_id: string;
  alias_name: string;
  contact_ids: string[];
  created_at: string;
  updated_at: string;
}

interface ContactsContextValue {
  contacts: Contact[];
  aliases: ArtistAlias[];
  addOrUpdateContact: (data: Omit<Contact, "id" | "workspace_id" | "firstInteraction" | "lastDownload" | "tracksDownloaded" | "totalDownloads"> & { trackName: string }) => void;
  getContact: (email: string) => Contact | undefined;
  upsertCollaborator: (data: { firstName: string; lastName: string; email?: string; role?: string; stageName?: string; pro?: string; ipi?: string; publisher?: string }) => void;
  refreshContacts: () => Promise<void>;
  refreshAliases: () => Promise<void>;
  upsertAlias: (aliasId: string | null, aliasName: string, contactIds: string[]) => Promise<boolean>;
  deleteAlias: (aliasId: string) => Promise<boolean>;
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
    stageName: (row.stage_name as string) || "",
    pro: Array.isArray(row.pro) ? (row.pro as string[]).join(", ") : (row.pro as string) || "",
    ipi: (row.ipi as string) || "",
    publisher: (row.publisher as string) || "",
    phone: (row.phone as string) || "",
    city: (row.city as string) || "",
    country: (row.country as string) || "",
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
  const [aliases, setAliases] = useState<ArtistAlias[]>([]);

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

  const fetchAliases = useCallback(async () => {
    if (!activeWorkspace || !user) {
      setAliases([]);
      return;
    }
    const { data, error } = await supabase
      .from("artist_aliases")
      .select("id, workspace_id, alias_name, contact_ids, created_at, updated_at")
      .eq("workspace_id", activeWorkspace.id)
      .order("alias_name", { ascending: true });
    if (error) {
      // Silent dégradation : table absente (migration non appliquée) ou RLS — pas d'erreur fatale
      console.warn("Error fetching artist aliases:", error.message);
      setAliases([]);
    } else {
      setAliases((data || []) as ArtistAlias[]);
    }
  }, [activeWorkspace, user]);

  useEffect(() => {
    fetchContacts();
    fetchAliases();
  }, [fetchContacts, fetchAliases]);

  const upsertAlias = useCallback(
    async (aliasId: string | null, aliasName: string, contactIds: string[]): Promise<boolean> => {
      if (!activeWorkspace || !user) return false;
      const trimmed = aliasName.trim();
      if (!trimmed) {
        toast.error("Alias name is required");
        return false;
      }
      const { error } = await supabase.rpc("upsert_artist_alias", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _alias_id: aliasId,
        _alias_name: trimmed,
        _contact_ids: contactIds,
      });
      if (error) {
        console.error("Error upserting alias:", error);
        toast.error("Failed to save alias");
        return false;
      }
      await fetchAliases();
      return true;
    },
    [activeWorkspace, user, fetchAliases]
  );

  const deleteAlias = useCallback(
    async (aliasId: string): Promise<boolean> => {
      if (!user) return false;
      const { error } = await supabase.rpc("delete_artist_alias", {
        _user_id: user.id,
        _alias_id: aliasId,
      });
      if (error) {
        console.error("Error deleting alias:", error);
        toast.error("Failed to delete alias");
        return false;
      }
      await fetchAliases();
      return true;
    },
    [user, fetchAliases]
  );

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
    async (data: { firstName: string; lastName: string; email?: string; role?: string; stageName?: string; pro?: string; ipi?: string; publisher?: string }) => {
      if (!activeWorkspace || !user) return;
      var fullName = ((data.firstName || "") + " " + (data.lastName || "")).trim();
      if (!fullName) return;

      // Use upsert RPC — handles insert-or-update by name
      var proArray = data.pro ? data.pro.split(", ").filter(Boolean) : null;
      await supabase.rpc("upsert_contact", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _first_name: data.firstName,
        _last_name: data.lastName,
        _email: data.email || null,
        _role: data.role || null,
        _stage_name: data.stageName || null,
        _company: null,
        _phone: null,
        _pro: proArray,
        _ipi: data.ipi || null,
        _publisher: data.publisher || null,
      });
      await fetchContacts();
    },
    [activeWorkspace, user, fetchContacts]
  );

  const getContact = useCallback(
    (email: string) => {
      return contacts.find((c) => c.email.toLowerCase() === email.toLowerCase());
    },
    [contacts]
  );

  return (
    <ContactsContext.Provider value={useMemo(() => ({
      contacts,
      aliases,
      addOrUpdateContact,
      getContact,
      upsertCollaborator,
      refreshContacts: fetchContacts,
      refreshAliases: fetchAliases,
      upsertAlias,
      deleteAlias,
    }), [contacts, aliases, addOrUpdateContact, getContact, upsertCollaborator, fetchContacts, fetchAliases, upsertAlias, deleteAlias])}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const ctx = useContext(ContactsContext);
  if (!ctx) throw new Error("useContacts must be used within ContactsProvider");
  return ctx;
}
