import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Loader2, Repeat } from "lucide-react";
import { EquivalencyEngine } from "@/components/EquivalencyEngine";

const Swap = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <Repeat className="h-3.5 w-3.5" /> Swap
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">Same nutrition. Less money.</h1>
        <p className="text-muted-foreground mb-6">
          Enter a food and we'll suggest cheaper alternatives that match the protein and calories.
        </p>
        <EquivalencyEngine />
      </div>
    </main>
  );
};

export default Swap;
