// Les genres de plateforme : normale, glace, ressort, lave...
//
// Chaque genre a sa FICHE : sa couleur, s'il est solide (on marche dessus) et son effet sur le joueur.
// Les genres de départ ont une image (public/platformer/images/plateformes/<genre>.png), répétée en
// tuiles sur toute la plateforme ; un genre inventé dans l'éditeur se montre de sa couleur.
// La force de l'effet et le sens d'un tapis roulant, eux, se règlent sur chaque plateforme posée.
// Les fiches sont sauvegardées (platformer/mon-aventure/genres) dès que l'éditeur en change une. L'Aventure, elle,
// se joue toujours avec les genres de départ : ce que le joueur change ne touche que ses niveaux.

import { lire, ecrire } from "../../socle/sauvegarde";
import { RACINE, oublierLeRecord } from "./niveaux";

export type Effet = "" | "glisse" | "rebond" | "mortel" | "tapis" | "ecroule" | "eau" | "teleporte";

export interface Fiche {
  couleur: [number, number, number];
  solide: boolean;
  effet: Effet;
}

export const EFFETS: Record<Effet, string> = {
  "": "Rien", glisse: "Glisse", rebond: "Rebondit", mortel: "Mortel",
  tapis: "Tapis roulant", ecroule: "S'écroule", eau: "Eau", teleporte: "Téléporteur",
};

// Ce que dit la fenêtre d'un genre, pour chaque effet
export const EXPLICATIONS: Record<Effet, string> = {
  "": "Une plateforme toute simple.",
  glisse: "On y glisse : on met du temps à démarrer et à s'arrêter.",
  rebond: "On y rebondit, plus haut qu'un saut.",
  mortel: "La toucher coûte une vie.",
  tapis: "Elle emporte le joueur posé dessus.",
  ecroule: "Elle s'écroule un instant après qu'on s'y est posé.",
  eau: "On y coule doucement ; chaque saut fait nager.",
  teleporte: "Elle envoie le joueur sur la suivante du même genre.",
};

// Les effets qui ont une force (de 1 à 3) : ce qu'elle règle, et le nom de chaque force
export const LES_FORCES: Partial<Record<Effet, [string, string[]]>> = {
  glisse: ["Elle glisse", ["Un peu", "Moyen", "Beaucoup"]],
  rebond: ["Elle fait rebondir", ["Un peu", "Moyen", "Beaucoup"]],
  tapis: ["Le tapis avance", ["Lentement", "Moyen", "Vite"]],
  ecroule: ["Elle s'écroule", ["Lentement", "Moyen", "Vite"]],
};

export const MAXIMUM = 15;                 // pas plus de genres : la palette de l'éditeur n'a que 3 rangées
const NORMALE: Fiche = { couleur: [90, 180, 90], solide: true, effet: "" };   // toujours solide, sans effet

export const DE_DEPART: Record<string, Fiche> = {
  normale: NORMALE,
  glace: { couleur: [165, 225, 250], solide: true, effet: "glisse" },
  ressort: { couleur: [239, 68, 68], solide: true, effet: "rebond" },
  lave: { couleur: [234, 88, 12], solide: false, effet: "mortel" },
  decor: { couleur: [60, 100, 70], solide: false, effet: "" },
  tapis: { couleur: [120, 120, 135], solide: true, effet: "tapis" },
  fragile: { couleur: [200, 140, 80], solide: true, effet: "ecroule" },
  eau: { couleur: [50, 110, 210], solide: false, effet: "eau" },
  teleporteur: { couleur: [170, 90, 220], solide: true, effet: "teleporte" },
};

// Les genres qui ont leur image dans public/platformer/images/plateformes/
export const AVEC_IMAGE = ["decor", "eau", "fragile", "glace", "lave", "ressort", "tapis", "teleporteur"];

const CLE = RACINE + "/genres";

export class Genres {
  fiches: Record<string, Fiche> = {};

  // sauvegardes = false : les genres de départ, tels quels (pour jouer l'Aventure)
  constructor(private readonly sauvegardes = true) {
    this.charger();
  }

  // Une sauvegarde absente ou abîmée : les genres de départ. Une fiche abîmée : laissée de côté.
  charger() {
    let lues = this.sauvegardes ? lire<Record<string, unknown>>(CLE) : null;
    if (!lues || typeof lues !== "object" || Array.isArray(lues)) {
      lues = DE_DEPART as unknown as Record<string, unknown>;
    }
    this.fiches = {};
    for (const [nom, brute] of Object.entries(lues).slice(0, MAXIMUM)) {
      const fiche = brute as Partial<Fiche>;
      if (!Array.isArray(fiche?.couleur) || fiche.couleur.length !== 3) {
        continue;
      }
      const couleur = fiche.couleur.map((v) => Math.min(Math.max(Math.round(Number(v)) || 0, 0), 255)) as Fiche["couleur"];
      const effet = (fiche.effet ?? "") in EFFETS ? fiche.effet as Effet : "";   // un effet inconnu : aucun effet
      this.fiches[nom] = { couleur, solide: fiche.solide === true, effet };
    }
    // La normale existe toujours, solide et sans effet : c'est elle que jouent l'Infini et le duo
    this.fiches.normale = { ...NORMALE, couleur: this.fiches.normale?.couleur ?? NORMALE.couleur };
  }

  // Un genre changé change Mon aventure : son record ne vaut plus
  enregistrer() {
    ecrire(CLE, this.fiches);
    oublierLeRecord();
  }

  // Un genre inconnu (supprimé, mal écrit) se comporte comme la normale
  fiche(genre: string): Fiche {
    return this.fiches[genre] ?? this.fiches.normale;
  }

  solide(genre: string): boolean {
    return this.fiche(genre).solide;
  }

  effet(genre: string): Effet {
    return this.fiche(genre).effet;
  }

  nomLibre(nom: string): boolean {
    if (nom === "" || Object.keys(this.fiches).length >= MAXIMUM) {
      return false;
    }
    return Object.keys(this.fiches).every((autre) => autre.toLowerCase() !== nom.toLowerCase());
  }

  // Un nouveau genre, d'une couleur au hasard : solide, sans effet. Sa fenêtre permet de le changer.
  ajouter(nom: string) {
    const auHasard = () => 60 + Math.floor(Math.random() * 160);
    this.fiches[nom] = { couleur: [auHasard(), auHasard(), auHasard()], solide: true, effet: "" };
    this.enregistrer();
  }

  supprimer(nom: string) {
    delete this.fiches[nom];
    this.enregistrer();
  }
}

// La clé de la texture d'un genre (voir textures.ts)
export function textureDuGenre(genre: string, fiche: Fiche): string {
  return AVEC_IMAGE.includes(genre) ? "platformer-genre-" + genre : "platformer-couleur-" + fiche.couleur.join("-");
}
