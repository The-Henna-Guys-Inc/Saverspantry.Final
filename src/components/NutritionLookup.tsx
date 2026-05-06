import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Sparkles, Search } from "lucide-react";
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
};

const SUGGESTIONS = [
  "2 tbsp chia seeds",
  "1 cup cooked lentils",
  "100g paneer",
  "1 medium banana",
];

export const NutritionLookup = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Nutrition | null>(null);

  const lookup = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("nutrition-lookup", {
        body: { query: q },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data.nutrition);
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
            placeholder="Try: 1 cup cooked quinoa"
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

      <div className="flex flex-wrap gap-2 mt-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setQuery(s);
              lookup(s);
            }}
            className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-muted transition-smooth"
          >
            {s}
          </button>
        ))}
      </div>

      {result && (
        <Card className="mt-6 p-6 rounded-3xl shadow-glow border-border/50 animate-fade-up">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-xl font-semibold text-primary">{result.food}</h3>
              <p className="text-sm text-muted-foreground">Per ~{Math.round(result.serving_grams)}g serving</p>
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
