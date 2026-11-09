import { describe, expect, it } from "vitest";
import { getClientIp, getClientIpHash, hashIp } from "@/server/security/ip-hash";

describe("hashIp", () => {
  it("est stable pour une même IP et un même sel", () => {
    expect(hashIp("203.0.113.7", "sel")).toBe(hashIp("203.0.113.7", "sel"));
  });

  it("change avec le sel et avec l'IP", () => {
    expect(hashIp("203.0.113.7", "sel-a")).not.toBe(hashIp("203.0.113.7", "sel-b"));
    expect(hashIp("203.0.113.7", "sel")).not.toBe(hashIp("203.0.113.8", "sel"));
  });

  it("ne contient jamais l'IP en clair", () => {
    const hash = hashIp("203.0.113.7", "sel");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).not.toContain("203");
  });
});

describe("getClientIp", () => {
  const withHeaders = (headers: Record<string, string>) =>
    new Request("https://jeu.example/api", { headers });

  it("prend la première IP de x-forwarded-for", () => {
    expect(getClientIp(withHeaders({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("retombe sur x-real-ip puis sur un seau partagé", () => {
    expect(getClientIp(withHeaders({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(getClientIp(withHeaders({}))).toBe("unknown");
  });
});

describe("getClientIpHash", () => {
  it("renvoie une empreinte hexadécimale salée via l'env", () => {
    const request = new Request("https://jeu.example/api", {
      headers: { "x-forwarded-for": "203.0.113.7" },
    });
    const hash = getClientIpHash(request);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).not.toContain("203.0.113.7");
  });
});
