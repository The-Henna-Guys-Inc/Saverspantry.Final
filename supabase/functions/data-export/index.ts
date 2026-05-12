import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Returns a single JSON file with everything the user owns.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("unauthorized", { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) {
      return new Response("unauthorized", { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;
    const email = claims.claims.email as string | undefined;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const tables = [
      "profiles","pantry_items","pantry_consumption_log","pantry_locations",
      "saved_swaps","saved_lookups","saved_recipes",
      "meal_plans","savings_events","analytics_snapshots",
      "watchlist_items","store_visits","sale_confirmations","sale_flags",
      "notifications","user_legal_acceptances","data_export_requests",
      "user_roles",
    ];
    const dump: Record<string, any> = {
      exported_at: new Date().toISOString(),
      user: { id: userId, email },
    };
    for (const t of tables) {
      const { data } = await admin.from(t).select("*").eq("user_id", userId);
      dump[t] = data ?? [];
    }

    // Log the request (best-effort)
    await admin.from("data_export_requests").insert({
      user_id: userId, status: "complete", completed_at: new Date().toISOString(),
    });

    const filename = `saverspantry-export-${new Date().toISOString().slice(0,10)}.json`;
    return new Response(JSON.stringify(dump, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
