import { describe, expect, it } from "vitest";
import { buildSecurityHeaders, generateNonce } from "@/server/security/headers";

const base = {
  nonce: "NONCE123",
  isDev: false,
  isProduction: false,
  supabaseUrl: "https://xyz.supabase.co",
};

function csp(options: Partial<typeof base> = {}): string {
  return buildSecurityHeaders({ ...base, ...options })["Content-Security-Policy"] ?? "";
}

describe("buildSecurityHeaders", () => {
  it("insère le nonce dans script-src et style-src", () => {
    const value = csp();
    expect(value).toContain("script-src 'self' 'nonce-NONCE123' 'strict-dynamic'");
    expect(value).toContain("style-src 'self' 'nonce-NONCE123'");
  });

  it("n'autorise en connexion externe que Supabase (https + wss) et Turnstile", () => {
    const value = csp();
    const connect = value.split("; ").find((d) => d.startsWith("connect-src"));
    expect(connect).toBe(
      "connect-src 'self' https://challenges.cloudflare.com https://xyz.supabase.co wss://xyz.supabase.co",
    );
  });

  it("sans URL Supabase : aucune origine Supabase (fail closed)", () => {
    expect(csp({ supabaseUrl: undefined })).toContain("connect-src 'self' https://challenges.cloudflare.com;");
  });

  it("interdit tout embedding et toute base externe", () => {
    const value = csp();
    expect(value).toContain("frame-ancestors 'none'");
    expect(value).toContain("object-src 'none'");
    expect(value).toContain("base-uri 'self'");
    expect(value).toContain("form-action 'self'");
  });

  it("unsafe-eval en dev uniquement", () => {
    expect(csp({ isDev: true })).toContain("'unsafe-eval'");
    expect(csp({ isDev: false })).not.toContain("'unsafe-eval'");
  });

  it("HSTS et upgrade-insecure-requests en production uniquement", () => {
    const dev = buildSecurityHeaders(base);
    const prod = buildSecurityHeaders({ ...base, isProduction: true });
    expect(dev["Strict-Transport-Security"]).toBeUndefined();
    expect(dev["Content-Security-Policy"]).not.toContain("upgrade-insecure-requests");
    expect(prod["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
    expect(prod["Content-Security-Policy"]).toContain("upgrade-insecure-requests");
  });

  it("pose les autres en-têtes obligatoires", () => {
    const headers = buildSecurityHeaders(base);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
  });
});

describe("generateNonce", () => {
  it("génère un nonce base64 unique par appel", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(Buffer.from(a, "base64").length).toBe(16);
  });
});
