import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserLocation } from "@/hooks/useUserLocation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Search, Star, X, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";

const MAX_FAVORITES = 3;

type StoreResult = {
  id: string;
  name: string;
  chain: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  zip: string | null;
  source: "curated" | "places";
};

type FavoriteEntry = {
  id: string;
  name: string;
  chain: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
};

export function FavoriteStoresManager() {
  const { user } = useAuth();
  const { location, zipCode } = useUserLocation();
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [filterEnabled, setFilterEnabled] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StoreResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load profile + hydrate favorites
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("favorite_store_ids, favorites_filter_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      const ids = ((profile as any)?.favorite_store_ids ?? []) as string[];
      setFilterEnabled((profile as any)?.favorites_filter_enabled ?? true);
      if (ids.length) {
        const { data: stores } = await supabase
          .from("specialty_stores")
          .select("id, name, chain_name, address, city, region")
          .in("id", ids);
        const ordered = ids
          .map((id) => stores?.find((s) => s.id === id))
          .filter(Boolean)
          .map((s: any) => ({
            id: s.id, name: s.name, chain: s.chain_name,
            address: s.address, city: s.city, region: s.region,
          }));
        setFavorites(ordered);
      } else {
        setFavorites([]);
      }
      setLoading(false);
    })();
  }, [user]);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase.functions.invoke("search-stores-for-favorites", {
        body: {
          query: query.trim(),
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
          zip: zipCode ?? null,
        },
      });
      setSearching(false);
      if (error) { toast.error(error.message); return; }
      setResults((data?.results ?? []) as StoreResult[]);
    }, 350);
    return () => clearTimeout(t);
  }, [query, location, zipCode]);

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);

  const persist = async (next: FavoriteEntry[], nextFilter = filterEnabled) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        favorite_store_ids: next.map((f) => f.id),
        favorites_filter_enabled: nextFilter,
      } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const addFavorite = async (s: StoreResult) => {
    if (favorites.length >= MAX_FAVORITES) {
      toast.error(`You can only save ${MAX_FAVORITES} favorite stores.`);
      return;
    }
    if (favoriteIds.has(s.id)) return;
    const entry: FavoriteEntry = {
      id: s.id, name: s.name, chain: s.chain,
      address: s.address, city: s.city, region: s.region,
    };
    const next = [...favorites, entry];
    if (await persist(next)) {
      setFavorites(next);
      toast.success(`${s.name} added to favorites`);
      setQuery("");
      setResults([]);
    }
  };

  const removeFavorite = async (id: string) => {
    const next = favorites.filter((f) => f.id !== id);
    if (await persist(next)) setFavorites(next);
  };

  const toggleFilter = async (enabled: boolean) => {
    setFilterEnabled(enabled);
    await persist(favorites, enabled);
  };

  if (loading) {
    return (
      <Card className="p-6 rounded-3xl border-border/50 shadow-soft mt-6">
        <div className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-3xl border-border/50 shadow-soft mt-6 space-y-5">
      <div>
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <Star className="h-3.5 w-3.5" /> Your stores
        </div>
        <h2 className="text-lg font-semibold text-primary">Favorite local stores</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick up to {MAX_FAVORITES} stores you shop at. We'll use them to surface deals, promotions, and ingredient suggestions tailored to you.
        </p>
      </div>

      {favorites.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Your picks ({favorites.length}/{MAX_FAVORITES})</Label>
          <div className="space-y-2">
            {favorites.map((f) => (
              <div key={f.id} className="flex items-start justify-between gap-3 p-3 rounded-2xl border border-border/60 bg-secondary/30">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                  {(f.address || f.city) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{[f.address, f.city, f.region].filter(Boolean).join(", ")}</span>
                    </p>
                  )}
                </div>
                <Button
                  type="button" variant="ghost" size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => removeFavorite(f.id)}
                  disabled={saving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {favorites.length < MAX_FAVORITES && (
        <div>
          <Label htmlFor="store-search" className="text-xs">Search for a store</Label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="store-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Trader Joe's, Safeway, H Mart…"
              className="pl-9 rounded-xl"
            />
          </div>
          {!location && !zipCode && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Set your ZIP above for better local results.
            </p>
          )}
          {searching && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          )}
          {!searching && results.length > 0 && (
            <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto rounded-xl border border-border/60 bg-background">
              {results.map((s) => {
                const already = favoriteIds.has(s.id);
                return (
                  <button
                    key={`${s.source}-${s.id}`}
                    type="button"
                    onClick={() => !already && addFavorite(s)}
                    disabled={already || saving}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-center justify-between gap-3 disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[s.address, s.city, s.region].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                    {already ? (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Added</span>
                    ) : (
                      <Plus className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground mt-3">No matches yet — try a different name or check your ZIP.</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
        <div className="min-w-0">
          <Label htmlFor="fav-filter" className="text-sm font-medium">Filter Deals by my favorites</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            When on, the Deals tab only shows promotions from your favorite stores.
          </p>
        </div>
        <Switch
          id="fav-filter"
          checked={filterEnabled}
          onCheckedChange={toggleFilter}
          disabled={favorites.length === 0 || saving}
        />
      </div>
    </Card>
  );
}
