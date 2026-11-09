import { BOOLEAN_TRUE, type Analysis } from "./analysis";
import type { AnyCharacter, AnyTheme } from "./theme.types";

export const ANSWERS = ["OUI", "NON", "JE_NE_SAIS_PAS"] as const;
export type Answer = (typeof ANSWERS)[number];

/**
 * Moteur déterministe : la SEULE source de vérité pour les réponses.
 * Toute incohérence (attribut inconnu, valeur hors vocabulaire, donnée null)
 * donne « Je ne sais pas » plutôt qu'une réponse inventée.
 */
export function evaluate(analysis: Analysis, secret: AnyCharacter, theme: AnyTheme): Answer {
  switch (analysis.type) {
    case "unanswerable":
      return "JE_NE_SAIS_PAS";

    case "identity":
      return secret.id === analysis.characterId ? "OUI" : "NON";

    case "predicate": {
      const def = theme.attributes[analysis.attribute];
      const actual = secret.attributes[analysis.attribute];
      if (!def || actual === null || actual === undefined) return "JE_NE_SAIS_PAS";

      let matches: boolean;
      switch (def.kind) {
        case "boolean":
          if (analysis.value !== BOOLEAN_TRUE || typeof actual !== "boolean") return "JE_NE_SAIS_PAS";
          matches = actual;
          break;
        case "enum":
          if (!def.values.includes(analysis.value) || typeof actual !== "string") return "JE_NE_SAIS_PAS";
          matches = actual === analysis.value;
          break;
        case "tags":
          if (!def.values.includes(analysis.value) || !Array.isArray(actual)) return "JE_NE_SAIS_PAS";
          matches = actual.includes(analysis.value);
          break;
      }
      return matches !== analysis.negated ? "OUI" : "NON";
    }
  }
}

export function findCharacter(theme: AnyTheme, id: string): AnyCharacter {
  const character = theme.characters.find((c) => c.id === id);
  if (!character) throw new Error(`Personnage "${id}" introuvable dans le thème "${theme.id}"`);
  return character;
}
