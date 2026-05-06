import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { BellRing, Plus, Trash2, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

type Item = {
  id: string;
  food_name: string;
  min_savings_pct: number;
  min_savings_usd: number;
  snoozed_until: string | null;
};

const SUGGESTIONS = ["basmati rice", "lentils", "olive oil", "paneer", "chicken thighs", "eggs", "yogurt", "tofu"];

export default function Watchlist() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    refresh();
  }, [user]);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("watchlist_items")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Item[]);
    setLoading(false);
  };

  const add = async (name: string) => {
    if (!user) return;
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return;
    setAdding(true);
    const { error } = await supabase.from("watchlist_items").insert({ user_id: user.id, food_name: trimmed });
    setAdding(false);
    if (error) return toast.error(error.message);
    setNewItem("");
    toast.success("Added");
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("watchlist_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateThreshold = async (id: string, min_savings_pct: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, min_savings_pct } : i)));
    await supabase.from("watchlist_items").update({ min_savings_pct }).eq("id", id);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-primary">Your watchlist</h1>
            <p className="text-sm text-muted-foreground mt-1">
              We'll surface matching sales on the Sales page. Quiet by default — no notifications you didn't ask for.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link to="/sales"><Tag className="h-4 w-4 mr-1.5" />See sales</Link>
          </Button>
        </div>

        <Card className="p-5 rounded-3xl shadow-soft border-border/50 mb-6">
          <form onSubmit={(e) => { e.preventDefault(); add(newItem); }} className="flex gap-2">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add a staple (e.g. basmati rice)"
              className="rounded-xl bg-card"
            />
            <Button type="submit" variant="hero" size="sm" disabled={adding} className="rounded-xl">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </form>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {SUGGESTIONS.filter((s) => !items.some((i) => i.food_name === s)).map((s) => (
              <button
                key={s}
                onClick={() => add(s)}
                className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-muted transition-smooth"
              >
                + {s}
              </button>
            ))}
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <Card className="p-8 rounded-3xl text-center bg-gradient-warm">
            <BellRing className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Nothing watched yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add staples you regularly buy. We'll let you know when they go on sale.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <Card key={it.id} className="p-4 rounded-2xl border-border/50">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="font-medium capitalize">{it.food_name}</div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-muted-foreground" onClick={() => remove(it.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-32">Alert at ≥ {it.min_savings_pct}% off</span>
                  <Slider
                    value={[it.min_savings_pct]}
                    min={10}
                    max={50}
                    step={5}
                    onValueChange={(v) => updateThreshold(it.id, v[0])}
                    className="flex-1"
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
