// Les réglages de la course : change-les, relance, et sens la différence au volant.

// La conduite
export const ACCELERATION = 380;           // pixels par seconde gagnés chaque seconde où on accélère
export const FREIN = 700;                  // pixels par seconde perdus chaque seconde où on freine
export const VITESSE_MAX = 520;
export const MARCHE_ARRIERE = 160;         // la vitesse la plus grande en reculant
export const VIRAGE = 2.6;                 // de combien la voiture tourne, en radians par seconde
export const FROTTEMENT = 0.5;             // la route freine un peu la voiture
export const FROTTEMENT_HERBE = 2.5;       // l'herbe la freine beaucoup
export const ADHERENCE = 5;                // les pneus collent à la route : moins, et la voiture glisse
export const ADHERENCE_HERBE = 1.5;

// La nitro et les pièges
export const VITESSE_NITRO = 760;          // la vitesse la plus grande pendant la nitro
export const DUREE_NITRO = 1.5;            // secondes de nitro par bidon
export const NITRO_MAX = 3;                // les bidons qu'on peut garder
export const DUREE_FLECHE = 0.6;           // une flèche au sol : une petite nitro gratuite
export const DUREE_HUILE = 1.2;            // une flaque d'huile : les pneus ne tiennent plus
export const ADHERENCE_HUILE = 0.3;
export const RETOUR_BIDON = 5;             // secondes avant qu'un bidon ramassé revienne

// L'aide : une voiture presque arrêtée hors de la route y est remise après ce temps (en secondes)
export const REMISE_SUR_LA_ROUTE = 1.5;

// Au doigt, c'est plus difficile qu'au clavier : quelques coups de pouce
export const AIDE_MOBILE = {
  rivaux: 0.92,                            // les rivaux vont un peu moins vite
  frottementHerbe: 1.3,                    // l'herbe freine moins
  huile: 0.5,                              // une flaque d'huile fait glisser deux fois moins longtemps
  direction: 0.7,                          // sans toucher ◀ ▶, la voiture se remet doucement dans l'axe de la route
};

// La course
export const TOURS = 3;
export const NIVEAU_COURSE = 0.75;         // les rivaux : 1, aussi vite qu'ils peuvent ; moins, ils lèvent le pied

export const JOUEUR = { nom: "Toi", couleur: 0xff7a1a };
export const RIVAUX = [
  { nom: "Éclair", couleur: 0xf4d03f },
  { nom: "Fusée", couleur: 0x9b6bff },
  { nom: "Bolide", couleur: 0x3ec46d },
];

// Le début du nom des sauvegardes : le même que l'ancien jeu, les records d'avant sont gardés
export const SAUVEGARDE = "course-de-pixy";

// L'ordre d'affichage dans la course : plus le nombre est grand, plus c'est dessus
export const PROFONDEUR = {
  piste: 0,
  traces: 1,
  objets: 2,
  fumee: 3,
  fantome: 4,
  flammes: 5,
  voitures: 6,
  gerbes: 7,
};

export const ORANGE = 0xff7a1a;
export const FOND = "#1c1a25";
