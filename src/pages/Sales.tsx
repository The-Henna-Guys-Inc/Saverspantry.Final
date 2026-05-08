import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tag, ThumbsUp, Flag, Loader2, MapPin, Trash2, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { AdminSaleDialog } from "@/components/AdminSaleDialog";
import { AdminSaleCsvUpload } from "@/components/AdminSaleCsvUpload";
import { CuisineFilterBar } from "@/components/CuisineFilterBar";
import { useCuisinePrefs } from "@/hooks/useCuisinePrefs";
import { detectItemCuisines } from "@/lib/cuisineHints";

type Sale = {
  id: string;
  food_name: string;
  store_name: string;
  store_chain: string | null;
  title: string;
  sale_price_usd: number;
  regular_price_usd: number | null;
  savings_pct: number | null;
  pack_size: string | null;
  ends_at: string;
  source: string;
  confirmation_count: number;
  city: string | null;
  region: string | null;
  address: string | null;
  google_maps_url: string | null;
};

const sourceMeta: Record<string, { label: string; cls: string }> = {
  kroger_api: { label: "Kroger", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  user_submitted: { label: "Community", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  admin_curated: { label: "Curated", cls: "bg-primary/10 text-primary" },
};

export default function Sales() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [watchedFoods, setWatchedFoods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const { cuisines, isFiltering, setEnabled } = useCuisinePrefs();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const loadSales = async () => {
    const { data: salesData } = await supabase
      .from("sale_observations")
      .select("*")
      .in("moderation_status", ["auto_approved", "approved"])
      .gt("ends_at", new Date().toISOString())
      .order("ends_at", { ascending: true })
      .limit(100);
    setSales((salesData ?? []) as Sale[]);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: salesData }, { data: wl }, { data: confirms }, { data: roles }] = await Promise.all([
        supabase
          .from("sale_observations")
          .select("*")
          .in("moderation_status", ["auto_approved", "approved"])
          .gt("ends_at", new Date().toISOString())
          .order("ends_at", { ascending: true })
          .limit(100),
        supabase.from("watchlist_items").select("food_name").eq("user_id", user.id),
        supabase.from("sale_confirmations").select("sale_observation_id").eq("user_id", user.id),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      setSales((salesData ?? []) as Sale[]);
      setWatchedFoods((wl ?? []).map((w: any) => w.food_name.toLowerCase()));
      setConfirmedIds(new Set((confirms ?? []).map((c: any) => c.sale_observation_id)));
      setIsAdmin((roles ?? []).some((r: any) => r.role === "admin"));
      setLoading(false);
    })();
  }, [user]);

  const matched = useMemo(() => {
    if (!watchedFoods.length) return [];
    return sales.filter((s) => watchedFoods.some((w) => s.food_name.toLowerCase().includes(w) || w.includes(s.food_name.toLowerCase())));
  }, [sales, watchedFoods]);

  const confirm = async (saleId: string) => {
    if (!user || confirmedIds.has(saleId)) return;
    setConfirming(saleId);
    const { error } = await supabase.from("sale_confirmations").insert({ sale_observation_id: saleId, user_id: user.id });
    setConfirming(null);
    if (error) return toast.error(error.message);
    setConfirmedIds((prev) => new Set(prev).add(saleId));
    setSales((prev) => prev.map((s) => (s.id === saleId ? { ...s, confirmation_count: s.confirmation_count + 1 } : s)));
  };

  const flag = async (saleId: string) => {
    if (!user) return;
    const reason = window.prompt("What's wrong? (incorrect price / expired / fake store / spam)") ?? "";
    if (!reason.trim()) return;
    const { error } = await supabase.from("sale_flags").insert({ sale_observation_id: saleId, user_id: user.id, reason: reason.slice(0, 80) });
    if (error) return toast.error(error.message);
    toast.success("Reported. Thanks for keeping the feed clean.");
  };

  const removeSale = async (saleId: string) => {
    if (!window.confirm("Remove this sale from the feed?")) return;
    const { error } = await supabase.from("sale_observations").delete().eq("id", saleId);
    if (error) return toast.error(error.message);
    setSales((prev) => prev.filter((s) => s.id !== saleId));
    toast.success("Removed.");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-primary">Sales near you</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Some verified by stores, some by the community. We never rank by paid placement.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && user && <AdminSaleCsvUpload userId={user.id} onCreated={loadSales} />}
            {isAdmin && user && <AdminSaleDialog userId={user.id} onCreated={loadSales} />}
            <Button asChild variant="hero" size="sm" className="rounded-xl">
              <Link to="/watchlist">Manage watchlist</Link>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="watching" className="w-full">
          <TabsList className="rounded-xl">
            <TabsTrigger value="watching" className="rounded-lg">
              On your watchlist {matched.length > 0 && <Badge variant="secondary" className="ml-2">{matched.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-lg">All sales</TabsTrigger>
          </TabsList>

          <TabsContent value="watching" className="mt-5">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : matched.length === 0 ? (
              <Card className="p-8 rounded-3xl text-center bg-gradient-warm">
                <Tag className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Nothing matched yet</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Add staples you regularly buy and we'll surface sales here.
                </p>
                <Button asChild variant="hero" size="sm" className="rounded-xl">
                  <Link to="/watchlist">Build my watchlist</Link>
                </Button>
              </Card>
            ) : (
              <SaleList sales={matched} onConfirm={confirm} onFlag={flag} confirming={confirming} confirmedIds={confirmedIds} isAdmin={isAdmin} onRemove={removeSale} userId={user?.id ?? ""} onRefresh={loadSales} />
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-5">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : sales.length === 0 ? (
              <Card className="p-8 rounded-3xl text-center bg-gradient-warm">
                <p className="text-sm text-muted-foreground">No active sales right now. Check back soon.</p>
              </Card>
            ) : (
              <SaleList sales={sales} onConfirm={confirm} onFlag={flag} confirming={confirming} confirmedIds={confirmedIds} isAdmin={isAdmin} onRemove={removeSale} userId={user?.id ?? ""} onRefresh={loadSales} />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function SaleList({
  sales, onConfirm, onFlag, confirming, confirmedIds, isAdmin, onRemove, userId, onRefresh,
}: {
  sales: Sale[];
  onConfirm: (id: string) => void;
  onFlag: (id: string) => void;
  confirming: string | null;
  confirmedIds: Set<string>;
  isAdmin: boolean;
  onRemove: (id: string) => void;
  userId: string;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      {sales.map((s) => {
        const meta = sourceMeta[s.source] ?? sourceMeta.user_submitted;
        const verified = s.confirmation_count >= 3;
        return (
          <Card key={s.id} className="p-5 rounded-3xl shadow-soft border-border/50 hover:shadow-glow transition-smooth">
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>
                    {meta.label}
                  </span>
                  {verified && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      Community verified
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold text-foreground mt-1.5">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {s.store_name}{s.city ? ` · ${s.city}${s.region ? `, ${s.region}` : ""}` : ""}
                  </span>
                </p>
                {s.address && (
                  <p className="text-xs text-muted-foreground mt-0.5 pl-[18px]">{s.address}</p>
                )}
                {(s.google_maps_url || s.address) && (
                  <a
                    href={s.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.store_name} ${s.address ?? ""} ${s.city ?? ""} ${s.region ?? ""}`.trim())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1 pl-[18px]"
                  >
                    Open in Google Maps <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-bold text-primary tabular-nums">${Number(s.sale_price_usd).toFixed(2)}</div>
                {s.regular_price_usd && (
                  <div className="text-xs text-muted-foreground line-through tabular-nums">${Number(s.regular_price_usd).toFixed(2)}</div>
                )}
                {s.savings_pct && (
                  <div className="text-xs font-semibold text-primary mt-0.5">Save {Math.round(Number(s.savings_pct))}%</div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50 flex-wrap">
              <div className="text-xs text-muted-foreground">
                {s.pack_size && <span className="mr-3">{s.pack_size}</span>}
                Ends {formatDistanceToNow(new Date(s.ends_at), { addSuffix: true })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl h-8 text-xs"
                  onClick={() => onConfirm(s.id)}
                  disabled={confirmedIds.has(s.id) || confirming === s.id}
                >
                  {confirming === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className={`h-3 w-3 ${confirmedIds.has(s.id) ? "fill-current" : ""}`} />}
                  <span className="ml-1.5">{confirmedIds.has(s.id) ? "Confirmed" : "I saw it"}</span>
                  {s.confirmation_count > 0 && <span className="ml-1 text-muted-foreground">· {s.confirmation_count}</span>}
                </Button>
                <Button size="sm" variant="ghost" className="rounded-xl h-8 text-xs text-muted-foreground" onClick={() => onFlag(s.id)}>
                  <Flag className="h-3 w-3" />
                </Button>
                {isAdmin && (
                  <>
                    <AdminSaleDialog
                      userId={userId}
                      onCreated={onRefresh}
                      sale={{
                        id: s.id,
                        food_name: s.food_name,
                        title: s.title,
                        store_name: s.store_name,
                        store_chain: s.store_chain,
                        sale_price_usd: s.sale_price_usd,
                        regular_price_usd: s.regular_price_usd,
                        pack_size: s.pack_size,
                        address: s.address,
                        city: s.city,
                        region: s.region,
                        google_maps_url: s.google_maps_url,
                        ends_at: s.ends_at,
                      }}
                      trigger={
                        <Button size="sm" variant="ghost" className="rounded-xl h-8 text-xs">
                          <Pencil className="h-3 w-3" />
                        </Button>
                      }
                    />
                    <Button size="sm" variant="ghost" className="rounded-xl h-8 text-xs text-destructive" onClick={() => onRemove(s.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
