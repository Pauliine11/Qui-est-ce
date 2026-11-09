import { describe, expect, it } from "vitest";
import type { Analysis } from "../src/domain/analysis";
import {
  applyAction,
  createGame,
  MAX_QUESTIONS_PER_PLAYER,
  toPlayerView,
  type AnswerMode,
  type ApplyResult,
  type Game,
  type GameAction,
} from "../src/domain/game/game";
import { buildFixtureTheme } from "./fixtures/theme";

const theme = buildFixtureTheme();

/** Secret de A = perso-1 (index 0), secret de B = perso-6 (index 5). */
function newGame(answerMode: AnswerMode = "ai_referee"): Game {
  const draws = [0, 5];
  return createGame({ id: "g1", theme, answerMode, firstTurn: "A" }, () => draws.shift() ?? 0);
}

function play(game: Game, action: GameAction): ApplyResult {
  return applyAction(game, theme, action, game.version);
}

function expectOk(result: ApplyResult) {
  if (!result.ok) throw new Error(`Action refusée : ${result.error}`);
  return result;
}

const askGlasses = (by: "A" | "B", id: string, analysis: Analysis | null = {
  type: "predicate",
  attribute: "hasGlasses",
  value: "true",
  negated: false,
}): GameAction => ({ type: "ask", by, questionId: id, text: "Il a des lunettes ?", analysis });

describe("création", () => {
  it("tire un secret par joueur", () => {
    const game = newGame();
    expect(game.players.A.secretId).toBe("perso-1");
    expect(game.players.B.secretId).toBe("perso-6");
    expect(game.status).toBe("PLAYING");
  });
});

describe("mode Arbitre IA", () => {
  it("répond automatiquement à partir du secret ADVERSE et passe le tour", () => {
    const { game, events } = expectOk(play(newGame(), askGlasses("A", "q1")));
    // Secret de B (perso-6) n'a pas de lunettes
    expect(game.log[0]?.answer).toBe("NON");
    expect(game.turn).toBe("B");
    expect(game.version).toBe(1);
    expect(events.map((e) => e.type)).toEqual(["question_asked", "question_answered", "turn_changed"]);
  });

  it("refuse de jouer hors de son tour", () => {
    expect(play(newGame(), askGlasses("B", "q1"))).toEqual({ ok: false, error: "NOT_YOUR_TURN" });
  });

  it("refuse une version périmée (double clic, deux onglets)", () => {
    const game = newGame();
    const first = expectOk(applyAction(game, theme, askGlasses("A", "q1"), 0));
    expect(applyAction(first.game, theme, askGlasses("B", "q2"), 0)).toEqual({ ok: false, error: "VERSION_CONFLICT" });
  });

  it("exige une analyse", () => {
    expect(play(newGame(), askGlasses("A", "q1", null))).toEqual({ ok: false, error: "ANALYSIS_REQUIRED" });
  });

  it("une question d'identité est traitée comme une tentative", () => {
    const { game, events } = expectOk(play(newGame(), askGlasses("A", "q1", { type: "identity", characterId: "perso-6" })));
    expect(game.status).toBe("FINISHED");
    expect(game.result).toEqual({ winner: "A", reason: "correct_guess" });
    expect(events.at(-1)).toMatchObject({ type: "game_finished", reveal: { A: "perso-1", B: "perso-6" } });
  });

  it("plafonne le nombre de questions mais laisse deviner", () => {
    let game = newGame();
    game = { ...game, players: { ...game.players, A: { ...game.players.A, questionsAsked: MAX_QUESTIONS_PER_PLAYER } } };
    expect(play(game, askGlasses("A", "q1"))).toEqual({ ok: false, error: "QUESTION_LIMIT_REACHED" });
    expect(play(game, { type: "guess", by: "A", characterId: "perso-6" }).ok).toBe(true);
  });
});

describe("tentatives (règle : erreur = perte du tour)", () => {
  it("mauvaise tentative : le tour passe, la partie continue", () => {
    const { game, events } = expectOk(play(newGame(), { type: "guess", by: "A", characterId: "perso-2" }));
    expect(game.status).toBe("PLAYING");
    expect(game.turn).toBe("B");
    expect(game.players.A.wrongGuesses).toEqual(["perso-2"]);
    expect(events[0]).toEqual({ type: "guess_made", by: "A", characterId: "perso-2", correct: false });
  });

  it("interdit de retenter le même personnage", () => {
    let game = expectOk(play(newGame(), { type: "guess", by: "A", characterId: "perso-2" })).game;
    game = expectOk(play(game, askGlasses("B", "q1"))).game;
    expect(play(game, { type: "guess", by: "A", characterId: "perso-2" })).toEqual({ ok: false, error: "ALREADY_GUESSED" });
  });

  it("refuse un personnage inexistant", () => {
    expect(play(newGame(), { type: "guess", by: "A", characterId: "intrus" })).toEqual({ ok: false, error: "UNKNOWN_CHARACTER" });
  });

  it("bonne tentative : victoire et révélation", () => {
    const { game } = expectOk(play(newGame(), { type: "guess", by: "A", characterId: "perso-6" }));
    expect(game.result).toEqual({ winner: "A", reason: "correct_guess" });
    expect(play(game, askGlasses("B", "q1"))).toEqual({ ok: false, error: "GAME_FINISHED" });
  });
});

describe("mode classique", () => {
  it("met la question en attente, seul l'adversaire peut répondre", () => {
    let game = expectOk(play(newGame("classic"), askGlasses("A", "q1", null))).game;
    expect(game.pendingQuestionId).toBe("q1");
    expect(game.turn).toBe("A");

    expect(play(game, { type: "answer", by: "A", questionId: "q1", answer: "OUI" })).toEqual({ ok: false, error: "NOT_YOUR_TURN" });
    expect(play(game, { type: "guess", by: "A", characterId: "perso-6" })).toEqual({ ok: false, error: "AWAITING_ANSWER" });

    game = expectOk(play(game, { type: "answer", by: "B", questionId: "q1", answer: "NON" })).game;
    expect(game.log[0]?.answer).toBe("NON");
    expect(game.pendingQuestionId).toBeNull();
    expect(game.turn).toBe("B");
  });

  it("refuse une réponse à une question inexistante", () => {
    const game = expectOk(play(newGame("classic"), askGlasses("A", "q1", null))).game;
    expect(play(game, { type: "answer", by: "B", questionId: "q9", answer: "OUI" })).toEqual({ ok: false, error: "NO_PENDING_QUESTION" });
  });

  it("timeout : c'est le répondant en retard qui perd", () => {
    const game = expectOk(play(newGame("classic"), askGlasses("A", "q1", null))).game;
    expect(play(game, { type: "timeout", by: "A" })).toEqual({ ok: false, error: "INVALID_ACTION" });
    expect(expectOk(play(game, { type: "timeout", by: "B" })).game.result).toEqual({ winner: "A", reason: "timeout" });
  });
});

describe("abandon", () => {
  it("l'adversaire gagne", () => {
    expect(expectOk(play(newGame(), { type: "forfeit", by: "B" })).game.result).toEqual({ winner: "A", reason: "forfeit" });
  });
});

describe("confidentialité", () => {
  it("la vue joueur ne contient jamais le secret adverse avant la fin", () => {
    let game = newGame();
    game = expectOk(play(game, askGlasses("A", "q1"))).game;
    const viewA = toPlayerView(game, "A");
    expect(viewA.yourSecretId).toBe("perso-1");
    expect(JSON.stringify(viewA)).not.toContain("perso-6");
    expect(JSON.stringify(viewA)).not.toContain("analysis");
    expect(viewA.reveal).toBeUndefined();
  });

  it("aucun événement ne contient le secret de l'adversaire avant la fin", () => {
    let game = newGame();
    const events = [];
    for (const action of [
      askGlasses("A", "q1"),
      askGlasses("B", "q2"),
      { type: "guess", by: "A", characterId: "perso-2" } as const,
    ]) {
      const result = expectOk(play(game, action));
      game = result.game;
      events.push(...result.events);
    }
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("perso-6"); // secret de B
    expect(serialized).not.toContain("perso-1"); // secret de A
  });

  it("la révélation n'apparaît qu'en fin de partie", () => {
    const { game } = expectOk(play(newGame(), { type: "forfeit", by: "A" }));
    expect(toPlayerView(game, "A").reveal).toEqual({ A: "perso-1", B: "perso-6" });
  });
});
