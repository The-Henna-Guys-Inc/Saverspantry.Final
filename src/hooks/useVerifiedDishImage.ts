import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Resolves an image for an AI-generated dish title via an edge function that
// asks Gemini for the canonical Wikipedia page, then fetches the lead image.
// Cached in localStorage with a 30-day TTL.

const PREFIX = "verifiedDishImg:v1:";
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

const lookup = async (dish: string, cuisine?: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke("dish-image-lookup", {
      body: { dish, cuisine },
    });
    if (error) return null;
    return (data?.url as string) ?? null;
  } catch {
    return null;
  }
};

export const useVerifiedDishImage = (dish: string | undefined, cuisine?: string) => {
  const key = dish ? `${dish}::${cuisine ?? ""}` : "";
  const cached = key ? readCache(key) : undefined;
  const [src, setSrc] = useState<string | null | undefined>(cached);

  useEffect(() => {
    if (!dish || !key) return;
    if (cached !== undefined) { setSrc(cached); return; }
    let cancelled = false;
    let p = inflight.get(key);
    if (!p) {
      p = lookup(dish, cuisine).then((url) => {
        writeCache(key, url);
        inflight.delete(key);
        return url;
      });
      inflight.set(key, p);
    }
    p.then((url) => { if (!cancelled) setSrc(url); });
    return () => { cancelled = true; };
  }, [dish, cuisine, key, cached]);

  return src; // undefined = loading, string = url, null = not found
};
