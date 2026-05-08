import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sprout, LogOut, BookmarkCheck, CalendarDays, Refrigerator,
  Settings as SettingsIcon, Store as StoreIcon, Tag, BarChart3, Shield, Menu,
} from "lucide-react";
import { toast } from "sonner";
import { SavingsCounter } from "@/components/SavingsCounter";
import { NotificationBell } from "@/components/NotificationBell";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";

const NAV = [
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/pantry", label: "Pantry", icon: Refrigerator },
  { to: "/pantry/calendar", label: "Expiry calendar", icon: CalendarDays },
  { to: "/stores", label: "Stores", icon: StoreIcon },
  { to: "/sales", label: "Sales", icon: Tag },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/library", label: "Library", icon: BookmarkCheck },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export const Header = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

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

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border/40">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-leaf flex items-center justify-center shadow-soft shrink-0">
            <Sprout className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-none min-w-0">
            <span className="font-bold text-primary truncate">ThriftPantry</span>
            <span className="text-[10px] text-muted-foreground hidden sm:block">Eat well, spend less</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {loading ? null : user ? (
            <>
              {NAV.filter(n => n.to !== "/settings").map(({ to, label, icon: Icon }) => (
                <Button key={to} asChild variant="ghost" size="sm" className="rounded-xl">
                  <Link to={to}><Icon className="h-4 w-4 mr-1.5" />{label.split(" ")[0]}</Link>
                </Button>
              ))}
              <SavingsCounter />
              <NotificationBell />
              {isAdmin && (
                <Button asChild variant="ghost" size="sm" className="rounded-xl">
                  <Link to="/admin/analytics"><Shield className="h-4 w-4 mr-1.5" />Admin</Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="icon" className="rounded-xl">
                <Link to="/settings" aria-label="Settings"><SettingsIcon className="h-4 w-4" /></Link>
              </Button>
              <Button onClick={signOut} variant="ghost" size="sm" className="rounded-xl">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button asChild variant="hero" size="sm" className="rounded-xl">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>

        {/* Mobile: bell + hamburger drawer (tab bar handles primary nav) */}
        <div className="flex md:hidden items-center gap-1">
          {loading ? null : user ? (
            <>
              <NotificationBell />
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <SheetHeader>
                    <SheetTitle className="text-primary">Menu</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 flex flex-col gap-1">
                    {NAV.map(({ to, label, icon: Icon }) => (
                      <SheetClose asChild key={to}>
                        <Link
                          to={to}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-secondary transition-smooth"
                        >
                          <Icon className="h-4 w-4 text-primary" />
                          <span>{label}</span>
                        </Link>
                      </SheetClose>
                    ))}
                    {isAdmin && (
                      <SheetClose asChild>
                        <Link to="/admin/analytics"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-secondary">
                          <Shield className="h-4 w-4 text-primary" /><span>Admin analytics</span>
                        </Link>
                      </SheetClose>
                    )}
                    <div className="my-3 border-t border-border/50" />
                    <div className="px-3"><SavingsCounter /></div>
                    <SheetClose asChild>
                      <button onClick={signOut}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-secondary text-left mt-2">
                        <LogOut className="h-4 w-4 text-primary" /><span>Sign out</span>
                      </button>
                    </SheetClose>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <Button asChild variant="hero" size="sm" className="rounded-xl">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
