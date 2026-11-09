import { NextResponse, type NextRequest } from "next/server";
import { buildSecurityHeaders, generateNonce } from "@/server/security/headers";

/**
 * Proxy Next.js 16 (ex-middleware) : pose les en-têtes de sécurité sur toutes
 * les réponses, avec un nonce CSP par requête. Next lit le nonce dans
 * l'en-tête CSP de la requête et l'applique à ses propres balises.
 */
export function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const securityHeaders = buildSecurityHeaders({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    isProduction: process.env.NODE_ENV === "production",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", securityHeaders["Content-Security-Policy"] ?? "");

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  // Tout sauf les assets statiques (les routes /api sont incluses volontairement).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
