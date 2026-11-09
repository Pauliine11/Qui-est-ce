import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, apiError } from "@/server/security/api-error";
import { withApiRoute } from "@/server/security/route-wrapper";

const request = () => new Request("https://jeu.example/api/games", { method: "POST" });

describe("apiError", () => {
  it("renvoie le format standard { error: { code, message } }", async () => {
    const response = apiError("RATE_LIMITED", 429);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: { code: "RATE_LIMITED", message: "Trop de requêtes. Réessaie dans un instant." },
    });
  });
});

describe("withApiRoute", () => {
  it("laisse passer une réponse réussie", async () => {
    const route = withApiRoute(async () => Response.json({ ok: true }));
    const response = await route(request(), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("convertit une ApiError en réponse standard", async () => {
    const route = withApiRoute(async () => {
      throw new ApiError("NOT_FOUND", 404);
    });
    const response = await route(request(), {});
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Ressource introuvable." } });
  });

  it("convertit une ZodError en 400 sans détail interne", async () => {
    const route = withApiRoute(async () => {
      z.object({ themeId: z.string() }).parse({ themeId: 42 });
      return Response.json({});
    });
    const response = await route(request(), {});
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "BAD_REQUEST", message: "Requête invalide." } });
  });

  it("une erreur inattendue → 500 générique, journalisée sans stack côté client", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = withApiRoute(async () => {
      throw new Error("secret interne: clé sk-123");
    });
    const response = await route(request(), {});
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "INTERNAL", message: "Erreur interne." } });
    expect(JSON.stringify(body)).not.toContain("sk-123");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("une valeur levée non-Error est aussi convertie en 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = withApiRoute(async () => {
      throw "boom";
    });
    const response = await route(request(), {});
    expect(response.status).toBe(500);
    spy.mockRestore();
  });
});
