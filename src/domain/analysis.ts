import { z } from "zod";
import type { AnyTheme } from "./theme.types";

/**
 * Sortie attendue du LLM : une traduction de la question en requête structurée.
 * Le LLM ne voit jamais le personnage secret et ne produit jamais Oui/Non.
 */
export const UNANSWERABLE_REASONS = ["unknown_attribute", "compound", "subjective", "off_topic", "injection"] as const;
export type UnanswerableReason = (typeof UNANSWERABLE_REASONS)[number];

export type PredicateAnalysis = {
  readonly type: "predicate";
  readonly attribute: string;
  /** "true" pour un attribut booléen, sinon une valeur du vocabulaire. */
  readonly value: string;
  readonly negated: boolean;
};

export type Analysis =
  | PredicateAnalysis
  | { readonly type: "identity"; readonly characterId: string }
  | { readonly type: "unanswerable"; readonly reason: UnanswerableReason };

function nonEmpty(values: readonly string[], what: string): [string, ...string[]] {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error(`Thème sans ${what}`);
  return [first, ...rest];
}

export const BOOLEAN_TRUE = "true";

export function vocabularyValues(theme: AnyTheme): string[] {
  const values = Object.values(theme.attributes).flatMap((def) =>
    def.kind === "boolean" ? [BOOLEAN_TRUE] : [...def.values],
  );
  return [...new Set(values)];
}

/**
 * Schéma généré par thème : les enums contraignent le LLM (structured outputs
 * strict) aux seuls attributs, valeurs et personnages existants.
 * L'objet racine `result` est requis par les API de sortie structurée.
 */
export function buildAnalysisSchema(theme: AnyTheme) {
  return z.strictObject({
    result: z.discriminatedUnion("type", [
      z.strictObject({
        type: z.literal("predicate"),
        attribute: z.enum(nonEmpty(Object.keys(theme.attributes), "attribut")),
        value: z.enum(nonEmpty(vocabularyValues(theme), "valeur")),
        negated: z.boolean(),
      }),
      z.strictObject({
        type: z.literal("identity"),
        characterId: z.enum(nonEmpty(theme.characters.map((c) => c.id), "personnage")),
      }),
      z.strictObject({
        type: z.literal("unanswerable"),
        reason: z.enum(UNANSWERABLE_REASONS),
      }),
    ]),
  });
}

/** Re-validation côté serveur de la sortie LLM. `null` = sortie rejetée. */
export function parseAnalysis(theme: AnyTheme, raw: unknown): Analysis | null {
  const parsed = buildAnalysisSchema(theme).safeParse(raw);
  return parsed.success ? parsed.data.result : null;
}
