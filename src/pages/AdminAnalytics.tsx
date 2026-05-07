import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Loader2, Shield, Users, Sparkles, Tag, Utensils, Refrigerator } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

type Event = { user_id: string; category: string; amount_usd: number; occurred_at: string; food_name: string | null };

const isoMonday = (d: Date) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};

const AdminAnalytics = () => {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [pantryCount, setPantryCount] = useState(0);
  const [saleCount, setSaleCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
      setChecking(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7 * 12);
      const [{ data: ev }, { count: pCount }, { count: sCount }] = await Promise.all([
        supabase
          .from("savings_events")
          .select("user_id, category, amount_usd, occurred_at, food_name")
          .gte("occurred_at", since.toISOString())
          .order("occurred_at", { ascending: false })
          .limit(5000),
        supabase.from("pantry_consumption_log").select("*", { count: "exact", head: true }),
        supabase.from("sale_observations").select("*", { count: "exact", head: true }),
      ]);
      setEvents((ev ?? []) as Event[]);
      setPantryCount(pCount ?? 0);
      setSaleCount(sCount ?? 0);
      setLoading(false);
    })();
  }, [isAdmin]);

  const stats = useMemo(() => {
    const users = new Set<string>();
    let totalSaved = 0;
    const byCategory: Record<string, number> = {};
    const byFood: Record<string, number> = {};
    for (const e of events) {
      users.add(e.user_id);
      const amt = Number(e.amount_usd) || 0;
      totalSaved += amt;
      byCategory[e.category] = (byCategory[e.category] || 0) + amt;
      const f = e.food_name || "Other";
      byFood[f] = (byFood[f] || 0) + amt;
    }
    const now = new Date();
    const weeks: { week: string; total: number; users: number }[] = [];
    const thisMonday = isoMonday(now);
    for (let i = 11; i >= 0; i--) {
      const ws = new Date(thisMonday);
      ws.setDate(ws.getDate() - i * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);
      const slice = events.filter((e) => {
        const d = new Date(e.occurred_at);
        return d >= ws && d < we;
      });
      const userSet = new Set(slice.map((e) => e.user_id));
      weeks.push({
        week: ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        total: Math.round(slice.reduce((s, e) => s + (Number(e.amount_usd) || 0), 0) * 100) / 100,
        users: userSet.size,
      });
    }
    const topFoods = Object.entries(byFood)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    return { activeUsers: users.size, totalSaved, byCategory, weeks, topFoods, count: events.length };
  }, [events]);

  if (authLoading || checking) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const catIcon: Record<string, typeof Sparkles> = {
    swap: Sparkles,
    sale: Tag,
    meal_plan: Utensils,
    pantry_use: Refrigerator,
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <Shield className="h-3.5 w-3.5" /> Admin
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">Platform analytics</h1>
        <p className="text-muted-foreground mb-8">Aggregated, anonymized activity across all ThriftPantry users (last 12 weeks).</p>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="p-6 rounded-3xl bg-gradient-warm border-border/50 shadow-soft">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Active users
                </div>
                <div className="text-3xl font-bold text-primary tabular-nums mt-1">{stats.activeUsers}</div>
              </Card>
              <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Total saved</div>
                <div className="text-3xl font-bold text-primary tabular-nums mt-1">${stats.totalSaved.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">{stats.count} actions</div>
              </Card>
              <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Pantry log entries</div>
                <div className="text-3xl font-bold text-primary tabular-nums mt-1">{pantryCount}</div>
              </Card>
              <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Sales submitted</div>
                <div className="text-3xl font-bold text-primary tabular-nums mt-1">{saleCount}</div>
              </Card>
            </div>

            <Card className="p-6 rounded-3xl border-border/50 shadow-soft mb-8">
              <h2 className="text-sm font-semibold text-primary mb-4">Weekly savings & active users</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.weeks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: 12,
                      }}
                    />
                    <Bar yAxisId="left" dataKey="total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Saved ($)" />
                    <Bar yAxisId="right" dataKey="users" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} name="Users" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
                <h2 className="text-sm font-semibold text-primary mb-4">By category</h2>
                <ul className="space-y-3">
                  {Object.entries(stats.byCategory).map(([k, v]) => {
                    const Icon = catIcon[k] ?? Sparkles;
                    const max = Math.max(...Object.values(stats.byCategory));
                    const pct = max > 0 ? (v / max) * 100 : 0;
                    return (
                      <li key={k}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-1.5 text-foreground/90">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            {k.replace("_", " ")}
                          </span>
                          <span className="font-semibold text-primary tabular-nums">${v.toFixed(2)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-gradient-leaf" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
                <h2 className="text-sm font-semibold text-primary mb-4">Top foods (platform-wide)</h2>
                {stats.topFoods.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">No data yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {stats.topFoods.map((f, i) => (
                      <li key={i} className="flex justify-between text-sm">
                        <span className="text-foreground/90 truncate pr-2">{i + 1}. {f.name}</span>
                        <span className="font-semibold text-primary tabular-nums">${f.value.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default AdminAnalytics;
