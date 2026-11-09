import type { Redis } from "@upstash/redis";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { budgetKey, consumeLlmBudget, secondsUntilUtcMidnight } from "@/server/redis/budget";

const incr = vi.fn();
const expire = vi.fn();
const redis = { incr, expire } as unknown as Redis;

beforeEach(() => {
  incr.mockReset();
  expire.mockReset();
});

describe("budgetKey / secondsUntilUtcMidnight", () => {
  it("une clé par jour UTC", () => {
    expect(budgetKey(new Date("2026-11-10T15:30:00Z"))).toBe("llm:budget:20261110");
    expect(budgetKey(new Date("2026-11-10T23:59:59Z"))).not.toBe(budgetKey(new Date("2026-11-11T00:00:01Z")));
  });

  it("calcule l'expiration à minuit UTC", () => {
    expect(secondsUntilUtcMidnight(new Date("2026-11-10T23:59:30Z"))).toBe(30);
    expect(secondsUntilUtcMidnight(new Date("2026-11-10T00:00:00Z"))).toBe(86_400);
  });
});

describe("consumeLlmBudget", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("compte atomiquement et pose l'expiration à la première unité", async () => {
    incr.mockResolvedValue(1);
    await consumeLlmBudget(redis, now);
    expect(incr).toHaveBeenCalledWith("llm:budget:20261110");
    expect(expire).toHaveBeenCalledWith("llm:budget:20261110", secondsUntilUtcMidnight(now));
  });

  it("ne repose pas l'expiration ensuite", async () => {
    incr.mockResolvedValue(42);
    await consumeLlmBudget(redis, now);
    expect(expire).not.toHaveBeenCalled();
  });

  // L'env de test fixe LLM_DAILY_BUDGET=200 (tests/setup.ts).
  it("au budget exact, l'appel passe encore", async () => {
    incr.mockResolvedValue(200);
    await expect(consumeLlmBudget(redis, now)).resolves.toBeUndefined();
  });

  it("au-delà du budget → 503 SERVICE_BUSY", async () => {
    incr.mockResolvedValue(201);
    await expect(consumeLlmBudget(redis, now)).rejects.toMatchObject({ code: "SERVICE_BUSY", status: 503 });
  });
});
