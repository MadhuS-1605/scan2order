// Supported menu languages. Pure module (client + server safe).

export const LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "mr", label: "Marathi", native: "मराठी" },
];

export const LANG_LABEL: Record<string, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l.native]),
);

export function parseLanguages(csv: string | null | undefined): string[] {
  const set = new Set(["en"]);
  (csv ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => LANGUAGES.some((l) => l.code === c))
    .forEach((c) => set.add(c));
  return [...set];
}

export type Translations = Record<
  string,
  { name?: string; description?: string }
> | null;

// Pick the translated name/description for a language, falling back to base.
export function localize(
  base: { name: string; description: string | null },
  translations: unknown,
  lang: string,
): { name: string; description: string | null } {
  if (lang === "en" || !translations || typeof translations !== "object") {
    return base;
  }
  const t = (translations as Record<string, { name?: string; description?: string }>)[
    lang
  ];
  if (!t) return base;
  return {
    name: t.name?.trim() || base.name,
    description: t.description?.trim() || base.description,
  };
}
