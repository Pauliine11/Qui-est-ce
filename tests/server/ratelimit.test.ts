import type { Redis } from "@upstash/redis";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimit, type RateLimitKind } from "@/server/redis/ratelimit";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  slidingWindow: vi.fn((limit: number, window: string) => ({ limit, window })),
  configs: [] as { prefix?: string }[],
}));

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = mocks.slidingWindow;
    limit = mocks.limit;
    constructor(config: { prefix?: string }) {
      mocks.configs.push(config);
    }
  }
  return { Ratelimit };
});

const fakeRedis = {} as Redis;

beforeEach(() => {
  mocks.limit.mockReset();
  mocks.slidingWindow.mockClear();
  mocks.configs.length = 0;
});

describe("assertRateLimit", () => {
  it("laisse passer sous la limite", async () => {
    mocks.limit.mockResolvedValue({ success: true });
    await expect(createRateLimit(fakeRedis).assertRateLimit("actionsPerIp", "hash-ip")).resolves.toBeUndefined();
    expect(mocks.limit).toHaveBeenCalledWith("hash-ip", { rate: 1 });
  });

  it("refuse au-delà de la limite → 429 RATE_LIMITED", async () => {
    mocks.limit.mockResolvedValue({ success: false });
    await expect(createRateLimit(fakeRedis).assertRateLimit("questionsPerIp", "hash-ip")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
    });
  });

  it("transmet un coût multiple (injection = triple)", async () => {
    mocks.limit.mockResolvedValue({ success: true });
    await createRateLimit(fakeRedis).assertRateLimit("questionsPerPlayer", "g1:A", 3);
    expect(mocks.limit).toHaveBeenCalledWith("g1:A", { rate: 3 });
  });

  it("configure chaque limiteur selon le barème (fenêtre glissante, préfixe dédié)", async () => {
    mocks.limit.mockResolvedValue({ success: true });
    const expected: Record<RateLimitKind, [number, string]> = {
      questionsPerPlayer: [10, "1 m"],
      questionsPerIp: [60, "1 h"],
      soloGamesPerIp: [20, "1 d"],
      roomsCreatedPerIp: [10, "1 d"],
      roomJoinPerIp: [10, "1 h"],
      actionsPerIp: [120, "1 m"],
    };
    const rateLimit = createRateLimit(fakeRedis);
    for (const kind of Object.keys(expected) as RateLimitKind[]) {
      await rateLimit.assertRateLimit(kind, "id");
      expect(mocks.slidingWindow).toHaveBeenLastCalledWith(...expected[kind]);
      expect(mocks.configs.at(-1)?.prefix).toBe(`rl:${kind}`);
    }
  });

  it("réutilise le même limiteur pour un même type", async () => {
    mocks.limit.mockResolvedValue({ success: true });
    const rateLimit = createRateLimit(fakeRedis);
    await rateLimit.assertRateLimit("actionsPerIp", "a");
    await rateLimit.assertRateLimit("actionsPerIp", "b");
    expect(mocks.configs).toHaveLength(1);
  });
});

describe("penalizeRateLimit", () => {
  it("consomme le surcoût sans jamais rejeter", async () => {
    mocks.limit.mockResolvedValue({ success: false });
    const rateLimit = createRateLimit(fakeRedis);
    await expect(rateLimit.penalizeRateLimit("questionsPerPlayer", "g1:A", 2)).resolves.toBeUndefined();
    expect(mocks.limit).toHaveBeenCalledWith("g1:A", { rate: 2 });
  });
});
