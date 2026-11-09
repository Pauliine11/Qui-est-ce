/**
 * Tests de typage (vérifiés par `npm run typecheck`, pas exécutés).
 * Chaque @ts-expect-error DOIT produire une erreur, sinon tsc échoue.
 */
import { defineTheme } from "../src/domain/theme.types";

const base = {
  id: "demo",
  schemaVersion: 1,
  title: "Démo",
  description: "Démo",
  cover: { src: "/c.webp", alt: "Couverture" },
} as const;

const image = { src: "/a.webp", alt: "Portrait" };

// ✅ Thème valide
defineTheme({
  ...base,
  attributes: {
    hair: { kind: "enum", label: "Cheveux", description: "Couleur", values: ["noir", "blond"] },
    glasses: { kind: "boolean", label: "Lunettes", description: "Lunettes" },
    items: { kind: "tags", label: "Objets", description: "Objets", values: ["épée", "chapeau"] },
  },
  characters: [{ id: "a", name: "A", image, attributes: { hair: "noir", glasses: null, items: ["épée"] } }],
});

// ❌ Valeur hors vocabulaire
defineTheme({
  ...base,
  attributes: { hair: { kind: "enum", label: "Cheveux", description: "Couleur", values: ["noir", "blond"] } },
  characters: [
    {
      id: "a",
      name: "A",
      image,
      attributes: {
        // @ts-expect-error "violet" n'est pas dans le vocabulaire
        hair: "violet",
      },
    },
  ],
});

// ❌ Booléen attendu
defineTheme({
  ...base,
  attributes: { glasses: { kind: "boolean", label: "Lunettes", description: "Lunettes" } },
  characters: [
    {
      id: "a",
      name: "A",
      image,
      attributes: {
        // @ts-expect-error string au lieu de boolean
        glasses: "oui",
      },
    },
  ],
});

// ❌ Attribut manquant
defineTheme({
  ...base,
  attributes: { glasses: { kind: "boolean", label: "Lunettes", description: "Lunettes" } },
  characters: [
    {
      id: "a",
      name: "A",
      image,
      // @ts-expect-error "glasses" manquant
      attributes: {},
    },
  ],
});
