import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createGame, type Game } from "@/domain/game/game";
import { createGameRepository } from "@/server/games/repository";
import { ApiError } from "@/server/security/api-error";
import { fakeSupabase } from "../helpers/fake-supabase";
import { buildFixtureTheme } from "../fixtures/theme";

const theme = buildFixtureTheme();
const GAME_ID = "3f2f9d1e-7b4a-4a7e-9c3d-2a1b0c9d8e7f";

function fixtureGame(): Game {
  const draws = [0, 5];
  return createGame({ id: GAME_ID, theme, answerMode: "ai_referee", firstTurn: "A" }, () => draws.shift() ?? 0);
}

function validRow(game: Game) {
  return {
    id: game.id,
    mode: "solo",
    theme_id: game.themeId,
    answer_mode: game.answerMode,
    difficulty: "hard",
    state: JSON.parse(JSON.stringify(game)) as unknown,
    version: game.version,
    status: "playing",
    expires_at: "2026-11-11T00:00:00.000Z",
  };
}

let consoleSpy: MockInstance;
beforeEach(() => {
  consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleSpy.mockRestore();
});

describe("loadGame", () => {
  it("retourne l'état validé et les métadonnées", async () => {
    const game = fixtureGame();
    const { client } = fakeSupabase([{ data: validRow(game) }]);
    const record = await createGameRepository(client).loadGame(GAME_ID);
    expect(record).not.toBeNull();
    expect(record?.game).toEqual(game);
    expect(record?.mode).toBe("solo");
    expect(record?.difficulty).toBe("hard");
    expect(record?.status).toBe("playing");
  });

  it("retourne null si la partie n'existe pas", async () => {
    const { client } = fakeSupabase([{ data: null }]);
    expect(await createGameRepository(client).loadGame(GAME_ID)).toBeNull();
  });

  it("rejette un state corrompu (500 interne, jamais propagé tel quel)", async () => {
    const game = fixtureGame();
    const row = validRow(game);
    row.state = { ...(row.state as object), players: "corrompu" };
    const { client } = fakeSupabase([{ data: row }]);
    await expect(createGameRepository(client).loadGame(GAME_ID)).rejects.toMatchObject({
      code: "INTERNAL",
      status: 500,
    });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("rejette une incohérence entre la ligne et le state (version différente)", async () => {
    const game = fixtureGame();
    const row = { ...validRow(game), version: 7 };
    const { client } = fakeSupabase([{ data: row }]);
    await expect(createGameRepository(client).loadGame(GAME_ID)).rejects.toMatchObject({ code: "INTERNAL" });
  });
});

describe("saveGame", () => {
  it("écrit state + version + statut avec le verrou optimiste", async () => {
    const game = fixtureGame();
    const { client, calls } = fakeSupabase([{ data: [{ id: game.id }] }]);
    await createGameRepository(client).saveGame(game, 0);

    const update = calls.find((c) => c.method === "update");
    expect(update?.args[0]).toMatchObject({ version: game.version, status: "playing" });
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["id", game.id]);
    expect(eqCalls).toContainEqual(["version", 0]);
  });

  it("statut 'finished' quand la partie est terminée", async () => {
    const game: Game = { ...fixtureGame(), status: "FINISHED", result: { winner: "A", reason: "forfeit" } };
    const { client, calls } = fakeSupabase([{ data: [{ id: game.id }] }]);
    await createGameRepository(client).saveGame(game, 0);
    expect(calls.find((c) => c.method === "update")?.args[0]).toMatchObject({ status: "finished" });
  });

  it("aucune ligne modifiée → VERSION_CONFLICT 409", async () => {
    const game = fixtureGame();
    const { client } = fakeSupabase([{ data: [] }]);
    await expect(createGameRepository(client).saveGame(game, 0)).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
      status: 409,
    });
  });
});

describe("getPlayerSlot", () => {
  it("retourne le siège du joueur, ou null s'il ne participe pas", async () => {
    const { client } = fakeSupabase([{ data: { slot: "B" } }, { data: null }]);
    const repository = createGameRepository(client);
    expect(await repository.getPlayerSlot(GAME_ID, "user-1")).toBe("B");
    expect(await repository.getPlayerSlot(GAME_ID, "user-2")).toBeNull();
  });
});

describe("createGame", () => {
  it("insère la partie puis les joueurs", async () => {
    const game = fixtureGame();
    const { client, calls } = fakeSupabase([{ data: null }, { data: null }]);
    await createGameRepository(client).createGame({
      game,
      mode: "solo",
      difficulty: "hard",
      status: "playing",
      players: [
        { slot: "A", userId: "user-1", displayName: "Joueur" },
        { slot: "B", userId: null, displayName: "IA" },
      ],
      expiresAt: new Date("2026-11-11T00:00:00Z"),
    });
    expect(calls.filter((c) => c.method === "insert").map((c) => c.table)).toEqual(["games", "game_players"]);
    expect(calls[0]?.args[0]).toMatchObject({ id: game.id, mode: "solo", version: 0 });
  });

  it("compense en supprimant la partie si l'insertion des joueurs échoue", async () => {
    const game = fixtureGame();
    const { client, calls } = fakeSupabase([
      { data: null },
      { error: { message: "duplicate key" } },
      { data: null },
    ]);
    await expect(
      createGameRepository(client).createGame({
        game,
        mode: "pvp",
        difficulty: null,
        status: "waiting",
        players: [{ slot: "A", userId: "user-1", displayName: "Hôte" }],
        expiresAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    expect(calls.some((c) => c.table === "games" && c.method === "delete")).toBe(true);
  });
});
