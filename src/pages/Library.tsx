import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Trash2, Sparkles, ArrowLeftRight, ChefHat, Search, ExternalLink, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { RecipeUrlImport } from "@/components/RecipeUrlImport";

type Row = { id: string; created_at: string; query?: string; food?: string; result?: any; recipe?: any };

const Library = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [lookups, setLookups] = useState<Row[]>([]);
  const [swaps, setSwaps] = useState<Row[]>([]);
  const [recipes, setRecipes] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const filt = (rows: Row[], pick: (r: Row) => string) =>
    !q.trim() ? rows : rows.filter((r) => pick(r).toLowerCase().includes(q.toLowerCase()));
  const fRecipes = useMemo(() => filt(recipes, (r) => `${r.recipe?.title ?? ""} ${r.recipe?.cuisine ?? ""}`), [recipes, q]);
  const fSwaps = useMemo(() => filt(swaps, (r) => r.food ?? ""), [swaps, q]);
  const fLookups = useMemo(() => filt(lookups, (r) => `${r.result?.food ?? ""} ${r.query ?? ""}`), [lookups, q]);

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

  const sendToPlanner = (recipe: any) => {
    try {
      const queue = JSON.parse(sessionStorage.getItem("planner_queue") || "[]");
      const exists = queue.some((r: any) => r.title === recipe?.title);
      if (exists) { toast.info("Already queued for next plan"); return; }
      queue.push({
        title: recipe?.title,
        cuisine: recipe?.cuisine,
        ingredients: recipe?.ingredients ?? [],
      });
      sessionStorage.setItem("planner_queue", JSON.stringify(queue));
      toast.success("Queued — open Planner & generate", {
        action: { label: "Open Planner", onClick: () => navigate("/planner") },
      });
    } catch {
      toast.error("Could not queue recipe");
    }
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
      <div className="container max-w-4xl mx-auto px-6 py-6 sm:py-10">
        <h1 className="text-3xl font-bold text-primary mb-2">Your library</h1>
        <p className="text-muted-foreground mb-6">Saved lookups, swaps, and recipes — or import a recipe from any URL.</p>

        <div className="mb-8">
          <RecipeUrlImport onImported={load} />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="recipes">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <TabsList className="bg-secondary rounded-2xl">
                <TabsTrigger value="recipes" className="rounded-xl">Recipes ({fRecipes.length})</TabsTrigger>
                <TabsTrigger value="swaps" className="rounded-xl">Swaps ({fSwaps.length})</TabsTrigger>
                <TabsTrigger value="lookups" className="rounded-xl">Lookups ({fLookups.length})</TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search saved items"
                  className="pl-9 rounded-xl" />
              </div>
            </div>

            <TabsContent value="recipes" className="space-y-3 m-0">
              {fRecipes.length === 0 ? <Empty icon={ChefHat} label="recipes" cta="/#recipe" /> : fRecipes.map(r => (
                <Card key={r.id} className="p-5 rounded-2xl border-border/50 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-accent">{r.recipe?.cuisine}</div>
                    <h3 className="font-semibold text-primary">{r.recipe?.title}</h3>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.recipe?.time_minutes}m · {r.recipe?.servings} servings · ${r.recipe?.estimated_total_cost_usd?.toFixed(2)}
                    </div>
                    {(r as any).source_url && (
                      <a href={(r as any).source_url} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1">
                        <ExternalLink className="h-3 w-3" /> Original source
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => sendToPlanner(r.recipe)}
                      title="Queue for next meal plan" className="rounded-xl">
                      <CalendarPlus className="h-4 w-4 mr-1" />Plan
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove("saved_recipes", r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="swaps" className="space-y-3 m-0">
              {fSwaps.length === 0 ? <Empty icon={ArrowLeftRight} label="swaps" cta="/#swap" /> : fSwaps.map(r => (
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
              {fLookups.length === 0 ? <Empty icon={Sparkles} label="lookups" cta="/#lookup" /> : fLookups.map(r => (
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
