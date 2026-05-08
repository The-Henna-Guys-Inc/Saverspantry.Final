import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Alert = {
  id: string;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string | null;
  metadata: any;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
};

const sevColor = (s: string) =>
  s === "critical" ? "destructive" : s === "warning" ? "default" : "secondary";

const AdminAlerts = () => {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

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
    const q = supabase.from("operational_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const { data } = showResolved ? await q : await q.eq("resolved", false);
    setAlerts((data ?? []) as Alert[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, showResolved]);

  const resolve = async (id: string) => {
    const { error } = await supabase.from("operational_alerts")
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: user!.id })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Alert resolved");
    load();
  };

  const runCheck = async () => {
    toast.loading("Running checks…", { id: "ops" });
    const { error } = await supabase.functions.invoke("ops-monitor");
    if (error) {
      toast.error(error.message, { id: "ops" });
    } else {
      toast.success("Checks complete", { id: "ops" });
      load();
    }
  };

  if (authLoading || checking) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Operational alerts</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowResolved((v) => !v)}>
              {showResolved ? "Hide resolved" : "Show resolved"}
            </Button>
            <Button size="sm" onClick={runCheck}>Run checks now</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : alerts.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-primary" />
            No {showResolved ? "" : "open "}alerts.
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant={sevColor(a.severity) as any}>{a.severity}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{a.alert_type}</span>
                      {a.resolved && <Badge variant="outline">resolved</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
                      <h3 className="font-semibold">{a.title}</h3>
                    </div>
                    {a.message && <p className="text-sm text-muted-foreground mt-1">{a.message}</p>}
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!a.resolved && (
                    <Button variant="outline" size="sm" onClick={() => resolve(a.id)}>Resolve</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminAlerts;
