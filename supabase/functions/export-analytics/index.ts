import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JWKS = createRemoteJWKSet(new URL(`${Deno.env.get("SUPABASE_URL")}/auth/v1/.well-known/jwks.json`));

const csv = (rows: any[][]) =>
  rows.map((r) => r.map((c) => {
    if (c == null) return "";
    const s = String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!auth) return new Response("unauthorized", { status: 401, headers: corsHeaders });
    const { payload } = await jwtVerify(auth, JWKS);
    const userId = payload.sub as string;

    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "savings";

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let header: string[] = [];
    let rows: any[][] = [];
    let filename = `${type}.csv`;

    if (type === "savings") {
      const { data } = await supabase.from("savings_events")
        .select("occurred_at, category, food_name, amount_usd, metadata")
        .eq("user_id", userId).order("occurred_at", { ascending: false }).limit(5000);
      header = ["occurred_at", "category", "food_name", "amount_usd", "metadata"];
      rows = (data ?? []).map((r) => [r.occurred_at, r.category, r.food_name ?? "", r.amount_usd, JSON.stringify(r.metadata ?? {})]);
    } else if (type === "pantry") {
      const { data } = await supabase.from("pantry_consumption_log")
        .select("used_at, item_name, quantity_used, unit, expires_on, was_before_expiry, days_to_expiry")
        .eq("user_id", userId).order("used_at", { ascending: false }).limit(5000);
      header = ["used_at", "item_name", "quantity_used", "unit", "expires_on", "was_before_expiry", "days_to_expiry"];
      rows = (data ?? []).map((r) => [r.used_at, r.item_name, r.quantity_used, r.unit ?? "", r.expires_on ?? "", r.was_before_expiry, r.days_to_expiry ?? ""]);
    } else if (type === "spend") {
      const { data } = await supabase.from("meal_plans")
        .select("week_start_date, plan, created_at")
        .eq("user_id", userId).order("week_start_date", { ascending: false }).limit(500);
      header = ["week_start_date", "total_estimated_cost_usd", "created_at"];
      rows = (data ?? []).map((r) => [r.week_start_date, (r.plan as any)?.total_estimated_cost_usd ?? "", r.created_at]);
    } else {
      return new Response("invalid type", { status: 400, headers: corsHeaders });
    }

    const body = csv([header, ...rows]);
    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
