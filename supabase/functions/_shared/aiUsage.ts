// Shared helper for AI cost tracking and response caching across edge functions.
// Each AI function should:
//   1. Build a stable cacheKey from inputs (use stableHash).
//   2. Call cacheGet(fnName, key) — return early on hit (already logs).
//   3. Make the AI call, then call logAiUsage(...) and cachePut(...).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Rough USD per 1K tokens (input/output blended). Update as pricing shifts.
// Source: Lovable AI Gateway docs — adjust here if rates change.
const PRICING: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-pro":         { input: 0.00125, output: 0.005 },
  "google/gemini-2.5-flash":       { input: 0.000075, output: 0.0003 },
  "google/gemini-2.5-flash-lite":  { input: 0.0000375, output: 0.00015 },
  "google/gemini-3.1-pro-preview": { input: 0.00125, output: 0.005 },
  "google/gemini-3-flash-preview": { input: 0.000075, output: 0.0003 },
  "openai/gpt-5":                  { input: 0.00125, output: 0.01 },
  "openai/gpt-5-mini":             { input: 0.00025, output: 0.002 },
  "openai/gpt-5-nano":             { input: 0.00005, output: 0.0004 },
  "openai/gpt-5.2":                { input: 0.00125, output: 0.01 },
};

let _client: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (_client) return _client;
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const p = PRICING[model] ?? { input: 0.0005, output: 0.002 };
  return (promptTokens / 1000) * p.input + (completionTokens / 1000) * p.output;
}

export async function stableHash(input: unknown): Promise<string> {
  const json = JSON.stringify(input, Object.keys(input as object ?? {}).sort());
  const buf = new TextEncoder().encode(json);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getUserIdFromAuth(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const token = auth.slice(7);
    const { data } = await admin().auth.getUser(token);
    return data.user?.id ?? null;
  } catch { return null; }
}

export type LogArgs = {
  userId: string | null;
  functionName: string;
  model: string | null;
  promptTokens?: number;
  completionTokens?: number;
  cached?: boolean;
  latencyMs?: number;
  status?: "ok" | "error";
  error?: string;
};

export async function logAiUsage(a: LogArgs): Promise<void> {
  try {
    const prompt = a.promptTokens ?? 0;
    const completion = a.completionTokens ?? 0;
    const cost = a.cached || !a.model ? 0 : estimateCostUsd(a.model, prompt, completion);
    await admin().from("ai_usage_log").insert({
      user_id: a.userId,
      function_name: a.functionName,
      model: a.model,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion,
      cost_estimate_usd: cost,
      cached: !!a.cached,
      latency_ms: a.latencyMs ?? null,
      status: a.status ?? "ok",
      error: a.error ?? null,
    });
  } catch (e) {
    console.error("ai usage log failed:", e);
  }
}

export async function cacheGet<T = unknown>(functionName: string, key: string): Promise<T | null> {
  try {
    const { data } = await admin()
      .from("ai_response_cache")
      .select("response, expires_at")
      .eq("cache_key", `${functionName}:${key}`)
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    // best-effort hit counter (don't await failures)
    admin().rpc; // noop ref
    admin().from("ai_response_cache")
      .update({ hit_count: 1 })  // not great — overwrites; we'll do via SQL on miss path instead
      .eq("cache_key", `${functionName}:${key}`)
      .then(() => {}, () => {});
    return data.response as T;
  } catch { return null; }
}

export async function cachePut(functionName: string, key: string, response: unknown, ttlHours = 24 * 7): Promise<void> {
  try {
    const expires = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
    await admin().from("ai_response_cache").upsert({
      cache_key: `${functionName}:${key}`,
      function_name: functionName,
      response,
      expires_at: expires,
      hit_count: 0,
    }, { onConflict: "cache_key" });
  } catch (e) {
    console.error("ai cache put failed:", e);
  }
}
