import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Search, Check, Users } from "lucide-react";
import { useContacts, type ArtistAlias, type Contact } from "@/contexts/ContactsContext";
import { EmptyState } from "@/components/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ArtistAliasesTab() {
  const { aliases, contacts, upsertAlias, deleteAlias } = useContacts();
  const [editing, setEditing] = useState<ArtistAlias | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArtistAlias | null>(null);
  const [deleting, setDeleting] = useState(false);

  const contactById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const c of contacts) map.set(c.id, c);
    return map;
  }, [contacts]);

  const formatContact = (c: Contact) => {
    const fullName = ((c.firstName || "") + " " + (c.lastName || "")).trim();
    return c.stageName || fullName || c.email || "—";
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteAlias(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground max-w-2xl">
          Map an artist or group name (e.g. <span className="text-foreground font-medium">"Banx &amp; Ranx"</span>) to one or more
          contacts. The upload modal uses these to suggest the right splits automatically.
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 hover:from-orange-600 hover:via-pink-600 hover:to-purple-600 text-white shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Alias
        </button>
      </div>

      {aliases.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No aliases yet"
          description='Create your first alias so Trakalog knows that "Banx & Ranx" means Yannick + Zacharie, not two unknown collaborators.'
          actionLabel="New Alias"
          onAction={() => setEditing("new")}
        />
      ) : (
        <div className="card-premium overflow-hidden divide-y divide-border/40">
          {aliases.map((alias) => {
            const mapped = alias.contact_ids
              .map((id) => contactById.get(id))
              .filter((c): c is Contact => Boolean(c));
            return (
              <div key={alias.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{alias.alias_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    →{" "}
                    {mapped.length > 0
                      ? mapped.map(formatContact).join(", ")
                      : <span className="italic">No contacts linked</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditing(alias)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Edit alias"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(alias)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Delete alias"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <AliasModal
          alias={editing === "new" ? null : editing}
          contacts={contacts}
          onClose={() => setEditing(null)}
          onSave={async (name, ids) => {
            const ok = await upsertAlias(editing === "new" ? null : editing.id, name, ids);
            if (ok) setEditing(null);
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete alias?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.alias_name}" will be removed. The underlying contacts stay untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface AliasModalProps {
  alias: ArtistAlias | null;
  contacts: Contact[];
  onClose: () => void;
  onSave: (name: string, ids: string[]) => Promise<void> | void;
}

function AliasModal({ alias, contacts, onClose, onSave }: AliasModalProps) {
  const [name, setName] = useState(alias?.alias_name || "");
  const [ids, setIds] = useState<string[]>(alias?.contact_ids ? [...alias.contact_ids] : []);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const full = ((c.firstName || "") + " " + (c.lastName || "")).toLowerCase();
      return (
        full.includes(q) ||
        (c.stageName || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search]);

  const toggle = (id: string) => {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(name.trim(), ids);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {alias ? "Edit Alias" : "New Alias"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
              Alias name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Banx & Ranx"'
              className="h-10 w-full px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
              Linked contacts ({ids.length})
            </label>
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 border border-border focus-within:border-brand-orange/30 transition-all">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts…"
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-secondary/40 divide-y divide-border/30">
              {filteredContacts.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No contacts match "{search}"
                </p>
              ) : (
                filteredContacts.map((c) => {
                  const checked = ids.includes(c.id);
                  const display = ((c.firstName || "") + " " + (c.lastName || "")).trim() || c.email || "—";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={display + (c.stageName ? " (" + c.stageName + ")" : "")}
                      onClick={() => toggle(c.id)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-secondary/80 transition-colors"
                    >
                      <span
                        aria-hidden="true"
                        className={
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors " +
                          (checked
                            ? "border-brand-orange bg-brand-orange text-white"
                            : "border-border bg-card")
                        }
                      >
                        {checked && <Check className="w-3 h-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-foreground font-medium truncate">{display}</span>
                        {c.stageName && (
                          <span className="block text-2xs text-muted-foreground truncate">{c.stageName}</span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/30">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 hover:from-orange-600 hover:via-pink-600 hover:to-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? "Saving…" : alias ? "Save" : "Create alias"}
          </button>
        </div>
      </div>
    </div>
  );
}
