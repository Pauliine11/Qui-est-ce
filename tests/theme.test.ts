import { describe, expect, it } from "vitest";
import { assertValidTheme, themeSchema } from "../src/domain/theme.schema";
import { buildFixtureTheme } from "./fixtures/theme";

describe("themeSchema", () => {
  it("accepte un thème cohérent", () => {
    expect(() => assertValidTheme(buildFixtureTheme())).not.toThrow();
  });

  it("exige exactement 24 personnages", () => {
    const theme = buildFixtureTheme();
    expect(themeSchema.safeParse({ ...theme, characters: theme.characters.slice(0, 23) }).success).toBe(false);
  });

  it("refuse les ids en double", () => {
    const theme = buildFixtureTheme();
    const characters = theme.characters.map((c, i) => (i === 1 ? { ...c, id: "perso-1" } : c));
    expect(themeSchema.safeParse({ ...theme, characters }).success).toBe(false);
  });

  it("refuse une valeur hors vocabulaire", () => {
    const theme = buildFixtureTheme();
    const characters = theme.characters.map((c, i) =>
      i === 0 ? { ...c, attributes: { ...c.attributes, hairColor: "violet" } } : c,
    );
    expect(themeSchema.safeParse({ ...theme, characters }).success).toBe(false);
  });

  it("refuse un attribut manquant ou inconnu", () => {
    const theme = buildFixtureTheme();
    const missing = theme.characters.map((c, i) => {
      if (i !== 0) return c;
      const { hasScar: _removed, ...rest } = c.attributes;
      return { ...c, attributes: rest };
    });
    const unknown = theme.characters.map((c, i) =>
      i === 0 ? { ...c, attributes: { ...c.attributes, height: "grand" } } : c,
    );
    expect(themeSchema.safeParse({ ...theme, characters: missing }).success).toBe(false);
    expect(themeSchema.safeParse({ ...theme, characters: unknown }).success).toBe(false);
  });

  it("refuse un attribut non discriminant", () => {
    const theme = buildFixtureTheme();
    const characters = theme.characters.map((c) => ({ ...c, attributes: { ...c.attributes, hasGlasses: true } }));
    expect(themeSchema.safeParse({ ...theme, characters }).success).toBe(false);
  });

  it("refuse une image sans texte alternatif", () => {
    const theme = buildFixtureTheme();
    const characters = theme.characters.map((c, i) => (i === 0 ? { ...c, image: { ...c.image, alt: " " } } : c));
    expect(themeSchema.safeParse({ ...theme, characters }).success).toBe(false);
  });
});
