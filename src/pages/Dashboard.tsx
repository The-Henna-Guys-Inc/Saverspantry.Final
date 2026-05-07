import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, BarChart3, TrendingDown, Sparkles, Tag, Utensils } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { PantryInsights } from "@/components/dashboard/PantryInsights";
import { SpendReport } from "@/components/dashboard/SpendReport";

type Event = {
  id: string;
  category: string;
  food_name: string | null;
  amount_usd: number;
  occurred_at: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  swap: "Swaps",
  sale: "Sales",
  meal_plan: "Meal plans",
  pantry_use: "Pantry use",
};

const CATEGORY_ICON: Record<string, typeof Sparkles> = {
  swap: Sparkles,
  sale: Tag,
  meal_plan: Utensils,
  pantry_use: TrendingDown,
};

// Use design tokens via CSS vars so colors honor the theme
const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--secondary-foreground))",
];

const isoMonday = (d: Date) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7 * 12);
      const { data } = await supabase
        .from("savings_events")
        .select("id, category, food_name, amount_usd, occurred_at")
        .eq("user_id", user.id)
        .gte("occurred_at", since.toISOString())
        .order("occurred_at", { ascending: false })
        .limit(1000);
      setEvents((data ?? []) as Event[]);
      setLoading(false);
    })();
  }, [user]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let lifetime = 0;
    let thisMonth = 0;
    const byCategory: Record<string, number> = {};
    const byFood: Record<string, number> = {};

    for (const e of events) {
      const amt = Number(e.amount_usd) || 0;
      lifetime += amt;
      if (new Date(e.occurred_at) >= monthStart) thisMonth += amt;
      byCategory[e.category] = (byCategory[e.category] || 0) + amt;
      const food = e.food_name || "Other";
      byFood[food] = (byFood[food] || 0) + amt;
    }

    // 12-week trend
    const weeks: { week: string; total: number }[] = [];
    const thisMonday = isoMonday(now);
    for (let i = 11; i >= 0; i--) {
      const ws = new Date(thisMonday);
      ws.setDate(ws.getDate() - i * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);
      const total = events
        .filter((e) => {
          const d = new Date(e.occurred_at);
          return d >= ws && d < we;
        })
        .reduce((s, e) => s + (Number(e.amount_usd) || 0), 0);
      weeks.push({
        week: ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        total: Math.round(total * 100) / 100,
      });
    }

    const categoryData = Object.entries(byCategory)
      .map(([k, v]) => ({ name: CATEGORY_LABEL[k] ?? k, value: Math.round(v * 100) / 100, key: k }))
      .filter((d) => d.value > 0);

    const topFoods = Object.entries(byFood)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { lifetime, thisMonth, weeks, categoryData, topFoods, count: events.length };
  }, [events]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <BarChart3 className="h-3.5 w-3.5" /> Dashboard
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">Your dashboard</h1>
        <p className="text-muted-foreground mb-8">Savings, pantry insights, and weekly grocery spend — all in one place.</p>

        <Tabs defaultValue="savings" className="w-full">
          <TabsList className="rounded-2xl mb-6">
            <TabsTrigger value="savings" className="rounded-xl">Savings</TabsTrigger>
            <TabsTrigger value="pantry" className="rounded-xl">Pantry</TabsTrigger>
            <TabsTrigger value="spend" className="rounded-xl">Spend</TabsTrigger>
          </TabsList>

          <TabsContent value="savings">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : stats.count === 0 ? (
          <Card className="p-10 rounded-3xl border-border/50 text-center">
            <div className="text-5xl mb-3">🌱</div>
            <h2 className="text-xl font-semibold text-primary mb-2">No savings yet</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Save a swap from the Equivalency Engine, capture a sale, or generate a meal plan — your savings will start showing up here.
            </p>
          </Card>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <Card className="p-6 rounded-3xl bg-gradient-warm border-border/50 shadow-soft">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Lifetime saved</div>
                <div className="text-3xl font-bold text-primary tabular-nums mt-1">${stats.lifetime.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">across {stats.count} action{stats.count === 1 ? "" : "s"}</div>
              </Card>
              <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">This month</div>
                <div className="text-3xl font-bold text-primary tabular-nums mt-1">${stats.thisMonth.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">resets on the 1st</div>
              </Card>
              <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Weekly avg (12w)</div>
                <div className="text-3xl font-bold text-primary tabular-nums mt-1">
                  ${(stats.weeks.reduce((s, w) => s + w.total, 0) / 12).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">based on the last 12 weeks</div>
              </Card>
            </div>

            {/* Trend chart */}
            <Card className="p-6 rounded-3xl border-border/50 shadow-soft mb-8">
              <h2 className="text-sm font-semibold text-primary mb-4">Savings trend — last 12 weeks</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.weeks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`$${v.toFixed(2)}`, "Saved"]}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* By category */}
              <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
                <h2 className="text-sm font-semibold text-primary mb-4">Where it's coming from</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.categoryData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} paddingAngle={2}>
                        {stats.categoryData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.75rem",
                          fontSize: 12,
                        }}
                        formatter={(v: number) => `$${v.toFixed(2)}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {stats.categoryData.map((c) => {
                    const Icon = CATEGORY_ICON[c.key] ?? Sparkles;
                    return (
                      <div key={c.key} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        <span>{c.name}</span>
                        <span className="ml-auto font-semibold text-foreground tabular-nums">${c.value.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Top foods */}
              <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
                <h2 className="text-sm font-semibold text-primary mb-4">Top foods you've saved on</h2>
                {stats.topFoods.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">No food-level data yet.</div>
                ) : (
                  <ul className="space-y-3">
                    {stats.topFoods.map((f, i) => {
                      const max = stats.topFoods[0].value || 1;
                      const pct = (f.value / max) * 100;
                      return (
                        <li key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-foreground/90 truncate pr-2">{f.name}</span>
                            <span className="font-semibold text-primary tabular-nums">${f.value.toFixed(2)}</span>
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
          </>
        )}
      </div>
    </main>
  );
};

export default Dashboard;
