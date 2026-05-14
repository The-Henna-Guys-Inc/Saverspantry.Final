// Shared AI call shim — lets all edge functions switch between
// Lovable AI Gateway and direct Google Gemini via a single env var.
//
// Set AI_PROVIDER=gemini and GEMINI_API_KEY=... to use Google directly.
// Default (unset / "lovable") keeps using LOVABLE_API_KEY + Lovable Gateway.
//
// Both endpoints speak the OpenAI chat-completions JSON shape
// (messages, tools, tool_choice, modalities, image_url, tool_calls),
// so callers can pass the same body unchanged.

const PROVIDER = (Deno.env.get("AI_PROVIDER") ?? "lovable").toLowerCase();

const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Map Lovable model IDs (`google/gemini-2.5-flash`) to Google's
// OpenAI-compatible names (`gemini-2.5-flash`). Image model included.
function mapModel(model: string): string {
  if (PROVIDER !== "gemini") return model;
  return model.replace(/^google\//, "");
}

export interface AiCallBody {
  model: string;
  messages: unknown[];
  tools?: unknown[];
  tool_choice?: unknown;
  modalities?: string[];
  // Allow any other OpenAI-compatible field
  [k: string]: unknown;
}

/**
 * Drop-in replacement for `fetch(GATEWAY, { ... })`.
 * Returns the raw Response so callers can keep their existing
 * status-code branching (429 → rate_limited, 402 → credits, etc.).
 */
export async function aiCall(body: AiCallBody): Promise<Response> {
  if (PROVIDER === "gemini") {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY not configured");
    return fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, model: mapModel(body.model) }),
    });
  }

  // Default: Lovable AI Gateway
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  return fetch(LOVABLE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export const AI_PROVIDER = PROVIDER;
