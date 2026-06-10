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
import { AdminFlyerUpload } from "@/components/AdminFlyerUpload";
import { AdminFlyerUrlImport } from "@/components/AdminFlyerUrlImport";
import { CuisineFilterBar } from "@/components/CuisineFilterBar";
import { useCuisinePrefs } from "@/hooks/useCuisinePrefs";
import { detectItemCuisines } from "@/lib/cuisineHints";
import { PagerBar } from "@/components/PagerBar";
import { LocationHeader } from "@/components/LocationHeader";

import { UserSubmitDealDialog } from "@/components/UserSubmitDealDialog";
import { useUserLocation } from "@/hooks/useUserLocation";
import { distanceMiles, formatDistance } from "@/lib/distance";
import { findLaunchCity, LAUNCH_CITIES } from "@/lib/launchArea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 10;

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
  store_id: string | null;
  specialty_stores?: { latitude: number | null; longitude: number | null } | null;
  _distance?: number | null;
};

type SortMode = "distance" | "savings" | "ending";

const sourceMeta: Record<string, { label: string; cls: string }> = {
  kroger_api: { label: "Kroger", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  user_submitted: { label: "Community", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  admin_curated: { label: "Curated", cls: "bg-primary/10 text-primary" },
};

export default function Sales({ embedded = false }: { embedded?: boolean } = {}) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [watchedFoods, setWatchedFoods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [matchedPage, setMatchedPage] = useState(1);
  const [allPage, setAllPage] = useState(1);
  const [sortMode, setSortMode] = useState<SortMode>("distance");
  const { cuisines, isFiltering, setEnabled } = useCuisinePrefs();
  const { location, zipCode, radiusMiles } = useUserLocation();
  const matchedCity = findLaunchCity(location);
  const [viewCityId, setViewCityId] = useState<string>("auto");
  const displayCity = viewCityId === "auto" ? matchedCity : (LAUNCH_CITIES.find(c => c.id === viewCityId) ?? null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const loadSales = async () => {
    const { data: salesData } = await supabase
      .from("sale_observations")
      .select("*, specialty_stores(latitude, longitude)")
      .in("moderation_status", ["auto_approved", "approved"])
      .gt("ends_at", new Date().toISOString())
      .order("ends_at", { ascending: true })
      .limit(200);
    setSales((salesData ?? []) as Sale[]);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: salesData }, { data: wl }, { data: confirms }, { data: roles }] = await Promise.all([
        supabase
          .from("sale_observations")
          .select("*, specialty_stores(latitude, longitude)")
          .in("moderation_status", ["auto_approved", "approved"])
          .gt("ends_at", new Date().toISOString())
          .order("ends_at", { ascending: true })
          .limit(200),
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

  // Attach distance + apply radius filter
  const withDistance = useMemo(() => {
    return sales.map((s) => {
      const lat = s.specialty_stores?.latitude;
      const lng = s.specialty_stores?.longitude;
      let d: number | null = null;
      if (location && lat != null && lng != null) {
        d = distanceMiles(location.lat, location.lng, Number(lat), Number(lng));
      }
      return { ...s, _distance: d };
    });
  }, [sales, location]);

  const radiusFiltered = useMemo(() => {
    if (!location) return withDistance;
    return withDistance.filter((s) => s._distance == null || s._distance <= radiusMiles);
  }, [withDistance, location, radiusMiles]);

  const cuisineFiltered = useMemo(() => {
    const base = isFiltering
      ? radiusFiltered.filter((s) => {
          const tags = detectItemCuisines(s.food_name);
          return tags.length === 0 || tags.some((t) => cuisines.includes(t));
        })
      : radiusFiltered;
    const sorted = [...base];
    if (sortMode === "distance") {
      sorted.sort((a, b) => {
        const ad = a._distance ?? Number.POSITIVE_INFINITY;
        const bd = b._distance ?? Number.POSITIVE_INFINITY;
        return ad - bd;
      });
    } else if (sortMode === "savings") {
      sorted.sort((a, b) => Number(b.savings_pct ?? 0) - Number(a.savings_pct ?? 0));
    } else {
      sorted.sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime());
    }
    return sorted;
  }, [radiusFiltered, cuisines, isFiltering, sortMode]);

  const matched = useMemo(() => {
    if (!watchedFoods.length) return [];
    return cuisineFiltered.filter((s) => watchedFoods.some((w) => s.food_name.toLowerCase().includes(w) || w.includes(s.food_name.toLowerCase())));
  }, [cuisineFiltered, watchedFoods]);

  const matchedPaged = useMemo(
    () => matched.slice((matchedPage - 1) * PAGE_SIZE, matchedPage * PAGE_SIZE),
    [matched, matchedPage],
  );
  const allPaged = useMemo(
    () => cuisineFiltered.slice((allPage - 1) * PAGE_SIZE, allPage * PAGE_SIZE),
    [cuisineFiltered, allPage],
  );

  useEffect(() => { setMatchedPage(1); }, [matched.length]);
  useEffect(() => { setAllPage(1); }, [cuisineFiltered.length]);

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
    if (!window.confirm("Remove this deal from the feed?")) return;
    const { error } = await supabase.from("sale_observations").delete().eq("id", saleId);
    if (error) return toast.error(error.message);
    setSales((prev) => prev.filter((s) => s.id !== saleId));
    toast.success("Removed.");
  };

  const Outer: any = embedded ? "div" : "div";
  return (
    <Outer className={embedded ? "" : "min-h-screen bg-background"}>
      {!embedded && <Header />}
      <main className={embedded ? "" : "container max-w-4xl mx-auto px-6 py-10"}>
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
                🌱 Now serving
              </span>
              <Select value={viewCityId} onValueChange={setViewCityId}>
                <SelectTrigger className="h-7 rounded-full text-[11px] font-semibold uppercase tracking-wider w-auto px-3 bg-secondary/60 text-secondary-foreground border-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">All launch cities</SelectItem>
                  {LAUNCH_CITIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <h1 className="text-3xl font-bold text-primary">Deals near you</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Hand-curated weekly from {displayCity ? displayCity.name : "Illinois"} specialty grocers. Some verified by stores, some by the community — we never rank by paid placement.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isAdmin && (
              <Button asChild variant="outline" size="sm" className="rounded-xl h-8 px-3 text-xs">
                <Link to="/admin/deals">Moderation</Link>
              </Button>
            )}
            {isAdmin && user && <AdminFlyerUpload userId={user.id} onComplete={loadSales} />}
            {isAdmin && user && <AdminFlyerUrlImport userId={user.id} onComplete={loadSales} />}
            {isAdmin && user && <AdminSaleCsvUpload userId={user.id} onCreated={loadSales} />}
            {isAdmin && user && <AdminSaleDialog userId={user.id} onCreated={loadSales} />}
            <UserSubmitDealDialog onSubmitted={loadSales} />
            <Button asChild variant="ghost" size="sm" className="rounded-xl h-8 px-3 text-xs">
              <Link to="/watchlist">Watchlist</Link>
            </Button>
          </div>
        </div>

        <LocationHeader />

        

        <CuisineFilterBar
          cuisines={cuisines}
          isFiltering={isFiltering}
          onShowAll={() => setEnabled(false)}
          onResume={() => setEnabled(true)}
          className="mb-4"
        />
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="text-xs text-muted-foreground">
            {cuisineFiltered.length} active deal{cuisineFiltered.length === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort:</span>
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="h-8 rounded-xl text-xs w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="distance">Nearest</SelectItem>
                <SelectItem value="savings">Highest savings</SelectItem>
                <SelectItem value="ending">Ending soonest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Tabs defaultValue="watching" className="w-full">
          <TabsList className="rounded-xl">
            <TabsTrigger value="watching" className="rounded-lg">
              On your watchlist {matched.length > 0 && <Badge variant="secondary" className="ml-2">{matched.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-lg">All deals</TabsTrigger>
          </TabsList>

          <TabsContent value="watching" className="mt-5">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : matched.length === 0 ? (
              <Card className="p-8 rounded-3xl text-center bg-gradient-warm">
                <Tag className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Nothing matched yet</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Add staples you regularly buy and we'll surface deals here.
                </p>
                <Button asChild variant="hero" size="sm" className="rounded-xl">
                  <Link to="/watchlist">Build my watchlist</Link>
                </Button>
              </Card>
            ) : (
              <>
                <SaleList sales={matchedPaged} onConfirm={confirm} onFlag={flag} confirming={confirming} confirmedIds={confirmedIds} isAdmin={isAdmin} onRemove={removeSale} userId={user?.id ?? ""} onRefresh={loadSales} />
                <PagerBar page={matchedPage} pageSize={PAGE_SIZE} total={matched.length} onPageChange={setMatchedPage} />
              </>
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-5">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : cuisineFiltered.length === 0 ? (
              <Card className="p-8 rounded-3xl text-center bg-gradient-warm">
                <p className="text-sm text-muted-foreground">
                  {isFiltering ? "No active deals match your cuisines. Try toggling \"Show everything\"." : "No active deals right now. Check back soon."}
                </p>
              </Card>
            ) : (
              <>
                <SaleList sales={allPaged} onConfirm={confirm} onFlag={flag} confirming={confirming} confirmedIds={confirmedIds} isAdmin={isAdmin} onRemove={removeSale} userId={user?.id ?? ""} onRefresh={loadSales} />
                <PagerBar page={allPage} pageSize={PAGE_SIZE} total={cuisineFiltered.length} onPageChange={setAllPage} />
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </Outer>
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
          <Card key={s.id} className="p-5 rounded-3xl shadow-soft border-border-strong hover:shadow-glow transition-smooth">
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
                    {s._distance != null && (
                      <span className="ml-1.5 text-primary font-medium">· {formatDistance(s._distance)}</span>
                    )}
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

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border-strong flex-wrap">
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
