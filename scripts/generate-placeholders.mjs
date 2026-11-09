/**
 * Génère les portraits placeholders SVG du thème shōnen dans
 * public/themes/shonen/. Usage : node scripts/generate-placeholders.mjs
 * Les données visuelles (couleur, lunettes…) dupliquent volontairement le
 * thème : elles n'influencent que le dessin, pas le jeu.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "themes", "shonen");

const HAIR = {
  noir: "#1f2937",
  blond: "#f59e0b",
  roux: "#ea580c",
  blanc: "#e5e7eb",
  bleu: "#3b82f6",
  rose: "#f472b6",
  vert: "#22c55e",
  violet: "#8b5cf6",
};

const ROLE_BG = {
  "héros": "#fef3c7",
  rival: "#dbeafe",
  mentor: "#dcfce7",
  antagoniste: "#fce7f3",
};

// id, nom, cheveux, lunettes, cicatrice, rôle
const CHARACTERS = [
  ["kaito-renji", "Kaito Renji", "noir", true, true, "héros"],
  ["sora-tatsuki", "Sora Tatsuki", "blond", false, false, "rival"],
  ["renzo-akaba", "Renzo Akaba", "roux", false, false, "mentor"],
  ["haru-shirogane", "Haru Shirogane", "blanc", true, false, "antagoniste"],
  ["tomo-aozora", "Tomo Aozora", "bleu", false, true, "héros"],
  ["jiro-momose", "Jiro Momose", "rose", false, false, "rival"],
  ["goro-wakaba", "Goro Wakaba", "vert", true, false, "mentor"],
  ["ren-fujimura", "Ren Fujimura", "violet", false, false, "antagoniste"],
  ["mei-kuroda", "Mei Kuroda", "noir", false, true, "héros"],
  ["hana-kogane", "Hana Kogane", "blond", true, false, "rival"],
  ["akane-hiiro", "Akane Hiiro", "roux", false, false, "mentor"],
  ["sumi-hakugin", "Sumi Hakugin", "blanc", false, false, "antagoniste"],
  ["aoi-mizuno", "Aoi Mizuno", "bleu", true, true, "héros"],
  ["momoka-tsubaki", "Momoka Tsubaki", "rose", false, false, "rival"],
  ["midori-kashiwa", "Midori Kashiwa", "vert", false, false, "mentor"],
  ["sumire-ayakaze", "Sumire Ayakaze", "violet", true, false, "antagoniste"],
  ["kagemaru", "Kagemaru", "noir", false, true, "héros"],
  ["hoshimaru", "Hoshimaru", "blond", false, false, "rival"],
  ["tetsuko", "Tetsuko", "roux", true, false, "mentor"],
  ["yukinee", "Yukinee", "blanc", false, false, "antagoniste"],
  ["raijinbo", "Raijinbo", "bleu", false, true, "héros"],
  ["sakuramaru", "Sakuramaru", "rose", true, false, "rival"],
  ["mokuren", "Mokuren", "vert", false, false, "mentor"],
  ["yamikage", "Yamikage", "violet", false, false, "antagoniste"],
];

function portrait(name, hair, glasses, scar, role) {
  const hairHex = HAIR[hair];
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300" role="img">
  <rect width="240" height="300" rx="16" fill="${ROLE_BG[role]}"/>
  <circle cx="120" cy="130" r="62" fill="#f5d0a9"/>
  <path d="M 58 130 A 62 62 0 0 1 182 130 L 182 112 Q 120 46 58 112 Z" fill="${hairHex}"/>
  <circle cx="98" cy="138" r="6" fill="#1f2937"/>
  <circle cx="142" cy="138" r="6" fill="#1f2937"/>
  <path d="M 106 166 Q 120 176 134 166" stroke="#92400e" stroke-width="4" fill="none" stroke-linecap="round"/>
  ${glasses ? '<g stroke="#334155" stroke-width="4" fill="none"><rect x="84" y="126" width="28" height="22" rx="6"/><rect x="128" y="126" width="28" height="22" rx="6"/><line x1="112" y1="136" x2="128" y2="136"/></g>' : ""}
  ${scar ? '<line x1="146" y1="110" x2="160" y2="128" stroke="#b91c1c" stroke-width="4" stroke-linecap="round"/>' : ""}
  <text x="120" y="236" text-anchor="middle" font-family="system-ui, sans-serif" font-size="40" font-weight="700" fill="${hairHex}">${initials}</text>
  <text x="120" y="272" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="#334155">${name}</text>
</svg>
`;
}

const cover = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300" role="img">
  <rect width="480" height="300" rx="16" fill="#0ea5e9"/>
  <circle cx="90" cy="80" r="40" fill="#fef3c7" opacity="0.9"/>
  <path d="M 0 240 L 120 150 L 220 220 L 330 130 L 480 230 L 480 300 L 0 300 Z" fill="#0369a1"/>
  <text x="240" y="120" text-anchor="middle" font-family="system-ui, sans-serif" font-size="44" font-weight="800" fill="#ffffff">Académie Tenkū</text>
  <text x="240" y="160" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="#e0f2fe">24 héros originaux</text>
</svg>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "cover.svg"), cover);
for (const [id, name, hair, glasses, scar, role] of CHARACTERS) {
  writeFileSync(join(OUT, `${id}.svg`), portrait(name, hair, glasses, scar, role));
}
console.log(`${CHARACTERS.length + 1} fichiers SVG écrits dans ${OUT}`);
