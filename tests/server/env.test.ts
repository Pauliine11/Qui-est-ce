import { describe, expect, it } from "vitest";
import { parseEnv } from "@/server/env";

const valid: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://xyz.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  UPSTASH_REDIS_REST_URL: "https://xyz.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
  LLM_PROVIDER: "anthropic",
  LLM_MODEL: "claude-haiku-5-5",
  LLM_API_KEY: "sk-test",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site",
  TURNSTILE_SECRET_KEY: "secret",
  IP_HASH_SALT: "0123456789abcdef",
  LLM_DAILY_BUDGET: "150",
};

describe("parseEnv", () => {
  it("accepte une configuration complète et convertit le budget en nombre", () => {
    const env = parseEnv(valid);
    expect(env.LLM_PROVIDER).toBe("anthropic");
    expect(env.LLM_DAILY_BUDGET).toBe(150);
  });

  it("échoue en nommant la variable manquante, sans afficher de valeur", () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _omitted, ...incomplete } = valid;
    expect(() => parseEnv(incomplete)).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
    try {
      parseEnv(incomplete);
    } catch (error) {
      expect((error as Error).message).not.toContain("sk-test");
      expect((error as Error).message).not.toContain("secret");
    }
  });

  it("refuse un fournisseur LLM inconnu", () => {
    expect(() => parseEnv({ ...valid, LLM_PROVIDER: "mistral" })).toThrowError(/LLM_PROVIDER/);
  });

  it("refuse un budget non entier ou négatif et un sel trop court", () => {
    expect(() => parseEnv({ ...valid, LLM_DAILY_BUDGET: "beaucoup" })).toThrowError(/LLM_DAILY_BUDGET/);
    expect(() => parseEnv({ ...valid, LLM_DAILY_BUDGET: "-5" })).toThrowError(/LLM_DAILY_BUDGET/);
    expect(() => parseEnv({ ...valid, IP_HASH_SALT: "court" })).toThrowError(/IP_HASH_SALT/);
  });

  it("refuse une URL Supabase invalide", () => {
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "pas-une-url" })).toThrowError(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });
});
