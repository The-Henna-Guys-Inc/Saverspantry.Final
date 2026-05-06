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
import { Loader2, Plus, Trash2, Refrigerator } from "lucide-react";
import { toast } from "sonner";

type PantryItem = {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  category: string | null;
  expires_on: string | null;
};

const CATEGORIES = ["produce", "protein", "dairy", "pantry", "frozen", "bakery", "other"];
const UNITS = ["unit", "g", "kg", "oz", "lb", "ml", "L", "cup", "tbsp", "tsp"];

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
  const [expires, setExpires] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("id, item, quantity, unit, category, expires_on")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setItems(data ?? []);
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
        expires_on: expires || null,
      })
      .select("id, item, quantity, unit, category, expires_on")
      .single();
    setAdding(false);
    if (error) return toast.error(error.message);
    setItems((p) => [data as PantryItem, ...p]);
    setName(""); setQty("1"); setExpires("");
    toast.success("Added to pantry");
  };

  const remove = async (id: string) => {
    const prev = items;
    setItems((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from("pantry_items").delete().eq("id", id);
    if (error) { setItems(prev); toast.error(error.message); }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const grouped = items.reduce<Record<string, PantryItem[]>>((acc, i) => {
    const c = i.category || "other";
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
        <p className="text-muted-foreground mb-8">Track staples at home — your grocery list will skip what you've already got.</p>

        <Card className="p-6 rounded-3xl border-border/50 shadow-soft mb-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
              <Label htmlFor="e" className="text-xs">Expires (optional)</Label>
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
            {Object.entries(grouped).map(([cat, list]) => (
              <Card key={cat} className="p-5 rounded-2xl border-border/50">
                <div className="text-xs uppercase tracking-wider text-accent mb-3">{cat}</div>
                <ul className="space-y-2">
                  {list.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <div className="font-medium text-primary">{it.item}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.quantity} {it.unit}{it.expires_on ? ` · expires ${it.expires_on}` : ""}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => remove(it.id)} className="rounded-lg">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </li>
                  ))}
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
