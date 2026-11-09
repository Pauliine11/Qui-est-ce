import type { AnyTheme } from "@/domain/theme.types";
import { shonenTheme } from "./shonen";

/** Registre des thèmes jouables. Chaque thème est validé par un test dédié. */
export const themes: readonly AnyTheme[] = [shonenTheme];

export function getTheme(id: string): AnyTheme | null {
  return themes.find((theme) => theme.id === id) ?? null;
}
