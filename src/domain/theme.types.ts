/**
 * Vocabulaire d'un thème. Chaque thème déclare ses propres attributs ;
 * les personnages, le prompt LLM et le schéma de sortie en sont dérivés.
 */
interface AttributeBase {
  readonly label: string;
  /** Description fournie au LLM pour l'aider à reconnaître la notion. */
  readonly description: string;
  /** Formulation utilisée par l'IA adverse, ex. "A-t-il les cheveux {value} ?" */
  readonly askTemplate?: string;
}

export type AttributeDef =
  | (AttributeBase & { readonly kind: "boolean" })
  /** Une seule valeur par personnage (ex. couleur de cheveux). */
  | (AttributeBase & { readonly kind: "enum"; readonly values: readonly string[] })
  /** Plusieurs valeurs possibles par personnage (ex. accessoires). */
  | (AttributeBase & { readonly kind: "tags"; readonly values: readonly string[] });

export type AttributeDefs = Readonly<Record<string, AttributeDef>>;

type ValueOf<D> = D extends { kind: "boolean" }
  ? boolean
  : D extends { kind: "enum"; values: readonly (infer V)[] }
    ? V
    : D extends { kind: "tags"; values: readonly (infer V)[] }
      ? readonly V[]
      : never;

/** `null` = information inconnue → le moteur répondra « Je ne sais pas ». */
export type CharacterAttributes<A extends AttributeDefs> = {
  readonly [K in keyof A]: ValueOf<A[K]> | null;
};

export interface ImageRef {
  readonly src: string;
  readonly alt: string;
  readonly credit?: string;
  readonly license?: string;
}

export interface Character<A extends AttributeDefs = AttributeDefs> {
  /** Slug stable, ex. "kaito-renji". */
  readonly id: string;
  readonly name: string;
  readonly image: ImageRef;
  readonly attributes: CharacterAttributes<A>;
}

export interface Theme<A extends AttributeDefs = AttributeDefs> {
  readonly id: string;
  /** À incrémenter quand le vocabulaire change : invalide le cache des analyses LLM. */
  readonly schemaVersion: number;
  readonly title: string;
  readonly description: string;
  readonly cover: ImageRef;
  readonly attributes: A;
  /** Exactement 24 (vérifié à l'exécution par `themeSchema`). */
  readonly characters: readonly Character<A>[];
}

export type AnyTheme = Theme<AttributeDefs>;
export type AnyCharacter = Character<AttributeDefs>;

/**
 * Déclare un thème avec typage strict : une valeur hors vocabulaire ou un
 * attribut manquant sur un personnage est une erreur de compilation.
 * `NoInfer` force TypeScript à déduire le vocabulaire depuis `attributes` uniquement.
 */
export const defineTheme = <const A extends AttributeDefs>(
  theme: Omit<Theme<A>, "characters"> & { readonly characters: readonly Character<NoInfer<A>>[] },
): Theme<A> => theme;
