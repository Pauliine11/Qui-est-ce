export const QUESTION_MIN_LENGTH = 3;
export const QUESTION_MAX_LENGTH = 200;

export type SanitizeError = "invalid_type" | "too_short" | "too_long" | "forbidden_chars";
export type SanitizeResult = { ok: true; value: string } | { ok: false; error: SanitizeError };

/** Caractères de contrôle (sauts de ligne, tabulations…) → espace. */
const CONTROL_CHARS = /\p{Cc}/gu;
/** Caractères de format invisibles (zero-width, contrôles bidi, BOM…) → supprimés. */
const FORMAT_CHARS = /\p{Cf}/gu;
/** Caractères inutiles pour une question et utilisés pour casser les délimiteurs du prompt. */
const FORBIDDEN = /[<>{}[\]`\\|]/;

/**
 * Nettoie la question d'un joueur avant tout traitement.
 * Ne remplace PAS les autres défenses (secret hors du prompt, sortie structurée,
 * re-validation) : c'est une couche parmi d'autres.
 */
export function sanitizeQuestion(raw: unknown): SanitizeResult {
  if (typeof raw !== "string") return { ok: false, error: "invalid_type" };
  // Coupe-circuit avant normalisation pour éviter de traiter des entrées énormes.
  if (raw.length > QUESTION_MAX_LENGTH * 4) return { ok: false, error: "too_long" };

  const value = raw
    .normalize("NFKC")
    .replace(FORMAT_CHARS, "")
    .replace(CONTROL_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (FORBIDDEN.test(value)) return { ok: false, error: "forbidden_chars" };
  if (value.length < QUESTION_MIN_LENGTH) return { ok: false, error: "too_short" };
  if (value.length > QUESTION_MAX_LENGTH) return { ok: false, error: "too_long" };
  return { ok: true, value };
}

/**
 * Forme canonique pour la clé de cache des analyses LLM
 * (l'analyse ne dépend pas du secret, elle est donc partageable entre parties).
 */
export function canonicalQuestion(sanitized: string): string {
  return sanitized
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}' ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
