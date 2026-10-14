// La liste des jeux de l'Arcade. Ajouter un jeu : une fiche ici, et un dossier src/jeux/<cle>/.
//
// « charger » utilise import() : le code d'un jeu n'est téléchargé que quand on le lance.
// L'Arcade démarre vite, même avec beaucoup de jeux.

import type Phaser from "phaser";

// Ce que chaque dossier de jeu exporte (dans son index.ts)
export interface ModuleDeJeu {
  scenes: Record<string, typeof Phaser.Scene>;   // nom de la scène → sa classe
  premiere: string;                              // la scène qui démarre le jeu
  donnees?: object;                              // ce qu'elle reçoit au départ (le thème de la course, par exemple)
}

export interface FicheDeJeu {
  cle: string;
  titre: string;
  emoji: string;
  couleur: number;
  charger?: () => Promise<ModuleDeJeu>;          // pas encore de « charger » : le jeu arrive bientôt
}

// Les deux premières cartes lancent le même jeu de course, chacune dans son thème (voir course/index.ts :
// une seule carte, courseAuTheme() sans thème, ferait choisir le thème dans le menu)
export const CATALOGUE: FicheDeJeu[] = [
  {
    cle: "voiture", titre: "Course de voitures", emoji: "🏎️", couleur: 0xe8453c,
    charger: () => import("./course").then((module) => module.courseAuTheme("voitures")),
  },
  {
    cle: "licorne", titre: "Course des licornes", emoji: "🦄", couleur: 0xff8fd0,
    charger: () => import("./course").then((module) => module.courseAuTheme("licornes")),
  },
  {
    cle: "demineur", titre: "Démineur", emoji: "💣", couleur: 0x4fb3ff,
    charger: () => import("./demineur").then((module) => module.default),
  },
  {
    cle: "baston", titre: "Baston de robots", emoji: "🤖", couleur: 0xff9f2e,
    charger: () => import("./baston").then((module) => module.default),
  },
  {
    cle: "platformer", titre: "Platformer", emoji: "🍄", couleur: 0x5fd068,
    charger: () => import("./platformer").then((module) => module.default),
  },
  {
    cle: "tir", titre: "Tir spatial", emoji: "🚀", couleur: 0x5ff0ff,
    charger: () => import("./tir").then((module) => module.default),
  },
  {
    cle: "tamago", titre: "Tamago", emoji: "🥚", couleur: 0xff2d95,
    charger: () => import("./tamago").then((module) => module.default),
  },
  {
    cle: "catapulte", titre: "Catapulte", emoji: "🏰", couleur: 0xdc9a52,
    charger: () => import("./catapulte").then((module) => module.default),
  },
];
