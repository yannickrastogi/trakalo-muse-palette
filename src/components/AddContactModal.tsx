import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectChips } from "@/components/MultiSelectChips";
import { UserPlus, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useContacts, type Contact } from "@/contexts/ContactsContext";
import { autoPopulateAliasesFromSplits } from "@/lib/aliasAutoPopulate";
import { INDUSTRY_ROLES, COUNTRIES, PROS } from "@/lib/constants";

/** Simple freeform multi-chip input — type a value + Enter (or blur) to add as a chip. */
function ChipsInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    setDraft("");
    if (!v) return;
    if (value.some((x) => x.toLowerCase() === v.toLowerCase())) return; // dedup case-insensitive
    onChange([...value, v]);
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-md border border-input bg-background min-h-[40px]">
      {value.map((p) => (
        <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">
          {p}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== p))}
            className="hover:text-destructive transition-colors"
            aria-label={`Remove ${p}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={value.length === 0 ? placeholder : ""}
        className="bg-transparent outline-none flex-1 min-w-[120px] text-sm py-1"
      />
    </div>
  );
}
import { toast } from "sonner";

interface AddContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the modal opens in edit mode and pre-fills all fields. */
  editingContact?: Contact | null;
}

export function AddContactModal({ open, onOpenChange, editingContact }: AddContactModalProps) {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { contacts, refreshContacts, refreshAliases } = useContacts();
  const isEditMode = !!editingContact;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [stageName, setStageName] = useState("");
  const [publishers, setPublishers] = useState<string[]>([]);
  const [ipi, setIpi] = useState("");
  const [pros, setPros] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Pre-fill (or reset) the form when editingContact changes or the modal opens
  useEffect(() => {
    if (open && editingContact) {
      setFullName(((editingContact.firstName || "") + " " + (editingContact.lastName || "")).trim());
      setEmail(editingContact.email || "");
      setRoles((editingContact.role || "").split(",").map((s) => s.trim()).filter(Boolean));
      setCompany(editingContact.organization || "");
      setPhone(editingContact.phone || "");
      setCity(editingContact.city || "");
      setCountry(editingContact.country || "");
      setStageName(editingContact.stageName || "");
      setPublishers((editingContact.publisher || "").split(",").map((s) => s.trim()).filter(Boolean));
      setIpi(editingContact.ipi || "");
      // editingContact.pro is comma-joined on the frontend (mapped from DB text[] in ContactsContext)
      setPros((editingContact.pro || "").split(",").map((s) => s.trim()).filter(Boolean));
    } else if (open && !editingContact) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingContact?.id]);

  function resetForm() {
    setFullName("");
    setEmail("");
    setRoles([]);
    setCompany("");
    setPhone("");
    setCity("");
    setCountry("");
    setStageName("");
    setPublishers([]);
    setIpi("");
    setPros([]);
  }

  function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace || !user) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) return;

    if (!isValidEmail(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Check for duplicate email in workspace (skip in edit mode if email unchanged)
    const duplicate = contacts.find((c) =>
      c.email.toLowerCase() === trimmedEmail && c.id !== editingContact?.id
    );
    if (duplicate) {
      toast.error("A contact with this email already exists");
      return;
    }

    setSaving(true);

    // Split name into first/last (split on first space)
    const spaceIdx = trimmedName.indexOf(" ");
    const firstName = spaceIdx > 0 ? trimmedName.slice(0, spaceIdx) : trimmedName;
    const lastName = spaceIdx > 0 ? trimmedName.slice(spaceIdx + 1) : "";

    // Build shared field set from local state (now first-class in the UI for both add + edit modes)
    const cleanFirstName = firstName;
    const cleanLastName = lastName || null;
    const cleanRole = roles.length > 0 ? roles.join(", ") : null;
    const cleanCompany = company.trim() || null;
    const cleanPhone = phone.trim() || null;
    const cleanStageName = stageName.trim() || null;
    const cleanPublisher = publishers.length > 0 ? publishers.join(", ") : null;
    const cleanIpi = ipi.trim() || null;
    const cleanPros = pros.length > 0 ? pros : null; // DB column is text[] — pass array directly
    const cleanCity = city.trim() || null;
    const cleanCountry = country || null;

    let error: unknown = null;
    if (isEditMode && editingContact) {
      const res = await supabase.rpc("update_contact", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _contact_id: editingContact.id,
        _first_name: cleanFirstName,
        _last_name: cleanLastName,
        _email: trimmedEmail,
        _role: cleanRole,
        _company: cleanCompany,
        _phone: cleanPhone,
        _pro: cleanPros,
        _ipi: cleanIpi,
        _publisher: cleanPublisher,
        _stage_name: cleanStageName,
        _city: cleanCity,
        _country: cleanCountry,
      });
      error = res.error;
    } else {
      const res = await supabase.rpc("add_contact_manual", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _first_name: cleanFirstName,
        _last_name: cleanLastName,
        _email: trimmedEmail,
        _role: cleanRole,
        _company: cleanCompany,
        _phone: cleanPhone,
        _pro: cleanPros,
        _ipi: cleanIpi,
        _publisher: cleanPublisher,
        _stage_name: cleanStageName,
        _city: cleanCity,
        _country: cleanCountry,
      });
      error = res.error;
    }

    setSaving(false);

    if (error) {
      const err = error as { code?: string };
      // Handle unique constraint violation from DB
      if (err.code === "23505") {
        toast.error("A contact with this email already exists");
      } else {
        toast.error(isEditMode ? "Failed to update contact" : "Failed to add contact");
        console.error(isEditMode ? "Error updating contact:" : "Error adding contact:", error);
      }
      return;
    }

    // Sync to Artist Aliases: a distinct stage_name implies a real-name → alias
    // mapping. Fire-and-forget, silent (uses local consts — resetForm clears state).
    const fullNameForAlias = (cleanFirstName + " " + (cleanLastName || "")).trim();
    if (cleanStageName && cleanStageName.toLowerCase() !== fullNameForAlias.toLowerCase()) {
      autoPopulateAliasesFromSplits({
        splits: [{ name: fullNameForAlias, email: trimmedEmail || undefined, stage_name: cleanStageName }],
        workspaceId: activeWorkspace.id,
        userId: user.id,
      })
        .then(function () { refreshAliases(); })
        .catch(function () {});
    }

    toast.success(isEditMode ? "Contact updated successfully" : "Contact added successfully");
    resetForm();
    onOpenChange(false);
    await refreshContacts();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? <Pencil className="w-5 h-5 text-brand-orange" /> : <UserPlus className="w-5 h-5 text-brand-orange" />}
            {isEditMode ? "Edit Contact" : "Add Contact"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2 max-h-[75vh] overflow-y-auto pr-1">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="ac-name">Full Name *</Label>
            <Input
              id="ac-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="ac-email">Email *</Label>
            <Input
              id="ac-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              required
            />
          </div>

          {/* Roles — multi-select (a contact may have several industry roles, e.g. "Artist, Songwriter") */}
          <div className="space-y-1.5">
            <Label>Role</Label>
            <MultiSelectChips
              options={INDUSTRY_ROLES}
              selected={roles}
              onChange={setRoles}
              placeholder="Select one or more roles"
              filterable
            />
          </div>

          {/* Company */}
          <div className="space-y-1.5">
            <Label htmlFor="ac-company">Company</Label>
            <Input
              id="ac-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Label / Agency / Studio"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="ac-phone">Phone</Label>
            <Input
              id="ac-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
            />
          </div>

          {/* City + Country */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ac-city">City</Label>
              <Input
                id="ac-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="London"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stage Name + IPI (compact pair) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ac-stage">Stage Name</Label>
              <Input
                id="ac-stage"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="e.g. KNY Factory"
              />
              <p className="text-xs text-muted-foreground">Artist or stage name — auto-creates an alias</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-ipi">IPI</Label>
              <Input
                id="ac-ipi"
                value={ipi}
                onChange={(e) => setIpi(e.target.value)}
                placeholder="e.g. 00528847833"
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Publisher — freeform multi-chip */}
          <div className="space-y-1.5">
            <Label>Publisher</Label>
            <ChipsInput
              value={publishers}
              onChange={setPublishers}
              placeholder="Add publisher and press Enter"
            />
          </div>

          {/* PROs — multi-select filterable from INDUSTRY-known list */}
          <div className="space-y-1.5">
            <Label>PROs</Label>
            <MultiSelectChips
              options={PROS}
              selected={pros}
              onChange={setPros}
              placeholder="Select one or more PROs"
              filterable
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !fullName.trim() || !email.trim()}
              className="px-5 py-2 rounded-xl text-[13px] font-semibold bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 hover:from-orange-600 hover:via-pink-600 hover:to-purple-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (isEditMode ? "Saving..." : "Adding...") : (isEditMode ? "Save Changes" : "Add Contact")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
