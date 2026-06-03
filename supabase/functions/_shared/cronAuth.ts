// Guard for cron-only edge functions. Requires a shared secret header
// (`x-cron-secret`) matching the CRON_SECRET environment variable.
// If CRON_SECRET is not configured, the function refuses to run — fail closed.
export function checkCronAuth(req: Request): Response | null {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) {
    return new Response(
      JSON.stringify({ error: "CRON_SECRET not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const got = req.headers.get("x-cron-secret");
  if (got !== expected) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  return null;
}
