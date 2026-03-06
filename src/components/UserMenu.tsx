import { useState } from "react";
import { User, LogOut, Settings, CreditCard, ChevronDown } from "lucide-react";

export function UserMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange via-brand-pink to-brand-purple flex items-center justify-center text-xs font-bold text-primary-foreground">
          JD
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-popover border border-border rounded-xl shadow-lg z-50 p-1.5">
            <div className="px-3 py-2 border-b border-border mb-1">
              <p className="text-sm font-medium text-foreground">John Doe</p>
              <p className="text-xs text-muted-foreground">john@trakalog.com</p>
            </div>
            {[
              { icon: User, label: "Profile" },
              { icon: Settings, label: "Settings" },
              { icon: CreditCard, label: "Billing" },
            ].map((item) => (
              <button
                key={item.label}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary rounded-lg transition-colors"
              >
                <item.icon className="w-4 h-4 text-muted-foreground" />
                {item.label}
              </button>
            ))}
            <div className="border-t border-border mt-1 pt-1">
              <button className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-destructive hover:bg-secondary rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
