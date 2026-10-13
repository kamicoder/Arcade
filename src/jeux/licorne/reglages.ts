// Les réglages du galop : change-les, relance, et sens la différence.
// Ce sont ceux de l'ancien jeu (C:\Data\Jeux\Licorne\js\donnees.js), réglés avec soin : on n'y touche pas.

export const ACCELERATION = 400;
export const FREIN = 700;
export const VITESSE_MAX = 500;
export const VITESSE_TURBO = 820;
export const MARCHE_ARRIERE = 150;
export const VIRAGE = 2.8;                 // radians par seconde
export const FROTTEMENT = 0.5;             // la route arc-en-ciel freine un peu
export const FROTTEMENT_NUAGE = 2.6;       // les nuages freinent beaucoup
export const ADHERENCE = 6;                // moins, et la licorne glisse
export const ADHERENCE_NUAGE = 2;
export const TOURS = 3;
export const DUREE_TURBO = 1.6;            // secondes de turbo par étoile
export const DUREE_FLECHE = 0.7;           // le petit turbo des flèches arc-en-ciel
export const DUREE_GEANTE = 6;             // le bonbon rend géante pendant ce temps
export const DUREE_ETOURDIE = 1.3;         // un nuage d'orage fait tourner la tête
export const ETOILES_MAX = 3;
export const RETOUR_ETOILE = 6;            // secondes avant qu'une étoile ramassée revienne
export const RETOUR_BONBON = 12;
export const LARGEUR_ROUTE = 160;
export const LIMITE = LARGEUR_ROUTE / 2 + 75;   // plus loin du milieu de la route : la barrière de nuages
export const TAILLE_LICORNE = 1.1;
export const REPECHAGE = 3;                // une licorne qui n'avance plus depuis ce temps (en secondes) est remise sur la route

// Les niveaux, à choisir au menu
//   rivales : leur vitesse ; frottementNuage : combien les nuages du bord freinent ;
//   etourdie : la durée d'un étourdissement ; direction : l'aide au pilotage (0 : aucune) ;
//   elastique : les rivales en tête attendent les joueuses, celles qui traînent se dépêchent (0 : non)
export interface Niveau {
  id: string;
  nom: string;
  rivales: number;
  frottementNuage: number;
  etourdie: number;
  direction: number;
  elastique: number;
}

export const NIVEAUX: Niveau[] = [
  { id: "facile", nom: "🐣 Facile", rivales: 0.68, frottementNuage: 1.3, etourdie: 0.5, direction: 0.8, elastique: 1 },
  { id: "normal", nom: "🦄 Normal", rivales: 1, frottementNuage: 2.6, etourdie: 1, direction: 0, elastique: 0.5 },
  { id: "expert", nom: "🔥 Expert", rivales: 1.08, frottementNuage: 2.6, etourdie: 1, direction: 0, elastique: 0 },
];

// Au doigt, c'est plus difficile qu'au clavier : un coup de pouce de plus, quel que soit le niveau
export const AIDE_DOIGT = { rivales: 0.95, direction: 0.5 };

// Les aides d'une course : celles du niveau, plus celles du doigt
export function aidesDuNiveau(niveau: Niveau, auDoigt: boolean): Niveau {
  if (!auDoigt) {
    return niveau;
  }
  return {
    ...niveau,
    rivales: niveau.rivales * AIDE_DOIGT.rivales,
    direction: Math.max(niveau.direction, AIDE_DOIGT.direction),
  };
}

// Les sept bandes de la route, du bord extérieur vers le milieu
export const ARC_EN_CIEL = ["#ff5e7e", "#ff9f43", "#ffd93d", "#6bdb8f", "#4fc3ff", "#7b7bff", "#c47dff"];

// Les couleurs de l'interface : des pastels, et un violet pour écrire
export const COULEURS = {
  texte: "#6a4a8c",
  texteDoux: "#8a6aae",
  texteClair: "#a58cc4",
  rose: "#ff5e9e",
  violet: "#b07cff",
  orange: "#e08a00",
  or: "#ffb300",
  argent: "#a0a8c0",
  bronze: "#d08a50",
};

// La police de l'ancien jeu (fournie avec le jeu, voir Chargement.ts), puis celles du système
export const POLICE_LICORNE = "Fredoka, Verdana, sans-serif";

// L'ordre d'affichage dans la course : plus le nombre est grand, plus c'est dessus
export const PROFONDEUR = {
  decor: 0,
  fleches: 1,
  bonbons: 2,
  orages: 3,
  etoiles: 4,
  traine: 5,
  fantome: 6,
  licornes: 10,                            // + l'échelle : les géantes passent par-dessus les autres
  gerbes: 20,
  etiquettes: 21,
};
