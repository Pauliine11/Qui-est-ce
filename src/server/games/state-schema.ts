import "server-only";
import { z } from "zod";
import { UNANSWERABLE_REASONS } from "@/domain/analysis";
import { ANSWERS } from "@/domain/engine";
import type { Game } from "@/domain/game/game";

/**
 * Validation du JSON `games.state` à la lecture : on ne fait jamais confiance
 * aveuglément au contenu de la base (ni à une éventuelle migration ratée).
 * Schéma strict : tout champ supplémentaire est rejeté.
 */

const playerSlot = z.enum(["A", "B"]);

const analysisSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("predicate"),
    attribute: z.string().min(1),
    value: z.string().min(1),
    negated: z.boolean(),
  }),
  z.strictObject({ type: z.literal("identity"), characterId: z.string().min(1) }),
  z.strictObject({ type: z.literal("unanswerable"), reason: z.enum(UNANSWERABLE_REASONS) }),
]);

const questionEntry = z.strictObject({
  id: z.string().min(1),
  by: playerSlot,
  text: z.string().min(1),
  analysis: analysisSchema.nullable(),
  answer: z.enum(ANSWERS).nullable(),
  auto: z.boolean(),
});

const playerState = z.strictObject({
  secretId: z.string().min(1),
  questionsAsked: z.number().int().min(0),
  wrongGuesses: z.array(z.string().min(1)),
});

export const gameStateSchema = z.strictObject({
  id: z.string().min(1),
  themeId: z.string().min(1),
  answerMode: z.enum(["ai_referee", "classic"]),
  version: z.number().int().min(0),
  status: z.enum(["PLAYING", "FINISHED"]),
  turn: playerSlot,
  pendingQuestionId: z.string().min(1).nullable(),
  players: z.strictObject({ A: playerState, B: playerState }),
  log: z.array(questionEntry),
  result: z
    .strictObject({ winner: playerSlot, reason: z.enum(["correct_guess", "forfeit", "timeout"]) })
    .nullable(),
}) satisfies z.ZodType<Game>;
