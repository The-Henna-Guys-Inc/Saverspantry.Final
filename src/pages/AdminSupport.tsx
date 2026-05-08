import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, ArrowLeft } from "lucide-react";
import { TicketThread } from "@/components/SupportTickets";

type Ticket = {
  id: string; user_id: string; subject: string; category: string;
  status: string; priority: string; last_message_at: string; created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open", awaiting_user: "Awaiting user", resolved: "Resolved", closed: "Closed",
};

const FILTERS = ["open", "awaiting_user", "resolved", "closed", "all"] as const;

const AdminSupport = () => {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTERS[number]>("open");
  const [activeId, setActiveId] = useState<string | null>(null);

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
    let q = supabase.from("support_tickets")
      .select("id, user_id, subject, category, status, priority, last_message_at, created_at")
      .order("last_message_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, filter]);

  if (authLoading || checking) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <Shield className="h-3.5 w-3.5" /> Admin
        </div>
        <h1 className="text-3xl font-bold text-primary mb-6">Support inbox</h1>

        {activeId ? (
          <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
            <Button size="sm" variant="ghost" className="rounded-xl mb-4"
              onClick={() => { setActiveId(null); load(); }}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to inbox
            </Button>
            <TicketThread ticketId={activeId} userId={user.id} isAdmin={true} />
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-smooth capitalize ${
                    filter === f ? "bg-primary text-primary-foreground shadow-soft" : "bg-secondary text-secondary-foreground hover:bg-muted"
                  }`}>{f === "all" ? "All" : (STATUS_LABEL[f] ?? f)}</button>
              ))}
            </div>
            <Card className="p-2 rounded-3xl border-border/50 shadow-soft">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">No tickets in this view.</p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {tickets.map((t) => (
                    <li key={t.id}>
                      <button onClick={() => setActiveId(t.id)}
                        className="w-full text-left p-4 hover:bg-muted/40 transition-smooth rounded-2xl">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{t.subject}</span>
                          <Badge variant="secondary" className="text-[10px]">{STATUS_LABEL[t.status] ?? t.status}</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                          {t.category.replace("-", " ")} · {new Date(t.last_message_at).toLocaleString()} · user {t.user_id.slice(0, 8)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </main>
  );
};

export default AdminSupport;
