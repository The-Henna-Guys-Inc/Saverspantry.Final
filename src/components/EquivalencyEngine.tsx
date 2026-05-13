import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeftRight, TrendingDown, DollarSign, Flame, ChevronDown, ChevronUp, Activity, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SaveButton } from "./SaveButton";
import { WatchlistButton } from "./WatchlistButton";
import { AiFeedback } from "./AiFeedback";
import { COST_SWAPS, CALORIE_SWAPS } from "@/lib/popularSwaps";
import { useCuisinePrefs } from "@/hooks/useCuisinePrefs";
import { buildCuisineOptions, pickDefaultCuisineOption } from "@/lib/cuisineHints";
import { CuisinePrefHint } from "./CuisinePrefHint";

type Swap = {
  title: string;
  items: { food: string; portion: string }[];
  protein_g: number;
  calories_kcal: number;
  estimated_cost_usd: number;
  savings_percent: number;
  notes: string;
  nutrient_coverage?: string[];
  glycemic_impact?: "lower" | "similar" | "higher" | "unknown";
  glycemic_tradeoff?: string;
};
type Result = {
  original: { name: string; protein_g: number; calories_kcal: number; estimated_cost_usd: number };
  swaps: Swap[];
  price_source?: "estimate" | "kroger" | "mixed";
  price_store?: string | null;
};

const EXAMPLES = ["200g chicken breast", "2 large eggs", "1 cup Greek yogurt", "150g salmon"];
const BASE_CUISINES = ["Italian", "American", "Indian", "Mexican", "Chinese", "Greek", "Portuguese", "Spanish", "Japanese", "Turkish", "French", "Polish", "Pakistani", "Serbian", "Indonesian"];
const TOP_CUISINES_COUNT = 5;
const RESTRICTIONS = ["Halal", "Kosher", "Vegetarian"] as const;
type Restriction = typeof RESTRICTIONS[number];

export const EquivalencyEngine = () => {
  const [food, setFood] = useState("");
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [cuisineTouched, setCuisineTouched] = useState(false);
  const [showAllCuisines, setShowAllCuisines] = useState(false);
  const { cuisines: prefCuisines, favoriteCuisines, loading: prefsLoading } = useCuisinePrefs();
  const cuisineOptions = buildCuisineOptions(BASE_CUISINES, favoriteCuisines);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [profilePrefs, setProfilePrefs] = useState<any>(null);
  const [costOpen, setCostOpen] = useState(true);
  const [calOpen, setCalOpen] = useState(true);
  const [bloodSugar, setBloodSugar] = useState(false);

  useEffect(() => {
    if (prefsLoading || cuisineTouched) return;
    const def = pickDefaultCuisineOption(prefCuisines, cuisineOptions, favoriteCuisines);
    if (def) setCuisine(def);
  }, [prefsLoading, prefCuisines, favoriteCuisines, cuisineTouched, cuisineOptions]);
  const pickCuisine = (next: string | null) => { setCuisineTouched(true); setCuisine(next); };

  const [zipCode, setZipCode] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("dietary_prefs, zip_code").eq("user_id", user.id).maybeSingle();
      const prefs = (data?.dietary_prefs ?? {}) as any;
      setProfilePrefs(prefs);
      setZipCode(data?.zip_code ?? null);
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
          blood_sugar_friendly: bloodSugar,
          zip: zipCode ?? undefined,
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

      <div className="mt-3 p-3 rounded-2xl bg-card border border-border/50">
        <label className="flex items-start gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={bloodSugar}
            onClick={() => setBloodSugar((v) => !v)}
            className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              bloodSugar ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
                bloodSugar ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Activity className="h-3.5 w-3.5 text-primary" />
              Blood sugar friendly
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="About blood sugar filter">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Glycemic estimates are approximate. Consult a healthcare provider for medical guidance on blood sugar management.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lower glycemic alternatives for better blood sugar response
            </p>
          </div>
        </label>
      </div>

      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
          Cuisine <span className="normal-case text-muted-foreground/70">(optional)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => pickCuisine(null)}
            className={`text-xs px-3 py-1.5 rounded-full transition-smooth ${
              cuisine === null
                ? "bg-primary text-primary-foreground shadow-soft"
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
          >
            Any
          </button>
          {(showAllCuisines ? cuisineOptions : cuisineOptions.slice(0, TOP_CUISINES_COUNT)).map((c) => (
            <button
              key={c}
              onClick={() => pickCuisine(cuisine === c ? null : c)}
              className={`text-xs px-3 py-1.5 rounded-full transition-smooth ${
                cuisine === c
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
          {cuisineOptions.length > TOP_CUISINES_COUNT && (
            <button
              onClick={() => setShowAllCuisines((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-full bg-secondary/60 text-muted-foreground hover:bg-muted transition-smooth"
            >
              {showAllCuisines ? "Show less" : `View more (${cuisineOptions.length - TOP_CUISINES_COUNT})`}
            </button>
          )}
        </div>
        {!prefsLoading && prefCuisines.length === 0 && favoriteCuisines.length === 0 && (
          <CuisinePrefHint className="mt-2" />
        )}
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
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Original</div>
                <div className="flex items-center gap-2 shrink-0">
                  <WatchlistButton foodName={result.original.name} />
                  <SaveButton table="saved_swaps" payload={{ food: result.original.name, result }} />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-primary break-words">{result.original.name}</h3>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{Math.round(result.original.calories_kcal)} kcal</span>
                <span aria-hidden>·</span>
                <span>{result.original.protein_g.toFixed(0)}g protein</span>
                <span aria-hidden>·</span>
                <span className="font-semibold text-foreground">${result.original.estimated_cost_usd.toFixed(2)}</span>
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
              {bloodSugar && s.glycemic_impact && s.glycemic_impact !== "unknown" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {s.glycemic_impact === "lower" && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                      Lower GI
                    </span>
                  )}
                  {s.glycemic_impact === "similar" && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/30 text-foreground font-semibold">
                      Similar GI
                    </span>
                  )}
                  {s.glycemic_impact === "higher" && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold">
                      Higher GI
                    </span>
                  )}
                  {s.glycemic_tradeoff && (
                    <span className="text-xs text-muted-foreground">{s.glycemic_tradeoff}</span>
                  )}
                </div>
              )}
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

      {cuisine && (COST_SWAPS[cuisine] || CALORIE_SWAPS[cuisine]) && (
        <div className="mt-8 space-y-6">
          {COST_SWAPS[cuisine] && (
            <section>
              <button
                type="button"
                onClick={() => setCostOpen((v) => !v)}
                aria-expanded={costOpen}
                className="w-full flex items-center gap-2 mb-3 px-1 min-h-[44px] text-left"
              >
                <DollarSign className="h-4 w-4 text-primary shrink-0" />
                <h2 className="text-base font-bold text-primary flex-1">Top 10 cost-saving swaps · {cuisine}</h2>
                {costOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {costOpen && (<>
              <p className="text-xs text-muted-foreground mb-3 px-1">High-cost ingredients → cheaper picks with similar nutrition. Tap to run a full swap.</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {COST_SWAPS[cuisine].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setFood(s.from); find(s.from); }}
                    className="text-left p-3 rounded-2xl bg-card border border-border/50 hover:shadow-glow transition-smooth min-h-[44px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-semibold text-foreground">{s.from}</span>
                        <ArrowLeftRight className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span className="text-primary font-semibold">{s.to}</span>
                      </div>
                      {typeof s.savings === "number" && (
                        <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-accent/20 text-foreground shrink-0">
                          <TrendingDown className="h-3 w-3" />
                          {s.savings}%
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{s.note}</div>
                  </button>
                ))}
              </div>
              </>)}
            </section>
          )}

          {CALORIE_SWAPS[cuisine] && (
            <section>
              <button
                type="button"
                onClick={() => setCalOpen((v) => !v)}
                aria-expanded={calOpen}
                className="w-full flex items-center gap-2 mb-3 px-1 min-h-[44px] text-left"
              >
                <Flame className="h-4 w-4 text-accent shrink-0" />
                <h2 className="text-base font-bold text-primary flex-1">Top 10 lighter swaps · {cuisine}</h2>
                {calOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {calOpen && (<>
              <p className="text-xs text-muted-foreground mb-3 px-1">High-calorie ingredients → lighter alternatives with similar nutrition. Estimates are approximate.</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {CALORIE_SWAPS[cuisine].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setFood(s.from); find(s.from); }}
                    className="text-left p-3 rounded-2xl bg-card border border-border/50 hover:shadow-glow transition-smooth min-h-[44px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-semibold text-foreground">{s.from}</span>
                        <ArrowLeftRight className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span className="text-primary font-semibold">{s.to}</span>
                      </div>
                      {typeof s.savings === "number" && (
                        <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                          <Flame className="h-3 w-3" />
                          −{s.savings}%
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{s.note}</div>
                  </button>
                ))}
              </div>
              </>)}
            </section>
          )}
        </div>
      )}

    </div>
  );
};
