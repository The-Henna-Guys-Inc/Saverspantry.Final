import { useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Home,
  CalendarDays,
  Repeat,
  Refrigerator,
  Tag,
  MoreHorizontal,
  BookmarkCheck,
  Settings as SettingsIcon,
  Shield,
  LogOut,
  
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { BrandMark } from "@/components/BrandMark";

import { toast } from "sonner";

const tabs = [
  { to: "/", label: "Home", Icon: Home, end: true },
  { to: "/planner", label: "Plan", Icon: CalendarDays },
  { to: "/swap", label: "Swap", Icon: Repeat },
  { to: "/pantry", label: "Pantry", Icon: Refrigerator },
  { to: "/deals", label: "Deals", Icon: Tag },
];

export const MobileTabBar = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  if (loading || pathname.startsWith("/auth") || pathname.startsWith("/welcome") || pathname.startsWith("/demo")) return null;

  const signOut = async () => {
    await supabase.auth.signOut();
    setMoreOpen(false);
    toast.success("Signed out");
    navigate("/");
  };

  const itemBase =
    "flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-h-[56px] text-[11px] font-medium transition-colors";

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 bg-background/90 backdrop-blur-md border-t border-border/60 safe-bottom"
    >
      <ul className="grid grid-cols-6 max-w-2xl mx-auto pb-3">
        {tabs.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  itemBase,
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(itemBase, "w-full text-muted-foreground hover:text-foreground")}
                aria-label="More"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="rounded-t-3xl safe-bottom max-h-[85dvh] flex flex-col p-0"
            >
              <SheetHeader className="px-6 pt-6 pb-2 shrink-0">
                <SheetTitle asChild>
                  <div className="flex items-center justify-between gap-3">
                    <BrandMark to="" size="lg" showTagline />
                    <NotificationBell />
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="ghost" className="justify-start rounded-xl h-11" onClick={() => setMoreOpen(false)}>
                    <Link to="/dashboard"><BarChart3 className="h-4 w-4 mr-2" />Stats</Link>
                  </Button>
                  <Button asChild variant="ghost" className="justify-start rounded-xl h-11" onClick={() => setMoreOpen(false)}>
                    <Link to="/library"><BookmarkCheck className="h-4 w-4 mr-2" />Library</Link>
                  </Button>
                  <Button asChild variant="ghost" className="justify-start rounded-xl h-11 col-span-2" onClick={() => setMoreOpen(false)}>
                    <Link to="/settings"><SettingsIcon className="h-4 w-4 mr-2" />Settings</Link>
                  </Button>
                </div>

                {isAdmin && (
                  <>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-2 px-1">Admin</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["/admin/analytics", "Analytics"],
                        ["/admin/users", "Users"],
                        ["/admin/support", "Support"],
                        ["/admin/ai-usage", "AI usage"],
                        ["/admin/alerts", "Alerts"],
                        ["/admin/audit", "Audit log"],
                        ["/admin/sessions", "Sessions"],
                        ["/admin/deals", "Deals review"],
                        ["/admin/email-inbox", "Email inbox"],
                        ["/admin/email-aliases", "Email aliases"],
                        ["/admin/usda-sync", "USDA sync"],
                      ].map(([to, label]) => (
                        <Button key={to} asChild variant="ghost" size="sm" className="justify-start rounded-lg h-10 text-xs" onClick={() => setMoreOpen(false)}>
                          <Link to={to}><Shield className="h-3.5 w-3.5 mr-1.5 shrink-0" />{label}</Link>
                        </Button>
                      ))}
                    </div>
                  </>
                )}

                <Button onClick={signOut} variant="ghost" className="w-full justify-start rounded-xl h-11 text-destructive mt-4">
                  <LogOut className="h-4 w-4 mr-2" />Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
};
