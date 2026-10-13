// Les niveaux du démineur, et leurs records (les trois meilleurs temps de chacun, avec un nom).

import { lire, ecrire } from "../../socle/sauvegarde";

export interface Niveau {
  id: string;                              // pour la sauvegarde : demineur/<id>
  nom: string;
  rangees: number;
  colonnes: number;
  mines: number;
  couleur: number;
}

// Les trois niveaux du vrai démineur
export const NIVEAUX: Niveau[] = [
  { id: "facile", nom: "Facile", rangees: 9, colonnes: 9, mines: 10, couleur: 0x5fd068 },
  { id: "moyen", nom: "Moyen", rangees: 16, colonnes: 16, mines: 40, couleur: 0xffc83d },
  { id: "difficile", nom: "Difficile", rangees: 16, colonnes: 30, mines: 99, couleur: 0xff5a50 },
];

export interface Exploit {
  nom: string;
  temps: number;                           // en millisecondes
}

const PLACES = 3;                          // on ne garde que les 3 meilleurs
export const NOM_PAR_DEFAUT = "Anonyme";
const CLE_NOM = "demineur/nom";            // le dernier nom tapé, proposé la fois suivante

// Une sauvegarde abîmée ou bricolée ne doit pas empêcher de jouer : on ne garde que ce qui a la bonne forme
export function lireLesRecords(niveau: Niveau): Exploit[] {
  const lus = lire<unknown>("demineur/" + niveau.id);
  if (!Array.isArray(lus)) {
    return [];
  }
  return lus
    .filter((r): r is Exploit => typeof r?.nom === "string" && typeof r?.temps === "number" && r.temps >= 0)
    .sort((a, b) => a.temps - b.temps)
    .slice(0, PLACES);
}

// Un record s'il reste de la place sur le podium, ou s'il bat le dernier
export function estUnRecord(niveau: Niveau, temps: number): boolean {
  const liste = lireLesRecords(niveau);
  return liste.length < PLACES || temps < liste[liste.length - 1].temps;
}

// Range le record à sa place ; renvoie cette place (0 pour la première), ou -1 s'il ne tient pas
export function ajouterUnRecord(niveau: Niveau, nom: string, temps: number): number {
  const nouveau: Exploit = { nom: nom.trim().slice(0, 12) || NOM_PAR_DEFAUT, temps };
  const liste = [...lireLesRecords(niveau), nouveau].sort((a, b) => a.temps - b.temps).slice(0, PLACES);
  ecrire("demineur/" + niveau.id, liste);
  if (nouveau.nom !== NOM_PAR_DEFAUT) {
    ecrire(CLE_NOM, nouveau.nom);
  }
  return liste.indexOf(nouveau);
}

export function dernierNom(): string {
  const nom = lire<unknown>(CLE_NOM);
  return typeof nom === "string" ? nom.slice(0, 12) : "";
}

// 42345 ms → « 42,3 s » ; au-delà d'une minute → « 2 min 05 s »
export function enSecondes(ms: number): string {
  const s = ms / 1000;
  if (s < 60) {
    return s.toFixed(1).replace(".", ",") + " s";
  }
  const minutes = Math.floor(s / 60);
  return minutes + " min " + String(Math.floor(s % 60)).padStart(2, "0") + " s";
}
