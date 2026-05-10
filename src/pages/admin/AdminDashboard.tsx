import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import OverviewTab from "@/components/admin/OverviewTab";
import WaitlistTab from "@/components/admin/WaitlistTab";
import ContactsTab from "@/components/admin/ContactsTab";

export default function AdminDashboard() {
  const { user, session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [verified, setVerified] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (loading) return;
    if (!session?.user?.id) {
      navigate("/", { replace: true });
      return;
    }
    let cancelled = false;
    supabase
      .rpc("is_platform_admin", { _user_id: session.user.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || data !== true) {
          toast.error("Access denied — not a platform admin");
          signOut();
          return;
        }
        setVerified(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, session?.user?.id, navigate, signOut]);

  if (loading || !verified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight gradient-text font-[Sora]">TRAKALOG</span>
            <span className="text-xs font-bold tracking-[0.3em] text-orange-500 uppercase">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[200px]">
              {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-1.5 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="waitlist" className="mt-0">
            <WaitlistTab />
          </TabsContent>

          <TabsContent value="contacts" className="mt-0">
            <ContactsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
