// Guard for cron-only edge functions. The header `x-cron-secret` must match
// the value stored in the database vault (`cron_secret`). Verification goes
// through a privileged SQL function (`public.verify_cron_secret`) which is
// callable only by the service role — so a forged request from outside cannot
// validate even if it knows the function name.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function checkCronAuth(req: Request): Promise<Response | null> {
  const got = req.headers.get("x-cron-secret");
  if (!got) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc("verify_cron_secret", { _secret: got });
    if (error || data !== true) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
    return null;
  } catch (e) {
    console.error("checkCronAuth error", e);
    return new Response(
      JSON.stringify({ error: "Auth check failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
