import "server-only";
import { ApiError } from "./api-error";

/**
 * Anti-CSRF (invariant n°8) : toute route POST exige un en-tête Origin
 * correspondant à l'hôte servi. Les navigateurs envoient toujours Origin sur
 * un POST ; une absence ou une différence → 403, sans détail.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new ApiError("FORBIDDEN", 403);

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError("FORBIDDEN", 403);
  }

  // Derrière un proxy (Vercel…), l'hôte public est dans x-forwarded-host.
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;

  if (originHost !== host) throw new ApiError("FORBIDDEN", 403);
}
