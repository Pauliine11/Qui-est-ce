import { describe, expect, it } from "vitest";
import { applyAction, createGame, type Game } from "@/domain/game/game";
import { gameStateSchema } from "@/server/games/state-schema";
import { buildFixtureTheme } from "../fixtures/theme";

const theme = buildFixtureTheme();

function playedGame(): Game {
  const draws = [0, 5];
  let game = createGame({ id: "g1", theme, answerMode: "ai_referee", firstTurn: "A" }, () => draws.shift() ?? 0);
  const result = applyAction(
    game,
    theme,
    {
      type: "ask",
      by: "A",
      questionId: "q1",
      text: "Il a des lunettes ?",
      analysis: { type: "predicate", attribute: "hasGlasses", value: "true", negated: false },
    },
    0,
  );
  if (!result.ok) throw new Error(result.error);
  game = result.game;
  return game;
}

describe("gameStateSchema", () => {
  it("accepte un état produit par le domaine, à l'identique", () => {
    const game = playedGame();
    const parsed = gameStateSchema.parse(JSON.parse(JSON.stringify(game)));
    expect(parsed).toEqual(game);
  });

  it("rejette un champ supplémentaire (objet strict)", () => {
    const game = { ...playedGame(), injected: "payload" };
    expect(gameStateSchema.safeParse(game).success).toBe(false);
  });

  it("rejette une réponse hors vocabulaire", () => {
    const game = playedGame();
    const log = game.log.map((q) => ({ ...q, answer: "PEUT_ETRE" }));
    expect(gameStateSchema.safeParse({ ...game, log }).success).toBe(false);
  });

  it("rejette un joueur manquant ou un statut inconnu", () => {
    const game = playedGame();
    expect(gameStateSchema.safeParse({ ...game, players: { A: game.players.A } }).success).toBe(false);
    expect(gameStateSchema.safeParse({ ...game, status: "PAUSED" }).success).toBe(false);
  });

  it("rejette une analyse mal formée dans le log", () => {
    const game = playedGame();
    const log = game.log.map((q) => ({ ...q, analysis: { type: "unanswerable", reason: "invented" } }));
    expect(gameStateSchema.safeParse({ ...game, log }).success).toBe(false);
  });
});
