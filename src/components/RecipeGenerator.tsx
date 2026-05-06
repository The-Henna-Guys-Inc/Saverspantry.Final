import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ChefHat, Clock, Users, DollarSign } from "lucide-react";
import { SaveButton } from "./SaveButton";

type Recipe = {
  title: string;
  cuisine: string;
  servings: number;
  time_minutes: number;
  ingredients: { item: string; quantity: string }[];
  steps: string[];
  nutrition_per_serving: { calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  estimated_total_cost_usd: number;
  tip: string;
};

const CUISINES = ["Indian", "Italian", "Mexican", "Chinese", "Mediterranean", "Thai"];

export const RecipeGenerator = () => {
  const [ingredients, setIngredients] = useState("");
  const [cuisine, setCuisine] = useState("Mediterranean");
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  const generate = async () => {
    if (!ingredients.trim()) {
      toast.error("List a few ingredients first");
      return;
    }
    setLoading(true);
    setRecipe(null);
    try {
      const { data, error } = await supabase.functions.invoke("recipe-generate", {
        body: { ingredients, cuisine },
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
              className={`text-sm px-4 py-2 rounded-full transition-smooth ${
                cuisine === c
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

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
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Per serving</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: "Calories", v: Math.round(recipe.nutrition_per_serving.calories_kcal), u: "kcal" },
                  { l: "Protein", v: recipe.nutrition_per_serving.protein_g.toFixed(0), u: "g" },
                  { l: "Carbs", v: recipe.nutrition_per_serving.carbs_g.toFixed(0), u: "g" },
                  { l: "Fat", v: recipe.nutrition_per_serving.fat_g.toFixed(0), u: "g" },
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
