import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Refrigerator, Minus, AlertTriangle, X, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/BarcodeScanner";

type PantryItem = {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  category: string | null;
  location: string;
  expires_on: string | null;
  low_stock_threshold: number | null;
};

type PantryLocation = { id: string; name: string };

const CATEGORIES = ["produce", "protein", "dairy", "pantry", "frozen", "bakery", "other"];
const UNITS = ["unit", "g", "kg", "oz", "lb", "ml", "L", "cup", "tbsp", "tsp"];
const DEFAULT_LOCATIONS = ["fridge", "freezer", "pantry", "counter"];

const Pantry = () => {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [locations, setLocations] = useState<PantryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // form state
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("unit");
  const [category, setCategory] = useState("pantry");
  const [location, setLocation] = useState("pantry");
  const [expires, setExpires] = useState("");
  const [threshold, setThreshold] = useState("");

  // new location input
  const [newLoc, setNewLoc] = useState("");

  // barcode scanner
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleScanned = (r: { code: string; productName?: string; brand?: string; quantity?: string; categories?: string }) => {
    const label = r.productName ? (r.brand ? `${r.brand} ${r.productName}` : r.productName) : `Item ${r.code}`;
    setName(label);
    if (r.quantity) {
      const m = r.quantity.match(/([\d.]+)\s*(g|kg|ml|l|oz|lb)?/i);
      if (m) {
        setQty(m[1]);
        if (m[2]) {
          const u = m[2].toLowerCase() === "l" ? "L" : m[2].toLowerCase();
          if (UNITS.includes(u)) setUnit(u);
        }
      }
    }
    if (r.categories) {
      const lower = r.categories.toLowerCase();
      const match = CATEGORIES.find((c) => lower.includes(c));
      if (match) setCategory(match);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [itemsRes, locsRes] = await Promise.all([
        supabase.from("pantry_items").select("id, item, quantity, unit, category, location, expires_on, low_stock_threshold").order("created_at", { ascending: false }),
        supabase.from("pantry_locations").select("id, name").order("name"),
      ]);
      if (itemsRes.error) toast.error(itemsRes.error.message);
      else setItems((itemsRes.data ?? []) as PantryItem[]);
      if (!locsRes.error) setLocations((locsRes.data ?? []) as PantryLocation[]);
      setLoading(false);
    })();
  }, [user]);

  const allLocations = useMemo(() => {
    const custom = locations.map((l) => l.name);
    const merged = Array.from(new Set([...DEFAULT_LOCATIONS, ...custom]));
    return merged;
  }, [locations]);

  const addLocation = async () => {
    const n = newLoc.trim();
    if (!n) return;
    if (allLocations.some((l) => l.toLowerCase() === n.toLowerCase())) {
      toast.error("Location already exists");
      return;
    }
    const { data, error } = await supabase
      .from("pantry_locations")
      .insert({ user_id: user!.id, name: n })
      .select("id, name")
      .single();
    if (error) return toast.error(error.message);
    setLocations((p) => [...p, data as PantryLocation]);
    setNewLoc("");
    setLocation(n);
    toast.success("Location added");
  };

  const removeLocation = async (id: string, nm: string) => {
    if (items.some((it) => it.location === nm)) {
      toast.error("Move or remove items in this location first");
      return;
    }
    const prev = locations;
    setLocations((p) => p.filter((l) => l.id !== id));
    const { error } = await supabase.from("pantry_locations").delete().eq("id", id);
    if (error) { setLocations(prev); toast.error(error.message); }
  };

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
        low_stock_threshold: threshold === "" ? null : Number(threshold),
      })
      .select("id, item, quantity, unit, category, location, expires_on, low_stock_threshold")
      .single();
    setAdding(false);
    if (error) return toast.error(error.message);
    setItems((p) => [data as PantryItem, ...p]);
    setName(""); setQty("1"); setExpires(""); setThreshold("");
    toast.success("Added to pantry");
  };

  const checkLowStock = (it: PantryItem, next: number) => {
    if (it.low_stock_threshold == null) return;
    if (it.quantity > it.low_stock_threshold && next <= it.low_stock_threshold) {
      toast.warning(`Low stock: ${it.item} (${next} ${it.unit} left)`, {
        description: `Below your threshold of ${it.low_stock_threshold}.`,
      });
    }
  };

  const logConsumption = async (it: PantryItem, qtyUsed: number) => {
    if (qtyUsed <= 0 || !user) return;
    let wasBeforeExpiry: boolean | null = null;
    let daysToExpiry: number | null = null;
    if (it.expires_on) {
      const exp = new Date(it.expires_on); exp.setHours(0,0,0,0);
      const today = new Date(); today.setHours(0,0,0,0);
      daysToExpiry = Math.round((exp.getTime() - today.getTime()) / 86400000);
      wasBeforeExpiry = daysToExpiry >= 0;
    }
    await supabase.from("pantry_consumption_log").insert({
      user_id: user.id, pantry_item_id: it.id, item_name: it.item,
      quantity_used: qtyUsed, unit: it.unit, expires_on: it.expires_on,
      was_before_expiry: wasBeforeExpiry, days_to_expiry: daysToExpiry,
    });
  };

  const adjust = async (it: PantryItem, delta: number) => {
    const next = Math.max(0, Number((it.quantity + delta).toFixed(2)));
    const prev = items;
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, quantity: next } : x)));
    const { error } = await supabase.from("pantry_items").update({ quantity: next }).eq("id", it.id);
    if (error) { setItems(prev); return toast.error(error.message); }
    if (delta < 0) await logConsumption(it, -delta);
    checkLowStock(it, next);
    if (next === 0) toast.message(`${it.item} is out — remove it?`);
  };

  const setQuantity = async (it: PantryItem, val: string) => {
    const n = Math.max(0, Number(val) || 0);
    const prev = items;
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, quantity: n } : x)));
    const { error } = await supabase.from("pantry_items").update({ quantity: n }).eq("id", it.id);
    if (error) { setItems(prev); toast.error(error.message); return; }
    if (n < it.quantity) await logConsumption(it, it.quantity - n);
    checkLowStock(it, n);
  };

  const setItemThreshold = async (it: PantryItem, val: string) => {
    const n = val === "" ? null : Math.max(0, Number(val) || 0);
    const prev = items;
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, low_stock_threshold: n } : x)));
    const { error } = await supabase.from("pantry_items").update({ low_stock_threshold: n }).eq("id", it.id);
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
  const isLow = (it: PantryItem) => it.low_stock_threshold != null && it.quantity <= it.low_stock_threshold;

  const lowItems = items.filter(isLow);

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
        <p className="text-muted-foreground mb-8">Track staples at home — deduct as you use them and get alerts when something runs low.</p>

        {lowItems.length > 0 && (
          <Card className="p-4 rounded-2xl border-destructive/40 bg-destructive/5 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-destructive mb-1">Low stock ({lowItems.length})</div>
                <div className="text-muted-foreground">
                  {lowItems.map((i) => `${i.item} (${i.quantity} ${i.unit})`).join(" · ")}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Manage locations */}
        <Card className="p-5 rounded-2xl border-border/50 mb-6">
          <div className="text-xs uppercase tracking-wider text-accent mb-3">Your locations</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {DEFAULT_LOCATIONS.map((l) => (
              <span key={l} className="px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground">{l}</span>
            ))}
            {locations.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-xs text-primary">
                {l.name}
                <button onClick={() => removeLocation(l.id, l.name)} className="hover:text-destructive" title="Remove">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newLoc}
              onChange={(e) => setNewLoc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLocation()}
              placeholder="e.g. Basement, Garage shelf"
              className="rounded-xl"
            />
            <Button variant="outline" onClick={addLocation} className="rounded-xl shrink-0">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border-border/50 shadow-soft mb-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-8 gap-3">
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
                <SelectContent>{allLocations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="e" className="text-xs">Expires</Label>
              <Input id="e" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="rounded-xl mt-1" />
            </div>
            <div>
              <Label htmlFor="t" className="text-xs">Low at</Label>
              <Input id="t" type="number" min={0} step="0.1" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="opt." className="rounded-xl mt-1" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="hero" onClick={add} disabled={adding} className="rounded-xl">
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add to pantry
            </Button>
            <Button variant="outline" onClick={() => setScannerOpen(true)} className="rounded-xl">
              <ScanLine className="h-4 w-4 mr-2" /> Scan barcode
            </Button>
          </div>
        </Card>

        <BarcodeScanner open={scannerOpen} onOpenChange={setScannerOpen} onDetected={handleScanned} />

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
                    const low = isLow(it);
                    return (
                      <li key={it.id} className="flex flex-col gap-2 text-sm border-b border-border/40 pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-primary truncate flex items-center gap-1.5">
                              {it.item}
                              {low && <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-label="Low stock" />}
                            </div>
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
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Label htmlFor={`th-${it.id}`} className="text-xs">Alert when ≤</Label>
                          <Input
                            id={`th-${it.id}`}
                            type="number"
                            min={0}
                            step="0.1"
                            value={it.low_stock_threshold ?? ""}
                            onChange={(e) => setItemThreshold(it, e.target.value)}
                            placeholder="off"
                            className="h-7 w-20 rounded-lg text-center px-1"
                          />
                          <span>{it.unit}</span>
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
