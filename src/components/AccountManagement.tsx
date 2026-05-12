import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, Trash2, ShieldAlert, Loader2, ScrollText, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const AccountManagement = () => {
  const { user } = useAuth();
  const [pendingAt, setPendingAt] = useState<string | null>(null);
  const [purgeAt, setPurgeAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<"export" | "delete" | "cancel" | null>(null);

  const refresh = async () => {
    if (!user) return;
    const { data: req } = await supabase.from("account_deletion_requests")
      .select("scheduled_purge_at, cancelled_at, purged_at")
      .eq("user_id", user.id).maybeSingle();
    const active = req && !req.cancelled_at && !req.purged_at ? req : null;
    setPendingAt(active ? new Date().toISOString() : null);
    setPurgeAt(active?.scheduled_purge_at ?? null);
  };
  useEffect(() => { refresh(); }, [user]);

  const callFn = async (path: string, method: "GET" | "POST" = "POST", body?: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sign in first");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  };

  const exportData = async () => {
    setBusy("export");
    try {
      const res = await callFn("data-export", "GET");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `saverspantry-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Your data is downloading.");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const requestDelete = async () => {
    setBusy("delete");
    try {
      const res = await callFn("account-deletion", "POST", { action: "request" });
      if (!res.ok) throw new Error("Could not schedule deletion");
      const j = await res.json();
      setPurgeAt(j.scheduled_purge_at);
      setPendingAt(new Date().toISOString());
      toast.success("Account deletion scheduled. You have 30 days to cancel.");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const cancelDelete = async () => {
    setBusy("cancel");
    try {
      const res = await callFn("account-deletion", "POST", { action: "cancel" });
      if (!res.ok) throw new Error("Could not cancel");
      setPendingAt(null); setPurgeAt(null);
      toast.success("Deletion cancelled — welcome back!");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6 mt-8">
      {pendingAt && purgeAt && (
        <Card className="p-5 rounded-3xl border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-destructive">Account scheduled for deletion</div>
              <p className="text-xs text-muted-foreground mt-1">
                Your account and all data will be permanently removed on{" "}
                <strong className="text-foreground">{new Date(purgeAt).toLocaleDateString()}</strong>.
                Cancel any time before then to keep your account.
              </p>
              <Button variant="outline" size="sm" className="rounded-xl mt-3"
                onClick={cancelDelete} disabled={busy !== null}>
                {busy === "cancel" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                Cancel deletion
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-3">
          <ScrollText className="h-3.5 w-3.5" /> Legal
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/legal/tos"><Button variant="outline" size="sm" className="rounded-xl">Terms of Service</Button></Link>
          <Link to="/legal/privacy"><Button variant="outline" size="sm" className="rounded-xl">Privacy Policy</Button></Link>
        </div>
      </Card>

      <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
        <h3 className="text-sm font-semibold text-primary mb-1">Your data</h3>
        <p className="text-xs text-muted-foreground mb-4">Download a copy of everything we store about you.</p>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={exportData} disabled={busy !== null}>
          {busy === "export" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
          Download my data
        </Button>
      </Card>

      {!pendingAt && (
        <Card className="p-6 rounded-3xl border-destructive/30">
          <h3 className="text-sm font-semibold text-destructive mb-1">Danger zone</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Delete your account. We'll keep your data for 30 days in case you change your mind, then permanently remove everything.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="rounded-xl">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your pantry, savings history, meal plans, and all other data will be scheduled for permanent deletion in 30 days.
                  You can cancel any time before then by signing back in.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Keep my account</AlertDialogCancel>
                <AlertDialogAction onClick={requestDelete} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, schedule deletion
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      )}
    </div>
  );
};
