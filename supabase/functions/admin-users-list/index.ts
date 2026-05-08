import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const perPage = Math.min(parseInt(url.searchParams.get("perPage") ?? "50"), 200);
    const search = (url.searchParams.get("search") ?? "").toLowerCase().trim();

    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    let users = list.users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      banned_until: (u as any).banned_until ?? null,
      email_confirmed_at: u.email_confirmed_at,
    }));
    if (search) users = users.filter((u) => (u.email ?? "").toLowerCase().includes(search) || u.id.includes(search));

    const ids = users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      admin.from("profiles").select("user_id, display_name, subscription_tier, deletion_pending_at").in("user_id", ids),
      admin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);
    const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const rmap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = rmap.get(r.user_id) ?? [];
      arr.push(r.role);
      rmap.set(r.user_id, arr);
    });

    const enriched = users.map((u) => ({
      ...u,
      profile: pmap.get(u.id) ?? null,
      roles: rmap.get(u.id) ?? [],
    }));

    return new Response(JSON.stringify({ users: enriched, page, perPage, total: list.total ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-users-list error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
