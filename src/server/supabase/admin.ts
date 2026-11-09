import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/server/env";

let adminClient: SupabaseClient | null = null;

/**
 * Client service role : contourne la RLS, SERVEUR UNIQUEMENT (invariant n°3).
 * Toute lecture de la base passe ensuite par une validation Zod.
 */
export function getAdminClient(): SupabaseClient {
  adminClient ??= createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
