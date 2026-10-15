// Les niveaux : l'Aventure (celle du jeu) et Mon aventure (celle du joueur).
//
// L'AVENTURE ne se modifie pas. Ce sont des fichiers JSON, dans src/jeux/platformer/niveaux/ : un
// fichier par niveau, au format de l'atelier (voir elements.ts). On les lit et on les retouche à la main ;
// un nouveau fichier s'ajoute tout seul à l'Aventure, dans l'ordre des noms de fichier (d'où les deux
// chiffres devant : « 10-le-boss » viendrait sinon avant « 2-... »).
//
// MON AVENTURE est la campagne du joueur : l'éditeur y fait tout (créer, retoucher, renommer, ranger,
// supprimer, ou copier un niveau de l'Aventure pour démarrer). Elle est sauvegardée dans le navigateur
// (lire / ecrire du socle) :
//   platformer/mon-aventure/ordre            la liste des noms, dans l'ordre
//   platformer/mon-aventure/niveau/<nom>     un niveau
// Ses niveaux passent par le même validerNiveau que ceux de l'Aventure : un niveau abîmé est sauté.
//
// Les anciennes sauvegardes de l'éditeur (platformer/ordre, platformer/niveau/<nom>), du temps où il
// retouchait l'Aventure, ne sont pas reprises : oublierLesAnciennesSauvegardes() les efface.

import { lire, ecrire, oublier, oublierTout } from "../../socle/sauvegarde";
import { validerNiveau, type Niveau } from "./elements";
import { SAUVEGARDE } from "./reglages";

// Le nom de la campagne du joueur, partout où le jeu l'écrit (provisoire : il se change ici, d'un coup)
export const MON_AVENTURE = "Mon aventure";

export type Campagne = "aventure" | "mon-aventure";

// import.meta.glob : Vite range ici tous les fichiers du dossier, déjà lus (eager), dans l'ordre des noms
const fichiers = import.meta.glob("./niveaux/*.json", { eager: true, import: "default" });
const AVENTURE: readonly Niveau[] = Object.keys(fichiers).sort()
  .map((chemin) => fichiers[chemin] as Niveau)
  .map((brut) => validerNiveau(brut, brut.nom))
  .filter((niveau): niveau is Niveau => niveau !== null);

// Les noms des niveaux de l'Aventure, dans l'ordre
export function nomsDeLAventure(): string[] {
  return AVENTURE.map((niveau) => niveau.nom);
}

// Un niveau de l'Aventure : une copie, que le jeu (ou une copie dans Mon aventure) peut changer
export function chargerDeLAventure(nom: string): Niveau | null {
  const original = AVENTURE.find((niveau) => niveau.nom === nom);
  return original ? structuredClone(original) : null;
}

// ================================================================ Mon aventure

export const RACINE = SAUVEGARDE + "/mon-aventure";
const ORDRE = RACINE + "/ordre";
const RECORD = RACINE + "/meilleur-score";
const cleDuNiveau = (nom: string) => RACINE + "/niveau/" + nom;

export function nomLibre(nom: string, noms: string[]): boolean {
  if (nom.trim() === "" || nom.length > 30) {
    return false;
  }
  return noms.every((autre) => autre.toLowerCase() !== nom.toLowerCase());
}

// Les noms des niveaux de Mon aventure, dans l'ordre. Un nom dont le niveau n'existe plus est oublié.
export function liste(): string[] {
  const ordre = lire<unknown>(ORDRE);
  const noms = Array.isArray(ordre) ? ordre.filter((nom): nom is string => typeof nom === "string") : [];
  return noms.filter((nom, i) => noms.indexOf(nom) === i && lire(cleDuNiveau(nom)) !== null);
}

export function ranger(noms: string[]) {
  ecrire(ORDRE, noms);
  oublierLeRecord();
}

// Le meilleur score de Mon aventure. Il ne vaut que pour les niveaux tels qu'ils étaient : dès qu'ils
// changent (un niveau retouché, ajouté, rangé, supprimé, un genre changé), il repart de zéro.
export function lireLeRecord(): number {
  return lire<number>(RECORD) ?? 0;
}

// Renvoie vrai pour un nouveau record
export function garderLeRecord(score: number): boolean {
  if (score <= lireLeRecord()) {
    return false;
  }
  ecrire(RECORD, score);
  return true;
}

export function oublierLeRecord() {
  oublier(RECORD);
}

// Le niveau de Mon aventure de ce nom, ou null s'il est introuvable ou abîmé. Une copie neuve à chaque
// fois : le jeu et l'éditeur peuvent la changer sans toucher à la sauvegarde.
export function charger(nom: string): Niveau | null {
  const sauve = lire<unknown>(cleDuNiveau(nom));
  return sauve === null ? null : validerNiveau(sauve, nom);
}

// Enregistre un niveau ; un nom nouveau va à la fin de Mon aventure
export function enregistrer(niveau: Niveau) {
  ecrire(cleDuNiveau(niveau.nom), niveau);
  oublierLeRecord();
  const noms = liste();
  if (!noms.includes(niveau.nom)) {
    ranger([...noms, niveau.nom]);
  }
}

export function supprimer(nom: string) {
  oublier(cleDuNiveau(nom));
  ranger(liste().filter((autre) => autre !== nom));
}

export function renommer(ancien: string, nouveau: string) {
  const niveau = charger(ancien);
  if (!niveau) {
    return;
  }
  const noms = liste();
  ecrire(cleDuNiveau(nouveau), { ...niveau, nom: nouveau });
  oublier(cleDuNiveau(ancien));
  noms[noms.indexOf(ancien)] = nouveau;
  ranger(noms);
}

// Le nom d'une copie : « Grand saut (copie) », puis « (copie 2) »... Un nom trop long est raccourci.
export function nomDeCopie(nom: string, noms: string[]): string {
  for (let k = 1; ; k++) {
    const fin = k === 1 ? " (copie)" : ` (copie ${k})`;
    const essai = nom.slice(0, 30 - fin.length).trimEnd() + fin;
    if (nomLibre(essai, noms)) {
      return essai;
    }
  }
}

// Copie un niveau (de l'Aventure ou de Mon aventure) à la fin de Mon aventure. Renvoie son nom, ou
// null si l'original est introuvable.
export function copier(campagne: Campagne, nom: string): string | null {
  const original = campagne === "aventure" ? chargerDeLAventure(nom) : charger(nom);
  if (!original) {
    return null;
  }
  const copie = nomDeCopie(nom, liste());
  enregistrer({ ...original, nom: copie });
  return copie;
}

// ================================================================ Pour jouer

// Les niveaux qu'on peut jouer, dans l'ordre (un niveau abîmé ou sans départ est sauté). Relus à chaque
// partie : l'éditeur a pu changer Mon aventure.
export function chargerTous(campagne: Campagne): Niveau[] {
  const niveaux = campagne === "aventure" ? AVENTURE.map((niveau) => structuredClone(niveau)) : liste().map(charger);
  return niveaux.filter((niveau): niveau is Niveau => niveau !== null && niveau.elements.some((e) => e.sorte === "depart"));
}

// Le nom d'une campagne, tel que le jeu l'écrit
export function nomDeLaCampagne(campagne: Campagne): string {
  return campagne === "aventure" ? "l'Aventure" : MON_AVENTURE;
}

// Les sauvegardes de l'ancien éditeur, qui retouchait l'Aventure : on repart de zéro. Appelé à chaque
// lancement du jeu (une fois effacées, il n'y a plus rien à faire).
export function oublierLesAnciennesSauvegardes() {
  oublier(SAUVEGARDE + "/ordre");
  oublier(SAUVEGARDE + "/genres");          // les genres de l'ancien éditeur : ceux de Mon aventure sont rangés avec elle
  oublierTout(SAUVEGARDE + "/niveau/");
}
