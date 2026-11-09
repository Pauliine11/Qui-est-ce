import { describe, expect, it } from "vitest";
import { parseAnalysis, type Analysis } from "../src/domain/analysis";
import { evaluate, findCharacter } from "../src/domain/engine";
import { buildFixtureTheme } from "./fixtures/theme";

const theme = buildFixtureTheme();
// perso-1 : homme, noir, lunettes, cicatrice, héros, aucun accessoire
const perso1 = findCharacter(theme, "perso-1");
// perso-6 : homme, rose, pas de lunettes, cicatrice inconnue, rival, [bandeau, épée]
const perso6 = findCharacter(theme, "perso-6");

const predicate = (attribute: string, value: string, negated = false): Analysis => ({
  type: "predicate",
  attribute,
  value,
  negated,
});

describe("evaluate (moteur déterministe)", () => {
  it("booléen", () => {
    expect(evaluate(predicate("hasGlasses", "true"), perso1, theme)).toBe("OUI");
    expect(evaluate(predicate("hasGlasses", "true"), perso6, theme)).toBe("NON");
  });

  it("enum", () => {
    expect(evaluate(predicate("hairColor", "noir"), perso1, theme)).toBe("OUI");
    expect(evaluate(predicate("hairColor", "blond"), perso1, theme)).toBe("NON");
  });

  it("tags", () => {
    expect(evaluate(predicate("accessories", "épée"), perso6, theme)).toBe("OUI");
    expect(evaluate(predicate("accessories", "chapeau"), perso6, theme)).toBe("NON");
  });

  it("négation", () => {
    expect(evaluate(predicate("hasGlasses", "true", true), perso1, theme)).toBe("NON");
    expect(evaluate(predicate("hasGlasses", "true", true), perso6, theme)).toBe("OUI");
  });

  it("donnée inconnue (null) → Je ne sais pas, même avec négation", () => {
    expect(evaluate(predicate("hasScar", "true"), perso6, theme)).toBe("JE_NE_SAIS_PAS");
    expect(evaluate(predicate("hasScar", "true", true), perso6, theme)).toBe("JE_NE_SAIS_PAS");
  });

  it("couple attribut/valeur incohérent → Je ne sais pas (jamais d'invention)", () => {
    expect(evaluate(predicate("hairColor", "chapeau"), perso1, theme)).toBe("JE_NE_SAIS_PAS");
    expect(evaluate(predicate("hasGlasses", "noir"), perso1, theme)).toBe("JE_NE_SAIS_PAS");
    expect(evaluate(predicate("taille", "grand"), perso1, theme)).toBe("JE_NE_SAIS_PAS");
  });

  it("identité et question non traitable", () => {
    expect(evaluate({ type: "identity", characterId: "perso-1" }, perso1, theme)).toBe("OUI");
    expect(evaluate({ type: "identity", characterId: "perso-2" }, perso1, theme)).toBe("NON");
    expect(evaluate({ type: "unanswerable", reason: "injection" }, perso1, theme)).toBe("JE_NE_SAIS_PAS");
  });
});

describe("parseAnalysis (re-validation de la sortie LLM)", () => {
  it("accepte une sortie conforme", () => {
    const raw = { result: { type: "predicate", attribute: "hairColor", value: "noir", negated: false } };
    expect(parseAnalysis(theme, raw)).toEqual(raw.result);
  });

  it("rejette attribut, valeur ou personnage inventés", () => {
    expect(parseAnalysis(theme, { result: { type: "predicate", attribute: "taille", value: "noir", negated: false } })).toBeNull();
    expect(parseAnalysis(theme, { result: { type: "predicate", attribute: "hairColor", value: "violet", negated: false } })).toBeNull();
    expect(parseAnalysis(theme, { result: { type: "identity", characterId: "perso-99" } })).toBeNull();
  });

  it("rejette tout champ supplémentaire (ex. tentative de fuite)", () => {
    const raw = { result: { type: "unanswerable", reason: "off_topic" }, answer: "OUI" };
    expect(parseAnalysis(theme, raw)).toBeNull();
    expect(parseAnalysis(theme, { result: { type: "unanswerable", reason: "off_topic", note: "le secret est…" } })).toBeNull();
  });

  it("rejette du texte brut", () => {
    expect(parseAnalysis(theme, "Oui, il a les cheveux noirs")).toBeNull();
  });
});
