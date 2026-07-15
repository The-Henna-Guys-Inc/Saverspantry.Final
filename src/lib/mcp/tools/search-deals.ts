import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_deals",
  title: "Search current deals",
  description:
    "Search currently active, approved grocery deals. Filter by food name, city, or store name. Returns items on sale right now with price and store info.",
  inputSchema: {
    food: z.string().optional().describe("Substring match on the food/item name."),
    city: z.string().optional().describe("Filter by city name."),
    store: z.string().optional().describe("Substring match on the store name or chain."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ food, city, store, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const nowIso = new Date().toISOString();
    let q = supabaseForUser(ctx)
      .from("sale_observations")
      .select("id,food_name,store_name,store_chain,city,sale_price_usd,regular_price_usd,savings_pct,starts_at,ends_at,pack_size,category")
      .eq("moderation_status", "approved")
      .lte("starts_at", nowIso)
      .gte("ends_at", nowIso)
      .order("savings_pct", { ascending: false, nullsFirst: false })
      .limit(limit ?? 25);
    if (food) q = q.ilike("food_name", `%${food}%`);
    if (city) q = q.ilike("city", `%${city}%`);
    if (store) q = q.or(`store_name.ilike.%${store}%,store_chain.ilike.%${store}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { deals: data ?? [] },
    };
  },
});
