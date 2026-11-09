import "server-only";
import type { PublicEvent } from "@/domain/game/game";
import { env } from "@/server/env";

/**
 * Diffusion des événements publics sur le canal privé `game:<id>` via l'API
 * REST Realtime (clé service role). Les clients ne peuvent que lire ce canal
 * (policy SELECT sur realtime.messages), jamais y écrire.
 * Invariant n°4 : seuls des `PublicEvent` passent ici — aucun secret avant
 * `game_finished` (garanti par le domaine et vérifié par test).
 */

export function gameTopic(gameId: string): string {
  return `game:${gameId}`;
}

export async function broadcast(
  gameId: string,
  events: readonly PublicEvent[],
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const topic = gameTopic(gameId);
  // Envois séquentiels : l'ordre des événements doit être préservé.
  for (const event of events) {
    const url =
      `${env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast/` +
      `${encodeURIComponent(topic)}/events/${encodeURIComponent(event.type)}?private=true`;
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });
      if (!response.ok) {
        // La diffusion est "best effort" : ne fait jamais échouer l'action de jeu.
        console.error(`[broadcast] ${topic} ${event.type} → HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(
        `[broadcast] ${topic} ${event.type} → ${error instanceof Error ? error.message : "erreur réseau"}`,
      );
    }
  }
}
