import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, BellRing, Tag, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type WatchItem = {
  id: string;
  food_name: string;
  min_savings_usd: number;
  min_savings_pct: number;
  snoozed_until: string | null;
  created_at: string;
};

type SaleMatch = {
  id: string;
  food_name: string;
  title: string;
  store_name: string;
  sale_price_usd: number;
  regular_price_usd: number | null;
  savings_pct: number | null;
  starts_at: string;
  ends_at: string;
};

export const WatchlistActivity = ({ userId }: { userId: string }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [matches, setMatches] = useState<SaleMatch[]>([]);

  useEffect(() => {
    (async () => {
      const { data: w } = await supabase
        .from("watchlist_items")
        .select("id, food_name, min_savings_usd, min_savings_pct, snoozed_until, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      const watchItems = (w ?? []) as WatchItem[];
      setItems(watchItems);

      if (watchItems.length > 0) {
        const names = watchItems.map((x) => x.food_name);
        const { data: s } = await supabase
          .from("sale_observations")
          .select("id, food_name, title, store_name, sale_price_usd, regular_price_usd, savings_pct, starts_at, ends_at")
          .in("food_name", names)
          .gte("ends_at", new Date().toISOString())
          .in("moderation_status", ["auto_approved", "approved"])
          .order("starts_at", { ascending: false })
          .limit(20);
        setMatches((s ?? []) as SaleMatch[]);
      }
      setLoading(false);
    })();
  }, [userId]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (items.length === 0) {
    return (
      <Card className="p-10 rounded-3xl border-border/50 text-center">
        <div className="text-5xl mb-3">👀</div>
        <h2 className="text-xl font-semibold text-primary mb-2">Your watchlist is empty</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
          Add foods you regularly buy and we'll surface matching sales here.
        </p>
        <Button asChild variant="hero" className="rounded-xl">
          <Link to="/watchlist">Manage watchlist</Link>
        </Button>
      </Card>
    );
  }

  const now = new Date();
  const active = items.filter((i) => !i.snoozed_until || new Date(i.snoozed_until) <= now);
  const snoozed = items.filter((i) => i.snoozed_until && new Date(i.snoozed_until) > now);

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-6 rounded-3xl bg-gradient-warm border-border/50 shadow-soft">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Active watches
          </div>
          <div className="text-3xl font-bold text-primary tabular-nums mt-1">{active.length}</div>
        </Card>
        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Snoozed
          </div>
          <div className="text-3xl font-bold text-primary tabular-nums mt-1">{snoozed.length}</div>
        </Card>
        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <BellRing className="h-3.5 w-3.5" /> Live matches
          </div>
          <div className="text-3xl font-bold text-primary tabular-nums mt-1">{matches.length}</div>
        </Card>
      </div>

      <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-primary">Sales matching your watchlist</h2>
          <Button asChild size="sm" variant="ghost" className="rounded-xl">
            <Link to="/watchlist">Edit watchlist</Link>
          </Button>
        </div>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No live sales for your watched foods right now. We'll keep looking.
          </p>
        ) : (
          <ul className="space-y-3">
            {matches.map((m) => (
              <li key={m.id} className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/40">
                <Tag className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{m.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.store_name} · {m.food_name}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-primary tabular-nums">${Number(m.sale_price_usd).toFixed(2)}</div>
                  {m.savings_pct ? (
                    <Badge variant="secondary" className="text-[10px] mt-0.5">-{Math.round(m.savings_pct)}%</Badge>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
        <h2 className="text-sm font-semibold text-primary mb-4">Your watched foods</h2>
        <div className="flex flex-wrap gap-2">
          {items.map((i) => {
            const isSnoozed = i.snoozed_until && new Date(i.snoozed_until) > now;
            return (
              <Badge
                key={i.id}
                variant={isSnoozed ? "outline" : "secondary"}
                className="rounded-full px-3 py-1"
              >
                {i.food_name}
                <span className="ml-2 text-[10px] opacity-70">
                  ≥ ${i.min_savings_usd} / {i.min_savings_pct}%
                </span>
              </Badge>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
