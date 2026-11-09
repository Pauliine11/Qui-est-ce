import { describe, expect, it } from "vitest";
import { chooseMove, remainingCandidates, type AskedQuestion, type Difficulty } from "../src/domain/game/ai-opponent";
import { evaluate } from "../src/domain/engine";
import { buildFixtureTheme } from "./fixtures/theme";

const theme = buildFixtureTheme();

/** Générateur pseudo-aléatoire déterministe (mulberry32) pour des tests reproductibles. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simule l'IA contre un secret donné, retourne le nombre de tours pour trouver. */
function simulate(secretId: string, difficulty: Difficulty, seed = 1): number {
  const secret = theme.characters.find((c) => c.id === secretId)!;
  const history: AskedQuestion[] = [];
  const wrongGuesses: string[] = [];
  const random = seeded(seed);
  for (let turn = 1; turn <= 40; turn++) {
    const move = chooseMove({ theme, history, wrongGuesses, difficulty, canAsk: true, random });
    if (move.type === "ask") {
      history.push({ analysis: move.analysis, answer: evaluate(move.analysis, secret, theme) });
    } else if (move.characterId === secretId) {
      return turn;
    } else {
      wrongGuesses.push(move.characterId);
    }
  }
  throw new Error(`Secret ${secretId} non trouvé`);
}

describe("adversaire IA", () => {
  it("filtre les candidats selon les réponses reçues", () => {
    const history: AskedQuestion[] = [
      { analysis: { type: "predicate", attribute: "hairColor", value: "noir", negated: false }, answer: "OUI" },
    ];
    expect(remainingCandidates(theme, history, []).map((c) => c.id)).toEqual(["perso-1", "perso-9", "perso-17"]);
    expect(remainingCandidates(theme, history, ["perso-9"]).map((c) => c.id)).toEqual(["perso-1", "perso-17"]);
  });

  it("devine quand il ne reste qu'un candidat ou qu'il ne peut plus poser de question", () => {
    const random = seeded(1);
    expect(chooseMove({ theme, history: [], wrongGuesses: [], difficulty: "hard", canAsk: false, random }).type).toBe("guess");
  });

  it("utilise le gabarit de question du thème", () => {
    const history: AskedQuestion[] = [
      { analysis: { type: "predicate", attribute: "gender", value: "homme", negated: false }, answer: "OUI" },
    ];
    const move = chooseMove({ theme, history, wrongGuesses: [], difficulty: "hard", canAsk: true, random: seeded(1) });
    expect(move.type).toBe("ask");
  });

  it("niveau difficile : trouve chacun des 24 secrets en 7 tours max", () => {
    const turns = theme.characters.map((c) => simulate(c.id, "hard"));
    expect(Math.max(...turns)).toBeLessThanOrEqual(7);
  });

  it("niveau facile : trouve toujours, mais plus lentement en moyenne", () => {
    const hard = theme.characters.map((c) => simulate(c.id, "hard"));
    const easy = theme.characters.flatMap((c) => [1, 2, 3].map((seed) => simulate(c.id, "easy", seed)));
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(avg(easy)).toBeGreaterThan(avg(hard));
  });
});
