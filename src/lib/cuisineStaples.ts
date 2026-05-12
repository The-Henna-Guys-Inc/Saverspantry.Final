// Top 5 most-used household staples per cuisine tag.
// Keys MUST match CuisineTag values from src/lib/cuisineHints.ts.
// Used to seed a user's watchlist so they're alerted on 15%+ deals.
export const CUISINE_STAPLES: Record<string, string[]> = {
  south_asian: ["basmati rice", "lentils", "onions", "yogurt", "ginger"],
  southeast_asian: ["jasmine rice", "soy sauce", "coconut milk", "shallots", "fish sauce"],
  korean: ["short-grain rice", "soy sauce", "gochujang", "garlic", "sesame oil"],
  japanese: ["short-grain rice", "soy sauce", "miso", "nori", "tofu"],
  chinese: ["jasmine rice", "soy sauce", "ginger", "garlic", "scallions"],
  middle_eastern: ["olive oil", "chickpeas", "tahini", "lemons", "yogurt"],
  mediterranean: ["olive oil", "tomatoes", "feta", "lemons", "garlic"],
  mexican: ["tortillas", "black beans", "rice", "chicken thighs", "limes"],
  latin_american: ["rice", "black beans", "onions", "limes", "cilantro"],
  african: ["rice", "tomatoes", "onions", "chicken", "peanuts"],
};

export const DEFAULT_WATCH_MIN_PCT = 15;
