import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { env } from "@/server/env";

/**
 * Client lié à la requête (clé anon + cookies de session) : sert uniquement à
 * identifier l'utilisateur anonyme. Les écritures passent par le client admin.
 */
export async function createRequestClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

/** Utilisateur de la requête, vérifié auprès de Supabase Auth (jamais le JWT seul). */
export async function getRequestUser(): Promise<User | null> {
  const supabase = await createRequestClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
