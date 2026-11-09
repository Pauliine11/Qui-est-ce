import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluate } from "@/domain/engine";
import { chooseMove, type AskedQuestion } from "@/domain/game/ai-opponent";
import { assertValidTheme } from "@/domain/theme.schema";
import { getTheme, themes } from "@/themes/registry";
import { shonenTheme } from "@/themes/shonen";

/** Générateur déterministe (mulberry32), comme dans ai-opponent.test.ts. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("registre des thèmes", () => {
  it("valide chaque thème avec themeSchema", () => {
    expect(themes.length).toBeGreaterThan(0);
    for (const theme of themes) {
      expect(() => assertValidTheme(theme)).not.toThrow();
    }
  });

  it("retrouve un thème par id, null sinon", () => {
    expect(getTheme("shonen")?.id).toBe("shonen");
    expect(getTheme("inconnu")).toBeNull();
  });

  it("toutes les images référencées existent dans public/", () => {
    for (const theme of themes) {
      const files = [theme.cover.src, ...theme.characters.map((c) => c.image.src)];
      for (const src of files) {
        expect(existsSync(join(process.cwd(), "public", src)), `image manquante : ${src}`).toBe(true);
      }
    }
  });
});

describe("thème shōnen : résolubilité", () => {
  it("l'IA difficile trouve chaque personnage en 8 tours max", () => {
    for (const secret of shonenTheme.characters) {
      const history: AskedQuestion[] = [];
      const wrongGuesses: string[] = [];
      const random = seeded(7);
      let found = false;
      for (let turn = 1; turn <= 8; turn++) {
        const move = chooseMove({
          theme: shonenTheme,
          history,
          wrongGuesses,
          difficulty: "hard",
          canAsk: true,
          random,
        });
        if (move.type === "ask") {
          history.push({ analysis: move.analysis, answer: evaluate(move.analysis, secret, shonenTheme) });
        } else if (move.characterId === secret.id) {
          found = true;
          break;
        } else {
          wrongGuesses.push(move.characterId);
        }
      }
      expect(found, `secret non trouvé en 8 tours : ${secret.id}`).toBe(true);
    }
  });
});
