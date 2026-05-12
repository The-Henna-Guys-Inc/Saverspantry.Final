import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { EquivalencyEngine } from "@/components/EquivalencyEngine";
import { useAuth } from "@/hooks/useAuth";

const Demo = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  return (
    <main className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border/60">
        <div className="container max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link to="/welcome" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <BrandMark to="/welcome" size="sm" showTagline />
          <div className="w-10" />
        </div>
      </header>

      <section className="container max-w-3xl mx-auto px-5 pt-6 pb-4 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">Live demo</span>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-primary leading-tight">
          See what makes us different
        </h1>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
          Type a food and portion. We'll suggest cheaper, nutritionally-equivalent swaps in seconds. Try it as much as you like.
        </p>
      </section>

      <section className="container max-w-3xl mx-auto px-5 pb-32">
        <EquivalencyEngine />
      </section>

      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="container max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-2">
          <p className="text-xs text-muted-foreground sm:flex-1 text-center sm:text-left">
            Save your swaps, unlock recipes, pantry tracking and more.
          </p>
          <Button asChild variant="hero" size="lg" className="w-full sm:w-auto h-12 rounded-2xl">
            <Link to="/auth">Create free account</Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default Demo;
