import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useHousehold } from "@/hooks/useHousehold";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";

export default function JoinHousehold() {
  const { code = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { redeemInvite } = useHousehold();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "joining" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (authLoading || !user || status !== "idle") return;
    setStatus("joining");
    redeemInvite(code)
      .then(() => {
        setStatus("done");
        toast.success("You've joined the household!");
        setTimeout(() => navigate("/settings"), 1200);
      })
      .catch((e) => {
        setStatus("error");
        setMessage(e.message ?? "Could not join");
      });
  }, [authLoading, user, code, status, redeemInvite, navigate]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to={`/auth?redirect=/join/${code}`} replace />;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 rounded-3xl border-border/50 shadow-soft max-w-md w-full text-center">
        <div className="h-12 w-12 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
          <Users className="h-6 w-6 text-primary" />
        </div>
        {status === "joining" && (
          <>
            <h1 className="text-xl font-bold text-primary mb-2">Joining household…</h1>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
          </>
        )}
        {status === "done" && (
          <>
            <h1 className="text-xl font-bold text-primary mb-2">You're in!</h1>
            <p className="text-sm text-muted-foreground">Redirecting to your settings…</p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-xl font-bold text-primary mb-2">Couldn't join</h1>
            <p className="text-sm text-muted-foreground mb-4">{message}</p>
            <Button variant="hero" onClick={() => navigate("/settings")} className="rounded-xl">Go to settings</Button>
          </>
        )}
      </Card>
    </main>
  );
}
