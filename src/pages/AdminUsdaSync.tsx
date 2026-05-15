import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Shield, RefreshCw, ExternalLink, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";

type SyncRow = {
  id: string;
  status: string;
  ran_at: string;
  report_month: string | null;
  rows_imported: number | null;
  error_message: string | null;
  triggered_by: string | null;
  source_url?: string | null;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleString();

const AdminUsdaSync = () => {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<SyncRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [overrideUrl, setOverrideUrl] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
      setChecking(false);
    })();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("usda_sync_log")
      .select("*").order("ran_at", { ascending: false }).limit(100);
    if (error) toast.error(error.message);
    setRows((data ?? []) as SyncRow[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const runSync = async () => {
    setRunning(true);
    try {
      const body: Record<string, unknown> = { triggered_by: "admin_manual" };
      if (overrideUrl.trim()) body.override_url = overrideUrl.trim();
      const { data, error } = await supabase.functions.invoke("usda-food-plans-sync", { body });
      if (error) throw error;
      toast.success(data?.message ?? "Sync triggered");
      setOverrideUrl("");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Sync failed");
    } finally {
      setRunning(false);
    }
  };

  if (authLoading || checking) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <Shield className="h-3.5 w-3.5" /> Admin
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">USDA food plans sync</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Monthly auto-pull of USDA Cost of Food reports. Runs the 1st of each month at 10:00 UTC.
        </p>

        <Card className="p-4 sm:p-5 rounded-3xl border-border/50 shadow-soft mb-6">
          <div className="text-xs uppercase tracking-wider text-accent mb-3">Manual trigger</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={overrideUrl}
              onChange={(e) => setOverrideUrl(e.target.value)}
              placeholder="Optional override URL (PDF/XLSX)"
              className="rounded-xl"
            />
            <Button onClick={runSync} disabled={running} variant="hero" className="rounded-xl shrink-0">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Run sync now</span>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Leave override blank to use USDA's standard URL pattern. Use override only if USDA changes their file location.
          </p>
        </Card>

        <Card className="p-4 sm:p-5 rounded-3xl border-border/50 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider text-accent">Sync history · last 100</div>
            <Button onClick={load} variant="ghost" size="sm" className="rounded-lg">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No sync runs yet. Trigger one above.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-2 py-1.5">Status</th>
                    <th className="px-2 py-1.5">Ran at</th>
                    <th className="px-2 py-1.5">Report month</th>
                    <th className="px-2 py-1.5 text-right">Rows</th>
                    <th className="px-2 py-1.5">Trigger</th>
                    <th className="px-2 py-1.5">Source</th>
                    <th className="px-2 py-1.5">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/40 align-top">
                      <td className="px-2 py-2">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs">{fmtDate(r.ran_at)}</td>
                      <td className="px-2 py-2 text-xs">{r.report_month ?? "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.rows_imported ?? 0}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{r.triggered_by ?? "—"}</td>
                      <td className="px-2 py-2 text-xs">
                        {r.source_url ? (
                          <a href={r.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            link <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-2 text-xs text-destructive max-w-[200px] truncate" title={r.error_message ?? ""}>
                        {r.error_message ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
};

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "success" || s === "ok") {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary"><CheckCircle2 className="h-3 w-3" />success</span>;
  }
  if (s === "no_file_found" || s === "skipped" || s === "warning") {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent/30 text-foreground"><AlertTriangle className="h-3 w-3" />{s}</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive"><XCircle className="h-3 w-3" />{s}</span>;
}

export default AdminUsdaSync;
