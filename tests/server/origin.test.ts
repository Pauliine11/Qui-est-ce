import { describe, expect, it } from "vitest";
import { ApiError } from "@/server/security/api-error";
import { assertSameOrigin } from "@/server/security/origin";

function post(url: string, headers: Record<string, string>): Request {
  return new Request(url, { method: "POST", headers });
}

describe("assertSameOrigin", () => {
  it("accepte une origine identique à l'hôte de la requête", () => {
    const request = post("https://jeu.example/api/games", { origin: "https://jeu.example" });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("accepte l'hôte public transmis par le proxy (x-forwarded-host)", () => {
    const request = post("http://127.0.0.1:3000/api/games", {
      origin: "https://jeu.example",
      "x-forwarded-host": "jeu.example",
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("refuse une origine différente (403, sans détail)", () => {
    const request = post("https://jeu.example/api/games", { origin: "https://attaquant.example" });
    try {
      assertSameOrigin(request);
      expect.unreachable("aurait dû lever");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(403);
      expect((error as ApiError).code).toBe("FORBIDDEN");
    }
  });

  it("refuse un sous-domaine ou un port différent", () => {
    expect(() =>
      assertSameOrigin(post("https://jeu.example/api/x", { origin: "https://evil.jeu.example" })),
    ).toThrow(ApiError);
    expect(() =>
      assertSameOrigin(post("https://jeu.example/api/x", { origin: "https://jeu.example:8443" })),
    ).toThrow(ApiError);
  });

  it("refuse une requête sans en-tête Origin", () => {
    expect(() => assertSameOrigin(post("https://jeu.example/api/x", {}))).toThrow(ApiError);
  });

  it("refuse un Origin illisible (ex. « null »)", () => {
    expect(() => assertSameOrigin(post("https://jeu.example/api/x", { origin: "null" }))).toThrow(ApiError);
  });
});
