import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/server/env";

/**
 * Les IP ne sont jamais stockées ni journalisées en clair (CLAUDE.md) :
 * seule une empreinte salée sert de clé de rate limiting.
 */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** Première IP de x-forwarded-for, sinon x-real-ip, sinon seau partagé "unknown". */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function getClientIpHash(request: Request): string {
  return hashIp(getClientIp(request), env.IP_HASH_SALT);
}
