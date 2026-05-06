import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sprout, LogOut, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";

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
                <Link to="/library"><BookmarkCheck className="h-4 w-4 mr-1.5" />Library</Link>
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
