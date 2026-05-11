// Maps grocery item keywords -> cuisine tags that match specialty_stores.cuisine_specialties
// Keep keywords lowercase. Match is substring on the item name.

export type CuisineTag =
  | "korean" | "japanese" | "chinese" | "south_asian" | "southeast_asian"
  | "middle_eastern" | "mexican" | "latin_american" | "african" | "mediterranean";

// Maps free-form / legacy cuisine names users may have saved into our CuisineTag taxonomy.
export const LEGACY_CUISINE_MAP: Record<string, CuisineTag[]> = {
  pakistani: ["south_asian"],
  indian: ["south_asian"],
  bangladeshi: ["south_asian"],
  "sri lankan": ["south_asian"],
  nepali: ["south_asian"],
  afghani: ["south_asian", "middle_eastern"],
  persian: ["middle_eastern"],
  iranian: ["middle_eastern"],
  lebanese: ["middle_eastern", "mediterranean"],
  turkish: ["middle_eastern", "mediterranean"],
  "middle-eastern": ["middle_eastern"],
  "middle eastern": ["middle_eastern"],
  arab: ["middle_eastern"],
  moroccan: ["middle_eastern", "african"],
  ethiopian: ["african"],
  nigerian: ["african"],
  italian: ["mediterranean"],
  greek: ["mediterranean"],
  spanish: ["mediterranean"],
  portuguese: ["mediterranean"],
  french: ["mediterranean"],
  mediterranean: ["mediterranean"],
  polish: [],
  serbian: ["mediterranean"],
  thai: ["southeast_asian"],
  vietnamese: ["southeast_asian"],
  filipino: ["southeast_asian"],
  indonesian: ["southeast_asian"],
  malaysian: ["southeast_asian"],
  korean: ["korean"],
  japanese: ["japanese"],
  chinese: ["chinese"],
  taiwanese: ["chinese"],
  mexican: ["mexican"],
  "tex-mex": ["mexican"],
  cuban: ["latin_american"],
  peruvian: ["latin_american"],
  brazilian: ["latin_american"],
  caribbean: ["latin_american", "african"],
  american: [],
};

export function mapLegacyCuisines(names: string[] | undefined | null): CuisineTag[] {
  if (!Array.isArray(names)) return [];
  const out = new Set<CuisineTag>();
  for (const raw of names) {
    const key = String(raw ?? "").trim().toLowerCase();
    const tags = LEGACY_CUISINE_MAP[key];
    if (tags) tags.forEach((t) => out.add(t));
  }
  return [...out];
}

// Maps a user-prefs CuisineTag to candidate display names found in widget option lists
// (e.g. RecipeGenerator/EquivalencyEngine use ["American","Pakistani","Indian","Italian",
// "Mexican","Chinese","Mediterranean","Thai"]). Order = priority.
export const TAG_TO_DISPLAY_OPTIONS: Record<CuisineTag, string[]> = {
  korean: ["Korean", "Chinese"],
  japanese: ["Japanese", "Chinese"],
  chinese: ["Chinese"],
  south_asian: ["Indian", "Pakistani"],
  southeast_asian: ["Thai"],
  middle_eastern: ["Mediterranean"],
  mexican: ["Mexican"],
  latin_american: ["Mexican"],
  african: ["Mediterranean"],
  mediterranean: ["Mediterranean", "Italian"],
};

const normalizeCuisineName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

export function formatCuisineOptionLabel(value: string): string {
  const normalized = normalizeCuisineName(value);
  if (!normalized) return "";

  return normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildCuisineOptions(baseOptions: string[], rawNames?: string[] | null): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const raw of rawNames ?? []) {
    const label = formatCuisineOptionLabel(String(raw ?? ""));
    const key = normalizeCuisineName(label);
    if (!label || seen.has(key)) continue;
    seen.add(key);
    merged.push(label);
  }

  for (const option of baseOptions) {
    const key = normalizeCuisineName(option);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(option);
  }

  return merged;
}

/**
 * Given user cuisine prefs and a list of available widget options, return the first
 * option that matches a pref. Returns null if no match (caller should fall back to "Any").
 */
export function pickDefaultCuisineOption(
  prefs: CuisineTag[] | undefined | null,
  options: string[],
  rawNames?: string[] | null,
): string | null {
  const optLower = options.map((o) => normalizeCuisineName(o));
  // 1. Direct match against raw favorite names (e.g. "Italian" -> "Italian")
  if (Array.isArray(rawNames)) {
    for (const raw of rawNames) {
      const key = normalizeCuisineName(String(raw ?? ""));
      const idx = optLower.indexOf(key);
      if (idx >= 0) return options[idx];
    }
  }
  if (!prefs || prefs.length === 0) return null;
  const optSet = new Set(optLower);
  for (const tag of prefs) {
    const candidates = TAG_TO_DISPLAY_OPTIONS[tag] ?? [];
    for (const c of candidates) {
      if (optSet.has(c.toLowerCase())) {
        return options.find((o) => o.toLowerCase() === c.toLowerCase()) ?? null;
      }
    }
  }
  return null;
}

export const CUISINE_LABEL: Record<CuisineTag, string> = {
  korean: "Korean",
  japanese: "Japanese",
  chinese: "Chinese",
  south_asian: "South Asian",
  southeast_asian: "Southeast Asian",
  middle_eastern: "Middle Eastern",
  mexican: "Mexican",
  latin_american: "Latin American",
  african: "African",
  mediterranean: "Mediterranean",
};

const RULES: Array<{ kw: string; cuisines: CuisineTag[] }> = [
  // Korean
  { kw: "gochujang", cuisines: ["korean"] },
  { kw: "gochugaru", cuisines: ["korean"] },
  { kw: "kimchi", cuisines: ["korean"] },
  { kw: "doenjang", cuisines: ["korean"] },
  // Japanese
  { kw: "miso", cuisines: ["japanese"] },
  { kw: "mirin", cuisines: ["japanese"] },
  { kw: "dashi", cuisines: ["japanese"] },
  { kw: "nori", cuisines: ["japanese"] },
  { kw: "panko", cuisines: ["japanese"] },
  { kw: "sake", cuisines: ["japanese"] },
  // Chinese
  { kw: "soy sauce", cuisines: ["chinese", "japanese", "korean"] },
  { kw: "hoisin", cuisines: ["chinese"] },
  { kw: "oyster sauce", cuisines: ["chinese"] },
  { kw: "shaoxing", cuisines: ["chinese"] },
  { kw: "sichuan", cuisines: ["chinese"] },
  { kw: "bok choy", cuisines: ["chinese"] },
  { kw: "rice noodle", cuisines: ["chinese", "southeast_asian"] },
  // South Asian
  { kw: "paneer", cuisines: ["south_asian"] },
  { kw: "ghee", cuisines: ["south_asian"] },
  { kw: "garam masala", cuisines: ["south_asian"] },
  { kw: "turmeric", cuisines: ["south_asian"] },
  { kw: "cumin seed", cuisines: ["south_asian", "middle_eastern"] },
  { kw: "basmati", cuisines: ["south_asian"] },
  { kw: "lentil", cuisines: ["south_asian"] },
  { kw: "dal", cuisines: ["south_asian"] },
  { kw: "naan", cuisines: ["south_asian"] },
  { kw: "curry leaf", cuisines: ["south_asian"] },
  // Southeast Asian
  { kw: "fish sauce", cuisines: ["southeast_asian"] },
  { kw: "lemongrass", cuisines: ["southeast_asian"] },
  { kw: "coconut milk", cuisines: ["southeast_asian", "south_asian"] },
  { kw: "thai basil", cuisines: ["southeast_asian"] },
  { kw: "rice paper", cuisines: ["southeast_asian"] },
  { kw: "sriracha", cuisines: ["southeast_asian"] },
  // Middle Eastern
  { kw: "tahini", cuisines: ["middle_eastern", "mediterranean"] },
  { kw: "sumac", cuisines: ["middle_eastern"] },
  { kw: "za'atar", cuisines: ["middle_eastern"] },
  { kw: "zaatar", cuisines: ["middle_eastern"] },
  { kw: "harissa", cuisines: ["middle_eastern", "african"] },
  { kw: "pita", cuisines: ["middle_eastern", "mediterranean"] },
  { kw: "labneh", cuisines: ["middle_eastern"] },
  { kw: "pomegranate molasses", cuisines: ["middle_eastern"] },
  // Mexican / Latin
  { kw: "masa", cuisines: ["mexican"] },
  { kw: "tortilla", cuisines: ["mexican"] },
  { kw: "chipotle", cuisines: ["mexican"] },
  { kw: "tomatillo", cuisines: ["mexican"] },
  { kw: "queso fresco", cuisines: ["mexican"] },
  { kw: "cotija", cuisines: ["mexican"] },
  { kw: "poblano", cuisines: ["mexican"] },
  { kw: "ancho", cuisines: ["mexican"] },
  { kw: "plantain", cuisines: ["latin_american", "african"] },
  { kw: "yuca", cuisines: ["latin_american"] },
  // Mediterranean
  { kw: "feta", cuisines: ["mediterranean"] },
  { kw: "kalamata", cuisines: ["mediterranean"] },
  { kw: "halloumi", cuisines: ["mediterranean", "middle_eastern"] },
  // African
  { kw: "berbere", cuisines: ["african"] },
  { kw: "injera", cuisines: ["african"] },
];

export type ItemHint = { item: string; cuisines: CuisineTag[] };

export function detectItemCuisines(itemName: string): CuisineTag[] {
  const n = itemName.toLowerCase();
  const tags = new Set<CuisineTag>();
  for (const r of RULES) {
    if (n.includes(r.kw)) r.cuisines.forEach((c) => tags.add(c));
  }
  return [...tags];
}

export function summarizeCuisines(items: { item: string }[]): {
  hints: ItemHint[];
  cuisineCounts: Record<string, number>;
  topCuisines: CuisineTag[];
} {
  const hints: ItemHint[] = [];
  const counts: Record<string, number> = {};
  for (const it of items) {
    const cs = detectItemCuisines(it.item);
    if (cs.length) {
      hints.push({ item: it.item, cuisines: cs });
      cs.forEach((c) => (counts[c] = (counts[c] || 0) + 1));
    }
  }
  const topCuisines = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c as CuisineTag);
  return { hints, cuisineCounts: counts, topCuisines };
}
