// Les réglages du galop et les couleurs des licornes : change-les, relance, et sens la différence.
// Ce sont ceux de l'ancien jeu (C:\Data\Jeux\Licorne\js\donnees.js), réglés avec soin : on n'y touche pas.

import type { Conduite, Niveau } from "../../theme";

export const CONDUITE: Conduite = {
  acceleration: 400,
  frein: 700,
  vitesseMax: 500,
  marcheArriere: 150,
  virage: 2.8,
  pivot: 0.6,                              // une licorne n'est pas une voiture : même arrêtée, elle pivote
  frottement: 0.5,                         // la route arc-en-ciel freine un peu
  frottementHorsPiste: 2.6,                // les nuages freinent beaucoup
  adherence: 6,
  adherenceHorsPiste: 2,
  turbo: { duree: 1.6, vitesse: 820, poussee: 2.5, survole: true },   // en turbo, elle vole au-dessus des nuages
  reserveMax: 3,                           // trois étoiles
  taille: 1.1,
  rayonChoc: 20,
  rayonBarriere: 14,                       // le corps s'arrête contre les boules de nuage
  choc: 0.8,
  redresser: 2.5,                          // le nez dans les nuages : ils la tournent dans le sens de la route
  grille: { recul: 80, rangee: 85, decalage: 38 },
  repechage: { sansProgres: 3 },           // une licorne qui n'avance plus depuis 3 secondes revient sur la route
};

export const LARGEUR_ROUTE = 160;
export const LIMITE = LARGEUR_ROUTE / 2 + 75;   // plus loin du milieu de la route : la barrière de nuages

// Les niveaux, à choisir au menu (voir Niveau dans theme.ts)
export const NIVEAUX: Niveau[] = [
  { id: "facile", nom: "🐣 Facile", rivaux: 0.68, horsPiste: 1.3, malus: 0.5, direction: 0.8, elastique: 1 },
  { id: "normal", nom: "🦄 Normal", rivaux: 1, horsPiste: 2.6, malus: 1, direction: 0, elastique: 0.5 },
  { id: "expert", nom: "🔥 Expert", rivaux: 1.08, horsPiste: 2.6, malus: 1, direction: 0, elastique: 0 },
];

// Au doigt, c'est plus difficile qu'au clavier : un coup de pouce de plus, quel que soit le niveau
export const AIDE_DOIGT = { rivaux: 0.95, direction: 0.5 };

// Les sept bandes de la route, du bord extérieur vers le milieu
export const ARC_EN_CIEL = ["#ff5e7e", "#ff9f43", "#ffd93d", "#6bdb8f", "#4fc3ff", "#7b7bff", "#c47dff"];

// Les couleurs de l'interface : des pastels, et un violet pour écrire
export const COULEURS = {
  texte: "#6a4a8c",
  texteDoux: "#8a6aae",
  texteClair: "#a58cc4",
  rose: "#ff5e9e",
  violet: "#b07cff",
  orange: "#e08a00",
  or: "#ffb300",
  argent: "#a0a8c0",
  bronze: "#d08a50",
};

// La police de l'ancien jeu (fournie avec le thème, voir index.ts), puis celles du système
export const POLICE_LICORNE = "Fredoka, Verdana, sans-serif";

// L'ordre d'affichage dans la course : plus le nombre est grand, plus c'est dessus
export const PROFONDEUR = {
  fleches: 1,
  bonbons: 2,
  orages: 3,
  etoiles: 4,
  traine: 5,
  fantome: 6,
  licornes: 10,                            // + l'échelle : les géantes passent par-dessus les autres
};

// L'apparence d'une licorne (l'atelier peut la changer)
export interface Look {
  nom: string;
  corps: string;
  ombre: string;
  criniere: string[];
  corne: string;                           // une couleur, ou "arc" pour une corne arc-en-ciel
  accessoire: string;
}
