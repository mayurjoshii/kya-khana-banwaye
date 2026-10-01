// Name keys for dishes and ingredients, so "Paneer 200g", "paneer" and "Paneer"
// match the same fridge item, recipe or skill.

const SYNONYMS: Record<string, string> = {
  dahi: "curd",
  yogurt: "curd",
  yoghurt: "curd",
  "shimla mirch": "capsicum",
  "bell pepper": "capsicum",
  aloo: "potato",
  pyaz: "onion",
  pyaaz: "onion",
  kanda: "onion",
  tamatar: "tomato",
  adrak: "ginger",
  lehsun: "garlic",
  lasun: "garlic",
  "hari mirch": "green chilli",
  "green chili": "green chilli",
  "green chillies": "green chilli",
  "green chilies": "green chilli",
  palak: "spinach",
  methi: "fenugreek leaves",
  bhindi: "okra",
  "lady finger": "okra",
  gobi: "cauliflower",
  "phool gobi": "cauliflower",
  "patta gobi": "cabbage",
  matar: "peas",
  "green peas": "peas",
  baingan: "brinjal",
  eggplant: "brinjal",
  anda: "egg",
  eggs: "egg",
  chapati: "roti",
  chapatti: "roti",
  phulka: "roti",
  poli: "roti",
  chawal: "rice",
  "plain rice": "rice",
  "steamed rice": "rice",
  jeera: "cumin",
  haldi: "turmeric",
  dhania: "coriander leaves",
  kothimbir: "coriander leaves",
  coriander: "coriander leaves",
  "cottage cheese": "paneer",
  "soya chunks": "soya chunks",
  "soy chunks": "soya chunks",
  chickpeas: "chana",
  chole: "chana",
  "kabuli chana": "chana",
  "kidney beans": "rajma",
  tofu: "tofu",
};

const UNIT_WORDS =
  /\b\d+(\.\d+)?\s*(g|gm|gms|grams?|kg|kgs|ml|l|ltr|litres?|liters?|pcs?|pieces?|nos?|cups?|tbsp|tsp|bowls?|katori|packets?|pkts?)\b/g;

/** Lowercase, drop quantities and punctuation, collapse spaces, map synonyms. */
export function normalizeName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(UNIT_WORDS, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-zऀ-ॿ\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (SYNONYMS[base]) return SYNONYMS[base];
  // Synonyms map whole names only; dish names like "aloo gobi" stay as written.
  if (base.endsWith("es") && SYNONYMS[base.slice(0, -2)]) return SYNONYMS[base.slice(0, -2)];
  if (base.endsWith("s") && SYNONYMS[base.slice(0, -1)]) return SYNONYMS[base.slice(0, -1)];
  return base;
}

/** True when `needle` appears in `haystack` as whole words. */
export function containsWords(haystack: string, needle: string): boolean {
  if (!needle) return false;
  if (haystack === needle) return true;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(s|es)?($|\\s)`).test(haystack);
}

/**
 * True when two ingredient keys name the same thing: equal, or one is the other
 * plus qualifiers ("paneer" vs "malai paneer").
 */
export function sameIngredient(a: string, b: string): boolean {
  return a === b || containsWords(a, b) || containsWords(b, a);
}
