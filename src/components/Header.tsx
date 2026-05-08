import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sprout,
  LogOut,
  BookmarkCheck,
  CalendarDays,
  Refrigerator,
  Settings as SettingsIcon,
  Store as StoreIcon,
  Tag,
  BarChart3,
  Shield,
  Menu,
} from "lucide-react";
import { toast } from "sonner";
import { SavingsCounter } from "@/components/SavingsCounter";
import { NotificationBell } from "@/components/NotificationBell";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const Header = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/");
  };

  const navItems: NavItem[] = [
    { to: "/planner", label: "Planner", icon: CalendarDays },
    { to: "/pantry", label: "Pantry", icon: Refrigerator },
    { to: "/pantry/calendar", label: "Expiry", icon: CalendarDays },
    { to: "/stores", label: "Stores", icon: StoreIcon },
    { to: "/sales", label: "Sales", icon: Tag },
    { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { to: "/library", label: "Library", icon: BookmarkCheck },
  ];

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border/40">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-leaf flex items-center justify-center shadow-soft shrink-0">
            <Sprout className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-none min-w-0">
            <span className="font-bold text-primary truncate">ThriftPantry</span>
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              Eat well, spend less
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {loading ? null : user ? (
            <>
              {navItems.slice(0, 5).map((item) => (
                <Button
                  key={item.to}
                  asChild
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                >
                  <Link to={item.to}>
                    <item.icon className="h-4 w-4 mr-1.5" />
                    {item.label}
                  </Link>
                </Button>
              ))}
              <SavingsCounter />
              <Button asChild variant="ghost" size="sm" className="rounded-xl">
                <Link to="/dashboard">
                  <BarChart3 className="h-4 w-4 mr-1.5" />
                  Dashboard
                </Link>
              </Button>
              <NotificationBell />
              {isAdmin && (
                <Button asChild variant="ghost" size="sm" className="rounded-xl">
                  <Link to="/admin/analytics">
                    <Shield className="h-4 w-4 mr-1.5" />
                    Admin
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm" className="rounded-xl">
                <Link to="/library">
                  <BookmarkCheck className="h-4 w-4 mr-1.5" />
                  Library
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" className="rounded-xl">
                <Link to="/settings" aria-label="Settings">
                  <SettingsIcon className="h-4 w-4" />
                </Link>
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

        {/* Mobile / tablet header actions */}
        <div className="flex lg:hidden items-center gap-1">
          {loading ? null : user ? (
            <>
              <NotificationBell />
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl"
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85%] sm:w-80 p-0 flex flex-col">
                  <SheetHeader className="p-5 border-b border-border/40 text-left">
                    <SheetTitle className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-leaf flex items-center justify-center shadow-soft">
                        <Sprout className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="font-bold text-primary">ThriftPantry</span>
                        <span className="text-[10px] font-normal text-muted-foreground">
                          Eat well, spend less
                        </span>
                      </div>
                    </SheetTitle>
                  </SheetHeader>

                  <div className="px-5 py-4 border-b border-border/40">
                    <SavingsCounter />
                  </div>

                  <nav className="flex-1 overflow-y-auto p-3">
                    <ul className="flex flex-col gap-1">
                      {navItems.map((item) => {
                        const active = location.pathname === item.to;
                        return (
                          <li key={item.to}>
                            <SheetClose asChild>
                              <Link
                                to={item.to}
                                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                                  active
                                    ? "bg-primary/10 text-primary"
                                    : "text-foreground hover:bg-muted"
                                }`}
                              >
                                <item.icon className="h-5 w-5" />
                                {item.label}
                              </Link>
                            </SheetClose>
                          </li>
                        );
                      })}
                      {isAdmin && (
                        <li>
                          <SheetClose asChild>
                            <Link
                              to="/admin/analytics"
                              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted"
                            >
                              <Shield className="h-5 w-5" />
                              Admin
                            </Link>
                          </SheetClose>
                        </li>
                      )}
                      <li>
                        <SheetClose asChild>
                          <Link
                            to="/settings"
                            className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted"
                          >
                            <SettingsIcon className="h-5 w-5" />
                            Settings
                          </Link>
                        </SheetClose>
                      </li>
                    </ul>
                  </nav>

                  <div className="p-4 border-t border-border/40">
                    <Button
                      onClick={signOut}
                      variant="outline"
                      className="w-full rounded-xl"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
                    </Button>
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

      {/* Mobile bottom tab bar */}
      {user && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/40 safe-bottom">
          <ul className="grid grid-cols-5 h-16">
            {[
              { to: "/planner", label: "Plan", icon: CalendarDays },
              { to: "/pantry", label: "Pantry", icon: Refrigerator },
              { to: "/sales", label: "Sales", icon: Tag },
              { to: "/dashboard", label: "Stats", icon: BarChart3 },
              { to: "/library", label: "Saved", icon: BookmarkCheck },
            ].map((item) => {
              const active = location.pathname === item.to;
              return (
                <li key={item.to} className="flex">
                  <Link
                    to={item.to}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
};
