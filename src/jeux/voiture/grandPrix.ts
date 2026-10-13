// Le Grand Prix : tous les circuits l'un après l'autre, et des points à chaque arrivée.
// Pas de Phaser ici : l'état du Grand Prix voyage d'une scène à l'autre dans les données de
// scene.start(), alors on le garde simple, et on en fabrique un nouveau au lieu de le modifier.

import { CIRCUITS, type ModeleDeCircuit } from "./circuits";
import { JOUEUR, RIVAUX, NIVEAUX_GRAND_PRIX, POINTS_GRAND_PRIX } from "./reglages";

export interface Concurrent {
  nom: string;
  couleur: number;
  points: number;
}

export interface GrandPrix {
  course: number;                          // la course en cours (ou qui vient de finir) : 0 pour la première
  concurrents: Concurrent[];
}

export function nouveauGrandPrix(): GrandPrix {
  return {
    course: 0,
    concurrents: [JOUEUR, ...RIVAUX].map(({ nom, couleur }) => ({ nom, couleur, points: 0 })),
  };
}

export const NOMBRE_DE_COURSES = CIRCUITS.length;

export function circuitDeLaCourse(gp: GrandPrix): ModeleDeCircuit {
  return CIRCUITS[gp.course];
}

export function niveauDeLaCourse(gp: GrandPrix): number {
  return NIVEAUX_GRAND_PRIX[Math.min(gp.course, NIVEAUX_GRAND_PRIX.length - 1)];
}

export function estLaDerniere(gp: GrandPrix): boolean {
  return gp.course >= NOMBRE_DE_COURSES - 1;
}

// arrivee : les noms des pilotes, du premier au dernier
export function compterLesPoints(gp: GrandPrix, arrivee: string[]): GrandPrix {
  return {
    ...gp,
    concurrents: gp.concurrents.map((c) => {
      const place = arrivee.indexOf(c.nom);
      return { ...c, points: c.points + (place >= 0 ? POINTS_GRAND_PRIX[place] ?? 0 : 0) };
    }),
  };
}

export function courseSuivante(gp: GrandPrix): GrandPrix {
  return { ...gp, course: gp.course + 1 };
}

// Du plus de points au moins de points (à égalité, l'ordre de départ : sort garde l'ordre)
export function classementDuGrandPrix(gp: GrandPrix): Concurrent[] {
  return gp.concurrents.slice().sort((a, b) => b.points - a.points);
}
