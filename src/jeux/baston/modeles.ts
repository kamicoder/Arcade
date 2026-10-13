// Les trois modèles de robots : les plans parmi lesquels chaque joueur choisit.
// Du TypeScript pur : un modèle dit combien il va vite, saute haut, frappe fort, et quels tirs
// lance son coup spécial. C'est le robot (Robot.ts) qui en fait de vrais objets Phaser.

import { TIR } from "./reglages";

// Où est le corps du robot, et de quel côté il regarde : de quoi placer ses tirs
export interface Corps {
  gauche: number;
  droite: number;
  haut: number;
  bas: number;
  centreX: number;
  direction: 1 | -1;                       // 1 : il regarde à droite ; -1 : à gauche
}

// Un tir à lancer : il part de (x, y), vers la droite (1) ou la gauche (-1)
export interface PlanDeTir {
  x: number;
  y: number;
  direction: 1 | -1;
  degats: number;
  taille: number;
}

export interface Modele {
  nom: string;
  vitesse: number;                         // pixels par seconde
  saut: number;                            // la vitesse au moment du saut (négative : vers le haut)
  degats: number;                          // un coup de poing
  special: string;                         // ce que fait son coup spécial, pour l'écran de choix
  tirsSpeciaux: (corps: Corps) => PlanDeTir[];
}

// Le tir de tous les jours : il sort du bras
export function tirNormal(c: Corps): PlanDeTir {
  return { x: c.centreX + c.direction * 40, y: c.haut + 34, direction: c.direction, ...TIR };
}

export const MODELES: Modele[] = [
  {
    nom: "Le classique",
    vitesse: 5 * 60,                       // 5 pixels par tour
    saut: -18 * 60,
    degats: 8,
    special: "Un tir énorme",
    tirsSpeciaux: (c) => [{ x: c.centreX + c.direction * 48, y: c.haut + 34, direction: c.direction, degats: 25, taille: 36 }],
  },
  {
    // Plus lent, il saute moins haut, mais il frappe plus fort
    nom: "Le lourd",
    vitesse: 3 * 60,
    saut: -15 * 60,
    degats: 9,
    special: "Deux ondes de choc au ras du sol",
    tirsSpeciaux: (c) => [
      { x: c.gauche - 20, y: c.bas - 14, direction: -1, degats: 18, taille: 28 },
      { x: c.droite + 20, y: c.bas - 14, direction: 1, degats: 18, taille: 28 },
    ],
  },
  {
    // Rapide, il saute très haut, mais son coup spécial est moins fort
    nom: "Le rapide",
    vitesse: 7 * 60,
    saut: -21 * 60,
    degats: 8,
    special: "Une rafale de trois tirs",
    // Trois hauteurs : un seul peut toucher (la cible devient invincible après le premier)
    tirsSpeciaux: (c) => [10, 34, 58].map((dy) => (
      { x: c.centreX + c.direction * 40, y: c.haut + dy, direction: c.direction, degats: 20, taille: TIR.taille }
    )),
  },
];
