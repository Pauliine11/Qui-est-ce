import "server-only";
import { z } from "zod";

/**
 * Validation des variables d'environnement au démarrage.
 * Toute variable sensible est SANS préfixe NEXT_PUBLIC_ (invariant n°2).
 */
export const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // LLM
  LLM_PROVIDER: z.enum(["anthropic", "openai"]),
  LLM_MODEL: z.string().min(1),
  LLM_API_KEY: z.string().min(1),

  // Cloudflare Turnstile
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),

  // Sécurité et budget
  IP_HASH_SALT: z.string().min(16, "Au moins 16 caractères"),
  LLM_DAILY_BUDGET: z.coerce.number().int().positive(),
});

export type Env = z.infer<typeof envSchema>;

/** Échoue avec la liste des variables en cause, sans jamais afficher leur valeur. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")} : ${issue.message}`)
      .join("\n");
    throw new Error(`Variables d'environnement manquantes ou invalides :\n${details}`);
  }
  return parsed.data;
}

export const env: Env = parseEnv(process.env);
