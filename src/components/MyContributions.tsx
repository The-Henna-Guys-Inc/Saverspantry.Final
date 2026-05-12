import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Row = {
  id: string;
  title: string;
  store_name: string;
  sale_price_usd: number;
  moderation_status: string;
  created_at: string;
  ends_at: string;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  auto_approved: { label: "Live", cls: "bg-primary/10 text-primary" },
  approved: { label: "Live", cls: "bg-primary/10 text-primary" },
  pending_review: { label: "Pending review", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive" },
};

export function MyContributions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentRejections, setRecentRejections] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sale_observations")
        .select("id, title, store_name, sale_price_usd, moderation_status, created_at, ends_at")
        .eq("submitted_by_user_id", user.id)
        .eq("source", "user_submitted")
        .order("created_at", { ascending: false })
        .limit(30);
      setRows((data ?? []) as Row[]);
      const thirty = new Date(Date.now() - 30 * 86_400_000).toISOString();
      setRecentRejections(
        (data ?? []).filter(
          (r: any) => r.moderation_status === "rejected" && r.created_at >= thirty,
        ).length,
      );
      setLoading(false);
    })();
  }, [user]);

  return (
    <Card className="p-6 rounded-3xl border-border/50 shadow-soft mt-6">
      <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
        <Sparkles className="h-3.5 w-3.5" /> Your contributions
      </div>
      <h2 className="text-lg font-semibold text-primary mb-1">Deals you've shared</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Submissions are auto-approved by default. Help-keep the feed clean and we'll keep yours flowing.
      </p>

      {recentRejections >= 3 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs mb-4">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            {recentRejections} of your recent submissions were rejected. New submissions will go to manual review until things settle.
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">You haven't submitted any deals yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const meta = STATUS_META[r.moderation_status] ?? STATUS_META.pending_review;
            return (
              <li key={r.id} className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-secondary/50">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {r.store_name} · ${Number(r.sale_price_usd).toFixed(2)} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.cls}`}>
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
