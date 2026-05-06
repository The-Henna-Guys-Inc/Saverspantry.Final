import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Trash2, Sparkles, ArrowLeftRight, ChefHat } from "lucide-react";
import { toast } from "sonner";

type Row = { id: string; created_at: string; query?: string; food?: string; result?: any; recipe?: any };

const Library = () => {
  const { user, loading: authLoading } = useAuth();
  const [lookups, setLookups] = useState<Row[]>([]);
  const [swaps, setSwaps] = useState<Row[]>([]);
  const [recipes, setRecipes] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [a, b, c] = await Promise.all([
      supabase.from("saved_lookups").select("*").order("created_at", { ascending: false }),
      supabase.from("saved_swaps").select("*").order("created_at", { ascending: false }),
      supabase.from("saved_recipes").select("*").order("created_at", { ascending: false }),
    ]);
    setLookups((a.data as Row[]) ?? []);
    setSwaps((b.data as Row[]) ?? []);
    setRecipes((c.data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const remove = async (table: string, id: string) => {
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) return toast.error("Could not delete");
    toast.success("Deleted");
    load();
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const Empty = ({ icon: Icon, label, cta }: any) => (
    <div className="text-center py-16 text-muted-foreground">
      <Icon className="h-10 w-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">No {label} yet.</p>
      <Button asChild variant="link" className="text-accent mt-1"><Link to={cta}>Try it now</Link></Button>
    </div>
  );

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-primary mb-2">Your library</h1>
        <p className="text-muted-foreground mb-8">Saved lookups, swaps, and recipes.</p>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="recipes">
            <TabsList className="bg-secondary rounded-2xl mb-6">
              <TabsTrigger value="recipes" className="rounded-xl">Recipes ({recipes.length})</TabsTrigger>
              <TabsTrigger value="swaps" className="rounded-xl">Swaps ({swaps.length})</TabsTrigger>
              <TabsTrigger value="lookups" className="rounded-xl">Lookups ({lookups.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="recipes" className="space-y-3 m-0">
              {recipes.length === 0 ? <Empty icon={ChefHat} label="recipes" cta="/#recipe" /> : recipes.map(r => (
                <Card key={r.id} className="p-5 rounded-2xl border-border/50 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-accent">{r.recipe?.cuisine}</div>
                    <h3 className="font-semibold text-primary">{r.recipe?.title}</h3>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.recipe?.time_minutes}m · {r.recipe?.servings} servings · ${r.recipe?.estimated_total_cost_usd?.toFixed(2)}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove("saved_recipes", r.id)}><Trash2 className="h-4 w-4" /></Button>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="swaps" className="space-y-3 m-0">
              {swaps.length === 0 ? <Empty icon={ArrowLeftRight} label="swaps" cta="/#swap" /> : swaps.map(r => (
                <Card key={r.id} className="p-5 rounded-2xl border-border/50 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Original</div>
                    <h3 className="font-semibold text-primary">{r.food}</h3>
                    <div className="text-xs text-muted-foreground mt-1">{r.result?.swaps?.length ?? 0} alternatives saved</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove("saved_swaps", r.id)}><Trash2 className="h-4 w-4" /></Button>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="lookups" className="space-y-3 m-0">
              {lookups.length === 0 ? <Empty icon={Sparkles} label="lookups" cta="/#lookup" /> : lookups.map(r => (
                <Card key={r.id} className="p-5 rounded-2xl border-border/50 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-primary">{r.result?.food ?? r.query}</h3>
                    <div className="text-xs text-muted-foreground mt-1">
                      {Math.round(r.result?.calories_kcal ?? 0)} kcal · {r.result?.protein_g?.toFixed?.(1)}g protein
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove("saved_lookups", r.id)}><Trash2 className="h-4 w-4" /></Button>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
};

export default Library;
