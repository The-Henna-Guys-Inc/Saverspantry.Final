import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, ShoppingCart, RefreshCw, Calendar, Info } from "lucide-react";
import { toast } from "sonner";

type Meal = { title: string; main_ingredients: string[]; estimated_cost_usd: number; time_minutes: number };
type Day = { day: string; breakfast: Meal; lunch: Meal; dinner: Meal };
type Plan = { days: Day[]; total_estimated_cost_usd: number; budget_tip: string };
type GroceryItem = { item: string; quantity: string; category: string; estimated_cost_low_usd: number; estimated_cost_high_usd: number };
type Grocery = { items: GroceryItem[]; total_low_usd: number; total_high_usd: number };

const DIET_STYLES = [
  { value: "balanced", label: "Balanced" },
  { value: "high-protein", label: "High protein" },
  { value: "keto", label: "Keto" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "pescatarian", label: "Pescatarian" },
];

// ISO Monday of current week
const mondayOf = (d = new Date()) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
};

const Planner = () => {
  const { user, loading: authLoading } = useAuth();
  const [householdSize, setHouseholdSize] = useState(2);
  const [budget, setBudget] = useState<string>("");
  const [cuisine, setCuisine] = useState("");
  const [dietStyle, setDietStyle] = useState("balanced");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [grocery, setGrocery] = useState<Grocery | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [groceryLoading, setGroceryLoading] = useState(false);
  const weekStart = mondayOf();

  // Load existing plan + profile defaults
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: existing }] = await Promise.all([
        supabase.from("profiles").select("household_size").eq("user_id", user.id).maybeSingle(),
        supabase.from("meal_plans").select("plan").eq("user_id", user.id).eq("week_start_date", weekStart).maybeSingle(),
      ]);
      if (prof?.household_size) setHouseholdSize(prof.household_size);
      if (existing?.plan) setPlan(existing.plan as unknown as Plan);
    })();
  }, [user, weekStart]);

  const generate = async () => {
    setGenLoading(true);
    setGrocery(null);
    try {
      const { data, error } = await supabase.functions.invoke("meal-plan-generate", {
        body: { household_size: householdSize, budget_usd: budget ? Number(budget) : undefined, cuisine_focus: cuisine || undefined, diet_style: dietStyle },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setPlan(data as Plan);
      // upsert
      await supabase.from("meal_plans").upsert(
        { user_id: user!.id, week_start_date: weekStart, plan: data as any },
        { onConflict: "user_id,week_start_date" }
      );
      toast.success("Weekly plan generated");
    } catch (e: any) {
      toast.error(e.message ?? "Could not generate plan");
    } finally {
      setGenLoading(false);
    }
  };

  const buildGrocery = async () => {
    if (!plan) return;
    setGroceryLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("grocery-list-generate", {
        body: { plan, household_size: householdSize },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setGrocery(data as Grocery);
      toast.success("Grocery list ready");
    } catch (e: any) {
      toast.error(e.message ?? "Could not build list");
    } finally {
      setGroceryLoading(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const grouped = grocery ? grocery.items.reduce<Record<string, GroceryItem[]>>((acc, i) => {
    (acc[i.category] ||= []).push(i); return acc;
  }, {}) : null;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <Calendar className="h-3.5 w-3.5" /> Week of {weekStart}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">Weekly meal planner</h1>
        <p className="text-muted-foreground mb-8">Generate a 7-day plan and turn it into a grocery list.</p>

        <Card className="p-6 rounded-3xl border-border/50 shadow-soft mb-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="hh" className="text-xs">Household size</Label>
              <Input id="hh" type="number" min={1} max={12} value={householdSize}
                onChange={e => setHouseholdSize(Math.max(1, Number(e.target.value) || 1))}
                className="rounded-xl mt-1" />
            </div>
            <div>
              <Label htmlFor="ds" className="text-xs">Diet style</Label>
              <Select value={dietStyle} onValueChange={setDietStyle}>
                <SelectTrigger id="ds" className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIET_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="b" className="text-xs">Weekly budget ($, optional)</Label>
              <Input id="b" type="number" min={0} value={budget} onChange={e => setBudget(e.target.value)}
                placeholder="e.g. 100" className="rounded-xl mt-1" />
            </div>
            <div>
              <Label htmlFor="c" className="text-xs">Cuisine focus (optional)</Label>
              <Input id="c" value={cuisine} onChange={e => setCuisine(e.target.value)}
                placeholder="e.g. Mediterranean" className="rounded-xl mt-1" />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <Button variant="hero" onClick={generate} disabled={genLoading} className="rounded-xl">
              {genLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : plan ? <RefreshCw className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {plan ? "Regenerate plan" : "Generate plan"}
            </Button>
            {plan && (
              <Button variant="outline" onClick={buildGrocery} disabled={groceryLoading} className="rounded-xl">
                {groceryLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                Build grocery list
              </Button>
            )}
          </div>
        </Card>

        {plan && (
          <>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl font-semibold text-primary">Your week</h2>
              <div className="text-sm text-muted-foreground">
                Est. total <span className="font-semibold text-primary">${plan.total_estimated_cost_usd?.toFixed(2)}</span>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {plan.days.map((d) => (
                <Card key={d.day} className="p-5 rounded-2xl border-border/50">
                  <div className="text-xs uppercase tracking-wider text-accent mb-3">{d.day}</div>
                  {(["breakfast", "lunch", "dinner"] as const).map(slot => (
                    <div key={slot} className="mb-3 last:mb-0">
                      <div className="text-[11px] uppercase text-muted-foreground">{slot}</div>
                      <div className="font-medium text-primary text-sm">{d[slot].title}</div>
                      <div className="text-xs text-muted-foreground">
                        {d[slot].time_minutes}m · ${d[slot].estimated_cost_usd?.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
            {plan.budget_tip && (
              <Card className="p-4 rounded-2xl bg-secondary border-border/50 text-sm text-foreground/80 mb-8">
                💡 {plan.budget_tip}
              </Card>
            )}
          </>
        )}

        {grouped && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-xl font-semibold text-primary">Grocery list</h2>
              <div className="text-sm text-muted-foreground">
                Est. <span className="font-semibold text-primary">
                  ${grocery!.total_low_usd?.toFixed(2)}–${grocery!.total_high_usd?.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground mb-4 p-3 rounded-xl bg-secondary/60">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>AI estimate — actual prices vary by store, region, and sales. Live local pricing is coming soon.</span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(grouped).map(([cat, items]) => (
                <Card key={cat} className="p-5 rounded-2xl border-border/50">
                  <div className="text-xs uppercase tracking-wider text-accent mb-2">{cat}</div>
                  <ul className="space-y-1.5">
                    {items.map((it, i) => (
                      <li key={i} className="flex justify-between text-sm gap-3">
                        <span className="text-foreground/90">{it.item} <span className="text-muted-foreground">· {it.quantity}</span></span>
                        <span className="text-muted-foreground whitespace-nowrap">${it.estimated_cost_low_usd?.toFixed(2)}–${it.estimated_cost_high_usd?.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default Planner;
