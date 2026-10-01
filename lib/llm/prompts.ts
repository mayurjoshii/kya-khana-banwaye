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
