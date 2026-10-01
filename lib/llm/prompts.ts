// Prompts, one function per purpose. Keep them short: the free tier is small
// and every token here is sent on every call. No personal details beyond food.

export const EXTRACTION_SYSTEM = `You turn short household notes about food into structured updates for a meal-planning app.
The household is two adults ("me" is the person writing, "partner" is the other). They eat vegetarian food plus eggs.
Notes may be in English, Hindi, Marathi or a mix. Write every item name in simple English, singular, without quantities.
Only record what the note actually says. Never invent fridge items or preferences.
Fridge: "bought", "got", "have" -> add. "finished", "used up", "no more" -> used_up. "ran out", "out of" -> out.
Preferences: "want", "craving" -> craving. "don't want X today/tomorrow" -> avoid with that expiry. Lasting likes and dislikes -> permanent.
Strength: 1 mild, 2 normal, 3 strong ("hate", "never", "really want").`;

export function extractionPrompt(opts: {
  today: string;
  names: { me: string; partner: string };
  knownItems: string[];
  text?: string;
}): string {
  const lines = [
    `Today is ${opts.today}. "me" is ${opts.names.me}; "partner" is ${opts.names.partner}.`,
    opts.knownItems.length
      ? `Items the app already knows (reuse these names when they match): ${opts.knownItems.join(", ")}.`
      : "",
    opts.text ? `Note:\n"""${opts.text}"""` : "The note is the attached audio. Transcribe it, then extract.",
  ];
  return lines.filter(Boolean).join("\n\n");
}

// Planning ---------------------------------------------------------------------

export const LANGUAGE_NAME: Record<string, string> = { "hi-IN": "Hindi", "mr-IN": "Marathi" };

export const MENU_SYSTEM = `You plan one visit of a home cook in an Indian household.
Hard rules:
- Vegetarian food plus eggs only. Never meat, fish or seafood.
- Every dish lists the meals it is served at. A dish may be served at two meals (cooked once).
- Dish limit for the whole visit: count every distinct dish, including roti, rice and salad.
- Never use anything on the avoid list or the strong-dislike list.
- Do not repeat a dish from the recent menus (roti, rice, salad and curd are fine).
Good plans:
- Hit the protein target per person per meal using paneer, dals, chana, rajma, soya, tofu, eggs, curd, besan and sprouts. Vary the source day to day.
- Use what is in the fridge first. Pantry staples are always there. Keep items that must be bought to one or two.
- Fit the cook's time. Dinner is cooked at the same midday visit, so dinner dishes must reheat well.
- Simple = boiling, a simple tadka, a quick stir-fry, roti, rice, salad. Complex = multi-step gravies, stuffing, deep frying, special doughs.
- Use the likes and cravings when they fit. Home-style, not restaurant food.
- Quantities are for the stated number of adults, in g, ml or pieces wherever possible.`;

export function menuPrompt(ctx: {
  date: string;
  mealsLabel: string;
  servings: number;
  visitTime: string;
  visitMinutes: number;
  maxSimple: number;
  maxComplex: number;
  mealProteinMin: number;
  mealProteinMax: number;
  fridge: string[];
  staples: string[];
  likes: string[];
  avoid: string[];
  rules: { rule: string; kind: string }[];
  knownDishes: string[];
  recent: { date: string; dishes: string[] }[];
  feedback: string[];
  note: string;
  retryProblems?: string[];
}): string {
  const list = (items: string[]) => (items.length ? items.join(", ") : "none");
  const lines = [
    `Visit: ${ctx.date}, ${ctx.visitTime}, ${ctx.visitMinutes} minutes. Cook for: ${ctx.mealsLabel}.`,
    `Adults: ${ctx.servings}. Protein target: ${ctx.mealProteinMin}-${ctx.mealProteinMax} g per person per meal.`,
    `Dish limit: at most ${ctx.maxComplex} dishes if any dish is complex, otherwise at most ${ctx.maxSimple}.`,
    `In the fridge: ${list(ctx.fridge)}.`,
    `Pantry staples: ${list(ctx.staples)}.`,
    `Likes and cravings: ${list(ctx.likes)}.`,
    `Avoid (never use): ${list(ctx.avoid)}.`,
    ctx.rules.length
      ? `Cook rules:\n${ctx.rules.map((r) => `- (${r.kind === "hard" ? "must" : "prefer"}) ${r.rule}`).join("\n")}`
      : "",
    `Dishes the cook already knows: ${list(ctx.knownDishes)}.`,
    ctx.recent.length
      ? `Recent menus:\n${ctx.recent.map((r) => `- ${r.date}: ${r.dishes.join(", ")}`).join("\n")}`
      : "Recent menus: none.",
    ctx.feedback.length ? `Recent feedback:\n${ctx.feedback.map((f) => `- ${f}`).join("\n")}` : "",
    ctx.note ? `Note for this visit: ${ctx.note}` : "",
    ctx.retryProblems?.length
      ? `Your previous menu broke these rules. Fix all of them:\n${ctx.retryProblems.map((p) => `- ${p}`).join("\n")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n\n");
}

export function recipeStepsSystem(language: string): string {
  const name = LANGUAGE_NAME[language] ?? "Hindi";
  return `You write cooking steps for a home cook who will hear them as a voice note in ${name}.
Use simple spoken ${name}, short sentences, one action per step, at most 8 steps per dish.
Use household measures (कटोरी, चम्मच, मुट्ठी, चुटकी) instead of grams, and say when something is done ("जब तक प्याज़ सुनहरा न हो जाए").
Do not explain basics like washing vegetables. No English unless the ingredient has no common ${name} name.`;
}

export function recipeStepsPrompt(
  servings: number,
  dishes: { name: string; ingredients: { item: string; quantity: number; unit: string }[] }[],
): string {
  return [
    `Servings: ${servings} adults. Write steps for each dish below. Use exactly the dish names given.`,
    ...dishes.map(
      (d) => `${d.name}: ${d.ingredients.map((i) => `${i.item} ${i.quantity} ${i.unit}`).join(", ")}`,
    ),
  ].join("\n");
}
