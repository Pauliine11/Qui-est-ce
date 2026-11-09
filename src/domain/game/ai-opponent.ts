import { BOOLEAN_TRUE, type Analysis, type PredicateAnalysis } from "../analysis";
import { evaluate, type Answer } from "../engine";
import type { AnyCharacter, AnyTheme, AttributeDef } from "../theme.types";

/**
 * Adversaire IA du mode solo. 100 % algorithmique : il pose ses questions
 * directement sous forme structurée, donc AUCUN appel LLM (coût nul).
 * Ses questions sont répondues par le moteur sur le secret du joueur.
 */

export type Difficulty = "easy" | "hard";

export interface AskedQuestion {
  readonly analysis: Analysis;
  readonly answer: Answer;
}

export type AiMove =
  | { readonly type: "ask"; readonly analysis: PredicateAnalysis; readonly text: string }
  | { readonly type: "guess"; readonly characterId: string };

/** Personnages encore compatibles avec toutes les réponses reçues. */
export function remainingCandidates(
  theme: AnyTheme,
  history: readonly AskedQuestion[],
  wrongGuesses: readonly string[],
): AnyCharacter[] {
  return theme.characters.filter(
    (c) => !wrongGuesses.includes(c.id) && history.every((q) => evaluate(q.analysis, c, theme) === q.answer),
  );
}

function allPredicates(theme: AnyTheme): PredicateAnalysis[] {
  return Object.entries(theme.attributes).flatMap(([attribute, def]) =>
    (def.kind === "boolean" ? [BOOLEAN_TRUE] : def.values).map((value) => ({
      type: "predicate" as const,
      attribute,
      value,
      negated: false,
    })),
  );
}

export function questionText(def: AttributeDef, value: string): string {
  if (def.askTemplate) return def.askTemplate.replace("{value}", value);
  return def.kind === "boolean" ? `${def.label} ?` : `${def.label} : ${value} ?`;
}

/** Taille du plus gros groupe de réponses : plus c'est petit, plus la question est informative. */
function worstCase(predicate: PredicateAnalysis, candidates: readonly AnyCharacter[], theme: AnyTheme): number {
  const buckets = new Map<Answer, number>();
  for (const c of candidates) {
    const answer = evaluate(predicate, c, theme);
    buckets.set(answer, (buckets.get(answer) ?? 0) + 1);
  }
  return Math.max(...buckets.values());
}

export function chooseMove(params: {
  theme: AnyTheme;
  history: readonly AskedQuestion[];
  wrongGuesses: readonly string[];
  difficulty: Difficulty;
  canAsk: boolean;
  /** En production : `() => crypto.randomInt(2**32) / 2**32`. */
  random: () => number;
}): AiMove {
  const { theme, difficulty, random } = params;
  const candidates = remainingCandidates(theme, params.history, params.wrongGuesses);
  const pick = <T>(items: readonly T[]): T => {
    const item = items[Math.floor(random() * items.length)];
    if (item === undefined) throw new Error("Aucun choix possible");
    return item;
  };

  // Garde-fou : historique incohérent (ne devrait pas arriver) → on tente au hasard.
  if (candidates.length === 0) {
    const untried = theme.characters.filter((c) => !params.wrongGuesses.includes(c.id));
    return { type: "guess", characterId: pick(untried).id };
  }

  // Avec 2 candidats, deviner tout de suite est en moyenne plus rapide que demander.
  const guessThreshold = difficulty === "hard" ? 2 : 1;
  if (!params.canAsk || candidates.length <= guessThreshold) {
    return { type: "guess", characterId: pick(candidates).id };
  }

  const informative = allPredicates(theme)
    .map((predicate) => ({ predicate, worst: worstCase(predicate, candidates, theme) }))
    .filter(({ worst }) => worst < candidates.length);

  if (informative.length === 0) return { type: "guess", characterId: pick(candidates).id };

  const chosen =
    difficulty === "hard"
      ? informative.reduce((best, cur) => (cur.worst < best.worst ? cur : best)).predicate
      : pick(informative).predicate;

  const def = theme.attributes[chosen.attribute];
  if (!def) throw new Error(`Attribut inconnu : ${chosen.attribute}`);
  return { type: "ask", analysis: chosen, text: questionText(def, chosen.value) };
}
