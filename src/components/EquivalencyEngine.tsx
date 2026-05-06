import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeftRight, TrendingDown } from "lucide-react";
import { SaveButton } from "./SaveButton";

type Swap = {
  title: string;
  items: { food: string; portion: string }[];
  protein_g: number;
  calories_kcal: number;
  estimated_cost_usd: number;
  savings_percent: number;
  notes: string;
  nutrient_coverage?: string[];
};
type Result = {
  original: { name: string; protein_g: number; calories_kcal: number; estimated_cost_usd: number };
  swaps: Swap[];
};

const EXAMPLES = ["200g chicken breast", "2 large eggs", "1 cup Greek yogurt", "150g salmon"];
const RESTRICTIONS = ["Halal", "Kosher", "Vegetarian"] as const;
type Restriction = typeof RESTRICTIONS[number];

export const EquivalencyEngine = () => {
  const [food, setFood] = useState("");
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const toggle = (r: Restriction) =>
    setRestrictions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const find = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("equivalency-swap", {
        body: { food: q, dietary_prefs: restrictions.map((r) => r.toLowerCase()) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      toast.error(e.message ?? "Swap lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={(e) => { e.preventDefault(); find(food); }} className="flex gap-2">
        <Input
          value={food}
          onChange={(e) => setFood(e.target.value)}
          placeholder="Enter a food + portion (e.g. 200g chicken breast)"
          className="h-14 rounded-2xl bg-card text-base shadow-soft px-5"
        />
        <Button type="submit" size="lg" variant="hero" disabled={loading} className="h-14 px-6 rounded-2xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Find swaps</span>
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 mt-3">
        {RESTRICTIONS.map((r) => (
          <button
            key={r}
            onClick={() => toggle(r)}
            className={`text-xs px-3 py-1.5 rounded-full transition-smooth ${
              restrictions.includes(r)
                ? "bg-primary text-primary-foreground shadow-soft"
                : "bg-accent/20 text-foreground hover:bg-accent/30"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {EXAMPLES.map((s) => (
          <button key={s} onClick={() => { setFood(s); find(s); }}
            className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-muted transition-smooth">
            {s}
          </button>
        ))}
      </div>

      {result && (
        <div className="mt-6 space-y-4 animate-fade-up">
          <Card className="p-5 rounded-3xl bg-gradient-warm border-border/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Original</div>
                <h3 className="text-lg font-semibold text-primary mt-1">{result.original.name}</h3>
                <div className="text-sm text-muted-foreground mt-1">
                  {Math.round(result.original.calories_kcal)} kcal · {result.original.protein_g.toFixed(0)}g protein ·
                  <span className="font-semibold text-foreground ml-1">${result.original.estimated_cost_usd.toFixed(2)}</span>
                </div>
              </div>
              <SaveButton table="saved_swaps" payload={{ food: result.original.name, result }} />
            </div>
          </Card>

          {result.swaps.map((s, i) => (
            <Card key={i} className="p-5 rounded-3xl shadow-soft hover:shadow-glow transition-smooth border-border/50">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h4 className="text-base font-semibold text-primary">{s.title}</h4>
                {s.savings_percent > 0 && (
                  <div className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-accent/20 text-foreground shrink-0">
                    <TrendingDown className="h-3 w-3" />
                    Save {Math.round(s.savings_percent)}%
                  </div>
                )}
              </div>
              <ul className="text-sm text-foreground/80 mb-3 space-y-0.5">
                {s.items.map((it, j) => (
                  <li key={j}>• {it.portion} {it.food}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t border-border/50 pt-3">
                <span>{Math.round(s.calories_kcal)} kcal</span>
                <span>{s.protein_g.toFixed(0)}g protein</span>
                <span className="font-semibold text-foreground">${s.estimated_cost_usd.toFixed(2)}</span>
              </div>
              {s.nutrient_coverage && s.nutrient_coverage.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.nutrient_coverage.map((n, k) => (
                    <span key={k} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      + {n}
                    </span>
                  ))}
                </div>
              )}
              {s.notes && <p className="text-xs text-muted-foreground italic mt-2">{s.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
