import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Difficulty } from "@/domain/game/ai-opponent";
import type { Game, PlayerSlot } from "@/domain/game/game";
import { ApiError } from "@/server/security/api-error";
import { getAdminClient } from "@/server/supabase/admin";
import { gameStateSchema } from "./state-schema";

export type GameMode = "solo" | "pvp";
export type DbGameStatus = "waiting" | "playing" | "finished";

/** Ligne `games` telle qu'attendue : validée à la lecture, jamais crue sur parole. */
const gameRowSchema = z.object({
  id: z.uuid(),
  mode: z.enum(["solo", "pvp"]),
  theme_id: z.string().min(1),
  answer_mode: z.enum(["ai_referee", "classic"]),
  difficulty: z.enum(["easy", "hard"]).nullable(),
  state: z.unknown(),
  version: z.number().int().min(0),
  status: z.enum(["waiting", "playing", "finished"]),
  expires_at: z.string(),
});

const GAME_COLUMNS = "id, mode, theme_id, answer_mode, difficulty, state, version, status, expires_at";

export interface GameRecord {
  readonly game: Game;
  readonly mode: GameMode;
  readonly difficulty: Difficulty | null;
  readonly status: DbGameStatus;
  readonly expiresAt: string;
}

export interface NewGamePlayer {
  readonly slot: PlayerSlot;
  /** `null` pour l'IA du mode solo. */
  readonly userId: string | null;
  readonly displayName: string;
}

export interface CreateGameParams {
  readonly game: Game;
  readonly mode: GameMode;
  readonly difficulty: Difficulty | null;
  readonly status: DbGameStatus;
  readonly players: readonly NewGamePlayer[];
  readonly expiresAt: Date;
}

function internalError(context: string, detail: string): ApiError {
  // Journal serveur uniquement : le client ne reçoit que le message générique.
  console.error(`[repository] ${context} → ${detail}`);
  return new ApiError("INTERNAL", 500);
}

export function createGameRepository(client: SupabaseClient = getAdminClient()) {
  async function createGame(params: CreateGameParams): Promise<void> {
    const { game } = params;
    const { error } = await client.from("games").insert({
      id: game.id,
      mode: params.mode,
      theme_id: game.themeId,
      answer_mode: game.answerMode,
      difficulty: params.difficulty,
      state: game,
      version: game.version,
      status: params.status,
      expires_at: params.expiresAt.toISOString(),
    });
    if (error) throw internalError("createGame(games)", error.message);

    const { error: playersError } = await client.from("game_players").insert(
      params.players.map((p) => ({
        game_id: game.id,
        slot: p.slot,
        user_id: p.userId,
        display_name: p.displayName,
      })),
    );
    if (playersError) {
      // Compensation : pas de transaction multi-tables via PostgREST.
      await client.from("games").delete().eq("id", game.id);
      throw internalError("createGame(game_players)", playersError.message);
    }
  }

  async function loadGame(id: string): Promise<GameRecord | null> {
    const { data, error } = await client.from("games").select(GAME_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw internalError("loadGame", error.message);
    if (!data) return null;

    const row = gameRowSchema.safeParse(data);
    if (!row.success) throw internalError("loadGame", `ligne games invalide pour ${id}`);

    const state = gameStateSchema.safeParse(row.data.state);
    if (!state.success) throw internalError("loadGame", `state corrompu pour ${id}`);

    const game = state.data;
    if (game.id !== row.data.id || game.version !== row.data.version || game.themeId !== row.data.theme_id) {
      throw internalError("loadGame", `state incohérent avec la ligne pour ${id}`);
    }

    return {
      game,
      mode: row.data.mode,
      difficulty: row.data.difficulty,
      status: row.data.status,
      expiresAt: row.data.expires_at,
    };
  }

  /**
   * Verrou optimiste (invariant n°6) : `UPDATE … WHERE id = $1 AND version = $2`.
   * Aucune ligne modifiée → VERSION_CONFLICT (409).
   */
  async function saveGame(
    game: Game,
    expectedVersion: number,
    statusOverride?: DbGameStatus,
  ): Promise<void> {
    const status: DbGameStatus = statusOverride ?? (game.status === "FINISHED" ? "finished" : "playing");
    const { data, error } = await client
      .from("games")
      .update({ state: game, version: game.version, status })
      .eq("id", game.id)
      .eq("version", expectedVersion)
      .select("id");
    if (error) throw internalError("saveGame", error.message);
    if (!data || data.length === 0) throw new ApiError("VERSION_CONFLICT", 409);
  }

  async function getPlayerSlot(gameId: string, userId: string): Promise<PlayerSlot | null> {
    const { data, error } = await client
      .from("game_players")
      .select("slot")
      .eq("game_id", gameId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw internalError("getPlayerSlot", error.message);
    if (!data) return null;

    const slot = z.enum(["A", "B"]).safeParse(data.slot);
    if (!slot.success) throw internalError("getPlayerSlot", `slot invalide pour ${gameId}`);
    return slot.data;
  }

  return { createGame, loadGame, saveGame, getPlayerSlot };
}

export type GameRepository = ReturnType<typeof createGameRepository>;
