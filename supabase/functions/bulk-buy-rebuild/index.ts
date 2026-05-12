// Nightly job: derive new bulk_buy_candidates from recent sale_observations.
// Looks at sales with high savings_pct and a pack_size hint, groups by food_name,
// and upserts derived candidates that aren't already curated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { detectItemCuisines } from "../_shared/cuisineHints.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PACK_RE = /(\d+(?:\.\d+)?)\s*(lb|lbs|pound|kg|oz|g|ct|count|pack)/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const since = new Date(Date.now() - 60 * 86400 * 1000).toISOString();
    const { data: sales, error } = await supabase
      .from("sale_observations")
      .select("food_name, sale_price_usd, regular_price_usd, savings_pct, pack_size")
      .gte("created_at", since)
      .in("moderation_status", ["auto_approved", "approved"])
      .not("pack_size", "is", null);
    if (error) throw error;

    // Group by normalized food_name; require pack_size hint and ≥20% savings.
    type Row = { sale: number; reg: number; pack: string };
    const groups = new Map<string, Row[]>();
    for (const s of sales ?? []) {
      const pct = Number(s.savings_pct ?? 0);
      const reg = Number(s.regular_price_usd ?? 0);
      const sale = Number(s.sale_price_usd ?? 0);
      if (pct < 20 || !reg || !sale || !s.pack_size) continue;
      if (!PACK_RE.test(s.pack_size)) continue;
      const key = s.food_name.trim().toLowerCase();
      const arr = groups.get(key) ?? [];
      arr.push({ sale, reg, pack: s.pack_size });
      groups.set(key, arr);
    }

    // Existing candidates (skip if already curated under same name).
    const { data: existing } = await supabase
      .from("bulk_buy_candidates")
      .select("food_name, source");
    const curatedNames = new Set(
      (existing ?? [])
        .filter((c: any) => c.source === "curated")
        .map((c: any) => c.food_name.trim().toLowerCase()),
    );
    const derivedExisting = new Set(
      (existing ?? [])
        .filter((c: any) => c.source === "derived")
        .map((c: any) => c.food_name.trim().toLowerCase()),
    );

    const median = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return s.length ? s[Math.floor(s.length / 2)] : 0;
    };

    const upserts: any[] = [];
    for (const [name, rows] of groups.entries()) {
      if (rows.length < 2) continue; // need a couple of sightings
      if (curatedNames.has(name)) continue;
      const bulkPrice = median(rows.map((r) => r.sale));
      const typical = median(rows.map((r) => r.reg));
      if (typical <= bulkPrice) continue;
      const savingsPct = Math.round(((typical - bulkPrice) / typical) * 100);
      const tags = detectItemCuisines(name);
      upserts.push({
        food_name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
        cuisine_tags: tags,
        typical_unit_price_usd: Number(typical.toFixed(2)),
        bulk_unit_price_usd: Number(bulkPrice.toFixed(2)),
        bulk_pack_size: rows[0].pack,
        est_savings_pct: savingsPct,
        shelf_life_days: 90,
        confidence: rows.length >= 4 ? "high" : "medium",
        source: "derived",
        notes: `Derived from ${rows.length} recent sale${rows.length === 1 ? "" : "s"}.`,
      });
    }

    let inserted = 0;
    let updated = 0;
    for (const row of upserts) {
      const key = row.food_name.toLowerCase();
      if (derivedExisting.has(key)) {
        const { error: uErr } = await supabase
          .from("bulk_buy_candidates")
          .update(row)
          .ilike("food_name", row.food_name)
          .eq("source", "derived");
        if (!uErr) updated++;
      } else {
        const { error: iErr } = await supabase.from("bulk_buy_candidates").insert(row);
        if (!iErr) inserted++;
      }
    }

    return new Response(
      JSON.stringify({ scanned: sales?.length ?? 0, groups: groups.size, inserted, updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("bulk-buy-rebuild error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
