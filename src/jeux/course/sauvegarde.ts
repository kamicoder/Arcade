// Le thème de la partie, les préférences du joueur, et toutes les sauvegardes du jeu de course.
//
// Les sauvegardes ont une seule forme, la même pour tous les thèmes, et passent par lire / ecrire
// du socle (en JSON) :
//   course/<theme>/niveau              « facile », « normal »...
//   course/<theme>/son                 0 : tout, 1 : sans la musique, 2 : rien
//   course/<theme>/joueurs             [j1, j2] : le numéro du véhicule de chaque joueur dans l'équipe
//   course/<theme>/rivaux              à deux : 0 ou 2 rivaux
//   course/<theme>/circuit             le dernier circuit choisi
//   course/<theme>/circuit-dessine     les points du circuit dessiné
//   course/<theme>/record/<circuit>    le record du tour et son fantôme
//   course/<theme>/perso/<numero>      ce que l'atelier a changé à un véhicule de l'équipe

import type { Theme, Apparence, Niveau } from "./theme";
import type { Instant } from "./Coureur";
import {
  ID_CIRCUIT_DESSINE, POINTS_MIN, modeleDuCircuitDessine, type ModeleDeCircuit, type Point,
} from "./circuits";
import { lire, ecrire, oublier } from "../../socle/sauvegarde";

// ===== Le thème de la partie =====

let actuel: Theme | null = null;

export function themeEnCours(): Theme {
  if (!actuel) {
    throw new Error("Pas de thème : la course commence par sa scène de chargement");
  }
  return actuel;
}

const cle = (nom: string) => "course/" + themeEnCours().id + "/" + nom;

// ===== Les préférences : gardées d'une fois sur l'autre =====

export const preferences = {
  joueurs: [0, 1] as [number, number],     // le numéro du véhicule de chaque joueur
  niveau: 0,                               // dans theme.niveaux
  son: 0,                                  // 0 : tout, 1 : les bruitages sans la musique, 2 : rien
  rivaux: 0,                               // à deux : 0 ou 2 rivaux
};

// Au chargement : le thème choisi, et ses préférences
export function choisirLeTheme(theme: Theme) {
  actuel = theme;
  const taille = theme.equipe.length;
  const [j1, j2] = lire<[number, number]>(cle("joueurs")) ?? [0, 2];   // le premier et le troisième de l'équipe
  preferences.joueurs = [Math.abs(j1 | 0) % taille, Math.abs(j2 | 0) % taille];
  if (preferences.joueurs[0] === preferences.joueurs[1]) {
    preferences.joueurs[1] = (preferences.joueurs[0] + 1) % taille;
  }
  const niveau = lire<string>(cle("niveau")) ?? theme.niveauParDefaut;
  preferences.niveau = Math.max(0, theme.niveaux.findIndex((n) => n.id === niveau));
  preferences.son = Math.abs(Number(lire<number>(cle("son"))) | 0) % 3;
  preferences.rivaux = lire<number>(cle("rivaux")) === 2 ? 2 : 0;
}

export function garderLesJoueurs() {
  ecrire(cle("joueurs"), preferences.joueurs);
}

export function garderLeNiveau() {
  ecrire(cle("niveau"), themeEnCours().niveaux[preferences.niveau].id);
}

export function garderLeSon() {
  ecrire(cle("son"), preferences.son);
}

export function garderLesRivaux() {
  ecrire(cle("rivaux"), preferences.rivaux);
}

export function niveauChoisi(): Niveau {
  return themeEnCours().niveaux[preferences.niveau];
}

// Les aides d'une course : celles du niveau, plus celles du doigt (le doigt est moins précis qu'un clavier)
export function aidesDeLaCourse(auDoigt: boolean): Niveau {
  const niveau = niveauChoisi();
  const doigt = themeEnCours().aideAuDoigt;
  if (!auDoigt) {
    return niveau;
  }
  return {
    ...niveau,
    rivaux: niveau.rivaux * (doigt.rivaux ?? 1),
    horsPiste: Math.min(niveau.horsPiste, doigt.horsPiste ?? Infinity),
    malus: Math.min(niveau.malus, doigt.malus ?? Infinity),
    direction: Math.max(niveau.direction, doigt.direction ?? 0),
    elastique: Math.max(niveau.elastique, doigt.elastique ?? 0),
  };
}

// ===== Les véhicules et l'atelier =====

type Perso = Partial<Apparence>;

// L'apparence d'un véhicule de l'équipe, avec ce que l'atelier a changé
export function apparenceDe(numero: number): Apparence {
  const theme = themeEnCours();
  const base = theme.equipe[numero];
  const perso = lire<Perso>(cle("perso/" + numero)) ?? {};
  const apparence: Apparence = { ...base };
  for (const rubrique of theme.rubriques) {
    const valeur = perso[rubrique.cle];
    // Une valeur gardée qui n'existe plus dans les choix du thème est oubliée
    if (valeur !== undefined && rubrique.choix.some((c) => JSON.stringify(c) === JSON.stringify(valeur))) {
      apparence[rubrique.cle] = valeur;
    }
  }
  // Un nom effacé : on garde celui d'origine (effacer « Paillette » puis taper Z donne « PailletteZ »)
  apparence.nom = typeof perso.nom === "string" && perso.nom !== "" ? perso.nom : base.nom;
  return theme.completer(apparence);
}

// Le nom tel qu'il est gardé, même vide (pendant qu'on le tape)
export function nomGarde(numero: number): string {
  const perso = lire<Perso>(cle("perso/" + numero));
  return typeof perso?.nom === "string" ? perso.nom : themeEnCours().equipe[numero].nom;
}

export function changerApparence(numero: number, champ: string, valeur: string | string[]) {
  const perso = lire<Perso>(cle("perso/" + numero)) ?? {};
  perso[champ] = valeur;
  ecrire(cle("perso/" + numero), perso);
}

export function remettreApparence(numero: number) {
  oublier(cle("perso/" + numero));
}

// ===== Les records du contre-la-montre =====

export interface RecordDuCircuit {
  temps: number;
  fantome: Instant[];
}

export function lireRecord(id: string): RecordDuCircuit | null {
  const record = lire<RecordDuCircuit>(cle("record/" + id));
  return record && typeof record.temps === "number" && Array.isArray(record.fantome) ? record : null;
}

export function ecrireRecord(id: string, record: RecordDuCircuit) {
  ecrire(cle("record/" + id), record);
}

// ===== Les circuits : ceux du thème, et le circuit dessiné =====

export function pointsDessines(): Point[] | null {
  const lu = lire<unknown>(cle("circuit-dessine"));
  if (!Array.isArray(lu) || lu.length < POINTS_MIN) {
    return null;
  }
  const valide = lu.every((p) => typeof p?.x === "number" && typeof p?.y === "number");
  return valide ? lu.map((p: Point) => ({ x: p.x, y: p.y })) : null;
}

// Garde le circuit. Vrai s'il a changé : son ancien record ne compte plus.
export function garderCircuitDessine(points: Point[]): boolean {
  if (JSON.stringify(points) === JSON.stringify(pointsDessines())) {
    return false;
  }
  ecrire(cle("circuit-dessine"), points);
  oublier(cle("record/" + ID_CIRCUIT_DESSINE));
  return true;
}

export function listeDesCircuits(): ModeleDeCircuit[] {
  const theme = themeEnCours();
  const points = pointsDessines();
  return points ? [...theme.circuits, modeleDuCircuitDessine(theme, points)] : theme.circuits;
}

export function circuitParId(id: string): ModeleDeCircuit {
  const liste = listeDesCircuits();
  return liste.find((c) => c.id === id) ?? liste[0];
}

export function lireCircuitChoisi(): string | null {
  return lire<string>(cle("circuit"));
}

export function garderCircuitChoisi(id: string) {
  ecrire(cle("circuit"), id);
}
