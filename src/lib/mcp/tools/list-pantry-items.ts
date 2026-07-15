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
  name: "list_pantry_items",
  title: "List pantry items",
  description:
    "List the signed-in user's pantry items. Optionally filter by storage location (pantry, fridge, freezer, counter) or a search string on the item name.",
  inputSchema: {
    location: z.string().optional().describe("Filter by storage location, e.g. 'pantry', 'fridge', 'freezer', 'counter'."),
    search: z.string().optional().describe("Case-insensitive substring match on the item name."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ location, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("pantry_items")
      .select("id,item,quantity,unit,location,category,expires_on,updated_at")
      .order("location", { ascending: true })
      .order("item", { ascending: true })
      .limit(limit ?? 100);
    if (location) q = q.eq("location", location);
    if (search) q = q.ilike("item", `%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
