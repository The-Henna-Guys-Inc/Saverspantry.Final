import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";

const Welcome = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  return (
    <main className="h-[100dvh] bg-gradient-warm flex flex-col items-center justify-between px-6 py-10 overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md w-full">
        <div className="mb-8 scale-150 sm:scale-[1.75]">
          <BrandMark to="" size="lg" showTagline />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-primary leading-tight">
          Eat well,<br />
          <span className="bg-gradient-leaf bg-clip-text text-transparent">Save more.</span>
        </h1>
        <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
          Swap any food for a cheaper alternative with the same nutrition — no diet, no guesswork.
        </p>
      </div>

      <div className="w-full max-w-md space-y-3">
        <Button asChild variant="hero" size="lg" className="w-full h-14 rounded-2xl text-base">
          <Link to="/auth">Create free account</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full h-14 rounded-2xl text-base">
          <Link to="/demo">Try it — no account needed</Link>
        </Button>
        <Link
          to="/auth"
          className="block text-center text-sm text-muted-foreground hover:text-foreground py-2 transition-smooth"
        >
          I have an account
        </Link>
      </div>
    </main>
  );
};

export default Welcome;
