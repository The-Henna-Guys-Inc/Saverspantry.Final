import { useEffect, useMemo, useState } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, Check, X, ExternalLink, Flag, MapPin, Sparkles, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { AdminFlyerConfirmDialog } from "@/components/AdminFlyerConfirmDialog";

type Deal = {
  id: string;
  food_name: string;
  title: string;
  store_name: string;
  store_chain: string | null;
  city: string | null;
  region: string | null;
  address: string | null;
  sale_price_usd: number;
  regular_price_usd: number | null;
  savings_pct: number | null;
  pack_size: string | null;
  ends_at: string;
  source: string;
  moderation_status: string;
  flag_count: number;
  confirmation_count: number;
  photo_url: string | null;
  submitted_by_user_id: string | null;
  created_at: string;
  category: string | null;
};

type QueueMode = "pending" | "flagged" | "recent_user";

const AdminDeals = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const batchFilter = searchParams.get("batch");
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<QueueMode>("pending");
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [batchInfo, setBatchInfo] = useState<{ extracted_items_count: number; ai_cost_usd: number; original_filename: string; extraction_status: string } | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Filters
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [itemQuery, setItemQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [newlyExtracted, setNewlyExtracted] = useState(false);

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
    let q = supabase.from("sale_observations").select("*").limit(300);
    if (batchFilter) {
      q = q.eq("extraction_batch_id", batchFilter).eq("moderation_status", "pending_review");
    } else if (mode === "pending") {
      q = q.eq("moderation_status", "pending_review");
    } else if (mode === "flagged") {
      q = q.gte("flag_count", 1);
    } else {
      q = q.eq("source", "user_submitted");
    }
    if (sourceFilter !== "all") q = q.eq("source", sourceFilter);
    if (storeFilter !== "all") q = q.eq("store_name", storeFilter);
    if (cityFilter !== "all") q = q.eq("city", cityFilter);
    if (itemQuery.trim()) {
      const like = `%${itemQuery.trim().replace(/[%_]/g, "")}%`;
      q = q.or(`food_name.ilike.${like},title.ilike.${like}`);
    }
    if (newlyExtracted) {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      q = q.gte("created_at", since).not("extraction_batch_id", "is", null);
    }
    if (sortBy === "oldest") q = q.order("created_at", { ascending: true });
    else if (sortBy === "savings") q = q.order("savings_pct", { ascending: false, nullsFirst: false });
    else q = q.order("created_at", { ascending: false });

    const { data, error } = await q;
    if (error) toast.error(error.message);
    setDeals((data ?? []) as Deal[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!batchFilter) { setBatchInfo(null); setConfirmOpen(false); return; }
    (async () => {
      const { data } = await supabase
        .from("flyer_extraction_batches")
        .select("extracted_items_count, ai_cost_usd, original_filename, extraction_status")
        .eq("id", batchFilter)
        .maybeSingle();
      if (data) {
        setBatchInfo(data as any);
        if ((data as any).extraction_status === "awaiting_confirmation") setConfirmOpen(true);
      }
    })();
  }, [batchFilter]);

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, mode, batchFilter, storeFilter, cityFilter, sourceFilter, sortBy, newlyExtracted]);

  // Debounce item search
  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemQuery]);

  // Sign photo URLs for deal-submissions bucket
  useEffect(() => {
    (async () => {
      const next: Record<string, string> = {};
      await Promise.all(deals.filter((d) => d.photo_url).map(async (d) => {
        const path = d.photo_url!;
        if (path.startsWith("http")) { next[d.id] = path; return; }
        const { data } = await supabase.storage.from("deal-submissions").createSignedUrl(path, 3600);
        if (data?.signedUrl) next[d.id] = data.signedUrl;
      }));
      setPhotoUrls(next);
    })();
  }, [deals]);

  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from("sale_observations")
      .update({
        moderation_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_admin_id: user!.id,
      })
      .eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Approved");
    setDeals((prev) => prev.filter((d) => d.id !== id));
  };

  const reject = async (id: string) => {
    if (!window.confirm("Reject and remove this deal?")) return;
    setBusy(id);
    const { error } = await supabase.from("sale_observations").delete().eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    setDeals((prev) => prev.filter((d) => d.id !== id));
  };

  const approveAll = async () => {
    if (!batchFilter) return;
    const pending = deals.filter((d) => d.moderation_status === "pending_review");
    if (pending.length === 0) {
      toast.info("No pending deals to approve");
      return;
    }
    if (!window.confirm(`Approve all ${pending.length} pending deals in this batch?`)) return;
    setBusyAll(true);
    const { error } = await supabase.from("sale_observations")
      .update({
        moderation_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_admin_id: user!.id,
      })
      .eq("extraction_batch_id", batchFilter)
      .eq("moderation_status", "pending_review");
    setBusyAll(false);
    if (error) return toast.error(error.message);
    toast.success(`Approved ${pending.length} deals`);
    load();
  };

  const counts = useMemo(() => ({
    total: deals.length,
    pending: deals.filter((d) => d.moderation_status === "pending_review").length,
  }), [deals]);

  const distinctStores = useMemo(
    () => Array.from(new Set(deals.map((d) => d.store_name).filter(Boolean))).sort(),
    [deals],
  );
  const distinctCities = useMemo(
    () => Array.from(new Set(deals.map((d) => d.city).filter(Boolean) as string[])).sort(),
    [deals],
  );
  const filtersActive = storeFilter !== "all" || cityFilter !== "all" || sourceFilter !== "all" || itemQuery.trim() !== "" || newlyExtracted || sortBy !== "newest";
  const resetFilters = () => {
    setStoreFilter("all"); setCityFilter("all"); setSourceFilter("all");
    setItemQuery(""); setNewlyExtracted(false); setSortBy("newest");
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
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Deal moderation</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/flyer-sources">Flyer sources</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/email-inbox">Email inbox</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/deals?tab=sales">Back to deals</Link>
            </Button>
          </div>
        </div>

        {batchFilter && (
          <Card className="p-4 rounded-2xl bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <span className="font-semibold text-primary">Reviewing flyer batch</span>
                {batchInfo && (
                  <span className="text-muted-foreground ml-2">
                    · {batchInfo.original_filename} · {batchInfo.extracted_items_count} extracted · AI cost ${Number(batchInfo.ai_cost_usd).toFixed(4)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={approveAll} disabled={busyAll || counts.pending === 0} className="rounded-xl">
                  {busyAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  <span className="ml-1.5">Approve all</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSearchParams({})}>
                  Clear filter
                </Button>
              </div>
            </div>
          </Card>
        )}

        {batchFilter && batchInfo?.extraction_status === "awaiting_confirmation" && (
          <Card className="p-4 rounded-2xl bg-amber-500/5 border-amber-500/30">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <span className="font-semibold text-amber-700 dark:text-amber-400">Awaiting confirmation</span>
                <span className="text-muted-foreground ml-2">
                  AI extracted {batchInfo.extracted_items_count} deal{batchInfo.extracted_items_count === 1 ? "" : "s"}. Confirm the store and dates to send them to moderation.
                </span>
              </div>
              <Button size="sm" onClick={() => setConfirmOpen(true)} className="rounded-xl">
                <Sparkles className="h-3 w-3 mr-1.5" /> Confirm details
              </Button>
            </div>
          </Card>
        )}

        <AdminFlyerConfirmDialog
          batchId={batchFilter}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onConfirmed={() => { setConfirmOpen(false); load(); }}
        />

        {!batchFilter && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as QueueMode)}>
            <TabsList className="rounded-xl">
              <TabsTrigger value="pending" className="rounded-lg">Pending review</TabsTrigger>
              <TabsTrigger value="flagged" className="rounded-lg">Flagged</TabsTrigger>
              <TabsTrigger value="recent_user" className="rounded-lg">Recent community</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <Card className="p-3 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Filters</span>
            {filtersActive && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs ml-auto" onClick={resetFilters}>Reset</Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                placeholder="Search items…"
                className="pl-7 h-9 text-sm"
              />
            </div>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {distinctStores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="City" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cities</SelectItem>
                {distinctCities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="admin_curated">Flyer/admin curated</SelectItem>
                <SelectItem value="user_submitted">User submitted</SelectItem>
                <SelectItem value="promo_email">Email ingestion</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="savings">Highest savings %</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Button
              size="sm"
              variant={newlyExtracted ? "default" : "outline"}
              onClick={() => setNewlyExtracted(!newlyExtracted)}
              className="rounded-full h-7 text-xs"
            >
              <Sparkles className="h-3 w-3 mr-1" /> Newly extracted (24h)
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">{counts.total} item{counts.total === 1 ? "" : "s"}</span>
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : deals.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground rounded-3xl">
            Nothing in this queue. Nice and clean.
          </Card>
        ) : (
          <div className="space-y-3">
            {deals.map((d) => {
              const isExpired = new Date(d.ends_at) < new Date();
              return (
                <Card key={d.id} className="p-4 rounded-3xl">
                  <div className="flex gap-4 flex-wrap">
                    {photoUrls[d.id] && (
                      <a href={photoUrls[d.id]} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img src={photoUrls[d.id]} alt="Deal photo" className="h-24 w-24 object-cover rounded-xl border border-border" />
                      </a>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant={d.moderation_status === "pending_review" ? "default" : "secondary"}>
                          {d.moderation_status}
                        </Badge>
                        <Badge variant="outline">{d.source}</Badge>
                        {d.flag_count > 0 && (
                          <Badge variant="destructive" className="gap-1"><Flag className="h-3 w-3" />{d.flag_count}</Badge>
                        )}
                        {isExpired && <Badge variant="outline">expired</Badge>}
                        {d.category && <Badge variant="outline">{d.category}</Badge>}
                      </div>
                      <h3 className="font-semibold">{d.title}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {d.store_name}{d.city ? ` · ${d.city}${d.region ? `, ${d.region}` : ""}` : ""}
                      </p>
                      {d.address && <p className="text-xs text-muted-foreground mt-0.5">{d.address}</p>}
                      <div className="flex items-baseline gap-2 mt-1.5">
                        <span className="text-lg font-bold text-primary tabular-nums">${Number(d.sale_price_usd).toFixed(2)}</span>
                        {d.regular_price_usd && (
                          <span className="text-xs text-muted-foreground line-through tabular-nums">${Number(d.regular_price_usd).toFixed(2)}</span>
                        )}
                        {d.savings_pct && (
                          <span className="text-xs font-semibold text-primary">Save {Math.round(Number(d.savings_pct))}%</span>
                        )}
                        {d.pack_size && <span className="text-xs text-muted-foreground">· {d.pack_size}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                        {" · ends "}{formatDistanceToNow(new Date(d.ends_at), { addSuffix: true })}
                      </p>
                      {d.submitted_by_user_id && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
                          by {d.submitted_by_user_id}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button size="sm" onClick={() => approve(d.id)} disabled={busy === d.id} className="rounded-xl">
                        {busy === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        <span className="ml-1.5">Approve</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reject(d.id)} disabled={busy === d.id} className="rounded-xl text-destructive">
                        <X className="h-3 w-3" />
                        <span className="ml-1.5">Reject</span>
                      </Button>
                      {photoUrls[d.id] && (
                        <a href={photoUrls[d.id]} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 justify-center">
                          Photo <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDeals;
