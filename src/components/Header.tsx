import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sprout, LogOut, BookmarkCheck, CalendarDays, Refrigerator, Settings as SettingsIcon, Store as StoreIcon, Tag } from "lucide-react";
import { toast } from "sonner";
import { SavingsCounter } from "@/components/SavingsCounter";

export const Header = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border/40">
      <div className="container max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-leaf flex items-center justify-center shadow-soft">
            <Sprout className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-primary">NutriSwap</span>
        </Link>

        <nav className="flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="rounded-xl">
                <Link to="/planner"><CalendarDays className="h-4 w-4 mr-1.5" />Planner</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="rounded-xl">
                <Link to="/pantry"><Refrigerator className="h-4 w-4 mr-1.5" />Pantry</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="rounded-xl">
                <Link to="/pantry/calendar"><CalendarDays className="h-4 w-4 mr-1.5" />Expiry</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="rounded-xl">
                <Link to="/stores"><StoreIcon className="h-4 w-4 mr-1.5" />Stores</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="rounded-xl">
                <Link to="/sales"><Tag className="h-4 w-4 mr-1.5" />Sales</Link>
              </Button>
              <SavingsCounter />
              <Button asChild variant="ghost" size="sm" className="rounded-xl">
                <Link to="/library"><BookmarkCheck className="h-4 w-4 mr-1.5" />Library</Link>
              </Button>
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
      </div>
    </header>
  );
};
