import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Sparkles, Search, TrendingUp, Trophy, BadgeCheck } from "lucide-react";
import { SaveButton } from "./SaveButton";

type Nutrition = {
  food: string;
  serving_grams: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fiber_g: number;
  fat_g: number;
  key_micros: { name: string; amount: number; unit: string; dv_percent?: number }[];
  notes: string;
  source?: string;
};

type RankingItem = {
  food: string;
  portion_label: string;
  portion_grams: number;
  amount: number;
  unit: string;
  source: "USDA" | "AI estimate";
};
type Ranking = {
  query: string;
  nutrient: string;
  unit: string;
  items: RankingItem[];
  note: string;
};

// US-staple fallbacks shown when no community search history exists yet
const FALLBACK_TOP: string[] = [
  "1 large egg",
  "1 cup whole milk",
  "100g chicken breast",
  "1 medium banana",
  "1 slice whole wheat bread",
  "1 cup cooked white rice",
  "1 medium apple",
  "1 tbsp peanut butter",
  "1 cup oatmeal",
  "1 medium baked potato",
];

const normalize = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);

export const NutritionLookup = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Nutrition | null>(null);
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [topSearches, setTopSearches] = useState<string[]>([]);
  const [usingFallback, setUsingFallback] = useState(true);

  const loadTop = async () => {
    const { data, error } = await supabase.rpc("top_nutrition_searches", { _limit: 10 });
    if (error || !data || data.length === 0) {
      setTopSearches(FALLBACK_TOP);
      setUsingFallback(true);
      return;
    }
    setTopSearches(data.map((r: { query: string }) => r.query));
    setUsingFallback(false);
  };

  useEffect(() => {
    loadTop();
  }, []);

  const lookup = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    setRanking(null);
    try {
      const { data, error } = await supabase.functions.invoke("nutrition-lookup", {
        body: { query: q },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.ranking) setRanking(data.ranking as Ranking);
      else setResult(data.nutrition);
      // Fire-and-forget log; ignore RLS failures for unauth users
      supabase
        .from("nutrition_search_events")
        .insert({ query: q.trim().slice(0, 120), normalized_query: normalize(q) })
        .then(({ error: logErr }) => {
          if (!logErr) loadTop();
        });
    } catch (e: any) {
      toast.error(e.message ?? "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(query);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "1 cup cooked quinoa" or "foods highest in omega-3"'
            className="h-14 pl-11 rounded-2xl bg-card border-border text-base shadow-soft"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          variant="hero"
          disabled={loading}
          className="h-14 px-6 rounded-2xl"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Look up</span>
        </Button>
      </form>

      {topSearches.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            <TrendingUp className="h-3 w-3" />
            {usingFallback ? "Popular US staples" : "Top 10 searched"}
          </div>
          <div className="flex flex-wrap gap-2">
            {topSearches.slice(0, 10).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuery(s);
                  lookup(s);
                }}
                className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-muted transition-smooth min-h-[32px]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {result && (
        <Card className="mt-6 p-6 rounded-3xl shadow-glow border-border/50 animate-fade-up">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-xl font-semibold text-primary">{result.food}</h3>
              <p className="text-sm text-muted-foreground">Per ~{Math.round(result.serving_grams)}g serving</p>
              {result.source && (
                <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  Source: {result.source}
                </span>
              )}
            </div>
            <SaveButton table="saved_lookups" payload={{ query, result }} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
            {[
              { l: "Calories", v: `${Math.round(result.calories_kcal)}`, u: "kcal" },
              { l: "Protein", v: result.protein_g.toFixed(1), u: "g" },
              { l: "Carbs", v: result.carbs_g.toFixed(1), u: "g" },
              { l: "Fiber", v: result.fiber_g.toFixed(1), u: "g" },
              { l: "Fat", v: result.fat_g.toFixed(1), u: "g" },
            ].map((m) => (
              <div key={m.l} className="bg-gradient-warm rounded-2xl p-3 text-center">
                <div className="text-lg font-bold text-primary">{m.v}<span className="text-xs font-normal text-muted-foreground ml-0.5">{m.u}</span></div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">{m.l}</div>
              </div>
            ))}
          </div>

          {result.key_micros?.length > 0 && (
            <div className="mb-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Standout micros</div>
              <div className="flex flex-wrap gap-2">
                {result.key_micros.map((m) => (
                  <div key={m.name} className="px-3 py-1.5 rounded-full bg-secondary text-sm">
                    <span className="font-medium text-foreground">{m.name}</span>
                    <span className="text-muted-foreground ml-1.5">
                      {m.amount}{m.unit}
                      {m.dv_percent ? ` · ${Math.round(m.dv_percent)}% DV` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.notes && (
            <p className="text-sm text-foreground/80 italic border-l-2 border-accent pl-3">
              {result.notes}
            </p>
          )}
        </Card>
      )}
    </div>
  );
};
