import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import {
  applyAction,
  createGame,
  type Game,
  type GameAction,
  type PublicEvent,
} from "@/domain/game/game";
import { broadcast, gameTopic } from "@/server/games/broadcast";
import { buildFixtureTheme } from "../fixtures/theme";

const theme = buildFixtureTheme();

let consoleSpy: MockInstance;
beforeEach(() => {
  consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleSpy.mockRestore();
});

describe("broadcast", () => {
  const events: PublicEvent[] = [
    { type: "question_asked", by: "A", questionId: "q1", text: "Il a des lunettes ?" },
    { type: "turn_changed", turn: "B" },
  ];

  it("envoie un POST privé par événement, dans l'ordre", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    await broadcast("g1", events, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls[0]).toContain(`/realtime/v1/api/broadcast/${encodeURIComponent(gameTopic("g1"))}/events/question_asked`);
    expect(urls[1]).toContain("/events/turn_changed");
    for (const url of urls) expect(url).toContain("private=true");

    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(firstInit.body))).toEqual(events[0]);
    expect((firstInit.headers as Record<string, string>).apikey).toBeDefined();
  });

  it("ne lance jamais d'erreur : HTTP non-2xx et panne réseau sont journalisés", async () => {
    const failing = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockRejectedValueOnce(new Error("réseau coupé"));
    await expect(broadcast("g1", events, failing as unknown as typeof fetch)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });

  it("n'envoie rien pour une liste vide", async () => {
    const fetchMock = vi.fn();
    await broadcast("g1", [], fetchMock as unknown as typeof fetch);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("garde : aucun id de secret hors game_finished", () => {
  /** Secrets : A = perso-1, B = perso-6. */
  function newGame(): Game {
    const draws = [0, 5];
    return createGame({ id: "g1", theme, answerMode: "ai_referee", firstTurn: "A" }, () => draws.shift() ?? 0);
  }

  const ask = (by: "A" | "B", id: string): GameAction => ({
    type: "ask",
    by,
    questionId: id,
    text: "Il a des lunettes ?",
    analysis: { type: "predicate", attribute: "hasGlasses", value: "true", negated: false },
  });

  /** Déroule des scénarios complets et vérifie chaque lot d'événements. */
  const scenarios: GameAction[][] = [
    // Questions, mauvaise tentative, puis victoire.
    [ask("A", "q1"), ask("B", "q2"), { type: "guess", by: "A", characterId: "perso-3" }, ask("B", "q3"), { type: "guess", by: "A", characterId: "perso-6" }],
    // Abandon.
    [ask("A", "q1"), { type: "forfeit", by: "B" }],
    // Timeout.
    [{ type: "timeout", by: "A" }],
  ];

  it.each(scenarios.map((actions, i) => [i, actions] as const))("scénario %i", (_i, actions) => {
    let game = newGame();
    const secrets = [game.players.A.secretId, game.players.B.secretId];
    for (const action of actions) {
      const result = applyAction(game, theme, action, game.version);
      if (!result.ok) throw new Error(result.error);
      game = result.game;
      const finished = result.events.some((e) => e.type === "game_finished");
      for (const event of result.events) {
        if (event.type === "game_finished") continue;
        const serialized = JSON.stringify(event);
        for (const secret of secrets) {
          // Avant la fin de partie, aucun événement ne doit citer un secret.
          if (!finished) expect(serialized).not.toContain(secret);
        }
      }
    }
    expect(game.status).toBe("FINISHED");
  });
});
