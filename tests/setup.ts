/**
 * Variables d'environnement de fixture : permettent d'importer `@/server/env`
 * (validation stricte au chargement) dans les tests unitaires.
 */
const TEST_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-test",
  UPSTASH_REDIS_REST_URL: "https://test-redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "redis-token-test",
  LLM_PROVIDER: "anthropic",
  LLM_MODEL: "claude-haiku-5-5",
  LLM_API_KEY: "llm-key-test",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key-test",
  TURNSTILE_SECRET_KEY: "turnstile-secret-test",
  IP_HASH_SALT: "sel-de-test-32-caracteres-mini!!",
  LLM_DAILY_BUDGET: "200",
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] ??= value;
}
