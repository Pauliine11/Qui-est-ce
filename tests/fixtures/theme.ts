import type { AnyTheme } from "../../src/domain/theme.types";

const GENDERS = ["homme", "femme", "autre"] as const;
const HAIR = ["noir", "blond", "roux", "blanc", "bleu", "rose", "vert", "chauve"] as const;
const ROLES = ["héros", "rival", "mentor", "antagoniste"] as const;
const ACCESSORIES = ["bandeau", "chapeau", "épée", "écharpe", "masque"] as const;

/**
 * Thème de test : 24 personnages tous distincts (couple genre × cheveux unique).
 * Le personnage n°6 (perso-6) a une cicatrice inconnue (null).
 */
export function buildFixtureTheme(): AnyTheme {
  return {
    id: "test",
    schemaVersion: 1,
    title: "Thème de test",
    description: "Thème généré pour les tests",
    cover: { src: "/themes/test/cover.webp", alt: "Couverture du thème de test" },
    attributes: {
      gender: { kind: "enum", label: "Genre", description: "Genre du personnage", values: GENDERS },
      hairColor: {
        kind: "enum",
        label: "Couleur de cheveux",
        description: "Couleur principale des cheveux",
        values: HAIR,
        askTemplate: "Ton personnage a-t-il les cheveux {value} ?",
      },
      hasGlasses: { kind: "boolean", label: "Lunettes", description: "Porte des lunettes" },
      hasScar: { kind: "boolean", label: "Cicatrice", description: "Cicatrice visible au visage" },
      role: { kind: "enum", label: "Rôle", description: "Place dans l'histoire", values: ROLES },
      accessories: { kind: "tags", label: "Accessoires", description: "Objets portés", values: ACCESSORIES },
    },
    characters: Array.from({ length: 24 }, (_, i) => ({
      id: `perso-${i + 1}`,
      name: `Perso ${i + 1}`,
      image: { src: `/themes/test/perso-${i + 1}.webp`, alt: `Portrait du personnage ${i + 1}` },
      attributes: {
        gender: GENDERS[Math.floor(i / 8)] ?? null,
        hairColor: HAIR[i % 8] ?? null,
        hasGlasses: i % 3 === 0,
        hasScar: i === 5 ? null : i % 4 === 0,
        role: ROLES[i % 4] ?? null,
        accessories: ACCESSORIES.filter((_, bit) => ((i >> bit) & 1) === 1),
      },
    })),
  };
}
