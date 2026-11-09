import { defineTheme } from "@/domain/theme.types";

/**
 * Thème de démonstration : 24 personnages ORIGINAUX (aucun personnage de manga
 * existant, droits d'auteur). Visuels en placeholders SVG générés par
 * `scripts/generate-placeholders.mjs`.
 */

const img = (id: string, alt: string) => ({ src: `/themes/shonen/${id}.svg`, alt });

export const shonenTheme = defineTheme({
  id: "shonen",
  schemaVersion: 1,
  title: "Académie Tenkū",
  description:
    "Élèves, mentors et esprits d'une académie de héros inspirée des shōnen : 24 personnages originaux.",
  cover: { src: "/themes/shonen/cover.svg", alt: "Emblème de l'Académie Tenkū sur fond de ciel" },
  attributes: {
    gender: {
      kind: "enum",
      label: "Genre",
      description: "Genre du personnage : homme, femme, ou autre (esprit, automate…)",
      values: ["homme", "femme", "autre"],
      askTemplate: "Est-ce un personnage de genre « {value} » ?",
    },
    hairColor: {
      kind: "enum",
      label: "Couleur de cheveux",
      description: "Couleur principale de la chevelure",
      values: ["noir", "blond", "roux", "blanc", "bleu", "rose", "vert", "violet"],
      askTemplate: "A-t-il les cheveux {value} ?",
    },
    hasGlasses: {
      kind: "boolean",
      label: "Lunettes",
      description: "Porte des lunettes de vue ou de combat",
      askTemplate: "Porte-t-il des lunettes ?",
    },
    hasScar: {
      kind: "boolean",
      label: "Cicatrice",
      description: "Cicatrice visible sur le visage",
      askTemplate: "A-t-il une cicatrice visible ?",
    },
    role: {
      kind: "enum",
      label: "Rôle",
      description: "Place du personnage dans l'histoire",
      values: ["héros", "rival", "mentor", "antagoniste"],
      askTemplate: "Son rôle dans l'histoire est-il « {value} » ?",
    },
    power: {
      kind: "enum",
      label: "Pouvoir",
      description: "Élément du pouvoir principal",
      values: ["feu", "eau", "foudre", "vent", "terre", "ombre"],
      askTemplate: "Son pouvoir est-il lié à l'élément « {value} » ?",
    },
    accessories: {
      kind: "tags",
      label: "Accessoires",
      description: "Équipement porté (plusieurs possibles)",
      values: ["bandeau", "épée", "cape", "masque", "amulette"],
      askTemplate: "Porte-t-il cet accessoire : {value} ?",
    },
  },
  characters: [
    {
      id: "kaito-renji",
      name: "Kaito Renji",
      image: img("kaito-renji", "Garçon aux cheveux noirs, lunettes et cicatrice, regard déterminé"),
      attributes: { gender: "homme", hairColor: "noir", hasGlasses: true, hasScar: true, role: "héros", power: "feu", accessories: [] },
    },
    {
      id: "sora-tatsuki",
      name: "Sora Tatsuki",
      image: img("sora-tatsuki", "Garçon blond au bandeau, sourire en coin"),
      attributes: { gender: "homme", hairColor: "blond", hasGlasses: false, hasScar: false, role: "rival", power: "eau", accessories: ["bandeau"] },
    },
    {
      id: "renzo-akaba",
      name: "Renzo Akaba",
      image: img("renzo-akaba", "Homme roux portant une épée dans le dos"),
      attributes: { gender: "homme", hairColor: "roux", hasGlasses: false, hasScar: false, role: "mentor", power: "foudre", accessories: ["épée"] },
    },
    {
      id: "haru-shirogane",
      name: "Haru Shirogane",
      image: img("haru-shirogane", "Homme aux cheveux blancs, lunettes fines, bandeau et épée"),
      attributes: { gender: "homme", hairColor: "blanc", hasGlasses: true, hasScar: false, role: "antagoniste", power: "vent", accessories: ["bandeau", "épée"] },
    },
    {
      id: "tomo-aozora",
      name: "Tomo Aozora",
      image: img("tomo-aozora", "Garçon aux cheveux bleus, cicatrice au menton, cape au vent"),
      attributes: { gender: "homme", hairColor: "bleu", hasGlasses: false, hasScar: true, role: "héros", power: "terre", accessories: ["cape"] },
    },
    {
      id: "jiro-momose",
      name: "Jiro Momose",
      image: img("jiro-momose", "Garçon aux cheveux roses, bandeau et cape, air espiègle"),
      attributes: { gender: "homme", hairColor: "rose", hasGlasses: false, hasScar: null, role: "rival", power: "ombre", accessories: ["bandeau", "cape"] },
    },
    {
      id: "goro-wakaba",
      name: "Goro Wakaba",
      image: img("goro-wakaba", "Homme aux cheveux verts, lunettes rondes, épée et cape de maître"),
      attributes: { gender: "homme", hairColor: "vert", hasGlasses: true, hasScar: false, role: "mentor", power: "feu", accessories: ["épée", "cape"] },
    },
    {
      id: "ren-fujimura",
      name: "Ren Fujimura",
      image: img("ren-fujimura", "Homme aux cheveux violets, bandeau, épée et cape sombre"),
      attributes: { gender: "homme", hairColor: "violet", hasGlasses: false, hasScar: false, role: "antagoniste", power: "eau", accessories: ["bandeau", "épée", "cape"] },
    },
    {
      id: "mei-kuroda",
      name: "Mei Kuroda",
      image: img("mei-kuroda", "Fille aux cheveux noirs, cicatrice sur la joue, masque relevé"),
      attributes: { gender: "femme", hairColor: "noir", hasGlasses: false, hasScar: true, role: "héros", power: "foudre", accessories: ["masque"] },
    },
    {
      id: "hana-kogane",
      name: "Hana Kogane",
      image: img("hana-kogane", "Fille blonde à lunettes, bandeau doré et masque à la ceinture"),
      attributes: { gender: "femme", hairColor: "blond", hasGlasses: true, hasScar: false, role: "rival", power: "vent", accessories: ["bandeau", "masque"] },
    },
    {
      id: "akane-hiiro",
      name: "Akane Hiiro",
      image: img("akane-hiiro", "Femme rousse, épée au côté et masque de cérémonie"),
      attributes: { gender: "femme", hairColor: "roux", hasGlasses: false, hasScar: false, role: "mentor", power: "terre", accessories: ["épée", "masque"] },
    },
    {
      id: "sumi-hakugin",
      name: "Sumi Hakugin",
      image: img("sumi-hakugin", "Femme aux cheveux blancs, bandeau, épée et masque pâle"),
      attributes: { gender: "femme", hairColor: "blanc", hasGlasses: false, hasScar: false, role: "antagoniste", power: "ombre", accessories: ["bandeau", "épée", "masque"] },
    },
    {
      id: "aoi-mizuno",
      name: "Aoi Mizuno",
      image: img("aoi-mizuno", "Fille aux cheveux bleus, lunettes, cicatrice discrète, cape et masque"),
      attributes: { gender: "femme", hairColor: "bleu", hasGlasses: true, hasScar: true, role: "héros", power: "feu", accessories: ["cape", "masque"] },
    },
    {
      id: "momoka-tsubaki",
      name: "Momoka Tsubaki",
      image: img("momoka-tsubaki", "Fille aux cheveux roses, bandeau fleuri, cape et masque"),
      attributes: { gender: "femme", hairColor: "rose", hasGlasses: false, hasScar: false, role: "rival", power: "eau", accessories: ["bandeau", "cape", "masque"] },
    },
    {
      id: "midori-kashiwa",
      name: "Midori Kashiwa",
      image: img("midori-kashiwa", "Femme aux cheveux verts, épée d'entraînement, cape et masque"),
      attributes: { gender: "femme", hairColor: "vert", hasGlasses: false, hasScar: false, role: "mentor", power: "foudre", accessories: ["épée", "cape", "masque"] },
    },
    {
      id: "sumire-ayakaze",
      name: "Sumire Ayakaze",
      image: img("sumire-ayakaze", "Femme aux cheveux violets, lunettes, équipée de pied en cap"),
      attributes: { gender: "femme", hairColor: "violet", hasGlasses: true, hasScar: false, role: "antagoniste", power: "vent", accessories: ["bandeau", "épée", "cape", "masque"] },
    },
    {
      id: "kagemaru",
      name: "Kagemaru",
      image: img("kagemaru", "Esprit d'ombre aux mèches noires, cicatrice lumineuse, amulette au cou"),
      attributes: { gender: "autre", hairColor: "noir", hasGlasses: false, hasScar: true, role: "héros", power: "terre", accessories: ["amulette"] },
    },
    {
      id: "hoshimaru",
      name: "Hoshimaru",
      image: img("hoshimaru", "Esprit stellaire doré, bandeau céleste et amulette"),
      attributes: { gender: "autre", hairColor: "blond", hasGlasses: false, hasScar: false, role: "rival", power: "ombre", accessories: ["bandeau", "amulette"] },
    },
    {
      id: "tetsuko",
      name: "Tetsuko",
      image: img("tetsuko", "Automate aux fibres rousses, lunettes-viseurs, épée et amulette"),
      attributes: { gender: "autre", hairColor: "roux", hasGlasses: true, hasScar: false, role: "mentor", power: "feu", accessories: ["épée", "amulette"] },
    },
    {
      id: "yukinee",
      name: "Yukinee",
      image: img("yukinee", "Yōkai des neiges aux cheveux blancs, bandeau, épée et amulette gelée"),
      attributes: { gender: "autre", hairColor: "blanc", hasGlasses: false, hasScar: false, role: "antagoniste", power: "eau", accessories: ["bandeau", "épée", "amulette"] },
    },
    {
      id: "raijinbo",
      name: "Raijinbo",
      image: img("raijinbo", "Esprit de la foudre aux cheveux bleus, cicatrice en éclair, cape et amulette"),
      attributes: { gender: "autre", hairColor: "bleu", hasGlasses: false, hasScar: true, role: "héros", power: "foudre", accessories: ["cape", "amulette"] },
    },
    {
      id: "sakuramaru",
      name: "Sakuramaru",
      image: img("sakuramaru", "Esprit des cerisiers aux cheveux roses, lunettes, bandeau, cape et amulette"),
      attributes: { gender: "autre", hairColor: "rose", hasGlasses: true, hasScar: false, role: "rival", power: "vent", accessories: ["bandeau", "cape", "amulette"] },
    },
    {
      id: "mokuren",
      name: "Mokuren",
      image: img("mokuren", "Golem végétal aux feuilles vertes, épée de bois, cape et amulette"),
      attributes: { gender: "autre", hairColor: "vert", hasGlasses: false, hasScar: false, role: "mentor", power: "terre", accessories: ["épée", "cape", "amulette"] },
    },
    {
      id: "yamikage",
      name: "Yamikage",
      image: img("yamikage", "Ombre violette masquée, bandeau, épée, cape et amulette interdite"),
      attributes: { gender: "autre", hairColor: "violet", hasGlasses: false, hasScar: false, role: "antagoniste", power: "ombre", accessories: ["bandeau", "épée", "cape", "masque", "amulette"] },
    },
  ],
});
