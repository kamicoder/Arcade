// Ce qui reste d'un Tamago à l'autre : l'album (chaque Tamago, et comment il est parti) et le carnet
// d'amis (les visiteurs déjà venus). Le Tamago lui-même est sauvegardé à part (tamago/etat).

import { lire, ecrire } from "../../socle/sauvegarde";
import { SAUVEGARDE } from "./reglages";
import type { Etat, Fin } from "./vie";
import { formeDe, ageEnAnnees } from "./vie";

export interface Souvenir {
  nom: string;
  emoji: string;
  caractere: string;
  ans: number;
  age?: number;                            // son âge en temps de jeu (absent des souvenirs d'avant les mois)
  fin: Fin;
  date: string;                            // le jour de son départ, « 14/10/2026 »
}

export interface Ami {
  emoji: string;
  visites: number;
}

const ALBUM = SAUVEGARDE + "/album";
const AMIS = SAUVEGARDE + "/amis";
export const ETAT = SAUVEGARDE + "/etat";

export function album(): Souvenir[] {
  const liste = lire<Souvenir[]>(ALBUM);
  return Array.isArray(liste) ? liste : [];
}

export function garderEnSouvenir(e: Etat) {
  const forme = formeDe(e);
  const souvenir: Souvenir = {
    nom: forme.nom, emoji: forme.emoji, caractere: forme.caractere, ans: ageEnAnnees(e), age: e.age, fin: e.fin ?? "vieillesse",
    date: new Date().toLocaleDateString("fr-FR"),
  };
  ecrire(ALBUM, [souvenir, ...album()]);
}

export function amis(): Record<string, Ami> {
  const carnet = lire<Record<string, Ami>>(AMIS);
  return carnet && typeof carnet === "object" ? carnet : {};
}

// Renvoie vrai pour un nouvel ami
export function recevoirUnVisiteur(nom: string, emoji: string): boolean {
  const carnet = amis();
  const nouveau = !carnet[nom];
  carnet[nom] = { emoji, visites: (carnet[nom]?.visites ?? 0) + 1 };
  ecrire(AMIS, carnet);
  return nouveau;
}
