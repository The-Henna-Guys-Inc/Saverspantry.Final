import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeftRight, TrendingDown, DollarSign, Flame } from "lucide-react";
import { SaveButton } from "./SaveButton";
import { WatchlistButton } from "./WatchlistButton";
import { AiFeedback } from "./AiFeedback";
import { COST_SWAPS, CALORIE_SWAPS } from "@/lib/popularSwaps";

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
const CUISINES = ["American", "Pakistani", "Indian", "Italian", "Mexican", "Chinese", "Mediterranean", "Thai"];
const RESTRICTIONS = ["Halal", "Kosher", "Vegetarian"] as const;
type Restriction = typeof RESTRICTIONS[number];

export const EquivalencyEngine = () => {
  const [food, setFood] = useState("");
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [profilePrefs, setProfilePrefs] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("dietary_prefs").eq("user_id", user.id).maybeSingle();
      const prefs = (data?.dietary_prefs ?? {}) as any;
      setProfilePrefs(prefs);
      if (Array.isArray(prefs.restrictions)) {
        const fromProfile = prefs.restrictions
          .map((r: string) => r.charAt(0).toUpperCase() + r.slice(1))
          .filter((r: string): r is Restriction => (RESTRICTIONS as readonly string[]).includes(r));
        if (fromProfile.length) setRestrictions(fromProfile);
      }
    })();
  }, []);

  const toggle = (r: Restriction) =>
    setRestrictions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const find = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("equivalency-swap", {
        body: {
          food: q,
          dietary_prefs: restrictions.map((r) => r.toLowerCase()),
          cuisine: cuisine ?? undefined,
          profile: profilePrefs ? {
            cuisines: cuisine ? [cuisine] : (profilePrefs.cuisines ?? []),
            spice: profilePrefs.spice ?? null,
            loves: profilePrefs.loves ?? [],
            dislikes: profilePrefs.dislikes ?? [],
            allergies: profilePrefs.allergies ?? [],
          } : (cuisine ? { cuisines: [cuisine] } : null),
        },
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

      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
          Cuisine <span className="normal-case text-muted-foreground/70">(optional)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCuisine(null)}
            className={`text-xs px-3 py-1.5 rounded-full transition-smooth ${
              cuisine === null
                ? "bg-primary text-primary-foreground shadow-soft"
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
          >
            Any
          </button>
          {CUISINES.map((c) => (
            <button
              key={c}
              onClick={() => setCuisine((prev) => (prev === c ? null : c))}
              className={`text-xs px-3 py-1.5 rounded-full transition-smooth ${
                cuisine === c
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {EXAMPLES.map((s) => (
          <button key={s} onClick={() => { setFood(s); find(s); }}
            className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-muted transition-smooth">
            {s}
          </button>
        ))}
      </div>

      {cuisine && (COST_SWAPS[cuisine] || CALORIE_SWAPS[cuisine]) && (
        <div className="mt-8 space-y-6">
          {COST_SWAPS[cuisine] && (
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <h2 className="text-base font-bold text-primary">Top 10 cost-saving swaps · {cuisine}</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3 px-1">High-cost ingredients → cheaper picks with similar nutrition. Tap to run a full swap.</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {COST_SWAPS[cuisine].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setFood(s.from); find(s.from); }}
                    className="text-left p-3 rounded-2xl bg-card border border-border/50 hover:shadow-glow transition-smooth min-h-[44px]"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-foreground">{s.from}</span>
                      <ArrowLeftRight className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span className="text-primary font-semibold">{s.to}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{s.note}</div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {CALORIE_SWAPS[cuisine] && (
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <Flame className="h-4 w-4 text-accent" />
                <h2 className="text-base font-bold text-primary">Top 10 lighter swaps · {cuisine}</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3 px-1">High-calorie ingredients → lighter alternatives with similar nutrition. Estimates are approximate.</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {CALORIE_SWAPS[cuisine].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setFood(s.from); find(s.from); }}
                    className="text-left p-3 rounded-2xl bg-card border border-border/50 hover:shadow-glow transition-smooth min-h-[44px]"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-foreground">{s.from}</span>
                      <ArrowLeftRight className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span className="text-primary font-semibold">{s.to}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{s.note}</div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

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
              <div className="flex items-center gap-2 shrink-0">
                <WatchlistButton foodName={result.original.name} />
                <SaveButton table="saved_swaps" payload={{ food: result.original.name, result }} />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <AiFeedback
                feature="swap"
                context={{ food: result.original.name, cuisine, restrictions, swap_count: result.swaps.length }}
              />
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
