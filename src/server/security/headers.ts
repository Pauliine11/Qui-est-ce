/**
 * En-têtes de sécurité (CSP stricte avec nonce, invariant n°8).
 * Module pur, sans `server-only` : il est importé par `src/proxy.ts`, qui n'est
 * pas compilé avec la condition `react-server`. Il ne lit aucun secret.
 */

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64");
}

export interface SecurityHeadersOptions {
  readonly nonce: string;
  /** `unsafe-eval` requis par React en dev uniquement. */
  readonly isDev: boolean;
  /** HSTS et upgrade-insecure-requests en production uniquement. */
  readonly isProduction: boolean;
  /** Origine Supabase (https). Absente → aucune connexion externe Supabase autorisée. */
  readonly supabaseUrl?: string | undefined;
}

export function buildSecurityHeaders(options: SecurityHeadersOptions): Record<string, string> {
  const { nonce, isDev, isProduction, supabaseUrl } = options;

  const connectSrc = ["'self'", TURNSTILE_ORIGIN];
  if (supabaseUrl) {
    const { host } = new URL(supabaseUrl);
    connectSrc.push(`https://${host}`, `wss://${host}`);
  }

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE_ORIGIN}${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ];

  const headers: Record<string, string> = {
    "Content-Security-Policy": directives.join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  };
  if (isProduction) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  }
  return headers;
}
