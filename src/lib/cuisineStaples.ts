// Top 5 most-used household staples per cuisine.
// Used to seed a user's watchlist so they're alerted on 15%+ deals.
export const CUISINE_STAPLES: Record<string, string[]> = {
  italian: ["pasta", "olive oil", "canned tomatoes", "parmesan", "garlic"],
  american: ["chicken breast", "ground beef", "eggs", "milk", "bread"],
  indian: ["basmati rice", "lentils", "onions", "ginger", "yogurt"],
  mexican: ["tortillas", "black beans", "rice", "chicken thighs", "limes"],
  chinese: ["jasmine rice", "soy sauce", "ginger", "garlic", "scallions"],
  greek: ["olive oil", "feta", "lemons", "yogurt", "olives"],
  portuguese: ["bacalhau", "olive oil", "potatoes", "onions", "rice"],
  spanish: ["olive oil", "chorizo", "rice", "paprika", "tomatoes"],
  japanese: ["short-grain rice", "soy sauce", "miso", "nori", "tofu"],
  turkish: ["bulgur", "yogurt", "lentils", "olive oil", "tomatoes"],
  french: ["butter", "eggs", "flour", "shallots", "dijon mustard"],
  polish: ["potatoes", "cabbage", "kielbasa", "sour cream", "onions"],
  pakistani: ["basmati rice", "chicken", "lentils", "onions", "yogurt"],
  serbian: ["ground beef", "paprika", "onions", "potatoes", "cabbage"],
  indonesian: ["jasmine rice", "soy sauce", "shallots", "chilies", "coconut milk"],
};

export const DEFAULT_WATCH_MIN_PCT = 15;
