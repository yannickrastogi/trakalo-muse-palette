import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useContacts } from "@/contexts/ContactsContext";
import { INDUSTRY_ROLES, PROS } from "@/lib/constants";
import { toast } from "sonner";

interface AddContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddContactModal({ open, onOpenChange }: AddContactModalProps) {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { contacts, refreshContacts } = useContacts();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [pro, setPro] = useState("");
  const [ipi, setIpi] = useState("");
  const [publisher, setPublisher] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setFullName("");
    setEmail("");
    setRole("");
    setCompany("");
    setPhone("");
    setPro("");
    setIpi("");
    setPublisher("");
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

    // Check for duplicate email in workspace
    const duplicate = contacts.find(
      (c) => c.email.toLowerCase() === trimmedEmail
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

    const { error } = await supabase.from("contacts").insert({
      workspace_id: activeWorkspace.id,
      created_by: user.id,
      first_name: firstName,
      last_name: lastName || null,
      email: trimmedEmail,
      role: role || null,
      company: company.trim() || null,
      phone: phone.trim() || null,
      pro: pro || null,
      ipi: ipi.trim() || null,
      publisher: publisher.trim() || null,
    });

    setSaving(false);

    if (error) {
      // Handle unique constraint violation from DB
      if (error.code === "23505") {
        toast.error("A contact with this email already exists");
      } else {
        toast.error("Failed to add contact");
        console.error("Error adding contact:", error);
      }
      return;
    }

    toast.success("Contact added successfully");
    resetForm();
    onOpenChange(false);
    await refreshContacts();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-brand-orange" />
            Add Contact
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

          {/* PRO */}
          <div className="space-y-1.5">
            <Label>PRO</Label>
            <Select value={pro} onValueChange={setPro}>
              <SelectTrigger>
                <SelectValue placeholder="Select PRO" />
              </SelectTrigger>
              <SelectContent>
                {PROS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* IPI */}
          <div className="space-y-1.5">
            <Label htmlFor="ac-ipi">IPI Number</Label>
            <Input
              id="ac-ipi"
              value={ipi}
              onChange={(e) => setIpi(e.target.value)}
              placeholder="00000000000"
            />
          </div>

          {/* Publisher */}
          <div className="space-y-1.5">
            <Label htmlFor="ac-publisher">Publisher</Label>
            <Input
              id="ac-publisher"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              placeholder="Publisher name"
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
              {saving ? "Adding..." : "Add Contact"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
