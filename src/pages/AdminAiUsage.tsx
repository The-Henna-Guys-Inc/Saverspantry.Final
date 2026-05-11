import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Loader2, Shield, Sparkles, DollarSign, Database, AlertTriangle } from "lucide-react";

type Row = {
  function_name: string;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_estimate_usd: number;
  cached: boolean;
  status: string;
  created_at: string;
};

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

const AdminAiUsage = () => {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
      setChecking(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase.from("ai_usage_log")
        .select("function_name, model, prompt_tokens, completion_tokens, total_tokens, cost_estimate_usd, cached, status, created_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(5000);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, [isAdmin]);

  const stats = useMemo(() => {
    const dayMs = 86400000;
    const now = Date.now();
    const inWindow = (r: Row, days: number) => now - new Date(r.created_at).getTime() < days * dayMs;
    const sum = (rs: Row[], k: keyof Row) => rs.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const last7 = rows.filter((r) => inWindow(r, 7));
    const last30 = rows.filter((r) => inWindow(r, 30));
    const byFn = new Map<string, { calls: number; cached: number; tokens: number; cost: number; errors: number }>();
    for (const r of last30) {
      const e = byFn.get(r.function_name) ?? { calls: 0, cached: 0, tokens: 0, cost: 0, errors: 0 };
      e.calls += 1;
      if (r.cached) e.cached += 1;
      e.tokens += r.total_tokens;
      e.cost += Number(r.cost_estimate_usd) || 0;
      if (r.status !== "ok") e.errors += 1;
      byFn.set(r.function_name, e);
    }
    return {
      cost7: sum(last7, "cost_estimate_usd"),
      cost30: sum(last30, "cost_estimate_usd"),
      calls7: last7.length,
      calls30: last30.length,
      cacheHits30: last30.filter((r) => r.cached).length,
      tokens30: sum(last30, "total_tokens"),
      errors30: last30.filter((r) => r.status !== "ok").length,
      byFn: Array.from(byFn.entries()).sort((a, b) => b[1].cost - a[1].cost),
    };
  }, [rows]);

  if (authLoading || checking) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const cacheRate = stats.calls30 > 0 ? Math.round((stats.cacheHits30 / stats.calls30) * 100) : 0;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-5xl mx-auto px-6 py-6 sm:py-10">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <Shield className="h-3.5 w-3.5" /> Admin
        </div>
        <h1 className="text-3xl font-bold text-primary mb-6">AI usage & cost</h1>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Stat icon={<DollarSign className="h-4 w-4" />} label="Cost · 7d" value={usd(stats.cost7)} />
              <Stat icon={<DollarSign className="h-4 w-4" />} label="Cost · 30d" value={usd(stats.cost30)} />
              <Stat icon={<Sparkles className="h-4 w-4" />} label="Calls · 30d" value={fmt(stats.calls30)} />
              <Stat icon={<Database className="h-4 w-4" />} label="Cache hit · 30d" value={`${cacheRate}%`} />
            </div>

            <Card className="p-5 rounded-3xl border-border/50 shadow-soft mb-6">
              <div className="text-xs uppercase tracking-wider text-accent mb-3">By function · last 30 days</div>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="text-left">
                      <th className="px-2 py-1.5">Function</th>
                      <th className="px-2 py-1.5 text-right">Calls</th>
                      <th className="px-2 py-1.5 text-right">Cache</th>
                      <th className="px-2 py-1.5 text-right">Tokens</th>
                      <th className="px-2 py-1.5 text-right">Cost</th>
                      <th className="px-2 py-1.5 text-right">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byFn.map(([fn, e]) => (
                      <tr key={fn} className="border-t border-border/40">
                        <td className="px-2 py-2 font-medium">{fn}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmt(e.calls)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{e.calls ? Math.round((e.cached / e.calls) * 100) : 0}%</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmt(e.tokens)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{usd(e.cost)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{e.errors > 0 ? <span className="text-destructive">{e.errors}</span> : "—"}</td>
                      </tr>
                    ))}
                    {stats.byFn.length === 0 && (
                      <tr><td colSpan={6} className="px-2 py-6 text-center text-muted-foreground text-sm">No AI calls in the last 30 days.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {stats.errors30 > 0 && (
              <Card className="p-5 rounded-3xl border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-2">
                  <AlertTriangle className="h-4 w-4" /> {stats.errors30} error{stats.errors30 === 1 ? "" : "s"} in the last 30 days
                </div>
                <p className="text-xs text-muted-foreground">Check edge function logs for details.</p>
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  );
};

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4 rounded-2xl border-border/50 shadow-soft">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon}{label}</div>
      <div className="text-xl font-bold text-primary tabular-nums">{value}</div>
    </Card>
  );
}

export default AdminAiUsage;
