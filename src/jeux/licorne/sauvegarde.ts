// Les sauvegardes de la course des licornes : les mêmes noms que l'ancien jeu (licornes-...), sur le même
// site (kamicoder.github.io), pour que les records, les licornes de l'atelier et le circuit dessiné suivent.
//
// Piège : l'ancien jeu rangeait deux réglages en texte brut (licornes-niveau : facile, licornes-circuit-id :
// coeur), pas en JSON. Le lire() du socle les refuserait, et son ecrire() les entourerait de guillemets,
// que l'ancien jeu ne reconnaîtrait plus. Pour ces deux-là, on lit et on écrit le texte tel quel.

import { lire, ecrire, oublier } from "../../socle/sauvegarde";
import {
  LICORNES, CIRCUITS, modeleDuCircuitPerso, POINTS_MIN_EDITEUR, type Look, type ModeleDeCircuit,
} from "./donnees";
import { NIVEAUX } from "./reglages";
import type { Point } from "./circuits";
import type { Instant } from "./Coureuse";

export const PREFIXE = "licornes-";

const CLES = {
  niveau: PREFIXE + "niveau",              // texte brut
  circuitId: PREFIXE + "circuit-id",       // texte brut
  j1: PREFIXE + "j1",                      // des nombres : en JSON comme en texte, c'est pareil
  j2: PREFIXE + "j2",
  son: PREFIXE + "son",
  rivales: PREFIXE + "rivales",
  perso: PREFIXE + "perso",                // les licornes de l'atelier, par numéro
  circuitPerso: PREFIXE + "circuit-perso", // les points du circuit dessiné
  record: (id: string) => PREFIXE + "record-" + id,
};

function lireTexte(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireTexte(cle: string, valeur: string) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    // pas de sauvegarde, tant pis
  }
}

function lireNombre(cle: string): number {
  return Number(lire<number>(cle)) || 0;
}

// ===== Les préférences : gardées d'une fois sur l'autre =====

const choixInitial = (): [number, number] => {
  const j1 = lireNombre(CLES.j1) % LICORNES.length;
  let j2 = (Number(lire<number>(CLES.j2)) || 2) % LICORNES.length;   // comme l'ancien jeu : 0 devient 2
  if (j1 === j2) {
    j2 = (j1 + 1) % LICORNES.length;
  }
  return [j1, j2];
};

export const preferences = {
  choix: choixInitial(),                   // le numéro de la licorne de chaque joueuse
  niveau: Math.max(0, NIVEAUX.findIndex((n) => n.id === lireTexte(CLES.niveau))),
  son: lireNombre(CLES.son) % 3,           // 0 : tout, 1 : les bruitages sans la musique, 2 : rien
  rivales: lireNombre(CLES.rivales),       // en course à deux : 0 ou 2 rivales
};

export function garderLesChoix() {
  ecrire(CLES.j1, preferences.choix[0]);
  ecrire(CLES.j2, preferences.choix[1]);
}

export function garderLeNiveau() {
  ecrireTexte(CLES.niveau, NIVEAUX[preferences.niveau].id);
}

export function garderLeSon() {
  ecrire(CLES.son, preferences.son);
}

export function garderLesRivales() {
  ecrire(CLES.rivales, preferences.rivales);
}

export function lireCircuitChoisi(): string | null {
  return lireTexte(CLES.circuitId);
}

export function garderCircuitChoisi(id: string) {
  ecrireTexte(CLES.circuitId, id);
}

// ===== Les licornes de l'atelier =====

type LooksPerso = Record<string, Omit<Look, "ombre">>;

// Une couleur #rrvvbb un peu plus sombre
export function assombrir(hex: string, part: number): string {
  const n = parseInt(hex.slice(1), 16);
  const canal = (v: number) => Math.max(0, Math.round(v * (1 - part))).toString(16).padStart(2, "0");
  return "#" + canal((n >> 16) & 255) + canal((n >> 8) & 255) + canal(n & 255);
}

// L'apparence d'une licorne, avec ce que l'atelier a changé
export function lookDe(numero: number): Look {
  const base = LICORNES[numero];
  const perso = (lire<LooksPerso>(CLES.perso) ?? {})[numero];
  if (!perso) {
    return base;
  }
  return {
    nom: perso.nom || base.nom,
    corps: perso.corps,
    ombre: assombrir(perso.corps, 0.14),
    criniere: perso.criniere,
    corne: perso.corne,
    accessoire: perso.accessoire || "aucun",
  };
}

export function changerLook(numero: number, modifier: (look: Omit<Look, "ombre">) => void) {
  const tous = lire<LooksPerso>(CLES.perso) ?? {};
  const look = lookDe(numero);
  // Le nom tel qu'il est gardé, même vide : lookDe le remplace alors par celui d'origine, et l'ancien jeu
  // repartait de là (effacer « Paillette » puis taper Z donnait « PailletteZ »)
  const nom = tous[numero]?.nom ?? look.nom;
  const copie = { nom, corps: look.corps, criniere: look.criniere, corne: look.corne, accessoire: look.accessoire };
  modifier(copie);
  tous[numero] = copie;
  ecrire(CLES.perso, tous);
}

export function remettreLook(numero: number) {
  const tous = lire<LooksPerso>(CLES.perso) ?? {};
  delete tous[numero];
  ecrire(CLES.perso, tous);
}

// ===== Les records du contre-la-montre =====

export interface RecordDuCircuit {
  temps: number;
  fantome: Instant[];
}

export function lireRecord(id: string): RecordDuCircuit | null {
  return lire<RecordDuCircuit>(CLES.record(id));
}

export function ecrireRecord(id: string, record: RecordDuCircuit) {
  ecrire(CLES.record(id), record);
}

// ===== Le circuit dessiné =====

export function circuitPerso(): ModeleDeCircuit | null {
  const points = lire<Point[]>(CLES.circuitPerso);
  if (!Array.isArray(points) || points.length < POINTS_MIN_EDITEUR) {
    return null;
  }
  return modeleDuCircuitPerso(points);
}

// Un nouveau circuit : l'ancien record n'a plus de sens
export function garderCircuitPerso(points: Point[]) {
  ecrire(CLES.circuitPerso, points);
  oublier(CLES.record("perso"));
  garderCircuitChoisi("perso");
}

export function listeDesCircuits(): ModeleDeCircuit[] {
  const perso = circuitPerso();
  return perso ? [...CIRCUITS, perso] : CIRCUITS;
}

export function circuitParId(id: string): ModeleDeCircuit {
  return listeDesCircuits().find((c) => c.id === id) ?? CIRCUITS[0];
}
