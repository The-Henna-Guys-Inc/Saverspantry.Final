import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, Wallet, Utensils, Users } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

type MealPlan = { id: string; week_start_date: string; plan: any };
type Profile = { household_size: number };

const isoMonday = (d: Date) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0,0,0,0);
  return x;
};

export const SpendReport = ({ userId }: { userId: string }) => {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [profile, setProfile] = useState<Profile>({ household_size: 1 });

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7 * 12);
      const [{ data: p }, { data: prof }] = await Promise.all([
        supabase.from("meal_plans").select("id, week_start_date, plan").eq("user_id", userId).gte("week_start_date", since.toISOString().slice(0,10)).order("week_start_date", { ascending: true }),
        supabase.from("profiles").select("household_size").eq("user_id", userId).maybeSingle(),
      ]);
      setPlans((p ?? []) as MealPlan[]);
      if (prof) setProfile({ household_size: prof.household_size ?? 1 });
      setLoading(false);
    })();
  }, [userId]);

  const stats = useMemo(() => {
    const weeks = plans.map((p) => {
      const total = Number(p.plan?.total_estimated_cost_usd ?? 0);
      const days = Array.isArray(p.plan?.days) ? p.plan.days : [];
      const meals = days.length * 3;
      return {
        week: new Date(p.week_start_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        total: Math.round(total * 100) / 100,
        meals,
      };
    });
    const grandTotal = weeks.reduce((s, w) => s + w.total, 0);
    const totalMeals = weeks.reduce((s, w) => s + w.meals, 0);
    const avgWeekly = weeks.length ? grandTotal / weeks.length : 0;
    const costPerMeal = totalMeals ? grandTotal / totalMeals : 0;
    const costPerPerson = avgWeekly / Math.max(1, profile.household_size);

    // Adherence: weeks with a plan vs weeks in window
    const now = new Date();
    const start = isoMonday(new Date(now.getTime() - 7 * 12 * 86400000));
    const weeksInWindow = Math.max(1, Math.round((isoMonday(now).getTime() - start.getTime()) / (7 * 86400000)) + 1);
    const adherence = (weeks.length / weeksInWindow) * 100;

    return { weeks, grandTotal, avgWeekly, costPerMeal, costPerPerson, adherence, weeksInWindow, weeksWithPlan: weeks.length };
  }, [plans, profile.household_size]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="p-6 rounded-3xl bg-gradient-warm border-border/50 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Avg weekly spend</div>
          <div className="text-3xl font-bold text-primary tabular-nums mt-1 flex items-center gap-2">
            <Wallet className="h-5 w-5" />${stats.avgWeekly.toFixed(0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">last 12 weeks</div>
        </Card>
        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Cost per meal</div>
          <div className="text-3xl font-bold text-primary tabular-nums mt-1 flex items-center gap-2">
            <Utensils className="h-5 w-5" />${stats.costPerMeal.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">across all planned meals</div>
        </Card>
        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Per person / week</div>
          <div className="text-3xl font-bold text-primary tabular-nums mt-1 flex items-center gap-2">
            <Users className="h-5 w-5" />${stats.costPerPerson.toFixed(0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">household of {profile.household_size}</div>
        </Card>
        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Plan adherence</div>
          <div className="text-3xl font-bold text-primary tabular-nums mt-1">{stats.adherence.toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground mt-1">{stats.weeksWithPlan} of {stats.weeksInWindow} weeks planned</div>
        </Card>
      </div>

      <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
        <h2 className="text-sm font-semibold text-primary mb-4">Weekly grocery spend</h2>
        {stats.weeks.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Generate a meal plan to start tracking spend.</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weeks}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12 }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Spend"]}
                />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
};
