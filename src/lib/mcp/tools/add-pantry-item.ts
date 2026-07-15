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
  name: "add_pantry_item",
  title: "Add pantry item",
  description:
    "Add a new item to the signed-in user's pantry. Use location values like 'pantry', 'fridge', 'freezer', or 'counter'.",
  inputSchema: {
    item: z.string().trim().min(1).describe("Item name, e.g. 'olive oil'."),
    quantity: z.number().min(0).optional().describe("Quantity (default 1)."),
    unit: z.string().optional().describe("Unit, e.g. 'ea', 'oz', 'lb', 'g' (default 'ea')."),
    location: z.string().optional().describe("Storage location (default 'pantry')."),
    category: z.string().optional().describe("Optional category, e.g. 'produce', 'dairy'."),
    expires_on: z.string().optional().describe("ISO date (YYYY-MM-DD) for expiration."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("pantry_items")
      .insert({
        user_id: ctx.getUserId(),
        item: input.item,
        quantity: input.quantity ?? 1,
        unit: input.unit ?? "ea",
        location: input.location ?? "pantry",
        category: input.category ?? null,
        expires_on: input.expires_on ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Added ${data.item} to ${data.location}.` }],
      structuredContent: { item: data },
    };
  },
});
