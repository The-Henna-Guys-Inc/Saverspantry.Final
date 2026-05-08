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

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { action, target_user_id, ban_duration, role: roleName } = body ?? {};
    if (!action || !target_user_id) throw new Error("action and target_user_id required");
    if (target_user_id === user.id && (action === "ban" || action === "remove_admin")) {
      throw new Error("cannot modify own admin/ban status");
    }

    let result: any = null;
    const audit: Record<string, unknown> = { action_input: body };

    switch (action) {
      case "ban": {
        const dur = ban_duration ?? "8760h"; // default 1 year
        const { data, error } = await admin.auth.admin.updateUserById(target_user_id, { ban_duration: dur });
        if (error) throw error;
        result = { banned_until: (data.user as any).banned_until };
        break;
      }
      case "unban": {
        const { data, error } = await admin.auth.admin.updateUserById(target_user_id, { ban_duration: "none" });
        if (error) throw error;
        result = { banned_until: (data.user as any).banned_until };
        break;
      }
      case "send_password_reset": {
        const { data: tu } = await admin.auth.admin.getUserById(target_user_id);
        if (!tu?.user?.email) throw new Error("target has no email");
        const { error } = await admin.auth.resetPasswordForEmail(tu.user.email);
        if (error) throw error;
        result = { sent_to: tu.user.email };
        break;
      }
      case "add_role": {
        if (!roleName) throw new Error("role required");
        const { error } = await admin.from("user_roles").insert({ user_id: target_user_id, role: roleName });
        if (error && !String(error.message).includes("duplicate")) throw error;
        result = { role: roleName };
        break;
      }
      case "remove_role": {
        if (!roleName) throw new Error("role required");
        const { error } = await admin.from("user_roles").delete().eq("user_id", target_user_id).eq("role", roleName);
        if (error) throw error;
        result = { role: roleName };
        break;
      }
      default:
        throw new Error(`unknown action: ${action}`);
    }

    await admin.from("admin_audit_log").insert({
      admin_user_id: user.id,
      action: `user.${action}`,
      target_type: "user",
      target_id: target_user_id,
      metadata: { ...audit, result },
      ip_address: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
    });

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-user-action error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
