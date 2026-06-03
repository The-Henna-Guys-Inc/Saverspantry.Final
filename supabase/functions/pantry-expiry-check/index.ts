import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkCronAuth } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const unauth = checkCronAuth(req);
  if (unauth) return unauth;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const today = new Date();
    const in3 = new Date(today); in3.setDate(in3.getDate() + 3);
    const in3Iso = in3.toISOString().slice(0, 10);
    const todayIso = today.toISOString().slice(0, 10);

    // Expiring within 3 days
    const { data: expiring } = await supabase
      .from("pantry_items")
      .select("user_id, item, expires_on, quantity, unit")
      .not("expires_on", "is", null)
      .lte("expires_on", in3Iso)
      .gte("expires_on", todayIso);

    // Low stock
    const { data: low } = await supabase
      .from("pantry_items")
      .select("user_id, item, quantity, low_stock_threshold, unit")
      .not("low_stock_threshold", "is", null);

    const notifications: any[] = [];
    const seen = new Set<string>();

    for (const it of expiring ?? []) {
      const days = Math.max(0, Math.ceil((new Date(it.expires_on!).getTime() - today.getTime()) / 86400000));
      const key = `exp:${it.user_id}:${it.item}:${it.expires_on}`;
      if (seen.has(key)) continue;
      seen.add(key);
      notifications.push({
        user_id: it.user_id,
        kind: "expiring_soon",
        title: `${it.item} expires ${days === 0 ? "today" : `in ${days}d`}`,
        body: `${it.quantity} ${it.unit} in your pantry`,
        link: "/pantry",
        metadata: { item: it.item, expires_on: it.expires_on },
      });
    }

    for (const it of low ?? []) {
      if (it.low_stock_threshold == null) continue;
      if (Number(it.quantity) > Number(it.low_stock_threshold)) continue;
      const key = `low:${it.user_id}:${it.item}`;
      if (seen.has(key)) continue;
      seen.add(key);
      notifications.push({
        user_id: it.user_id,
        kind: "low_stock",
        title: `Running low on ${it.item}`,
        body: `Only ${it.quantity} ${it.unit} left`,
        link: "/pantry",
        metadata: { item: it.item },
      });
    }

    // Dedupe vs last 24h
    const since = new Date(Date.now() - 86400000).toISOString();
    const { data: recent } = await supabase
      .from("notifications")
      .select("user_id, title")
      .gte("created_at", since);
    const recentSet = new Set((recent ?? []).map((r) => `${r.user_id}:${r.title}`));
    const fresh = notifications.filter((n) => !recentSet.has(`${n.user_id}:${n.title}`));

    if (fresh.length) await supabase.from("notifications").insert(fresh);

    return new Response(JSON.stringify({ inserted: fresh.length, scanned: notifications.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
