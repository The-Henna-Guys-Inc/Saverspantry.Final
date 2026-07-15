import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_favorite_stores",
  title: "List favorite stores",
  description:
    "Return the signed-in user's favorite grocery stores (up to 3) with name, chain, and city.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: profile, error: pErr } = await sb
      .from("profiles")
      .select("favorite_store_ids")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (pErr) return { content: [{ type: "text", text: pErr.message }], isError: true };
    const ids = (profile?.favorite_store_ids ?? []) as string[];
    if (ids.length === 0) {
      return {
        content: [{ type: "text", text: "No favorite stores set yet." }],
        structuredContent: { stores: [] },
      };
    }
    const { data: stores, error: sErr } = await sb
      .from("specialty_stores")
      .select("id,name,chain,city,region,address")
      .in("id", ids);
    if (sErr) return { content: [{ type: "text", text: sErr.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(stores ?? []) }],
      structuredContent: { stores: stores ?? [] },
    };
  },
});
