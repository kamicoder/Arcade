// Les niveaux de l'Aventure.
//
// Les niveaux de départ sont des fichiers JSON, dans src/jeux/platformer/niveaux/ : un fichier par
// niveau, au format de l'atelier (voir elements.ts). On peut les lire et les retoucher à la main ;
// un nouveau fichier s'ajoute tout seul à l'Aventure, dans l'ordre des noms de fichier (d'où les deux
// chiffres devant : « 10-le-boss » viendrait sinon avant « 2-... »).
//
// L'éditeur sauvegarde dans le navigateur (lire / ecrire du socle) :
//   platformer/ordre            la liste des noms, dans l'ordre de l'Aventure
//   platformer/niveau/<nom>     un niveau créé, ou un niveau de départ retouché
// Un nom se lit d'abord dans les sauvegardes, puis dans les niveaux de départ. Supprimer un niveau de
// départ ne fait que le retirer de l'ordre : « Remettre les niveaux de départ » le fait revenir.

import { lire, ecrire, oublier } from "../../socle/sauvegarde";
import { validerNiveau, type Niveau } from "./elements";
import { SAUVEGARDE } from "./reglages";

// import.meta.glob : Vite range ici tous les fichiers du dossier, déjà lus (eager), dans l'ordre des noms
const fichiers = import.meta.glob("./niveaux/*.json", { eager: true, import: "default" });
export const DE_DEPART: Niveau[] = Object.keys(fichiers).sort()
  .map((chemin) => fichiers[chemin] as Niveau)
  .map((brut) => validerNiveau(brut, brut.nom))
  .filter((niveau): niveau is Niveau => niveau !== null);

const ORDRE = SAUVEGARDE + "/ordre";
const cleDuNiveau = (nom: string) => SAUVEGARDE + "/niveau/" + nom;

const deDepart = (nom: string) => DE_DEPART.find((niveau) => niveau.nom === nom);

export function nomLibre(nom: string, noms: string[]): boolean {
  if (nom.trim() === "" || nom.length > 30) {
    return false;
  }
  return noms.every((autre) => autre.toLowerCase() !== nom.toLowerCase());
}

// Les noms des niveaux, dans l'ordre de l'Aventure. Un nom dont le niveau n'existe plus est oublié.
export function liste(): string[] {
  const ordre = lire<unknown>(ORDRE);
  const noms = Array.isArray(ordre) ? ordre.filter((nom): nom is string => typeof nom === "string")
    : DE_DEPART.map((niveau) => niveau.nom);
  return noms.filter((nom, i) => noms.indexOf(nom) === i && (lire(cleDuNiveau(nom)) !== null || deDepart(nom)));
}

export function ranger(noms: string[]) {
  ecrire(ORDRE, noms);
}

// Le niveau de ce nom, ou null s'il est introuvable ou abîmé. On renvoie toujours une copie : le jeu
// et l'éditeur peuvent la changer sans toucher à l'original.
export function charger(nom: string): Niveau | null {
  const sauve = lire<unknown>(cleDuNiveau(nom));
  if (sauve !== null) {
    return validerNiveau(sauve, nom);
  }
  const original = deDepart(nom);
  return original ? structuredClone(original) : null;
}

export function enregistrer(niveau: Niveau) {
  ecrire(cleDuNiveau(niveau.nom), niveau);
}

// Le niveau de départ de ce nom, retouché dans l'éditeur ?
export function estRetouche(nom: string): boolean {
  return deDepart(nom) !== undefined && lire(cleDuNiveau(nom)) !== null;
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
  enregistrer({ ...niveau, nom: nouveau });
  oublier(cleDuNiveau(ancien));
  noms[noms.indexOf(ancien)] = nouveau;
  ranger(noms);
}

// Les niveaux de départ qui manquent reviennent à la fin, tels qu'ils étaient au départ
export function remettreLesNiveauxDeDepart() {
  const noms = liste();
  for (const niveau of DE_DEPART) {
    oublier(cleDuNiveau(niveau.nom));
    if (!noms.includes(niveau.nom)) {
      noms.push(niveau.nom);
    }
  }
  ranger(noms);
}

// Les niveaux de l'Aventure qu'on peut jouer, dans l'ordre (un niveau abîmé ou sans départ est sauté).
// Relus à chaque partie : l'éditeur a pu les changer.
export function chargerTous(): Niveau[] {
  return liste().map(charger)
    .filter((niveau): niveau is Niveau => niveau !== null && niveau.elements.some((e) => e.sorte === "depart"));
}
