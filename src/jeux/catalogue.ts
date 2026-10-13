// La liste des jeux de l'Arcade. Ajouter un jeu : une fiche ici, et un dossier src/jeux/<cle>/.
//
// « charger » utilise import() : le code d'un jeu n'est téléchargé que quand on le lance.
// L'Arcade démarre vite, même avec beaucoup de jeux.

import type Phaser from "phaser";

// Ce que chaque dossier de jeu exporte (dans son index.ts)
export interface ModuleDeJeu {
  scenes: Record<string, typeof Phaser.Scene>;   // nom de la scène → sa classe
  premiere: string;                              // la scène qui démarre le jeu
}

export interface FicheDeJeu {
  cle: string;
  titre: string;
  emoji: string;
  couleur: number;
  charger?: () => Promise<ModuleDeJeu>;          // pas encore de « charger » : le jeu arrive bientôt
}

export const CATALOGUE: FicheDeJeu[] = [
  {
    cle: "voiture", titre: "Course de voitures", emoji: "🏎️", couleur: 0xe8453c,
    charger: () => import("./voiture").then((module) => module.default),
  },
  { cle: "licorne", titre: "Course des licornes", emoji: "🦄", couleur: 0xff8fd0 },
  { cle: "demineur", titre: "Démineur", emoji: "💣", couleur: 0x4fb3ff },
  { cle: "baston", titre: "Baston de robots", emoji: "🤖", couleur: 0xff9f2e },
  { cle: "platformer", titre: "Platformer", emoji: "🍄", couleur: 0x5fd068 },
];
