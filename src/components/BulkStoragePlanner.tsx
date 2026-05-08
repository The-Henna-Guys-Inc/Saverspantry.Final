import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Boxes, Loader2, Plus, Trash2, TrendingDown, Sparkles, Pencil, RotateCcw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

// Per-person daily consumption in POUNDS, typical weekly retail $/lb (small pkg),
// and typical bulk $/lb (Costco/Sam's-style 20–50lb sacks). Shelf life in months
// (properly stored, sealed, cool/dry).
type BulkSource = {
  store: string;        // display name
  pricePerLb: number;   // typical $/lb at this source
  searchUrl: string;    // user-facing search link
};
type Staple = {
  key: string;
  label: string;
  searchTerm: string; // for Kroger lookup
  lbsPerPersonPerDay: number;
  retailPerLb: number;
  bulkPerLb: number;
  shelfLifeMonths: number;
  bulkSources?: BulkSource[];
};

// Helper to build a search URL on Costco / Sam's / Amazon
const costco = (q: string) => `https://www.costco.com/CatalogSearch?keyword=${encodeURIComponent(q)}`;
const sams = (q: string) => `https://www.samsclub.com/s/${encodeURIComponent(q)}`;
const amazon = (q: string) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}+bulk`;

// Per-person daily consumption tuned to REALISTIC household use
// (assuming a mixed diet — not any one staple as the sole calorie source).
// Sources: USDA per-capita food availability + LDS home-storage guidelines scaled down.
// bulkSources prices are typical observed $/lb on club-store / Amazon bulk packs.
const STAPLES: Staple[] = [
  { key: "rice",          label: "White rice",       searchTerm: "long grain white rice",     lbsPerPersonPerDay: 0.07, retailPerLb: 1.80, bulkPerLb: 0.85, shelfLifeMonths: 360,
    bulkSources: [{ store: "Costco", pricePerLb: 0.70, searchUrl: costco("rice 25 lb") }, { store: "Sam's Club", pricePerLb: 0.75, searchUrl: sams("rice 25 lb") }, { store: "Amazon", pricePerLb: 1.10, searchUrl: amazon("white rice") }] },
  { key: "beans",         label: "Dried beans",      searchTerm: "dried pinto beans",         lbsPerPersonPerDay: 0.05, retailPerLb: 2.20, bulkPerLb: 1.10, shelfLifeMonths: 96,
    bulkSources: [{ store: "Costco", pricePerLb: 1.05, searchUrl: costco("pinto beans 25 lb") }, { store: "Sam's Club", pricePerLb: 1.15, searchUrl: sams("pinto beans") }] },
  { key: "pasta",         label: "Pasta",            searchTerm: "spaghetti pasta",           lbsPerPersonPerDay: 0.07, retailPerLb: 2.00, bulkPerLb: 1.10, shelfLifeMonths: 24,
    bulkSources: [{ store: "Costco", pricePerLb: 1.00, searchUrl: costco("pasta") }, { store: "Sam's Club", pricePerLb: 1.10, searchUrl: sams("pasta") }] },
  { key: "flour",         label: "All-purpose flour",searchTerm: "all purpose flour",         lbsPerPersonPerDay: 0.08, retailPerLb: 1.40, bulkPerLb: 0.65, shelfLifeMonths: 12,
    bulkSources: [{ store: "Costco", pricePerLb: 0.55, searchUrl: costco("all purpose flour 25 lb") }, { store: "Sam's Club", pricePerLb: 0.60, searchUrl: sams("flour 25 lb") }] },
  { key: "sugar",         label: "Sugar",            searchTerm: "granulated sugar",          lbsPerPersonPerDay: 0.04, retailPerLb: 1.20, bulkPerLb: 0.70, shelfLifeMonths: 360,
    bulkSources: [{ store: "Costco", pricePerLb: 0.65, searchUrl: costco("sugar 25 lb") }, { store: "Sam's Club", pricePerLb: 0.70, searchUrl: sams("sugar 25 lb") }] },
  { key: "oats",          label: "Rolled oats",      searchTerm: "old fashioned rolled oats", lbsPerPersonPerDay: 0.05, retailPerLb: 2.40, bulkPerLb: 1.20, shelfLifeMonths: 24,
    bulkSources: [{ store: "Costco", pricePerLb: 1.10, searchUrl: costco("rolled oats") }, { store: "Amazon", pricePerLb: 1.50, searchUrl: amazon("rolled oats") }] },
  { key: "oil",           label: "Cooking oil",      searchTerm: "vegetable oil",             lbsPerPersonPerDay: 0.04, retailPerLb: 3.20, bulkPerLb: 1.80, shelfLifeMonths: 12,
    bulkSources: [{ store: "Costco", pricePerLb: 1.65, searchUrl: costco("vegetable oil") }, { store: "Sam's Club", pricePerLb: 1.80, searchUrl: sams("vegetable oil") }] },
  { key: "salt",          label: "Salt",             searchTerm: "iodized salt",              lbsPerPersonPerDay: 0.01, retailPerLb: 0.90, bulkPerLb: 0.35, shelfLifeMonths: 360,
    bulkSources: [{ store: "Costco", pricePerLb: 0.30, searchUrl: costco("salt") }] },
  { key: "tomatoes",      label: "Canned tomatoes",  searchTerm: "canned diced tomatoes",     lbsPerPersonPerDay: 0.10, retailPerLb: 1.60, bulkPerLb: 0.95, shelfLifeMonths: 24,
    bulkSources: [{ store: "Costco", pricePerLb: 0.85, searchUrl: costco("canned tomatoes") }, { store: "Sam's Club", pricePerLb: 0.95, searchUrl: sams("canned tomatoes") }] },
  { key: "peanut_butter", label: "Peanut butter",    searchTerm: "peanut butter",             lbsPerPersonPerDay: 0.03, retailPerLb: 4.20, bulkPerLb: 2.60, shelfLifeMonths: 18,
    bulkSources: [{ store: "Costco", pricePerLb: 2.40, searchUrl: costco("peanut butter") }, { store: "Sam's Club", pricePerLb: 2.60, searchUrl: sams("peanut butter") }] },
  { key: "lentils",       label: "Lentils",          searchTerm: "dried lentils",             lbsPerPersonPerDay: 0.03, retailPerLb: 2.40, bulkPerLb: 1.20, shelfLifeMonths: 60,
    bulkSources: [{ store: "Amazon", pricePerLb: 1.30, searchUrl: amazon("dried lentils") }, { store: "Costco", pricePerLb: 1.20, searchUrl: costco("lentils") }] },
  { key: "powdered_milk", label: "Powdered milk",    searchTerm: "nonfat dry milk",           lbsPerPersonPerDay: 0.04, retailPerLb: 6.00, bulkPerLb: 3.50, shelfLifeMonths: 36,
    bulkSources: [{ store: "Costco", pricePerLb: 3.20, searchUrl: costco("powdered milk") }, { store: "Amazon", pricePerLb: 3.80, searchUrl: amazon("nonfat dry milk") }] },
];

type CustomItem = {
  id: string;
  label: string;
  lbsPerPersonPerDay: number;
  retailPerLb: number;
  bulkPerLb: number;
  shelfLifeMonths: number;
};

// Per-staple user overrides (any subset of fields)
type StapleOverride = Partial<Pick<Staple, "label" | "lbsPerPersonPerDay" | "retailPerLb" | "bulkPerLb" | "shelfLifeMonths">>;
type Overrides = Record<string, StapleOverride>;
type LiveBulkPrice = Record<string, number | undefined>;

const HORIZONS = [3, 6, 12] as const;
type Horizon = typeof HORIZONS[number];

// Anything we can edit in the dialog (curated or custom)
type Editable = {
  id: string;
  isCustom: boolean;
  label: string;
  lbsPerPersonPerDay: number;
  retailPerLb: number;
  bulkPerLb: number;
  shelfLifeMonths: number;
};

interface Props {
  zip?: string | null;
}

export const BulkStoragePlanner = ({ zip: initialZip }: Props) => {
  const [household, setHousehold] = useState<number>(2);
  const [horizon, setHorizon] = useState<Horizon>(6);
  const [zip, setZip] = useState<string>(initialZip ?? "");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Overrides>({});
  const [customs, setCustoms] = useState<CustomItem[]>([]);
  const [livePrices, setLivePrices] = useState<LiveBulkPrice>({});
  const [storeName, setStoreName] = useState<string | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);

  // edit dialog
  const [editing, setEditing] = useState<Editable | null>(null);
  // add-custom form
  const [cName, setCName] = useState("");
  const [cLbs, setCLbs] = useState("0.10");
  const [cRetail, setCRetail] = useState("3.00");
  const [cBulk, setCBulk] = useState("1.50");
  const [cShelf, setCShelf] = useState("12");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("household_size, zip_code")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.household_size) setHousehold(data.household_size);
      if (data?.zip_code && !initialZip) setZip(data.zip_code);
    })();
  }, [initialZip]);

  const days = horizon * 30;
  // Apply overrides to curated, then drop hidden ones
  const effectiveStaples = useMemo(
    () => STAPLES.filter((s) => !hidden.has(s.key)).map((s) => ({ ...s, ...overrides[s.key] })),
    [hidden, overrides]
  );
  const hiddenStaples = STAPLES.filter((s) => hidden.has(s.key));

  const rows = useMemo(() => {
    const built = effectiveStaples.map((s) => {
      const totalLbs = s.lbsPerPersonPerDay * household * days;
      const live = livePrices[s.key];
      const userOverrodeRetail = overrides[s.key]?.retailPerLb != null;
      const retailPerLb = userOverrodeRetail ? s.retailPerLb : (live ?? s.retailPerLb);
      const bulkPerLb = (live && !userOverrodeRetail)
        ? Math.max(retailPerLb * 0.55, s.bulkPerLb * 0.9)
        : s.bulkPerLb;
      const retailCost = totalLbs * retailPerLb;
      const bulkCost = totalLbs * bulkPerLb;
      const savings = retailCost - bulkCost;
      const fitsShelf = s.shelfLifeMonths >= horizon;

      // Find cheapest bulk source that beats current bulkPerLb by ≥5%
      let bestDeal: { store: string; pricePerLb: number; searchUrl: string; pctVsBulk: number; pctVsRetail: number; extraSavings: number } | null = null;
      const sources = s.bulkSources ?? [];
      const cheapest = sources.reduce<BulkSource | null>((min, c) => (!min || c.pricePerLb < min.pricePerLb) ? c : min, null);
      if (cheapest && cheapest.pricePerLb < bulkPerLb * 0.95) {
        bestDeal = {
          ...cheapest,
          pctVsBulk: Math.round((1 - cheapest.pricePerLb / bulkPerLb) * 100),
          pctVsRetail: Math.round((1 - cheapest.pricePerLb / retailPerLb) * 100),
          extraSavings: (bulkPerLb - cheapest.pricePerLb) * totalLbs,
        };
      }

      return {
        ...s,
        totalLbs, retailPerLb, bulkPerLb, retailCost, bulkCost, savings, fitsShelf,
        isLive: !!live && !userOverrodeRetail,
        isCustom: false,
        bestDeal,
      };
    });
    const customRows = customs.map((c) => {
      const totalLbs = c.lbsPerPersonPerDay * household * days;
      const retailCost = totalLbs * c.retailPerLb;
      const bulkCost = totalLbs * c.bulkPerLb;
      return {
        key: c.id,
        label: c.label,
        searchTerm: c.label,
        lbsPerPersonPerDay: c.lbsPerPersonPerDay,
        shelfLifeMonths: c.shelfLifeMonths,
        totalLbs,
        retailPerLb: c.retailPerLb,
        bulkPerLb: c.bulkPerLb,
        retailCost,
        bulkCost,
        savings: retailCost - bulkCost,
        fitsShelf: c.shelfLifeMonths >= horizon,
        isLive: false,
        isCustom: true,
        bestDeal: null as null,
      };
    });
    return [...built, ...customRows];
  }, [effectiveStaples, customs, household, days, horizon, livePrices, overrides]);

  const totals = useMemo(() => {
    const retail = rows.reduce((s, r) => s + r.retailCost, 0);
    const bulk = rows.reduce((s, r) => s + r.bulkCost, 0);
    return { retail, bulk, savings: retail - bulk, weeklyEquivalent: retail / (horizon * 4.345) };
  }, [rows, horizon]);

  const removeRow = (id: string, isCustom: boolean) => {
    if (isCustom) {
      setCustoms((p) => p.filter((c) => c.id !== id));
    } else {
      setHidden((p) => { const n = new Set(p); n.add(id); return n; });
    }
  };
  const restoreStaple = (key: string) => setHidden((p) => { const n = new Set(p); n.delete(key); return n; });
  const resetCurated = (key: string) => setOverrides((p) => { const n = { ...p }; delete n[key]; return n; });

  const openEdit = (r: any) => {
    setEditing({
      id: r.key,
      isCustom: !!r.isCustom,
      label: r.label,
      lbsPerPersonPerDay: r.lbsPerPersonPerDay,
      retailPerLb: r.retailPerLb,
      bulkPerLb: r.bulkPerLb,
      shelfLifeMonths: r.shelfLifeMonths,
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    const { id, isCustom, label, lbsPerPersonPerDay, retailPerLb, bulkPerLb, shelfLifeMonths } = editing;
    if (!label.trim() || !(lbsPerPersonPerDay > 0) || !(retailPerLb > 0) || !(bulkPerLb > 0) || !(shelfLifeMonths > 0)) {
      toast.error("All fields need positive numbers.");
      return;
    }
    if (bulkPerLb >= retailPerLb) {
      toast.error("Bulk $/lb should be lower than retail.");
      return;
    }
    if (isCustom) {
      setCustoms((p) => p.map((c) => c.id === id ? { ...c, label: label.trim(), lbsPerPersonPerDay, retailPerLb, bulkPerLb, shelfLifeMonths } : c));
    } else {
      setOverrides((p) => ({ ...p, [id]: { label: label.trim(), lbsPerPersonPerDay, retailPerLb, bulkPerLb, shelfLifeMonths } }));
    }
    setEditing(null);
    toast.success("Updated");
  };

  const addCustom = () => {
    const lbs = parseFloat(cLbs), r = parseFloat(cRetail), b = parseFloat(cBulk), sh = parseInt(cShelf);
    if (!cName.trim() || !(lbs > 0) || !(r > 0) || !(b > 0) || !(sh > 0)) {
      toast.error("Fill in all custom item fields with positive numbers.");
      return;
    }
    if (b >= r) {
      toast.error("Bulk price per lb should be lower than retail.");
      return;
    }
    setCustoms((p) => [...p, {
      id: `c-${Date.now()}`,
      label: cName.trim(),
      lbsPerPersonPerDay: lbs,
      retailPerLb: r,
      bulkPerLb: b,
      shelfLifeMonths: sh,
    }]);
    setCName("");
  };

  const fetchLive = async () => {
    if (!zip || zip.length < 5) {
      toast.error("Enter a 5-digit ZIP to look up live prices.");
      return;
    }
    setPricesLoading(true);
    try {
      const items = effectiveStaples.map((s) => ({ item: s.searchTerm, key: s.key }));
      const { data, error } = await supabase.functions.invoke("kroger-prices", {
        body: { zip, items: items.map((i) => ({ item: i.item })) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStoreName(data?.store ? `${data.store.chain ?? ""} ${data.store.name ?? ""}`.trim() : null);
      const next: LiveBulkPrice = {};
      (data?.prices ?? []).forEach((p: any, idx: number) => {
        const key = items[idx]?.key;
        const m = p?.match;
        if (!key || !m?.price_usd) return;
        // crude: try to read size like "5 lb", "32 oz" → $/lb
        const size: string = (m.size ?? "").toLowerCase();
        let lbs: number | null = null;
        const lbMatch = size.match(/([\d.]+)\s*lb/);
        const ozMatch = size.match(/([\d.]+)\s*oz/);
        if (lbMatch) lbs = parseFloat(lbMatch[1]);
        else if (ozMatch) lbs = parseFloat(ozMatch[1]) / 16;
        if (lbs && lbs > 0) next[key] = m.price_usd / lbs;
      });
      setLivePrices(next);
      const matched = Object.keys(next).length;
      toast.success(matched > 0 ? `Refined ${matched} item${matched === 1 ? "" : "s"} with live prices` : "No size info found in matches — using built-in estimates");
    } catch (e: any) {
      toast.error(e.message ?? "Could not fetch live prices");
    } finally {
      setPricesLoading(false);
    }
  };

  return (
    <Card className="p-6 rounded-3xl border-border/50 shadow-soft mb-8">
      <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
        <Boxes className="h-3.5 w-3.5" /> Bulk & long-term storage
      </div>
      <h2 className="text-2xl font-bold text-primary mb-1">Stock up & save</h2>
      <p className="text-sm text-muted-foreground mb-5">
        See how much non-perishable food your household needs for {horizon} months — and what you'd save buying in bulk.
      </p>

      {/* Controls */}
      <div className="grid sm:grid-cols-4 gap-3 mb-5">
        <div>
          <Label className="text-xs">Household size</Label>
          <Input type="number" min={1} max={20} value={household} onChange={(e) => setHousehold(Math.max(1, parseInt(e.target.value) || 1))} className="rounded-xl mt-1" />
        </div>
        <div>
          <Label className="text-xs">Horizon</Label>
          <Select value={String(horizon)} onValueChange={(v) => setHorizon(parseInt(v) as Horizon)}>
            <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HORIZONS.map((h) => <SelectItem key={h} value={String(h)}>{h} months</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">ZIP (for live prices)</Label>
          <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="e.g. 90210" className="rounded-xl mt-1" />
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={fetchLive} disabled={pricesLoading} className="rounded-xl w-full">
            {pricesLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Refine with live prices
          </Button>
        </div>
      </div>
      {storeName && (
        <div className="text-xs text-muted-foreground mb-4">Live prices from <span className="font-medium text-primary">{storeName}</span></div>
      )}

      {/* Restore hidden curated items */}
      {hiddenStaples.length > 0 && (
        <div className="mb-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Hidden — tap to restore</div>
          <div className="flex flex-wrap gap-2">
            {hiddenStaples.map((s) => (
              <button
                key={s.key}
                onClick={() => restoreStaple(s.key)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-muted text-muted-foreground hover:bg-muted/70 inline-flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" /> {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results — cards on mobile, table on sm+ */}
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">Pick at least one staple above to see the plan.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {rows.map((r) => (
              <div key={r.key} className="rounded-2xl border border-border/50 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-medium text-primary flex items-center gap-2 flex-wrap">
                      {r.label}
                      {r.isLive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">LIVE</span>}
                      {!r.fitsShelf && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">{r.shelfLifeMonths}mo shelf</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.totalLbs.toFixed(1)} lb · ${r.retailPerLb.toFixed(2)}/lb retail · ${r.bulkPerLb.toFixed(2)}/lb bulk
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-primary p-2 -m-2" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => removeRow(r.key, r.isCustom)} className="text-muted-foreground hover:text-destructive p-2 -m-2" aria-label={r.isCustom ? "Remove" : "Hide"}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Retail</div>
                    <div className="tabular-nums">${r.retailCost.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bulk</div>
                    <div className="tabular-nums font-semibold text-primary">${r.bulkCost.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Save</div>
                    <div className="tabular-nums font-semibold text-accent">
                      ${r.savings.toFixed(0)}
                      {r.retailCost > 0 && <span className="text-[10px] text-muted-foreground font-normal ml-1">({Math.round((r.savings / r.retailCost) * 100)}%)</span>}
                    </div>
                  </div>
                </div>
                {r.bestDeal && (
                  <a
                    href={r.bestDeal.searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-2 rounded-xl bg-accent/10 border border-accent/30 px-3 py-2 text-xs text-accent hover:bg-accent/15 active:bg-accent/20"
                  >
                    <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">
                      Save <span className="font-bold">{r.bestDeal.pctVsBulk}%</span> more (~${r.bestDeal.extraSavings.toFixed(0)}) at <span className="font-semibold">{r.bestDeal.store}</span> — ${r.bestDeal.pricePerLb.toFixed(2)}/lb
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                )}
              </div>
            ))}
            <div className="rounded-2xl bg-muted/30 border-2 border-border p-4">
              <div className="font-semibold text-primary text-sm mb-2">Total · {household} {household === 1 ? "person" : "people"} · {horizon} months</div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Retail</div>
                  <div className="tabular-nums">${totals.retail.toFixed(0)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bulk</div>
                  <div className="tabular-nums font-bold text-primary">${totals.bulk.toFixed(0)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Save</div>
                  <div className="tabular-nums font-bold text-accent">
                    ${totals.savings.toFixed(0)}
                    {totals.retail > 0 && <span className="text-[10px] text-muted-foreground font-normal ml-1">({Math.round((totals.savings / totals.retail) * 100)}%)</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop / tablet table */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border/50">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Item</th>
                  <th className="text-right p-3">Need</th>
                  <th className="text-right p-3">Retail total</th>
                  <th className="text-right p-3">Bulk total</th>
                  <th className="text-right p-3">You save</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.key}>
                    <tr className="border-t border-border/50">
                      <td className="p-3">
                        <div className="font-medium text-primary flex items-center gap-2">
                          {r.label}
                          {r.isLive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">LIVE</span>}
                          {!r.fitsShelf && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">shelf life {r.shelfLifeMonths}mo</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">${r.retailPerLb.toFixed(2)}/lb retail · ${r.bulkPerLb.toFixed(2)}/lb bulk</div>
                      </td>
                      <td className="p-3 text-right tabular-nums">{r.totalLbs.toFixed(1)} lb</td>
                      <td className="p-3 text-right tabular-nums">${r.retailCost.toFixed(0)}</td>
                      <td className="p-3 text-right tabular-nums font-semibold text-primary">${r.bulkCost.toFixed(0)}</td>
                      <td className="p-3 text-right tabular-nums font-semibold text-accent">
                        ${r.savings.toFixed(0)}
                        {r.retailCost > 0 && (
                          <div className="text-[10px] font-normal text-muted-foreground">
                            {Math.round((r.savings / r.retailCost) * 100)}% off
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-primary p-2 -m-2" aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => removeRow(r.key, r.isCustom)} className="text-muted-foreground hover:text-destructive p-2 -m-2" aria-label={r.isCustom ? "Remove" : "Hide"}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {r.bestDeal && (
                      <tr className="border-t border-dashed border-accent/30 bg-accent/5">
                        <td colSpan={6} className="px-3 py-2">
                          <a
                            href={r.bestDeal.searchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs text-accent hover:underline"
                          >
                            <TrendingDown className="h-3.5 w-3.5" />
                            Save <span className="font-bold">{r.bestDeal.pctVsBulk}%</span> more (~${r.bestDeal.extraSavings.toFixed(0)}) at <span className="font-semibold">{r.bestDeal.store}</span> — ${r.bestDeal.pricePerLb.toFixed(2)}/lb
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="p-3 font-semibold text-primary">Total · {household} {household === 1 ? "person" : "people"} · {horizon} months</td>
                  <td className="p-3" />
                  <td className="p-3 text-right tabular-nums">${totals.retail.toFixed(0)}</td>
                  <td className="p-3 text-right tabular-nums font-bold text-primary">${totals.bulk.toFixed(0)}</td>
                  <td className="p-3 text-right tabular-nums font-bold text-accent">
                    <span className="inline-flex items-center gap-1"><TrendingDown className="h-3.5 w-3.5" />${totals.savings.toFixed(0)}</span>
                    {totals.retail > 0 && (
                      <div className="text-[10px] font-normal text-muted-foreground">
                        {Math.round((totals.savings / totals.retail) * 100)}% off
                      </div>
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          Equivalent of about <span className="font-semibold text-primary">${totals.weeklyEquivalent.toFixed(0)}/week</span> spent at retail. Stocking up could save you{" "}
          <span className="font-semibold text-accent">${(totals.savings / horizon).toFixed(0)}/month</span> on these staples.
        </p>
      )}

      {/* Custom item form */}
      <div className="mt-6 pt-5 border-t border-border/50">
        <div className="text-xs uppercase tracking-wider text-accent mb-3">Add your own staple</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-xs">Name</Label>
            <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. Quinoa" className="rounded-xl mt-1" />
          </div>
          <div>
            <Label className="text-xs">Lb/person/day</Label>
            <Input type="number" step="0.01" value={cLbs} onChange={(e) => setCLbs(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <Label className="text-xs">Retail $/lb</Label>
            <Input type="number" step="0.01" value={cRetail} onChange={(e) => setCRetail(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <Label className="text-xs">Bulk $/lb</Label>
            <Input type="number" step="0.01" value={cBulk} onChange={(e) => setCBulk(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <Label className="text-xs">Shelf (months)</Label>
            <Input type="number" value={cShelf} onChange={(e) => setCShelf(e.target.value)} className="rounded-xl mt-1" />
          </div>
        </div>
        <Button variant="outline" onClick={addCustom} className="rounded-xl mt-3">
          <Plus className="h-4 w-4 mr-2" /> Add custom item
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary">Edit {editing?.label}</DialogTitle>
            <DialogDescription>Tune the consumption rate, prices, or shelf life for your household.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Name</Label>
                <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} className="rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-xs">Lb/person/day</Label>
                <Input type="number" step="0.01" value={editing.lbsPerPersonPerDay}
                  onChange={(e) => setEditing({ ...editing, lbsPerPersonPerDay: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-xs">Shelf (months)</Label>
                <Input type="number" value={editing.shelfLifeMonths}
                  onChange={(e) => setEditing({ ...editing, shelfLifeMonths: parseInt(e.target.value) || 0 })}
                  className="rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-xs">Retail $/lb</Label>
                <Input type="number" step="0.01" value={editing.retailPerLb}
                  onChange={(e) => setEditing({ ...editing, retailPerLb: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-xs">Bulk $/lb</Label>
                <Input type="number" step="0.01" value={editing.bulkPerLb}
                  onChange={(e) => setEditing({ ...editing, bulkPerLb: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl mt-1" />
              </div>
            </div>
          )}
          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            {editing && !editing.isCustom && overrides[editing.id] ? (
              <Button variant="ghost" className="rounded-xl" onClick={() => { resetCurated(editing.id); setEditing(null); toast.success("Reset to defaults"); }}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Reset to default
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="hero" className="rounded-xl" onClick={saveEdit}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
