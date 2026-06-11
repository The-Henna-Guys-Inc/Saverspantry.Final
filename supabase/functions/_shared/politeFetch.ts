// Polite HTTP client for outbound scraping.
//
// Three guarantees per request:
//   1) Honest, identifiable User-Agent (SaversPantryBot/1.0)
//   2) robots.txt compliance — fetched & cached per host; disallowed paths throw
//   3) Per-host crawl-delay (default 2s; honors robots `Crawl-delay` directive)
//
// Use this for ANY request to a third-party site we don't own. Do not use for
// Lovable AI gateway, Supabase APIs, Kroger official API, Firecrawl, etc.

const UA = "SaversPantryBot/1.0 (+https://saverspantry.com/bot)";
const DEFAULT_CRAWL_DELAY_MS = 2000;
const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;

type RobotsRules = {
  disallow: string[];
  allow: string[];
  crawlDelayMs: number;
  fetchedAt: number;
};

const robotsCache = new Map<string, RobotsRules | "missing">();
const lastFetchAt = new Map<string, number>();

export class RobotsDisallowedError extends Error {
  constructor(public url: string) {
    super(`Blocked by robots.txt: ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

async function loadRobots(origin: string): Promise<RobotsRules | "missing"> {
  const cached = robotsCache.get(origin);
  if (cached && cached !== "missing" && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached;
  if (cached === "missing") return "missing";
  try {
    const r = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": UA, Accept: "text/plain" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      robotsCache.set(origin, "missing");
      return "missing";
    }
    const text = await r.text();
    const rules = parseRobots(text);
    robotsCache.set(origin, rules);
    return rules;
  } catch {
    robotsCache.set(origin, "missing");
    return "missing";
  }
}

function parseRobots(text: string): RobotsRules {
  // Pick the most specific group: SaversPantryBot > * (ignore others).
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean);
  type Group = { agents: string[]; disallow: string[]; allow: string[]; delay?: number };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const line of lines) {
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (key === "disallow") current.disallow.push(val);
      else if (key === "allow") current.allow.push(val);
      else if (key === "crawl-delay") {
        const n = parseFloat(val);
        if (!isNaN(n)) current.delay = Math.min(60, Math.max(0, n)) * 1000;
      }
    }
  }
  const specific = groups.find((g) => g.agents.some((a) => a.includes("saverspantrybot")));
  const wildcard = groups.find((g) => g.agents.includes("*"));
  const pick = specific ?? wildcard;
  return {
    disallow: pick?.disallow ?? [],
    allow: pick?.allow ?? [],
    crawlDelayMs: pick?.delay ?? DEFAULT_CRAWL_DELAY_MS,
    fetchedAt: Date.now(),
  };
}

function isAllowed(path: string, rules: RobotsRules): boolean {
  // Longest-match wins between allow & disallow.
  const match = (pattern: string): number => {
    if (!pattern) return 0; // empty disallow = allow everything
    // Convert robots glob to regex (* wildcard, $ end).
    const re = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + (pattern.endsWith("$") ? "" : ""));
    return re.test(path) ? pattern.length : -1;
  };
  let bestAllow = -1, bestDisallow = -1;
  for (const p of rules.allow) bestAllow = Math.max(bestAllow, match(p));
  for (const p of rules.disallow) bestDisallow = Math.max(bestDisallow, match(p));
  if (bestDisallow === -1) return true;
  return bestAllow >= bestDisallow;
}

async function throttleHost(host: string, crawlDelayMs: number) {
  const last = lastFetchAt.get(host) ?? 0;
  const wait = last + crawlDelayMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt.set(host, Date.now());
}

export interface PoliteFetchOptions extends RequestInit {
  /** Skip robots.txt check (use sparingly; only for our own infra). */
  skipRobots?: boolean;
  /** Override crawl-delay floor. */
  minDelayMs?: number;
}

/**
 * Fetch a URL with bot-identifying UA, robots.txt compliance, and crawl-delay.
 * Throws RobotsDisallowedError if the path is disallowed.
 */
export async function politeFetch(url: string, init: PoliteFetchOptions = {}): Promise<Response> {
  const u = new URL(url);
  const origin = `${u.protocol}//${u.host}`;
  const rules = init.skipRobots ? "missing" : await loadRobots(origin);
  if (rules !== "missing" && !isAllowed(u.pathname + u.search, rules)) {
    throw new RobotsDisallowedError(url);
  }
  const delay = Math.max(
    init.minDelayMs ?? 0,
    rules === "missing" ? DEFAULT_CRAWL_DELAY_MS : rules.crawlDelayMs,
  );
  await throttleHost(u.host, delay);
  const headers = new Headers(init.headers);
  if (!headers.has("User-Agent")) headers.set("User-Agent", UA);
  return fetch(url, { ...init, headers });
}

export const BOT_USER_AGENT = UA;
