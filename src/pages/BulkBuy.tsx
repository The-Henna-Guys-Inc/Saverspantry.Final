import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PackageOpen, Tag, MapPin, TrendingDown, Eye, Sparkles } from "lucide-react";
import { CuisineFilterBar } from "@/components/CuisineFilterBar";
import { useCuisinePrefs } from "@/hooks/useCuisinePrefs";
import { CUISINE_LABEL, type CuisineTag } from "@/lib/cuisineHints";
import { toast } from "sonner";
import { AiFeedback } from "@/components/AiFeedback";

// Infer unit + pack quantity from a free-form pack-size label like
// "10 lb bag", "5 kg sack", "32 fl oz bottle", "24 ct case".
function parsePack(label: string | null | undefined): { qty: number | null; unit: string } {
  if (!label) return { qty: null, unit: "unit" };
  const s = label.toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(fl\s?oz|oz|lb|lbs|pound|pounds|kg|g|gram|grams|ml|l|liter|liters|dozen|doz|ct|count|pack|pk|sheet|sheets)\b/);
  if (!m) return { qty: null, unit: "unit" };
  let qty = parseFloat(m[1]);
  let unit = m[2].replace(/\s/g, "");
  const map: Record<string, string> = {
    lbs: "lb", pound: "lb", pounds: "lb",
    gram: "g", grams: "g",
    liter: "L", liters: "L", l: "L",
    floz: "fl oz",
    count: "ct", pack: "ct", pk: "ct",
    sheets: "sheet",
  };
  if (unit === "dozen" || unit === "doz") {
    qty = qty * 12;
    unit = "ct";
  }
  unit = map[unit] ?? unit;
  return { qty, unit };
}

type Rec = {
  id: string;
  food_name: string;
  cuisine_tags: string[];
  typical_unit_price_usd: number;
  bulk_unit_price_usd: number;
  bulk_pack_size: string;
  est_savings_pct: number;
  shelf_life_days: number;
  storage_tip: string | null;
  best_store_type: string | null;
  confidence: string;
  used_qty_90d: number;
  on_sale: boolean;
  sale: { store_name: string; sale_price_usd: number } | null;
  est_monthly_savings_usd: number;
  reasons: string[];
};

type PricingAdj = {
  applied_factor: number;
  usda_factor: number;
  usda_source: "usda" | "fallback_curated";
  usda_report_month: string | null;
  regional_multiplier: number;
  regional_state: string | null;
  regional_label: string | null;
  fallback_used: boolean;
} | null;

const BulkBuy = ({ embedded = false }: { embedded?: boolean }) => {
  const { user, loading: authLoading } = useAuth();
  const { cuisines, isFiltering, setEnabled } = useCuisinePrefs();
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [total, setTotal] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingAdj>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("bulk-buy-recommend", {
      body: { respectFilter: true },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setRecs((data?.recommendations ?? []) as Rec[]);
    setTotal(data?.total_monthly_savings_usd ?? 0);
    setPricing((data?.pricing_adjustment ?? null) as PricingAdj);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (user) load();
    else setLoading(false);
  }, [user, authLoading, isFiltering, cuisines.join(",")]);

  const addToWatchlist = async (r: Rec) => {
    if (!user) return;
    setAdding(r.id);
    const { error } = await supabase.from("watchlist_items").insert({
      user_id: user.id,
      food_name: r.food_name,
      min_savings_pct: Math.max(15, Math.min(50, r.est_savings_pct)),
    });
    setAdding(null);
    if (error) {
      if (error.code === "23505") toast.info("Already on your watchlist");
      else toast.error(error.message);
      return;
    }
    toast.success(`Added ${r.food_name} to watchlist`);
  };

  const totalDisplay = useMemo(() => `$${total.toFixed(2)}`, [total]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const body = (
    <>
      {!embedded && (
        <>
          <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
            <PackageOpen className="h-3.5 w-3.5" /> Bulk-Buy
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">Buy big, save more</h1>
        </>
      )}
      <p className="text-muted-foreground mb-4">
          Personalized to the cuisines you cook and the staples you actually use. Sourced from specialty grocers where bulk usually wins.
        </p>

        <CuisineFilterBar
          cuisines={cuisines}
          isFiltering={isFiltering}
          onShowAll={() => setEnabled(false)}
          onResume={() => setEnabled(true)}
          className="mb-6"
        />

        <Card className="p-5 rounded-3xl border-accent/30 bg-gradient-warm shadow-soft mb-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-accent/20 flex items-center justify-center shrink-0">
              <TrendingDown className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Estimated monthly savings</div>
              <div className="text-2xl font-bold text-primary tabular-nums">{totalDisplay}/mo</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Based on your top {Math.min(10, recs.length)} recommendations.
              </div>
            </div>
          </div>
          {recs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40 flex justify-end">
              <AiFeedback
                feature="bulk_buy"
                context={{ count: recs.length, total_savings: total, cuisines, isFiltering }}
              />
            </div>
          )}
        </Card>

        {pricing && (
          <div className="text-[11px] text-muted-foreground mb-4 px-1 leading-relaxed">
            Prices shown are per-unit estimates, adjusted ×{pricing.applied_factor.toFixed(2)}
            {pricing.usda_source === "usda" && pricing.usda_report_month
              ? ` using USDA Food Plans (${new Date(pricing.usda_report_month).toLocaleDateString(undefined, { month: "short", year: "numeric" })})`
              : " using national curated baseline (USDA data unavailable — fallback)"}
            {pricing.regional_label ? ` and ${pricing.regional_label} cost-of-living` : ""}.
            Compare against the pack size before you buy.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : recs.length === 0 ? (
          <Card className="p-8 rounded-2xl border-border-strong text-center text-muted-foreground">
            No recommendations yet. {isFiltering ? "Try toggling \"Show everything\" or " : ""}
            <Link to="/settings" className="text-primary underline">add cuisines in Settings</Link>.
          </Card>
        ) : (
          <div className="card-masonry">
            {recs.map((r) => {
              const savedPct = r.est_savings_pct;
              return (
                <Card key={r.id} className="p-5 rounded-2xl border-border-strong flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-primary truncate">{r.food_name}</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.cuisine_tags.slice(0, 3).map((c) => (
                          <span key={c} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {CUISINE_LABEL[c as CuisineTag] ?? c}
                          </span>
                        ))}
                        {r.cuisine_tags.length === 0 && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">Staple</span>
                        )}
                      </div>
                    </div>
                    {r.on_sale && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/20 text-accent inline-flex items-center gap-1">
                        <Tag className="h-3 w-3" /> On deal
                      </span>
                    )}
                  </div>

                  {(() => {
                    const pk = parsePack(r.bulk_pack_size);
                    const perUnit = `/${pk.unit}`;
                    const packTotal = pk.qty ? pk.qty * Number(r.bulk_unit_price_usd) : null;
                    return (
                      <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pack</div>
                          <div className="font-medium text-foreground">{r.bulk_pack_size}</div>
                          {packTotal != null && (
                            <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                              ≈ ${packTotal.toFixed(2)} total
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bulk vs typical</div>
                          <div className="font-medium text-foreground tabular-nums">
                            ${Number(r.bulk_unit_price_usd).toFixed(2)}{perUnit}{" "}
                            <span className="text-muted-foreground line-through">
                              ${Number(r.typical_unit_price_usd).toFixed(2)}{perUnit}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Save</div>
                          <div className="font-semibold text-primary">{savedPct}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Shelf life</div>
                          <div className="font-medium text-foreground">{Math.round(r.shelf_life_days / 30)} mo</div>
                        </div>
                      </div>
                    );
                  })()}

                  {r.est_monthly_savings_usd > 0 && (
                    <div className="mt-3 text-xs text-primary font-medium">
                      ~${r.est_monthly_savings_usd.toFixed(2)}/mo for your household
                    </div>
                  )}

                  {r.storage_tip && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
                      <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-accent" />
                      {r.storage_tip}
                    </p>
                  )}

                  {r.reasons.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {r.reasons.map((rs, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/5 text-primary/80">
                          {rs}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.best_store_type && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>Best at: {r.best_store_type.replace(/_/g, " ")}</span>
                      <Link to="/stores" className="text-primary hover:underline ml-auto">Find stores →</Link>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => addToWatchlist(r)}
                      disabled={adding === r.id}
                    >
                      {adding === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                      Watch for deals
                    </Button>
                    {r.on_sale && r.sale && (
                      <Button asChild size="sm" variant="hero" className="rounded-xl">
                        <Link to="/sales">See deal →</Link>
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
    </>
  );

  if (embedded) return body;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-5xl mx-auto px-6 py-6 sm:py-10">{body}</div>
    </main>
  );
};

export default BulkBuy;
