// Maps grocery item keywords -> cuisine tags that match specialty_stores.cuisine_specialties
// Keep keywords lowercase. Match is substring on the item name.

export type CuisineTag =
  | "korean" | "japanese" | "chinese" | "south_asian" | "southeast_asian"
  | "middle_eastern" | "mexican" | "latin_american" | "african" | "mediterranean";

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
