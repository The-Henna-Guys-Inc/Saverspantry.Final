import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Store as StoreIcon, ExternalLink, Heart, Search, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AdminStoreDialog, type EditableStore } from "@/components/AdminStoreDialog";
import { AdminStoreCsvUpload } from "@/components/AdminStoreCsvUpload";
import { CuisineFilterBar } from "@/components/CuisineFilterBar";
import { useCuisinePrefs } from "@/hooks/useCuisinePrefs";
import { PagerBar } from "@/components/PagerBar";

const PAGE_SIZE = 10;

type Store = {
  id: string;
  name: string;
  chain_name: string | null;
  cuisine_specialties: string[];
  price_tier: string;
  description: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  curation_source: string | null;
};

const CUISINES = [
  { id: "indian", label: "Indian / South Asian" },
  { id: "chinese", label: "Chinese" },
  { id: "korean", label: "Korean" },
  { id: "japanese", label: "Japanese" },
  { id: "vietnamese", label: "Vietnamese" },
  { id: "mexican", label: "Mexican" },
  { id: "middle_eastern", label: "Middle Eastern" },
  { id: "filipino", label: "Filipino" },
];

// CuisineTag → store cuisine_specialties ids (the table uses several legacy ids)
const CUISINE_TAG_TO_STORE_IDS: Record<string, string[]> = {
  south_asian: ["indian", "south_asian", "pakistani", "bangladeshi"],
  southeast_asian: ["southeast_asian", "vietnamese", "thai", "filipino", "indonesian"],
  korean: ["korean"], japanese: ["japanese"], chinese: ["chinese"],
  middle_eastern: ["middle_eastern"], mexican: ["mexican"],
  latin_american: ["latin_american", "latin"], african: ["african"],
  mediterranean: ["mediterranean"],
};

const tierDot = (t: string) =>
  t === "low" ? "bg-primary" : t === "medium" ? "bg-accent" : t === "high" ? "bg-muted-foreground" : "bg-border";
const tierLabel = (t: string) =>
  t === "low" ? "Budget-friendly" : t === "medium" ? "Mid-range" : t === "high" ? "Higher-end" : "Price varies";

const Stores = ({ embedded = false }: { embedded?: boolean }) => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const { cuisines: prefCuisines, isFiltering: cuisineFilterOn, setEnabled: setCuisineEnabled, loading: prefsLoading } = useCuisinePrefs();

  // Effective filter ids = manual chips + (if cuisine filter on) expansion of pref cuisines
  const prefStoreIds = useMemo(
    () => prefCuisines.flatMap((c) => CUISINE_TAG_TO_STORE_IDS[c] ?? [c]),
    [prefCuisines],
  );
  const effectiveActive = useMemo(() => {
    const ids = new Set<string>(active);
    if (cuisineFilterOn) prefStoreIds.forEach((id) => ids.add(id));
    return [...ids];
  }, [active, prefStoreIds, cuisineFilterOn]);

  const loadStores = async () => {
    const { data: s } = await supabase
      .from("specialty_stores")
      .select("id, name, chain_name, cuisine_specialties, price_tier, description, address, city, region, latitude, longitude, curation_source")
      .order("name");
    setStores((s as Store[]) ?? []);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: v }, { data: roles }] = await Promise.all([
        supabase.from("store_visits").select("store_id").eq("user_id", user.id),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      setVisited(Object.fromEntries((v ?? []).map((r: any) => [r.store_id, true])));
      setIsAdmin((roles ?? []).some((r: any) => r.role === "admin"));
      await loadStores();
      setLoading(false);
    })();
  }, [user]);

  const toggleCuisine = (id: string) =>
    setActive((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const toggleVisited = async (storeId: string) => {
    if (!user) return;
    const isOn = visited[storeId];
    setVisited((p) => ({ ...p, [storeId]: !isOn }));
    if (isOn) {
      const { error } = await supabase.from("store_visits").delete().match({ user_id: user.id, store_id: storeId });
      if (error) { setVisited((p) => ({ ...p, [storeId]: true })); toast.error(error.message); }
    } else {
      const { error } = await supabase.from("store_visits").insert({ user_id: user.id, store_id: storeId });
      if (error) { setVisited((p) => ({ ...p, [storeId]: false })); toast.error(error.message); }
      else toast.success("Added to your stores");
    }
  };

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      if (effectiveActive.length && !s.cuisine_specialties.some((c) => effectiveActive.includes(c))) return false;
      if (q.trim()) {
        const hay = `${s.name} ${s.chain_name ?? ""} ${s.city ?? ""} ${s.region ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [stores, effectiveActive, q]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  // Reset to page 1 when filters/search change
  useEffect(() => { setPage(1); }, [q, effectiveActive.join("|")]);

  const mapHref = (s: Store) => {
    const query = s.address ? encodeURIComponent(`${s.name}, ${s.address}, ${s.city ?? ""}`) : encodeURIComponent(s.name);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const Wrapper: any = embedded ? "div" : "main";
  return (
    <Wrapper className={embedded ? "" : "min-h-screen bg-background"}>
      {!embedded && <Header />}
      <div className={embedded ? "" : "container max-w-5xl mx-auto px-6 py-6 sm:py-10"}>
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <StoreIcon className="h-3.5 w-3.5" /> Stores
        </div>
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <h1 className="text-3xl sm:text-4xl font-bold text-primary">Cuisine-specific grocers</h1>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <ZipSearchBox onDone={loadStores} prefCuisines={prefCuisines} cuisineFilterOn={cuisineFilterOn} />
            {isAdmin && (
              <>
                <AdminStoreCsvUpload onCreated={loadStores} />
                <AdminStoreDialog onSaved={loadStores} />
              </>
            )}
          </div>
        </div>
        <p className="text-muted-foreground mb-4">
          Indian, Mexican, Asian, Middle Eastern and more — staples for these cuisines <strong className="font-semibold text-foreground">often cost 15-50% less in ethnic grocery stores</strong> than at mainstream supermarkets.
        </p>

        <CuisineFilterBar
          cuisines={prefCuisines}
          isFiltering={cuisineFilterOn}
          onShowAll={() => setCuisineEnabled(false)}
          onResume={() => setCuisineEnabled(true)}
          className="mb-4"
        />

        <Card className="p-5 rounded-3xl border-border/50 shadow-soft mb-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or city" className="pl-9 rounded-xl" />
          </div>
          <div className="flex flex-wrap gap-2">
            {CUISINES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCuisine(c.id)}
                className={`text-xs px-3 py-1.5 rounded-full transition-smooth ${
                  active.includes(c.id)
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "bg-secondary text-secondary-foreground hover:bg-muted"
                }`}
              >
                {c.label}
              </button>
            ))}
            {active.length > 0 && (
              <button type="button" onClick={() => setActive([])}
                className="text-xs px-3 py-1.5 rounded-full text-muted-foreground hover:text-primary">
                Clear filters
              </button>
            )}
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 rounded-2xl border-border/50 text-center text-muted-foreground">
            No stores match. Try clearing filters — we're growing the catalog and live location search is coming next.
          </Card>
        ) : (
          <>
          <div className="card-masonry">
            {paginated.map((s) => (
              <Card key={s.id} className="p-5 rounded-2xl border-border/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-primary truncate">{s.name}</h3>
                    {s.chain_name && s.chain_name !== s.name && (
                      <div className="text-xs text-muted-foreground">{s.chain_name}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleVisited(s.id)}
                    aria-label={visited[s.id] ? "Remove from your stores" : "I shop here"}
                    className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-smooth ${
                      visited[s.id] ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-primary"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${visited[s.id] ? "fill-current" : ""}`} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {s.cuisine_specialties.slice(0, 3).map((c) => (
                    <span key={c} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                      {c.replace("_", " ")}
                    </span>
                  ))}
                </div>

                {s.description && (
                  <p className="text-sm text-foreground/80 mt-3">{s.description}</p>
                )}

                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <span className={`h-2 w-2 rounded-full ${tierDot(s.price_tier)}`} />
                  <span>{tierLabel(s.price_tier)}</span>
                </div>

                {(s.address || s.city) && (
                  <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{[s.address, s.city, s.region].filter(Boolean).join(", ")}</span>
                  </div>
                )}

                {s.curation_source === "google_places" && (
                  <div className="mt-2 text-[10px] text-muted-foreground/80 italic">
                    Listing data from Google
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <Button asChild variant="outline" size="sm" className="rounded-xl">
                    <a href={mapHref(s)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Open in Maps
                    </a>
                  </Button>
                  {isAdmin && (
                    <AdminStoreDialog
                      onSaved={loadStores}
                      store={s as EditableStore}
                      trigger={
                        <Button variant="ghost" size="sm" className="rounded-xl">
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
                        </Button>
                      }
                    />
                  )}
                </div>
              </Card>
            ))}
          </div>
          <PagerBar page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </>
        )}
      </div>
    </Wrapper>
  );
};

export default Stores;

function ZipSearchBox({
  onDone,
  prefCuisines,
  cuisineFilterOn,
}: {
  onDone: () => void;
  prefCuisines: string[];
  cuisineFilterOn: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [zip, setZip] = useState("");

  const handle = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const loc = zip.trim();
    if (!loc) {
      toast.error("Enter a ZIP code or city");
      return;
    }
    setBusy(true);
    const t = toast.loading(`Finding stores near ${loc}...`);
    try {
      const { data, error } = await supabase.functions.invoke("store-finder", {
        body: {
          location: loc,
          radius_miles: 10,
          cuisines: cuisineFilterOn && prefCuisines.length ? prefCuisines : undefined,
        },
      });
      if (error) throw error;
      const failures = Array.isArray(data?.failures) ? data.failures : [];
      if ((data?.total ?? 0) === 0 && failures.length) {
        toast.error(failures[0]?.message || "Store lookup failed", { id: t });
      } else if (failures.length) {
        toast.success(`Found ${data?.total ?? 0} stores (${data?.inserted ?? 0} new). Some cuisines could not be searched.`, { id: t });
      } else {
        toast.success(`Found ${data?.total ?? 0} stores (${data?.inserted ?? 0} new)`, { id: t });
      }
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Failed to find stores", { id: t });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handle} className="flex items-center gap-2">
      <Input
        value={zip}
        onChange={(e) => setZip(e.target.value)}
        placeholder="ZIP code or city"
        className="h-9 w-36 rounded-xl"
        inputMode="text"
        aria-label="ZIP code or city"
      />
      <Button type="submit" disabled={busy} variant="outline" size="sm" className="rounded-xl">
        {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
        Find stores
      </Button>
    </form>
  );
}
