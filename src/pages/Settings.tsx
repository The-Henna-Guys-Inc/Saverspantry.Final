import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";

const RESTRICTIONS = ["halal", "kosher", "vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"] as const;
const DIET_STYLES = ["balanced", "high-protein", "keto", "mediterranean", "pescatarian"] as const;

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [household, setHousehold] = useState(2);
  const [zip, setZip] = useState("");
  const [dietStyle, setDietStyle] = useState<string>("balanced");
  const [restrictions, setRestrictions] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, household_size, zip_code, dietary_prefs")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setHousehold(data.household_size ?? 2);
        setZip(data.zip_code ?? "");
        const prefs = (data.dietary_prefs ?? {}) as { style?: string; restrictions?: string[] };
        if (prefs.style) setDietStyle(prefs.style);
        if (Array.isArray(prefs.restrictions)) setRestrictions(prefs.restrictions);
      }
      setLoading(false);
    })();
  }, [user]);

  const toggle = (r: string) =>
    setRestrictions((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        household_size: Math.max(1, household),
        zip_code: zip.trim() || null,
        dietary_prefs: { style: dietStyle, restrictions },
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
