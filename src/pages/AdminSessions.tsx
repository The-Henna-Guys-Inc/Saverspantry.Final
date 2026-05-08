import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";

const AdminSessions = () => {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [maxHours, setMaxHours] = useState(720);
  const [idleMin, setIdleMin] = useState(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      const { data } = await supabase.from("admin_session_settings").select("*").maybeSingle();
      if (data) {
        setMaxHours(data.session_max_hours);
        setIdleMin(data.idle_timeout_minutes);
      }
      setLoading(false);
    })();
  }, [isAdmin]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("admin_session_settings")
      .update({ session_max_hours: maxHours, idle_timeout_minutes: idleMin, updated_by: user!.id, updated_at: new Date().toISOString() })
      .eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    await supabase.from("admin_audit_log").insert({
      admin_user_id: user!.id,
      action: "session.update_settings",
      metadata: { session_max_hours: maxHours, idle_timeout_minutes: idleMin },
    });
    toast.success("Session settings saved");
  };

  const signOutEverywhere = async () => {
    if (!confirm("Sign yourself out of all devices? This will not affect other users.")) return;
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) return toast.error(error.message);
    await supabase.from("admin_audit_log").insert({
      admin_user_id: user!.id,
      action: "session.signout_global",
    });
    toast.success("Signed out everywhere");
  };

  if (authLoading || checking || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Session controls</h1>
        </div>

        <Card className="p-5 space-y-4">
          <div>
            <h2 className="font-semibold mb-1">Session limits</h2>
            <p className="text-sm text-muted-foreground mb-3">
              The frontend will sign users out automatically when these thresholds are crossed.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Maximum session length (hours)</Label>
            <Input type="number" min={1} max={8760} value={maxHours} onChange={(e) => setMaxHours(parseInt(e.target.value || "0"))} />
          </div>
          <div className="space-y-2">
            <Label>Idle timeout (minutes)</Label>
            <Input type="number" min={5} max={1440} value={idleMin} onChange={(e) => setIdleMin(parseInt(e.target.value || "0"))} />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">Your sessions</h2>
          <p className="text-sm text-muted-foreground">
            Sign yourself out of every device. Use this if you suspect your account was used elsewhere.
          </p>
          <Button variant="outline" onClick={signOutEverywhere}>
            <LogOut className="h-4 w-4 mr-2" />Sign out of all devices
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default AdminSessions;
