// Les thèmes du jeu de course. Un nouveau thème : son dossier, et une ligne ici.

import type { Theme } from "../theme";
import { voitures } from "./voitures";
import { licornes } from "./licornes";

export const THEMES: Theme[] = [voitures, licornes];

export function themeParId(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
