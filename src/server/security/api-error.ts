import "server-only";
import { NextResponse } from "next/server";

/**
 * Erreurs d'API au format standard `{ error: { code, message } }` (CLAUDE.md).
 * Les messages sont destinés au client : jamais de détail interne.
 */
export const API_ERROR_MESSAGES = {
  BAD_REQUEST: "Requête invalide.",
  UNAUTHORIZED: "Authentification requise.",
  FORBIDDEN: "Requête refusée.",
  NOT_FOUND: "Ressource introuvable.",
  CONFLICT: "Action impossible dans l'état actuel de la partie.",
  VERSION_CONFLICT: "La partie a changé entre-temps. Recharge et réessaie.",
  RATE_LIMITED: "Trop de requêtes. Réessaie dans un instant.",
  SERVICE_BUSY: "Service momentanément saturé. Réessaie plus tard.",
  INTERNAL: "Erreur interne.",
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_MESSAGES;

/** À lancer depuis un handler : interceptée par `withApiRoute`. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, status: number, message?: string) {
    super(message ?? API_ERROR_MESSAGES[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function apiError(code: ApiErrorCode, status: number, message?: string): NextResponse {
  return NextResponse.json(
    { error: { code, message: message ?? API_ERROR_MESSAGES[code] } },
    { status },
  );
}
