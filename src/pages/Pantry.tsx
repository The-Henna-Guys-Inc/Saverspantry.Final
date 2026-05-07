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
import { Loader2, Plus, Trash2, Refrigerator, Minus } from "lucide-react";
import { toast } from "sonner";

type PantryItem = {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  category: string | null;
  location: string;
  expires_on: string | null;
};

const CATEGORIES = ["produce", "protein", "dairy", "pantry", "frozen", "bakery", "other"];
const UNITS = ["unit", "g", "kg", "oz", "lb", "ml", "L", "cup", "tbsp", "tsp"];
const LOCATIONS = ["fridge", "freezer", "pantry", "counter", "other"];

const Pantry = () => {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // form state
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("unit");
  const [category, setCategory] = useState("pantry");
  const [location, setLocation] = useState("pantry");
  const [expires, setExpires] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("id, item, quantity, unit, category, location, expires_on")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setItems((data ?? []) as PantryItem[]);
      setLoading(false);
    })();
  }, [user]);

  const add = async () => {
    if (!name.trim()) return toast.error("Add an item name");
    setAdding(true);
    const { data, error } = await supabase
      .from("pantry_items")
      .insert({
        user_id: user!.id,
        item: name.trim(),
        quantity: Number(qty) || 1,
        unit,
        category,
        location,
        expires_on: expires || null,
      })
      .select("id, item, quantity, unit, category, location, expires_on")
      .single();
    setAdding(false);
    if (error) return toast.error(error.message);
    setItems((p) => [data as PantryItem, ...p]);
    setName(""); setQty("1"); setExpires("");
    toast.success("Added to pantry");
  };

  const adjust = async (it: PantryItem, delta: number) => {
    const next = Math.max(0, Number((it.quantity + delta).toFixed(2)));
    const prev = items;
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, quantity: next } : x)));
    const { error } = await supabase.from("pantry_items").update({ quantity: next }).eq("id", it.id);
    if (error) { setItems(prev); return toast.error(error.message); }
    if (next === 0) toast.message(`${it.item} is out — remove it?`);
  };

  const setQuantity = async (it: PantryItem, val: string) => {
    const n = Math.max(0, Number(val) || 0);
    const prev = items;
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, quantity: n } : x)));
    const { error } = await supabase.from("pantry_items").update({ quantity: n }).eq("id", it.id);
    if (error) { setItems(prev); toast.error(error.message); }
  };

  const remove = async (id: string) => {
    const prev = items;
    setItems((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from("pantry_items").delete().eq("id", id);
    if (error) { setItems(prev); toast.error(error.message); }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const today = new Date(); today.setHours(0,0,0,0);
  const isExpiringSoon = (d: string | null) => {
    if (!d) return false;
    const dt = new Date(d);
    const diff = (dt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 3;
  };

  const grouped = items.reduce<Record<string, PantryItem[]>>((acc, i) => {
    const c = i.location || "other";
    (acc[c] ||= []).push(i); return acc;
  }, {});

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <Refrigerator className="h-3.5 w-3.5" /> Pantry
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">What you already have</h1>
        <p className="text-muted-foreground mb-8">Track staples at home — deduct as you use them so your shopping list stays accurate.</p>

        <Card className="p-6 rounded-3xl border-border/50 shadow-soft mb-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3">
            <div className="lg:col-span-2">
              <Label htmlFor="n" className="text-xs">Item</Label>
              <Input id="n" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brown rice" className="rounded-xl mt-1" />
            </div>
            <div>
              <Label htmlFor="q" className="text-xs">Qty</Label>
              <Input id="q" type="number" min={0} step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} className="rounded-xl mt-1" />
            </div>
            <div>
              <Label className="text-xs">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="e" className="text-xs">Expires</Label>
              <Input id="e" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="rounded-xl mt-1" />
            </div>
          </div>
          <div className="mt-4">
            <Button variant="hero" onClick={add} disabled={adding} className="rounded-xl">
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add to pantry
            </Button>
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <Card className="p-8 rounded-2xl border-border/50 text-center text-muted-foreground">
            Your pantry is empty. Add a few staples to start.
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(grouped).map(([loc, list]) => (
              <Card key={loc} className="p-5 rounded-2xl border-border/50">
                <div className="text-xs uppercase tracking-wider text-accent mb-3">{loc}</div>
                <ul className="space-y-3">
                  {list.map((it) => {
                    const expSoon = isExpiringSoon(it.expires_on);
                    const out = it.quantity <= 0;
                    return (
                      <li key={it.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-primary truncate">{it.item}</div>
                          <div className="text-xs text-muted-foreground">
                            {it.category}{it.expires_on ? <> · <span className={expSoon ? "text-destructive font-medium" : ""}>expires {it.expires_on}</span></> : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => adjust(it, -1)} disabled={out} title="Use one">
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            value={it.quantity}
                            onChange={(e) => setQuantity(it, e.target.value)}
                            className="h-8 w-16 rounded-lg text-center px-1"
                          />
                          <span className="text-xs text-muted-foreground w-8">{it.unit}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => adjust(it, 1)} title="Add one">
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => remove(it.id)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default Pantry;
