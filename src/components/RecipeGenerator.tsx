import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Loader2, ChefHat, Clock, Users, DollarSign, ChevronDown, SlidersHorizontal, CheckCircle2, AlertCircle } from "lucide-react";
import { SaveButton } from "./SaveButton";

type Recipe = {
  title: string;
  cuisine: string;
  servings: number;
  time_minutes: number;
  ingredients: { item: string; quantity: string }[];
  steps: string[];
  nutrition_per_serving: { calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g?: number; sodium_mg?: number };
  estimated_total_cost_usd: number;
  tip: string;
  constraint_conflict?: string;
};

const CUISINES = ["Indian", "Italian", "Mexican", "Chinese", "Mediterranean", "Thai"];
const RESTRICTIONS = ["Halal", "Kosher", "Vegetarian"] as const;
type Restriction = typeof RESTRICTIONS[number];

const numOrUndef = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export const RecipeGenerator = () => {
  const [ingredients, setIngredients] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [advOpen, setAdvOpen] = useState(false);
  const [maxCals, setMaxCals] = useState("");
  const [maxProtein, setMaxProtein] = useState("");
  const [maxSodium, setMaxSodium] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{ cals?: number; protein?: number; sodium?: number } | null>(null);

  const toggle = (r: Restriction) =>
    setRestrictions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const generate = async () => {
    if (!ingredients.trim()) {
      toast.error("List a few ingredients first");
      return;
    }
    setLoading(true);
    setRecipe(null);
    const filters = {
      cals: numOrUndef(maxCals),
      protein: numOrUndef(maxProtein),
      sodium: numOrUndef(maxSodium),
    };
    setAppliedFilters(filters.cals || filters.protein || filters.sodium ? filters : null);
    try {
      const { data, error } = await supabase.functions.invoke("recipe-generate", {
        body: {
          ingredients,
          cuisine: cuisine ?? "Any",
          dietary_prefs: restrictions.map((r) => r.toLowerCase()),
          max_calories_per_serving: filters.cals,
          max_protein_g: filters.protein,
          max_sodium_mg: filters.sodium,
          ai_notes: aiNotes.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRecipe(data);
    } catch (e: any) {
      toast.error(e.message ?? "Recipe generation failed");
    } finally {
      setLoading(false);
    }
  };

  const checkFilterMet = () => {
    if (!recipe || !appliedFilters) return null;
    const n = recipe.nutrition_per_serving;
    const tol = 1.1;
    const issues: string[] = [];
    if (appliedFilters.cals && n.calories_kcal > appliedFilters.cals * tol) issues.push(`~${Math.round(n.calories_kcal)} kcal vs ${appliedFilters.cals} target`);
    if (appliedFilters.protein && n.protein_g > appliedFilters.protein * tol) issues.push(`~${Math.round(n.protein_g)}g protein vs ${appliedFilters.protein}g target`);
    if (appliedFilters.sodium && (n.sodium_mg ?? 0) > appliedFilters.sodium * tol) issues.push(`~${Math.round(n.sodium_mg ?? 0)}mg sodium vs ${appliedFilters.sodium}mg target`);
    return issues;
  };
  const filterIssues = checkFilterMet();

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Card className="p-5 sm:p-6 rounded-3xl shadow-soft border-border/50 bg-card">
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Ingredients you have
        </label>
        <Input
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="chickpeas, spinach, tomatoes, lemon, garlic"
          className="mt-2 h-12 rounded-2xl bg-background"
        />

        <label className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mt-5 mb-2">
          Cuisine
        </label>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((c) => (
            <button
              key={c}
              onClick={() => setCuisine(c)}
              className={`text-sm px-4 py-2 rounded-full transition-smooth min-h-[44px] ${
                cuisine === c
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <label className="block text-xs uppercase tracking-wider text-muted-foreground font-semibold mt-5 mb-2">
          Dietary restrictions
        </label>
        <div className="flex flex-wrap gap-2">
          {RESTRICTIONS.map((r) => (
            <button
              key={r}
              onClick={() => toggle(r)}
              className={`text-sm px-4 py-2 rounded-full transition-smooth min-h-[44px] ${
                restrictions.includes(r)
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <Collapsible open={advOpen} onOpenChange={setAdvOpen} className="mt-5">
          <CollapsibleTrigger className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold hover:text-foreground transition-smooth">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Advanced filters (optional)
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Approx. calories per serving</label>
                <Input type="number" inputMode="numeric" min={200} max={1500} value={maxCals} onChange={(e) => setMaxCals(e.target.value)} placeholder="e.g. 600" className="h-11 rounded-xl bg-background" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Max protein (g)</label>
                <Input type="number" inputMode="numeric" min={5} max={100} value={maxProtein} onChange={(e) => setMaxProtein(e.target.value)} placeholder="e.g. 40" className="h-11 rounded-xl bg-background" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Max sodium (mg)</label>
                <Input type="number" inputMode="numeric" min={100} max={3000} value={maxSodium} onChange={(e) => setMaxSodium(e.target.value)} placeholder="e.g. 800" className="h-11 rounded-xl bg-background" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Notes for the AI</label>
              <Textarea value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} placeholder="e.g. kid-friendly, mild spice, suitable for gestational diabetes" className="rounded-xl bg-background min-h-[72px]" />
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground italic">
              Calorie estimates are approximate, generated from typical ingredient values. For precise tracking, use a dedicated calorie-tracking app.
            </p>
          </CollapsibleContent>
        </Collapsible>

        <Button
          onClick={generate}
          disabled={loading}
          variant="hero"
          size="lg"
          className="w-full mt-6 h-14 rounded-2xl"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChefHat className="h-4 w-4" />}
          <span className="ml-2">Generate recipe</span>
        </Button>
      </Card>

      {recipe && (
        <Card className="mt-6 p-6 sm:p-8 rounded-3xl shadow-glow border-border/50 animate-fade-up">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-accent font-semibold">{recipe.cuisine}</div>
              <h3 className="text-2xl sm:text-3xl font-bold text-primary mt-1">{recipe.title}</h3>
            </div>
            <SaveButton table="saved_recipes" payload={{ recipe, source: "ai_generated" }} />
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{recipe.time_minutes} min</div>
            <div className="flex items-center gap-1.5"><Users className="h-4 w-4" />{recipe.servings} servings</div>
            <div className="flex items-center gap-1.5 font-semibold text-foreground"><DollarSign className="h-4 w-4" />{recipe.estimated_total_cost_usd.toFixed(2)} total</div>
          </div>

          {appliedFilters && filterIssues !== null && (
            filterIssues.length === 0 ? (
              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-primary/10 text-primary px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Matches your filters (estimates are approximate).</span>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-accent/15 text-foreground px-3 py-2 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
                <span>Approximately {filterIssues.join(", ")}.</span>
              </div>
            )
          )}

          {recipe.constraint_conflict && recipe.constraint_conflict.trim() && (
            <p className="mt-3 text-sm text-foreground/80 border-l-2 border-accent pl-3">
              ⚠ {recipe.constraint_conflict}
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-6 mt-6">
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Ingredients</h4>
              <ul className="space-y-1.5 text-sm">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex justify-between gap-3 border-b border-border/40 pb-1.5">
                    <span>{ing.item}</span>
                    <span className="text-muted-foreground">{ing.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Per serving (approx.)</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: "Calories", v: Math.round(recipe.nutrition_per_serving.calories_kcal), u: "kcal" },
                  { l: "Protein", v: recipe.nutrition_per_serving.protein_g.toFixed(0), u: "g" },
                  { l: "Carbs", v: recipe.nutrition_per_serving.carbs_g.toFixed(0), u: "g" },
                  { l: "Fat", v: recipe.nutrition_per_serving.fat_g.toFixed(0), u: "g" },
                  ...(typeof recipe.nutrition_per_serving.fiber_g === "number" ? [{ l: "Fiber", v: recipe.nutrition_per_serving.fiber_g.toFixed(0), u: "g" }] : []),
                  ...(typeof recipe.nutrition_per_serving.sodium_mg === "number" ? [{ l: "Sodium", v: Math.round(recipe.nutrition_per_serving.sodium_mg), u: "mg" }] : []),
                ].map((m) => (
                  <div key={m.l} className="bg-gradient-warm rounded-2xl p-3 text-center">
                    <div className="text-lg font-bold text-primary">{m.v}<span className="text-xs font-normal text-muted-foreground ml-0.5">{m.u}</span></div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{m.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mt-6 mb-3">Steps</h4>
          <ol className="space-y-3">
            {recipe.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span className="leading-relaxed pt-0.5">{s}</span>
              </li>
            ))}
          </ol>

          {recipe.tip && (
            <p className="mt-6 text-sm text-foreground/80 italic border-l-2 border-accent pl-3">
              💡 {recipe.tip}
            </p>
          )}
        </Card>
      )}
    </div>
  );
};
