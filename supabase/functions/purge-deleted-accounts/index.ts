import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkCronAuth } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Cron-driven. Permanently deletes accounts past their grace period.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const unauth = checkCronAuth(req);
  if (unauth) return unauth;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: due } = await admin.from("account_deletion_requests")
    .select("id, user_id")
    .lte("scheduled_purge_at", new Date().toISOString())
    .is("cancelled_at", null)
    .is("purged_at", null)
    .limit(50);

  const purged: string[] = [];
  for (const r of due ?? []) {
    try {
      // Delete user-owned rows. RLS bypassed via service role.
      const tables = [
        "pantry_items","pantry_consumption_log","pantry_locations",
        "saved_swaps","saved_lookups","saved_recipes",
        "meal_plans","savings_events","analytics_snapshots",
        "watchlist_items","store_visits","sale_confirmations","sale_flags",
        "notifications","user_legal_acceptances","data_export_requests",
        "user_roles","profiles",
      ];
      for (const t of tables) await admin.from(t).delete().eq("user_id", r.user_id);
      // Finally delete the auth user
      await admin.auth.admin.deleteUser(r.user_id);
      await admin.from("account_deletion_requests").update({ purged_at: new Date().toISOString() }).eq("id", r.id);
      purged.push(r.user_id);
    } catch (e) {
      console.error("purge failed for", r.user_id, e);
    }
  }

  return new Response(JSON.stringify({ purged_count: purged.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
