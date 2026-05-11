import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sprout } from "lucide-react";

export const Header = () => {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border/40 safe-top">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 min-h-[44px]">
          <div className="w-8 h-8 rounded-xl bg-gradient-leaf flex items-center justify-center shadow-soft">
            <Sprout className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-primary">ThriftPantry</span>
            <span className="text-[10px] text-muted-foreground hidden sm:block">Eat well, spend less</span>
          </div>
        </Link>

        {loading ? null : !user && (
          <Button asChild variant="hero" size="sm" className="rounded-xl">
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
};
