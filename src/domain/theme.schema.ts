import { z } from "zod";
import type { AnyTheme } from "./theme.types";

export const CHARACTERS_PER_THEME = 24;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug attendu (a-z, 0-9, tirets)");
const text = z.string().trim().min(1);

const imageRef = z.strictObject({
  src: z.string().startsWith("/", "Chemin local attendu (assets servis par l'appli)"),
  alt: text,
  credit: text.optional(),
  license: text.optional(),
});

const valueList = z
  .array(text)
  .min(2, "Au moins 2 valeurs")
  .refine((values) => new Set(values).size === values.length, "Valeurs en double");

const base = { label: text, description: text, askTemplate: text.optional() };

const attributeDef = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("boolean"), ...base }),
  z.strictObject({ kind: z.literal("enum"), ...base, values: valueList }),
  z.strictObject({ kind: z.literal("tags"), ...base, values: valueList }),
]);

type AttributeDefParsed = z.infer<typeof attributeDef>;

const attributeValue = z.union([z.boolean(), z.string(), z.array(z.string()), z.null()]);

const character = z.strictObject({
  id: slug,
  name: text,
  image: imageRef,
  attributes: z.record(z.string(), attributeValue),
});

function checkValue(def: AttributeDefParsed, value: unknown): string | null {
  switch (def.kind) {
    case "boolean":
      return typeof value === "boolean" ? null : "booléen attendu";
    case "enum":
      return typeof value === "string" && def.values.includes(value)
        ? null
        : `valeur hors vocabulaire (${def.values.join(", ")})`;
    case "tags":
      if (!Array.isArray(value)) return "liste attendue";
      if (new Set(value).size !== value.length) return "valeurs en double";
      return value.every((v) => typeof v === "string" && def.values.includes(v))
        ? null
        : `valeur hors vocabulaire (${def.values.join(", ")})`;
  }
}

/** Valide la cohérence complète d'un thème. À exécuter en test et au démarrage. */
export const themeSchema = z
  .strictObject({
    id: slug,
    schemaVersion: z.number().int().positive(),
    title: text,
    description: text,
    cover: imageRef,
    attributes: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]*$/, "camelCase attendu"), attributeDef),
    characters: z.array(character).length(CHARACTERS_PER_THEME, `Exactement ${CHARACTERS_PER_THEME} personnages`),
  })
  .superRefine((theme, ctx) => {
    const keys = Object.keys(theme.attributes);
    if (keys.length === 0) {
      ctx.addIssue({ code: "custom", path: ["attributes"], message: "Aucun attribut défini" });
    }

    const seenIds = new Set<string>();
    theme.characters.forEach((c, i) => {
      if (seenIds.has(c.id)) {
        ctx.addIssue({ code: "custom", path: ["characters", i, "id"], message: `id en double : ${c.id}` });
      }
      seenIds.add(c.id);

      for (const key of keys) {
        if (!(key in c.attributes)) {
          ctx.addIssue({
            code: "custom",
            path: ["characters", i, "attributes", key],
            message: "attribut manquant (mettre null si inconnu)",
          });
        }
      }

      for (const [key, value] of Object.entries(c.attributes)) {
        const def = theme.attributes[key];
        if (!def) {
          ctx.addIssue({ code: "custom", path: ["characters", i, "attributes", key], message: "attribut inconnu" });
          continue;
        }
        if (value === null) continue;
        const error = checkValue(def, value);
        if (error) ctx.addIssue({ code: "custom", path: ["characters", i, "attributes", key], message: error });
      }
    });

    // Un attribut qui a la même valeur pour tout le monde ne sert à rien en jeu.
    for (const key of keys) {
      const distinct = new Set(
        theme.characters
          .map((c) => c.attributes[key])
          .filter((v) => v !== null && v !== undefined)
          .map((v) => JSON.stringify(Array.isArray(v) ? [...v].sort() : v)),
      );
      if (distinct.size < 2) {
        ctx.addIssue({ code: "custom", path: ["attributes", key], message: "attribut non discriminant (une seule valeur)" });
      }
    }
  });

export function assertValidTheme(theme: AnyTheme): void {
  const result = themeSchema.safeParse(theme);
  if (!result.success) {
    throw new Error(`Thème "${theme.id}" invalide :\n${z.prettifyError(result.error)}`);
  }
}
