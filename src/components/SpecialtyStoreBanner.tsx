import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, MapPin, X, Heart } from "lucide-react";
import { CUISINE_LABEL, CuisineTag } from "@/lib/cuisineHints";

type StoreRow = {
  id: string;
  name: string;
  chain_name: string | null;
  city: string | null;
  region: string | null;
  address: string | null;
  cuisine_specialties: string[];
  price_tier: string;
};

interface Props {
  topCuisines: CuisineTag[];
  matchCount: number;
}

export const SpecialtyStoreBanner = ({ topCuisines, matchCount }: Props) => {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!topCuisines.length) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data: storeRows }, favRes] = await Promise.all([
        supabase
          .from("specialty_stores")
          .select("id, name, chain_name, city, region, address, cuisine_specialties, price_tier")
          .overlaps("cuisine_specialties", topCuisines)
          .limit(20),
        user
          ? supabase.from("store_visits").select("store_id").eq("user_id", user.id)
          : Promise.resolve({ data: [] as { store_id: string }[] }),
      ]);
      setStores(storeRows ?? []);
      setFavorites(new Set((favRes.data ?? []).map((r: any) => r.store_id)));
    })();
  }, [topCuisines.join(",")]);

  if (dismissed || !topCuisines.length) return null;

  const favStores = stores.filter((s) => favorites.has(s.id));
  const showStores = (favStores.length ? favStores : stores).slice(0, 3);
  const cuisineLabels = topCuisines.map((c) => CUISINE_LABEL[c]).join(" / ");

  const mapsUrl = (s: StoreRow) => {
    const q = encodeURIComponent([s.name, s.address, s.city, s.region].filter(Boolean).join(", "));
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  };

  return (
    <Card className="p-4 rounded-2xl border-accent/30 bg-accent/5 mb-4 print:hidden">
      <div className="flex items-start gap-3">
        <Store className="h-5 w-5 text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold text-primary text-sm">
                {matchCount} ingredient{matchCount === 1 ? "" : "s"} this week may be cheaper at {cuisineLabels} grocers
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Specialty stores often beat supermarket prices on regional staples.
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-muted-foreground hover:text-foreground p-1 -m-1"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {showStores.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(expanded ? showStores : showStores.slice(0, 2)).map((s) => (
                <a
                  key={s.id}
                  href={mapsUrl(s)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-background border border-border hover:border-primary/60 transition-smooth"
                >
                  {favorites.has(s.id) && <Heart className="h-3 w-3 fill-accent text-accent" />}
                  <span className="font-medium text-foreground">{s.name}</span>
                  {s.city && <span className="text-muted-foreground">· {s.city}</span>}
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                </a>
              ))}
              {showStores.length > 2 && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-muted transition-smooth"
                >
                  +{showStores.length - 2} more
                </button>
              )}
            </div>
          )}

          <div className="mt-3">
            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Link to="/stores">Browse all specialty stores →</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
