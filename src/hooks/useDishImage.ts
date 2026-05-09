import { useEffect, useState } from "react";

// Manual overrides where a dish name doesn't map cleanly to a Wikipedia page,
// or where the default page lacks a good lead image. Values are Wikipedia
// page titles (use spaces — they get URL-encoded).
const TITLE_OVERRIDES: Record<string, string> = {
  // Pakistani
  "Chicken Karahi": "Karahi",
  "Beef Nihari": "Nihari",
  "Chicken Biryani": "Biryani",
  "Aloo Keema": "Keema",
  "Daal Chawal": "Dal",
  "Chicken Pulao": "Pilaf",
  "Paya": "Paya (dish)",
  // Indian
  "Dal Tadka": "Dal",
  // American
  "BBQ Ribs": "Pork ribs",
  "Pulled Pork Sandwich": "Pulled pork",
  "Buffalo Wings": "Buffalo wing",
  // Italian
  "Risotto Milanese": "Risotto alla milanese",
  "Penne Arrabbiata": "Arrabbiata sauce",
  "Minestrone Soup": "Minestrone",
  // Mexican
  "Tacos al Pastor": "Al pastor",
  "Mole Poblano": "Mole sauce",
  // Chinese
  "Beef and Broccoli": "Beef and broccoli",
  "Sweet and Sour Pork": "Sweet and sour",
  "Char Siu": "Char siu",
  // Mediterranean
  "Stuffed Grape Leaves": "Dolma",
  "Grilled Branzino": "European bass",
  // Thai
  "Pad Krapow": "Phat kaphrao",
  "Tom Kha Gai": "Tom kha kai",
  "Khao Pad": "Khao phat",
  "Som Tum": "Som tam",
  "Satay": "Satay",
};

const memCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

const STORAGE_PREFIX = "dishImg:v2:";

const readCache = (key: string): string | null | undefined => {
  if (memCache.has(key)) return memCache.get(key);
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return undefined;
    const parsed = JSON.parse(raw) as { url: string | null; t: number };
    // 30-day TTL
    if (Date.now() - parsed.t > 30 * 24 * 60 * 60 * 1000) return undefined;
    memCache.set(key, parsed.url);
    return parsed.url;
  } catch {
    return undefined;
  }
};

const writeCache = (key: string, url: string | null) => {
  memCache.set(key, url);
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ url, t: Date.now() }));
  } catch {
    // localStorage full / disabled — ignore
  }
};

const fetchSummaryThumb = async (title: string): Promise<string | null> => {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.originalimage?.source as string) || (json?.thumbnail?.source as string) || null;
  } catch {
    return null;
  }
};

const fetchSearchThumb = async (query: string): Promise<string | null> => {
  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(query + " food dish")}` +
      `&prop=pageimages&piprop=thumbnail&pithumbsize=600`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const pages = json?.query?.pages;
    if (!pages) return null;
    const first: any = Object.values(pages)[0];
    return (first?.thumbnail?.source as string) || null;
  } catch {
    return null;
  }
};

const lookup = async (name: string): Promise<string | null> => {
  const title = TITLE_OVERRIDES[name] ?? name;
  let url = await fetchSummaryThumb(title);
  if (!url && title !== name) url = await fetchSummaryThumb(name);
  if (!url) url = await fetchSearchThumb(name);
  return url;
};

export const useDishImage = (name: string) => {
  const cached = readCache(name);
  const [src, setSrc] = useState<string | null | undefined>(cached);

  useEffect(() => {
    if (cached !== undefined) return;
    let cancelled = false;
    let p = inflight.get(name);
    if (!p) {
      p = lookup(name).then((url) => {
        writeCache(name, url);
        inflight.delete(name);
        return url;
      });
      inflight.set(name, p);
    }
    p.then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [name, cached]);

  return src; // undefined = loading, string = url, null = not found
};
