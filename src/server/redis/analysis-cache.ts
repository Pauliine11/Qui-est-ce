import "server-only";
import { createHash } from "node:crypto";
import type { Redis } from "@upstash/redis";
import { parseAnalysis, type Analysis } from "@/domain/analysis";
import { canonicalQuestion } from "@/domain/sanitize";
import type { AnyTheme } from "@/domain/theme.types";
import { getRedis } from "./client";

/**
 * Cache des analyses LLM. L'analyse ne dépend pas du secret : elle est
 * partageable entre parties d'un même thème. `schemaVersion` invalide le
 * cache quand le vocabulaire change.
 */

export const ANALYSIS_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 jours

export function analysisCacheKey(theme: AnyTheme, sanitizedQuestion: string): string {
  const digest = createHash("sha256").update(canonicalQuestion(sanitizedQuestion)).digest("hex");
  return `analysis:v1:${theme.id}:${theme.schemaVersion}:${digest}`;
}

/** Relit le cache en re-validant contre le vocabulaire : jamais de confiance aveugle. */
export async function getCachedAnalysis(
  theme: AnyTheme,
  sanitizedQuestion: string,
  redis: Redis = getRedis(),
): Promise<Analysis | null> {
  const raw = await redis.get(analysisCacheKey(theme, sanitizedQuestion));
  if (raw === null || raw === undefined) return null;
  return parseAnalysis(theme, { result: raw });
}

/** Ne met en cache que les analyses valides, jamais les `injection`. */
export async function cacheAnalysis(
  theme: AnyTheme,
  sanitizedQuestion: string,
  analysis: Analysis,
  redis: Redis = getRedis(),
): Promise<void> {
  if (analysis.type === "unanswerable" && analysis.reason === "injection") return;
  if (parseAnalysis(theme, { result: analysis }) === null) return;
  await redis.set(analysisCacheKey(theme, sanitizedQuestion), analysis, {
    ex: ANALYSIS_CACHE_TTL_SECONDS,
  });
}
