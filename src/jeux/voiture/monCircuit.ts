// Le circuit que tu dessines : ses points sont sauvegardés, et il devient un circuit de plus dans le menu.
// Mêmes noms de sauvegarde que l'ancien jeu : un circuit dessiné là-bas se retrouve ici.

import { CIRCUITS, type ModeleDeCircuit, type Point } from "./circuits";
import { SAUVEGARDE } from "./reglages";
import { lire, ecrire, oublier } from "../../socle/sauvegarde";

export const ID_MON_CIRCUIT = "circuit-dessine";
export const MONDE_EDITEUR = { largeur: 2600, hauteur: 1800 };
export const POINTS_MIN = 4;               // moins, ce n'est pas un circuit
export const POINTS_MAX = 10;              // assez pour un beau circuit, pas trop pour s'y perdre
export const MARGE = 100;                  // un point ne colle pas au bord du monde : la route doit y tenir

const CLE_DES_POINTS = SAUVEGARDE + "/points-du-circuit";

export function modeleDeMonCircuit(points: Point[]): ModeleDeCircuit {
  return {
    id: ID_MON_CIRCUIT,
    nom: "Mon circuit",
    largeur: MONDE_EDITEUR.largeur,
    hauteur: MONDE_EDITEUR.hauteur,
    points,
    bidons: [[0.3, 0], [0.7, 0]],
    fleches: [[0.1, 0]],
    huiles: [],
  };
}

// Les points sauvegardés, ou rien. Une sauvegarde abîmée compte pour rien : on ne plante pas.
export function lireMesPoints(): Point[] | null {
  const lu = lire<unknown>(CLE_DES_POINTS);
  if (!Array.isArray(lu) || lu.length < POINTS_MIN) {
    return null;
  }
  const valide = lu.every((p) => typeof p?.x === "number" && typeof p?.y === "number");
  return valide ? lu.map((p: Point) => ({ x: p.x, y: p.y })) : null;
}

export function lireMonCircuit(): ModeleDeCircuit | null {
  const points = lireMesPoints();
  return points ? modeleDeMonCircuit(points) : null;
}

// Les circuits du jeu, et le tien à la fin s'il existe
export function tousLesCircuits(): ModeleDeCircuit[] {
  const mien = lireMonCircuit();
  return mien ? [...CIRCUITS, mien] : CIRCUITS;
}

// Garde le circuit. Renvoie vrai s'il a changé : son ancien record ne compte plus.
export function enregistrerMonCircuit(points: Point[]): boolean {
  if (JSON.stringify(points) === JSON.stringify(lireMesPoints())) {
    return false;
  }
  ecrire(CLE_DES_POINTS, points);
  oublier(SAUVEGARDE + "/" + ID_MON_CIRCUIT);
  return true;
}

// Un point posé : arrondi, et pas trop près du bord du monde
export function dansLeMonde(x: number, y: number): Point {
  return {
    x: Math.round(Math.min(Math.max(x, MARGE), MONDE_EDITEUR.largeur - MARGE)),
    y: Math.round(Math.min(Math.max(y, MARGE), MONDE_EDITEUR.hauteur - MARGE)),
  };
}
