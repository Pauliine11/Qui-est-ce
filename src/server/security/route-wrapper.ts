import "server-only";
import { ZodError } from "zod";
import { ApiError, apiError } from "./api-error";

/**
 * Enveloppe commune des Route Handlers : intercepte les erreurs, renvoie le
 * format standard et journalise sans données sensibles (ni corps de requête,
 * ni IP en clair, ni stack au client).
 */
export function withApiRoute<Context>(
  handler: (request: Request, context: Context) => Promise<Response>,
): (request: Request, context: Context) => Promise<Response> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return apiError(error.code, error.status, error.message);
      }
      if (error instanceof ZodError) {
        return apiError("BAD_REQUEST", 400);
      }
      const { pathname } = new URL(request.url);
      const summary = error instanceof Error ? `${error.name}: ${error.message}` : "erreur non identifiée";
      console.error(`[api] ${request.method} ${pathname} → ${summary}`);
      return apiError("INTERNAL", 500);
    }
  };
}
