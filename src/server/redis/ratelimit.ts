import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import { ApiError } from "@/server/security/api-error";
import { getRedis } from "./client";

/**
 * Rate limiting en fenêtre glissante (invariant n°7 : vérifié AVANT tout
 * appel LLM). Identifiants : empreinte d'IP salée, jamais l'IP en clair.
 */

export type RateLimitKind =
  | "questionsPerPlayer" // identifiant : `${gameId}:${slot}`
  | "questionsPerIp"
  | "soloGamesPerIp"
  | "roomsCreatedPerIp"
  | "roomJoinPerIp"
  | "actionsPerIp";

type Window = Parameters<typeof Ratelimit.slidingWindow>[1];

const CONFIG: Record<RateLimitKind, { readonly limit: number; readonly window: Window }> = {
  questionsPerPlayer: { limit: 10, window: "1 m" },
  questionsPerIp: { limit: 60, window: "1 h" },
  soloGamesPerIp: { limit: 20, window: "1 d" },
  roomsCreatedPerIp: { limit: 10, window: "1 d" },
  roomJoinPerIp: { limit: 10, window: "1 h" },
  actionsPerIp: { limit: 120, window: "1 m" },
};

export function createRateLimit(redis: Redis = getRedis()) {
  const limiters = new Map<RateLimitKind, Ratelimit>();

  function limiter(kind: RateLimitKind): Ratelimit {
    const existing = limiters.get(kind);
    if (existing) return existing;
    const { limit, window } = CONFIG[kind];
    const created = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `rl:${kind}`,
    });
    limiters.set(kind, created);
    return created;
  }

  /** Consomme `cost` unités ; au-delà de la limite → 429 RATE_LIMITED. */
  async function assertRateLimit(kind: RateLimitKind, identifier: string, cost = 1): Promise<void> {
    const { success } = await limiter(kind).limit(identifier, { rate: cost });
    if (!success) throw new ApiError("RATE_LIMITED", 429);
  }

  /**
   * Pénalité a posteriori (ex. question classée `injection` : coût triple,
   * donc +2 après la question déjà comptée). N'échoue jamais la requête
   * en cours : le surcoût s'appliquera aux suivantes.
   */
  async function penalizeRateLimit(kind: RateLimitKind, identifier: string, extraCost: number): Promise<void> {
    await limiter(kind).limit(identifier, { rate: extraCost });
  }

  return { assertRateLimit, penalizeRateLimit };
}

export type RateLimiters = ReturnType<typeof createRateLimit>;

let defaultRateLimit: RateLimiters | null = null;

export function getRateLimit(): RateLimiters {
  defaultRateLimit ??= createRateLimit();
  return defaultRateLimit;
}
