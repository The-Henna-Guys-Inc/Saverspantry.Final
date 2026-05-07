import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Settings as SettingsIcon, TrendingDown, Utensils } from "lucide-react";
import { toast } from "sonner";

const RESTRICTIONS = ["halal", "kosher", "vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"] as const;
const DIET_STYLES = ["balanced", "high-protein", "keto", "mediterranean", "pescatarian"] as const;
const CUISINES = ["mediterranean", "italian", "mexican", "indian", "chinese", "japanese", "thai", "middle-eastern", "american", "korean", "vietnamese", "french", "ethiopian", "caribbean"] as const;
const SPICE_LEVELS = ["mild", "medium", "spicy", "very-spicy"] as const;

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [household, setHousehold] = useState(2);
  const [zip, setZip] = useState("");
  const [dietStyle, setDietStyle] = useState<string>("balanced");
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [spice, setSpice] = useState<string>("medium");
  const [loves, setLoves] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [allergies, setAllergies] = useState("");
  const [savings, setSavings] = useState<{ total: number; count: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data }, { data: swaps }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, household_size, zip_code, dietary_prefs")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("saved_swaps")
          .select("result")
          .eq("user_id", user.id),
      ]);
      if (data) {
        setDisplayName(data.display_name ?? "");
        setHousehold(data.household_size ?? 2);
        setZip(data.zip_code ?? "");
        const prefs = (data.dietary_prefs ?? {}) as {
          style?: string; restrictions?: string[];
          cuisines?: string[]; spice?: string;
          loves?: string[]; dislikes?: string[]; allergies?: string[];
        };
        if (prefs.style) setDietStyle(prefs.style);
        if (Array.isArray(prefs.restrictions)) setRestrictions(prefs.restrictions);
        if (Array.isArray(prefs.cuisines)) setCuisines(prefs.cuisines);
        if (prefs.spice) setSpice(prefs.spice);
        if (Array.isArray(prefs.loves)) setLoves(prefs.loves.join(", "));
        if (Array.isArray(prefs.dislikes)) setDislikes(prefs.dislikes.join(", "));
        if (Array.isArray(prefs.allergies)) setAllergies(prefs.allergies.join(", "));
      }
      // Compute potential savings from equivalency engine history
      let total = 0;
      let count = 0;
      for (const row of swaps ?? []) {
        const r: any = row.result;
        const origCost = Number(r?.original?.estimated_cost_usd ?? 0);
        const swapCosts = (r?.swaps ?? [])
          .map((s: any) => Number(s?.estimated_cost_usd ?? 0))
          .filter((n: number) => n > 0);
        if (origCost > 0 && swapCosts.length) {
          const best = Math.min(...swapCosts);
          const diff = origCost - best;
          if (diff > 0) { total += diff; count += 1; }
        }
      }
      setSavings({ total, count });
      setLoading(false);
    })();
  }, [user]);

  const toggle = (r: string) =>
    setRestrictions((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  const toggleCuisine = (c: string) =>
    setCuisines((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        household_size: Math.max(1, household),
        zip_code: zip.trim() || null,
        dietary_prefs: {
          style: dietStyle,
          restrictions,
          cuisines,
          spice,
          loves: splitList(loves),
          dislikes: splitList(dislikes),
          allergies: splitList(allergies),
        },
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <SettingsIcon className="h-3.5 w-3.5" /> Settings
        </div>
        <h1 className="text-3xl font-bold text-primary mb-2">Your preferences</h1>
        <p className="text-muted-foreground mb-8">These power your meal plans, grocery list, and price estimates.</p>

        {savings && (
          <Card className="p-5 rounded-3xl border-accent/30 bg-gradient-warm shadow-soft mb-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-accent/20 flex items-center justify-center shrink-0">
                <TrendingDown className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Your potential savings</div>
                <div className="text-2xl font-bold text-primary tabular-nums">
                  ${savings.total.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {savings.count === 0
                    ? "Save swaps from the Equivalency Engine to start tracking."
                    : `Across ${savings.count} saved swap${savings.count === 1 ? "" : "s"} — picking the cheapest equivalent each time.`}
                </div>
              </div>
            </div>
          </Card>
        )}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Card className="p-6 rounded-3xl border-border/50 shadow-soft space-y-5">
            <div>
              <Label htmlFor="dn" className="text-xs">Display name</Label>
              <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-xl mt-1" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hh" className="text-xs">Household size</Label>
                <Input id="hh" type="number" min={1} max={12} value={household}
                  onChange={(e) => setHousehold(Math.max(1, Number(e.target.value) || 1))}
                  className="rounded-xl mt-1" />
              </div>
              <div>
                <Label htmlFor="z" className="text-xs">ZIP code</Label>
                <Input id="z" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="e.g. 94110" className="rounded-xl mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Diet style</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DIET_STYLES.map((s) => (
                  <button key={s} type="button" onClick={() => setDietStyle(s)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-smooth capitalize ${
                      dietStyle === s ? "bg-primary text-primary-foreground shadow-soft" : "bg-secondary text-secondary-foreground hover:bg-muted"
                    }`}>{s.replace("-", " ")}</button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Dietary restrictions</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {RESTRICTIONS.map((r) => (
                  <button key={r} type="button" onClick={() => toggle(r)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-smooth capitalize ${
                      restrictions.includes(r) ? "bg-primary text-primary-foreground shadow-soft" : "bg-secondary text-secondary-foreground hover:bg-muted"
                    }`}>{r.replace("-", " ")}</button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-3">
                <Utensils className="h-3.5 w-3.5" /> Food profile
              </div>
              <p className="text-xs text-muted-foreground mb-4">Used to tailor swaps, meal plans, and recipes to what you actually eat.</p>

              <Label className="text-xs">Favorite cuisines</Label>
              <div className="flex flex-wrap gap-2 mt-2 mb-4">
                {CUISINES.map((c) => (
                  <button key={c} type="button" onClick={() => toggleCuisine(c)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-smooth capitalize ${
                      cuisines.includes(c) ? "bg-primary text-primary-foreground shadow-soft" : "bg-secondary text-secondary-foreground hover:bg-muted"
                    }`}>{c.replace("-", " ")}</button>
                ))}
              </div>

              <Label className="text-xs">Spice tolerance</Label>
              <div className="flex flex-wrap gap-2 mt-2 mb-4">
                {SPICE_LEVELS.map((s) => (
                  <button key={s} type="button" onClick={() => setSpice(s)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-smooth capitalize ${
                      spice === s ? "bg-primary text-primary-foreground shadow-soft" : "bg-secondary text-secondary-foreground hover:bg-muted"
                    }`}>{s.replace("-", " ")}</button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="loves" className="text-xs">Foods you love</Label>
                  <Textarea id="loves" value={loves} onChange={(e) => setLoves(e.target.value)}
                    placeholder="e.g. salmon, chickpeas, sweet potato, paneer"
                    className="rounded-xl mt-1 min-h-[60px]" />
                  <p className="text-[11px] text-muted-foreground mt-1">Comma-separated. We'll lean toward these.</p>
                </div>
                <div>
                  <Label htmlFor="dislikes" className="text-xs">Foods you dislike</Label>
                  <Textarea id="dislikes" value={dislikes} onChange={(e) => setDislikes(e.target.value)}
                    placeholder="e.g. cilantro, mushrooms, tofu"
                    className="rounded-xl mt-1 min-h-[60px]" />
                  <p className="text-[11px] text-muted-foreground mt-1">Comma-separated. We'll avoid these.</p>
                </div>
                <div>
                  <Label htmlFor="allergies" className="text-xs">Allergies</Label>
                  <Textarea id="allergies" value={allergies} onChange={(e) => setAllergies(e.target.value)}
                    placeholder="e.g. peanuts, shellfish"
                    className="rounded-xl mt-1 min-h-[60px]" />
                  <p className="text-[11px] text-destructive/80 mt-1">Strictly excluded from all suggestions.</p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button variant="hero" onClick={save} disabled={saving} className="rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save changes
              </Button>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
};

export default Settings;
