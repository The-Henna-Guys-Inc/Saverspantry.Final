import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData, error: cErr } = await admin.auth.getUser(token);
    if (cErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action as string; // "request" | "cancel"
    const reason = (body.reason ?? null) as string | null;


    if (action === "request") {
      const { data: existing } = await admin.from("account_deletion_requests")
        .select("id, cancelled_at, purged_at").eq("user_id", userId).maybeSingle();
      if (existing && !existing.cancelled_at && !existing.purged_at) {
        return new Response(JSON.stringify({ ok: true, already: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const purgeAt = new Date(Date.now() + 30 * 86400000).toISOString();
      if (existing) {
        await admin.from("account_deletion_requests").update({
          requested_at: new Date().toISOString(), scheduled_purge_at: purgeAt,
          cancelled_at: null, purged_at: null, reason,
        }).eq("user_id", userId);
      } else {
        await admin.from("account_deletion_requests").insert({
          user_id: userId, scheduled_purge_at: purgeAt, reason,
        });
      }
      await admin.from("profiles").update({ deletion_pending_at: new Date().toISOString() }).eq("user_id", userId);
      return new Response(JSON.stringify({ ok: true, scheduled_purge_at: purgeAt }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "cancel") {
      await admin.from("account_deletion_requests")
        .update({ cancelled_at: new Date().toISOString() })
        .eq("user_id", userId).is("purged_at", null);
      await admin.from("profiles").update({ deletion_pending_at: null }).eq("user_id", userId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
