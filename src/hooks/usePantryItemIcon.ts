import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Resolves an AI-generated icon for a pantry item via an edge function.
// Cached in localStorage with a 30-day TTL and deduped in-flight.

const PREFIX = "pantryItemIcon:v3:";
const mem = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

const readCache = (key: string): string | null | undefined => {
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const p = JSON.parse(raw) as { url: string | null; t: number };
    if (Date.now() - p.t > 30 * 24 * 60 * 60 * 1000) return undefined;
    mem.set(key, p.url);
    return p.url;
  } catch { return undefined; }
};

const writeCache = (key: string, url: string | null) => {
  mem.set(key, url);
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ url, t: Date.now() })); } catch { /* ignore */ }
};

const lookup = async (item: string, category?: string | null): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke("pantry-item-icon", {
      body: { item, category },
    });
    if (error) return null;
    return (data?.url as string) ?? null;
  } catch {
    return null;
  }
};

export const usePantryItemIcon = (item: string | undefined, category?: string | null) => {
  const key = item ? `${item.toLowerCase().trim()}::${(category ?? "").toLowerCase()}` : "";
  const cached = key ? readCache(key) : undefined;
  const [src, setSrc] = useState<string | null | undefined>(cached);

  useEffect(() => {
    if (!item || !key) return;
    if (cached !== undefined) { setSrc(cached); return; }
    let cancelled = false;
    let p = inflight.get(key);
    if (!p) {
      p = lookup(item, category).then((url) => {
        writeCache(key, url);
        inflight.delete(key);
        return url;
      });
      inflight.set(key, p);
    }
    p.then((url) => { if (!cancelled) setSrc(url); });
    return () => { cancelled = true; };
  }, [item, category, key, cached]);

  return src; // undefined = loading, string = url, null = not found
};
