import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useContacts, type Contact } from "@/contexts/ContactsContext";
import { INDUSTRY_ROLES, COUNTRIES } from "@/lib/constants";
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
  const { contacts, refreshContacts } = useContacts();
  const isEditMode = !!editingContact;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill (or reset) the form when editingContact changes or the modal opens
  useEffect(() => {
    if (open && editingContact) {
      setFullName(((editingContact.firstName || "") + " " + (editingContact.lastName || "")).trim());
      setEmail(editingContact.email || "");
      setRole(editingContact.role || "");
      setCompany(editingContact.organization || "");
      setPhone(editingContact.phone || "");
      setCity(editingContact.city || "");
      setCountry(editingContact.country || "");
    } else if (open && !editingContact) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingContact?.id]);

  function resetForm() {
    setFullName("");
    setEmail("");
    setRole("");
    setCompany("");
    setPhone("");
    setCity("");
    setCountry("");
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

    let error: unknown = null;
    if (isEditMode && editingContact) {
      // Preserve fields not exposed in this modal — sending null would silently overwrite DB values.
      // pro is stored as text[] in DB; mapped to comma-string in app — split back to array on update.
      const preservedPro = editingContact.pro
        ? editingContact.pro.split(",").map((s) => s.trim()).filter(Boolean)
        : null;
      const res = await supabase.rpc("update_contact", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _contact_id: editingContact.id,
        _first_name: firstName,
        _last_name: lastName || null,
        _email: trimmedEmail,
        _role: role || null,
        _company: company.trim() || null,
        _phone: phone.trim() || null,
        _pro: preservedPro,
        _ipi: editingContact.ipi || null,
        _publisher: editingContact.publisher || null,
        _stage_name: editingContact.stageName || null,
        _city: city.trim() || null,
        _country: country || null,
      });
      error = res.error;
    } else {
      const res = await supabase.rpc("add_contact_manual", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _first_name: firstName,
        _last_name: lastName || null,
        _email: trimmedEmail,
        _role: role || null,
        _company: company.trim() || null,
        _phone: phone.trim() || null,
        _pro: null,
        _ipi: null,
        _publisher: null,
        _city: city.trim() || null,
        _country: country || null,
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
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
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

          {/* Role */}
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
