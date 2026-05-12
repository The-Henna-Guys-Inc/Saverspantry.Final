import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, LogOut, BookmarkCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const Header = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/");
  };

  const initial = (user?.email?.[0] ?? "?").toUpperCase();

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border/40 safe-top">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center min-h-[44px]" aria-label="ThriftPantry home">
          <div className="flex flex-col leading-tight">
            <span className="text-xl sm:text-2xl font-bold text-primary tracking-tight">
              Thrift<span className="text-accent">Pantry</span>
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground -mt-0.5">
              Eat well, spend less
            </span>
          </div>
        </Link>

        {loading ? null : !user ? (
          <Button asChild variant="hero" size="sm" className="rounded-xl">
            <Link to="/auth">Sign in</Link>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Account menu"
                className="w-10 h-10 rounded-full bg-gradient-leaf text-primary-foreground font-semibold flex items-center justify-center shadow-soft hover:shadow-glow transition-smooth"
              >
                {initial}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings"><SettingsIcon className="h-4 w-4 mr-2" />Profile & settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/library"><BookmarkCheck className="h-4 w-4 mr-2" />Library</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};
