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
import { Loader2, Sparkles, ShoppingCart, RefreshCw, Calendar, Info, Copy, Share2, Printer, Tag, MapPin } from "lucide-react";
import { toast } from "sonner";
import { SpecialtyStoreBanner } from "@/components/SpecialtyStoreBanner";
import { AiFeedback } from "@/components/AiFeedback";
import { detectItemCuisines, summarizeCuisines, CUISINE_LABEL } from "@/lib/cuisineHints";

type Meal = { title: string; main_ingredients: string[]; estimated_cost_usd: number; time_minutes: number };
type Day = { day: string; breakfast: Meal; lunch: Meal; dinner: Meal };
type Plan = { days: Day[]; total_estimated_cost_usd: number; budget_tip: string };
type GroceryItem = { item: string; quantity: string; category: string; estimated_cost_low_usd: number; estimated_cost_high_usd: number };
type Grocery = { items: GroceryItem[]; total_low_usd: number; total_high_usd: number };
type KrogerMatch = { product_name: string; brand?: string; size?: string; price_usd: number; on_sale: boolean; regular_price_usd?: number; image: string | null };
type KrogerResult = { store: { id: string; name: string; chain: string } | null; prices: { item: string; match: KrogerMatch | null }[]; total_usd: number };

const DIET_STYLES = [
  { value: "balanced", label: "Balanced" },
  { value: "high-protein", label: "High protein" },
  { value: "keto", label: "Keto" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "pescatarian", label: "Pescatarian" },
];

const RESTRICTIONS = ["Halal", "Kosher", "Vegetarian"] as const;
type Restriction = typeof RESTRICTIONS[number];

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
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const toggleRestriction = (r: Restriction) =>
    setRestrictions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  const [plan, setPlan] = useState<Plan | null>(null);
  const [grocery, setGrocery] = useState<Grocery | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [genLoading, setGenLoading] = useState(false);
  const [groceryLoading, setGroceryLoading] = useState(false);
  const [zip, setZip] = useState<string>("");
  const [krogerData, setKrogerData] = useState<KrogerResult | null>(null);
  const [krogerLoading, setKrogerLoading] = useState(false);
  const weekStart = mondayOf();

  const [profilePrefs, setProfilePrefs] = useState<any>(null);
  const [queued, setQueued] = useState<any[]>([]);

  const refreshQueue = () => {
    try { setQueued(JSON.parse(sessionStorage.getItem("planner_queue") || "[]")); } catch { setQueued([]); }
  };
  useEffect(() => { refreshQueue(); }, []);
  const clearQueue = () => { sessionStorage.removeItem("planner_queue"); setQueued([]); };
  const removeQueued = (title: string) => {
    const next = queued.filter((r) => r.title !== title);
    sessionStorage.setItem("planner_queue", JSON.stringify(next));
    setQueued(next);
  };

  // Load existing plan + profile defaults
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: existing }] = await Promise.all([
        supabase.from("profiles").select("household_size, dietary_prefs, zip_code").eq("user_id", user.id).maybeSingle(),
        supabase.from("meal_plans").select("plan").eq("user_id", user.id).eq("week_start_date", weekStart).maybeSingle(),
      ]);
      if (prof?.household_size) setHouseholdSize(prof.household_size);
      if (prof?.zip_code) setZip(prof.zip_code);
      const prefs = (prof?.dietary_prefs ?? {}) as any;
      setProfilePrefs(prefs);
      if (prefs.style) setDietStyle(prefs.style);
      if (Array.isArray(prefs.cuisines) && prefs.cuisines.length && !cuisine) {
        setCuisine(prefs.cuisines.slice(0, 2).join(", "));
      }
      if (Array.isArray(prefs.restrictions)) {
        const fromProfile = prefs.restrictions
          .map((r: string) => r.charAt(0).toUpperCase() + r.slice(1))
          .filter((r: string): r is Restriction => (RESTRICTIONS as readonly string[]).includes(r));
        if (fromProfile.length) setRestrictions(fromProfile);
      }
      if (existing?.plan) setPlan(existing.plan as unknown as Plan);
    })();
  }, [user, weekStart]);

  const generate = async () => {
    setGenLoading(true);
    setGrocery(null);
    try {
      const { data, error } = await supabase.functions.invoke("meal-plan-generate", {
        body: {
          household_size: householdSize,
          budget_usd: budget ? Number(budget) : undefined,
          cuisine_focus: cuisine || undefined,
          diet_style: dietStyle,
          dietary_prefs: restrictions.map((r) => r.toLowerCase()),
          profile: profilePrefs ? {
            cuisines: profilePrefs.cuisines ?? [],
            spice: profilePrefs.spice ?? null,
            loves: profilePrefs.loves ?? [],
            dislikes: profilePrefs.dislikes ?? [],
            allergies: profilePrefs.allergies ?? [],
          } : null,
          must_include_recipes: queued,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setPlan(data as Plan);
      // upsert
      await supabase.from("meal_plans").upsert(
        { user_id: user!.id, week_start_date: weekStart, plan: data as any },
        { onConflict: "user_id,week_start_date" }
      );
      if (queued.length) clearQueue();
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
      const { data: pantryRows } = await supabase
        .from("pantry_items")
        .select("item, quantity, unit");
      const { data, error } = await supabase.functions.invoke("grocery-list-generate", {
        body: { plan, household_size: householdSize, pantry: pantryRows ?? [] },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setGrocery(data as Grocery);
      setChecked({});
      setKrogerData(null);
      toast.success("Grocery list ready");
    } catch (e: any) {
      toast.error(e.message ?? "Could not build list");
    } finally {
      setGroceryLoading(false);
    }
  };

  const fetchKrogerPrices = async () => {
    if (!grocery) return;
    if (!zip || zip.trim().length < 5) {
      toast.error("Add a ZIP code in Settings to look up live prices");
      return;
    }
    setKrogerLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("kroger-prices", {
        body: { zip: zip.trim(), items: grocery.items.map((i) => ({ item: i.item })) },
      });
      if (error) throw error;
      if ((data as any)?.error && !(data as any)?.store) throw new Error((data as any).error);
      setKrogerData(data as KrogerResult);
      const r = data as KrogerResult;
      if (!r.store) toast.error("No Kroger-family store found near that ZIP");
      else {
        const matched = r.prices.filter((p) => p.match).length;
        toast.success(`${r.store.name}: ${matched}/${r.prices.length} items priced`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't fetch live prices");
    } finally {
      setKrogerLoading(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const grouped = grocery ? grocery.items.reduce<Record<string, GroceryItem[]>>((acc, i) => {
    (acc[i.category] ||= []).push(i); return acc;
  }, {}) : null;

  const keyOf = (it: GroceryItem) => `${it.category}::${it.item}`;
  const toggleItem = (k: string) => setChecked((p) => ({ ...p, [k]: !p[k] }));

  const listAsText = () => {
    if (!grocery) return "";
    const lines: string[] = [`Grocery list (week of ${weekStart})`, ""];
    Object.entries(grouped!).forEach(([cat, items]) => {
      lines.push(cat.toUpperCase());
      items.forEach((it) => lines.push(`- ${it.item} · ${it.quantity}`));
      lines.push("");
    });
    lines.push(`Estimated total: $${grocery.total_low_usd?.toFixed(2)}–$${grocery.total_high_usd?.toFixed(2)}`);
    return lines.join("\n");
  };

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(listAsText());
      toast.success("Copied to clipboard");
    } catch { toast.error("Couldn't copy"); }
  };

  const shareList = async () => {
    const text = listAsText();
    if (navigator.share) {
      try { await navigator.share({ title: "Grocery list", text }); } catch { /* user cancelled */ }
    } else { copyList(); }
  };

  const printList = () => window.print();

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-6xl mx-auto px-6 py-6 sm:py-10">
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
          <div className="mt-5">
            <Label className="text-xs">Dietary restrictions</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {RESTRICTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRestriction(r)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-smooth ${
                    restrictions.includes(r)
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "bg-secondary text-secondary-foreground hover:bg-muted"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {queued.length > 0 && (
            <div className="mt-5 p-3 rounded-xl bg-secondary/60 border border-border/50">
              <div className="text-xs uppercase tracking-wider text-accent mb-2">
                Recipes queued for next plan ({queued.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {queued.map((r) => (
                  <button
                    key={r.title}
                    type="button"
                    onClick={() => removeQueued(r.title)}
                    title="Remove from queue"
                    className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-80 transition-smooth"
                  >
                    {r.title} ×
                  </button>
                ))}
              </div>
            </div>
          )}
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
            <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
              <h2 className="text-xl font-semibold text-primary">Your week</h2>
              <div className="flex items-center gap-4 flex-wrap">
                <AiFeedback
                  feature="meal_plan"
                  context={{ household_size: householdSize, diet_style: dietStyle, cuisine, restrictions, days: plan.days?.length }}
                />
                <div className="text-sm text-muted-foreground">
                  Est. total <span className="font-semibold text-primary">${plan.total_estimated_cost_usd?.toFixed(2)}</span>
                </div>
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

        {grouped && (() => {
          const cuisineSummary = summarizeCuisines(grocery!.items);
          const krogerByItem: Record<string, KrogerMatch | null> = {};
          if (krogerData) for (const p of krogerData.prices) krogerByItem[p.item.toLowerCase()] = p.match;
          return (
          <div id="grocery-print">
            <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
              <h2 className="text-xl font-semibold text-primary">Grocery list</h2>
              <div className="flex items-center gap-4 flex-wrap">
                <AiFeedback
                  feature="grocery_list"
                  context={{ item_count: grocery!.items.length, household_size: householdSize }}
                  className="print:hidden"
                />
                <div className="text-sm text-muted-foreground">
                  {krogerData?.store ? (
                    <>Kroger total <span className="font-semibold text-primary">${krogerData.total_usd.toFixed(2)}</span></>
                  ) : (
                    <>Est. <span className="font-semibold text-primary">
                      ${grocery!.total_low_usd?.toFixed(2)}–${grocery!.total_high_usd?.toFixed(2)}
                    </span></>
                  )}
                </div>
              </div>
            </div>
            <SpecialtyStoreBanner
              topCuisines={cuisineSummary.topCuisines}
              matchCount={cuisineSummary.hints.length}
            />
            <div className="flex flex-wrap gap-2 mb-4 print:hidden">
              <Button variant="default" size="sm" onClick={fetchKrogerPrices} disabled={krogerLoading} className="rounded-xl">
                {krogerLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Tag className="h-3.5 w-3.5 mr-1.5" />}
                {krogerData ? "Refresh Kroger prices" : "Get live Kroger prices"}
              </Button>
              <Button variant="outline" size="sm" onClick={copyList} className="rounded-xl">
                <Copy className="h-3.5 w-3.5 mr-1.5" />Copy
              </Button>
              <Button variant="outline" size="sm" onClick={shareList} className="rounded-xl">
                <Share2 className="h-3.5 w-3.5 mr-1.5" />Share
              </Button>
              <Button variant="outline" size="sm" onClick={printList} className="rounded-xl">
                <Printer className="h-3.5 w-3.5 mr-1.5" />Print
              </Button>
            </div>
            {krogerData?.store && (
              <div className="flex items-center gap-2 text-xs mb-4 p-3 rounded-xl bg-primary/10 text-primary print:hidden">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>Live prices from <strong>{krogerData.store.name}</strong> ({krogerData.store.chain}) near {zip}</span>
              </div>
            )}
            {!krogerData && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground mb-4 p-3 rounded-xl bg-secondary/60 print:hidden">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>AI estimate. Tap "Get live Kroger prices" to look up real prices at the nearest Kroger-family store{zip ? ` to ${zip}` : " (add a ZIP in Settings first)"}.</span>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(grouped).map(([cat, items]) => (
                <Card key={cat} className="p-5 rounded-2xl border-border/50">
                  <div className="text-xs uppercase tracking-wider text-accent mb-2">{cat}</div>
                  <ul className="space-y-1.5">
                    {items.map((it, i) => {
                      const k = keyOf(it);
                      const done = !!checked[k];
                      const itemCuisines = detectItemCuisines(it.item);
                      return (
                        <li key={i} className="flex items-start justify-between text-sm gap-3">
                          <button type="button" onClick={() => toggleItem(k)}
                            className="flex items-start gap-2 text-left flex-1 group">
                            <span className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-smooth ${
                              done ? "bg-primary border-primary" : "border-border group-hover:border-primary/60"
                            }`}>
                              {done && <span className="text-primary-foreground text-[10px] leading-none">✓</span>}
                            </span>
                            <span className={done ? "line-through text-muted-foreground" : "text-foreground/90"}>
                              {it.item} <span className="text-muted-foreground">· {it.quantity}</span>
                              {itemCuisines.length > 0 && (
                                <span
                                  className="ml-1.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium align-middle"
                                  title={`Often cheaper at ${itemCuisines.map(c => CUISINE_LABEL[c]).join(" / ")} grocers`}
                                >
                                  {CUISINE_LABEL[itemCuisines[0]]}
                                </span>
                              )}
                            </span>
                          </button>
                          {(() => {
                            const km = krogerByItem[it.item.toLowerCase()];
                            if (km) {
                              return (
                                <span className="text-right whitespace-nowrap">
                                  <span className={`font-semibold ${km.on_sale ? "text-accent" : "text-primary"}`}>${km.price_usd.toFixed(2)}</span>
                                  {km.on_sale && km.regular_price_usd && (
                                    <span className="ml-1 text-[10px] text-muted-foreground line-through">${km.regular_price_usd.toFixed(2)}</span>
                                  )}
                                </span>
                              );
                            }
                            return <span className="text-muted-foreground whitespace-nowrap">${it.estimated_cost_low_usd?.toFixed(2)}–${it.estimated_cost_high_usd?.toFixed(2)}</span>;
                          })()}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
          );
        })()}
      </div>
    </main>
  );
};

export default Planner;
