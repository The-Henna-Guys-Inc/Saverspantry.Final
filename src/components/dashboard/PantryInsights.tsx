import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, AlertTriangle, Refrigerator, Trash2, RotateCw } from "lucide-react";

type PantryRow = { id: string; item: string; quantity: number; unit: string; expires_on: string | null; low_stock_threshold: number | null };
type ConsumptionRow = { id: string; item_name: string; quantity_used: number; was_before_expiry: boolean | null; used_at: string };

export const PantryInsights = ({ userId }: { userId: string }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PantryRow[]>([]);
  const [logs, setLogs] = useState<ConsumptionRow[]>([]);

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const [{ data: p }, { data: l }] = await Promise.all([
        supabase.from("pantry_items").select("id, item, quantity, unit, expires_on, low_stock_threshold").eq("user_id", userId),
        supabase.from("pantry_consumption_log").select("id, item_name, quantity_used, was_before_expiry, used_at").eq("user_id", userId).gte("used_at", since.toISOString()).order("used_at", { ascending: false }).limit(500),
      ]);
      setItems((p ?? []) as PantryRow[]);
      setLogs((l ?? []) as ConsumptionRow[]);
      setLoading(false);
    })();
  }, [userId]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);

    const expiringSoon = items
      .filter((i) => i.expires_on && new Date(i.expires_on) <= in7 && new Date(i.expires_on) >= today)
      .sort((a, b) => (a.expires_on! < b.expires_on! ? -1 : 1));
    const expired = items.filter((i) => i.expires_on && new Date(i.expires_on) < today);
    const lowStock = items.filter((i) => i.low_stock_threshold != null && i.quantity <= i.low_stock_threshold);

    const usedBefore = logs.filter((l) => l.was_before_expiry === true).length;
    const usedAfter = logs.filter((l) => l.was_before_expiry === false).length;
    const totalLogged = usedBefore + usedAfter;
    const wasteAvoidedRate = totalLogged > 0 ? (usedBefore / totalLogged) * 100 : null;

    const restock: Record<string, number> = {};
    for (const l of logs) {
      restock[l.item_name] = (restock[l.item_name] || 0) + 1;
    }
    const topUsed = Object.entries(restock)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { expiringSoon, expired, lowStock, wasteAvoidedRate, usedBefore, totalLogged, topUsed, totalItems: items.length };
  }, [items, logs]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-6 rounded-3xl bg-gradient-warm border-border/50 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Items in pantry</div>
          <div className="text-3xl font-bold text-primary tabular-nums mt-1 flex items-center gap-2">
            <Refrigerator className="h-6 w-6" />{stats.totalItems}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{stats.lowStock.length} low on stock</div>
        </Card>
        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Expiring this week</div>
          <div className="text-3xl font-bold text-primary tabular-nums mt-1 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-accent" />{stats.expiringSoon.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{stats.expired.length} already past expiry</div>
        </Card>
        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Waste avoided rate</div>
          <div className="text-3xl font-bold text-primary tabular-nums mt-1">
            {stats.wasteAvoidedRate == null ? "—" : `${stats.wasteAvoidedRate.toFixed(0)}%`}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.totalLogged === 0 ? "Deduct items as you use them to track this." : `${stats.usedBefore} of ${stats.totalLogged} used before expiry`}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          <h2 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-accent" />Expiring & expired</h2>
          {stats.expiringSoon.length + stats.expired.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Nothing expiring soon — nice work.</div>
          ) : (
            <ul className="space-y-2">
              {stats.expired.map((i) => (
                <li key={i.id} className="flex justify-between text-sm p-2 rounded-xl bg-destructive/10">
                  <span className="text-foreground">{i.item} <span className="text-muted-foreground">· {i.quantity} {i.unit}</span></span>
                  <span className="text-destructive font-semibold text-xs">expired</span>
                </li>
              ))}
              {stats.expiringSoon.map((i) => {
                const d = Math.round((new Date(i.expires_on!).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
                return (
                  <li key={i.id} className="flex justify-between text-sm p-2 rounded-xl bg-secondary">
                    <span className="text-foreground">{i.item} <span className="text-muted-foreground">· {i.quantity} {i.unit}</span></span>
                    <span className="text-accent font-semibold text-xs">in {d}d</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          <h2 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2"><RotateCw className="h-4 w-4" />Most-used (last 90 days)</h2>
          {stats.topUsed.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No deductions logged yet.</div>
          ) : (
            <ul className="space-y-3">
              {stats.topUsed.map((f, i) => {
                const max = stats.topUsed[0].count || 1;
                const pct = (f.count / max) * 100;
                return (
                  <li key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground/90 truncate pr-2">{f.name}</span>
                      <span className="font-semibold text-primary tabular-nums">{f.count}×</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-gradient-leaf" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {stats.lowStock.length > 0 && (
        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          <h2 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2"><Trash2 className="h-4 w-4" />Low on stock</h2>
          <div className="flex flex-wrap gap-2">
            {stats.lowStock.map((i) => (
              <span key={i.id} className="text-xs px-3 py-1.5 rounded-full bg-accent/15 text-foreground">
                {i.item} <span className="text-muted-foreground">· {i.quantity}/{i.low_stock_threshold} {i.unit}</span>
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
