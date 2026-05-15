// Regional grocery-cost multipliers for high-cost-of-living US states.
// Applied to estimated_cost_usd shown to users so prices reflect what they
// actually pay locally. Savings_percent is preserved (we scale original AND
// swaps by the same factor). Default = 1.0 for everywhere not listed.
//
// Multipliers based on USDA ERS regional food cost variation, BLS CPI for
// food at home, and Council for Community & Economic Research COLI food
// indices (2024–2025). Conservative — meant to be directionally right, not
// precise to the cent.

export type StateMultiplier = { state: string; label: string; multiplier: number };

export const STATE_MULTIPLIERS: Record<string, StateMultiplier> = {
  HI: { state: "HI", label: "Hawaii", multiplier: 1.30 },
  AK: { state: "AK", label: "Alaska", multiplier: 1.27 },
  CA: { state: "CA", label: "California", multiplier: 1.13 },
  NY: { state: "NY", label: "New York", multiplier: 1.13 },
  MA: { state: "MA", label: "Massachusetts", multiplier: 1.10 },
  DC: { state: "DC", label: "Washington, DC", multiplier: 1.10 },
  WA: { state: "WA", label: "Washington", multiplier: 1.08 },
  NJ: { state: "NJ", label: "New Jersey", multiplier: 1.08 },
  CT: { state: "CT", label: "Connecticut", multiplier: 1.08 },
  OR: { state: "OR", label: "Oregon", multiplier: 1.06 },
  VT: { state: "VT", label: "Vermont", multiplier: 1.05 },
  MD: { state: "MD", label: "Maryland", multiplier: 1.05 },
  RI: { state: "RI", label: "Rhode Island", multiplier: 1.05 },
  NH: { state: "NH", label: "New Hampshire", multiplier: 1.04 },
  CO: { state: "CO", label: "Colorado", multiplier: 1.04 },
};

export function multiplierForState(state?: string | null): StateMultiplier | null {
  if (!state) return null;
  const code = state.toUpperCase().trim();
  return STATE_MULTIPLIERS[code] ?? null;
}

// 3-digit ZIP prefix → state, restricted to states we adjust pricing for.
// Anything not in this map returns null and we apply 1.0×.
const HIGH_COST_ZIP3: Record<string, string> = {};
const ranges: [number, number, string][] = [
  [10, 27, "MA"],   // 010–027 (some 026/027 are RI but mostly MA; close enough)
  [28, 29, "RI"],
  [30, 38, "NH"],
  [39, 49, "ME"],   // not adjusted
  [50, 59, "VT"],
  [60, 69, "CT"],
  [70, 89, "NJ"],
  [100, 149, "NY"],
  [200, 205, "DC"],
  [206, 219, "MD"],
  [800, 816, "CO"],
  [900, 961, "CA"],
  [967, 968, "HI"],
  [970, 979, "OR"],
  [980, 994, "WA"],
  [995, 999, "AK"],
];
for (const [lo, hi, st] of ranges) {
  for (let i = lo; i <= hi; i++) HIGH_COST_ZIP3[String(i).padStart(3, "0")] = st;
}

export function stateFromZip(zip?: string | null): string | null {
  if (!zip) return null;
  const z = String(zip).trim();
  if (!/^\d{5}/.test(z)) return null;
  return HIGH_COST_ZIP3[z.slice(0, 3)] ?? null;
}

export function multiplierFromZip(zip?: string | null): StateMultiplier | null {
  return multiplierForState(stateFromZip(zip));
}
