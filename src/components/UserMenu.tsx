import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Settings, CreditCard, ChevronDown, Shield, Eye, Send, Edit3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRole, type AccessLevel } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";

const ACCESS_LEVELS: { level: AccessLevel; icon: typeof Eye; label: string }[] = [
  { level: "admin", icon: Shield, label: "Admin" },
  { level: "editor", icon: Edit3, label: "Editor" },
  { level: "pitcher", icon: Send, label: "Pitcher" },
  { level: "viewer", icon: Eye, label: "Viewer" },
];

const accessLevelColors: Record<AccessLevel, string> = {
  admin: "bg-brand-orange/12 text-brand-orange",
  editor: "bg-brand-purple/12 text-brand-purple",
  pitcher: "bg-brand-pink/12 text-brand-pink",
  viewer: "bg-muted-foreground/12 text-muted-foreground",
};

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const { t } = useTranslation();
  const { accessLevel, professionalTitle, setRole } = useRole();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const firstName = user?.user_metadata?.first_name || "";
  const lastName = user?.user_metadata?.last_name || "";
  const fullName = (firstName + " " + lastName).trim() || user?.email?.split("@")[0] || "";
  const email = user?.email || "";
  const avatarUrl = user?.user_metadata?.avatar_url || null;
  const initials = ((firstName[0] || user?.email?.[0] || "") + (lastName[0] || "")).toUpperCase() || "?";

  const currentLevelConfig = ACCESS_LEVELS.find(function (l) { return l.level === accessLevel; }) || ACCESS_LEVELS[0];
  var CurrentIcon = currentLevelConfig.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-secondary/80 transition-colors"
      >
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-primary-foreground btn-brand overflow-hidden" style={{ boxShadow: "none" }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setRoleMenuOpen(false); }} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-popover border border-border rounded-xl z-50 p-1.5 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-elevated)" }}>
            <div className="px-3 py-3 border-b border-border mb-1.5">
              <p className="text-[13px] font-semibold text-foreground tracking-tight">{fullName}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{email}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider " + accessLevelColors[accessLevel]}>
                  <CurrentIcon className="w-2.5 h-2.5" />
                  {currentLevelConfig.label}
                </span>
                {professionalTitle && (
                  <span className="text-2xs text-muted-foreground">{professionalTitle}</span>
                )}
              </div>
            </div>

            {/* Access level switcher (for testing) */}
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-secondary-foreground hover:bg-secondary rounded-lg transition-colors font-medium"
              >
                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                Switch Access Level
                <ChevronDown className={`w-3 h-3 text-muted-foreground ml-auto transition-transform ${roleMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {roleMenuOpen && (
                <div className="mt-1 mx-1 p-1 bg-secondary/50 rounded-lg max-h-48 overflow-y-auto">
                  {ACCESS_LEVELS.map(function (item) {
                    var ItemIcon = item.icon;
                    var isActive = item.level === accessLevel;
                    return (
                      <button
                        key={item.level}
                        onClick={function () {
                          // Use setRole with mapped AppRole for testing
                          var roleMap: Record<string, string> = { admin: "Admin", editor: "Manager", pitcher: "Publisher", viewer: "Viewer" };
                          setRole(roleMap[item.level] as any);
                          setRoleMenuOpen(false);
                          setOpen(false);
                        }}
                        className={"flex items-center gap-2 w-full px-2.5 py-1.5 text-[12px] rounded-md transition-colors font-medium " +
                          (isActive ? "bg-primary/12 text-primary" : "text-secondary-foreground hover:bg-secondary")
                        }
                      >
                        <ItemIcon className="w-3 h-3" />
                        {item.label}
                        {isActive && <span className="ml-auto text-primary text-[10px]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-border mt-1.5 pt-1.5">
              {[
                { icon: User, label: t("userMenu.profile"), path: "/settings" },
                { icon: Settings, label: t("userMenu.settings"), path: "/settings" },
                { icon: CreditCard, label: t("userMenu.billing"), path: "/settings" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => { navigate(item.path); setOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-secondary-foreground hover:bg-secondary rounded-lg transition-colors font-medium"
                >
                  <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  {item.label}
                </button>
              ))}
            </div>
            <div className="border-t border-border mt-1.5 pt-1.5">
              <button
                onClick={() => { signOut(); setOpen(false); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-destructive hover:bg-destructive/8 rounded-lg transition-colors font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t("userMenu.signOut")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
