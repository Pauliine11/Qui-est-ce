import "server-only";
import type { Redis } from "@upstash/redis";
import { env } from "@/server/env";
import { ApiError } from "@/server/security/api-error";
import { getRedis } from "./client";

/**
 * Coupe-circuit global : compteur atomique d'appels LLM par jour UTC.
 * Vérifié AVANT l'appel LLM (invariant n°7).
 */

export function budgetKey(now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `llm:budget:${day}`;
}

export function secondsUntilUtcMidnight(now: Date = new Date()): number {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
}

/** Consomme une unité ; au-delà de LLM_DAILY_BUDGET → 503 SERVICE_BUSY. */
export async function consumeLlmBudget(redis: Redis = getRedis(), now: Date = new Date()): Promise<void> {
  const key = budgetKey(now);
  const count = await redis.incr(key);
  if (count === 1) {
    // La clé est datée (une par jour UTC) : même si cet expire échouait,
    // elle ne serait plus jamais incrémentée le lendemain.
    await redis.expire(key, secondsUntilUtcMidnight(now));
  }
  if (count > env.LLM_DAILY_BUDGET) throw new ApiError("SERVICE_BUSY", 503);
}
