// Les réglages de la catapulte : change-les, relance, et sens la différence.
//
// Les unités sont celles de Matter (la physique de Phaser utilisée ici) : des pixels du monde, et des
// vitesses en pixels par PAS de physique (60 pas par seconde). Une vitesse de 10, c'est 600 pixels par
// seconde.

// Le monde : 1280 × 720, montré en entier (la caméra le réduit d'après la hauteur : 0,75 pour les 540 de l'Arcade).
// Au doigt, le jeu s'élargit à la proportion du téléphone (socle/largeur.ts) : le zoom reste le même, on
// voit un peu de paysage de chaque côté du monde.
export const MONDE = { largeur: 1280, hauteur: 720 };
export const SOL = 640;                    // le haut de l'herbe

// La fronde, et le point de repos du boulet entre ses deux branches
export const FRONDE = { x: 190, y: SOL - 65 };
export const REPOS = { x: FRONDE.x, y: SOL - 120 };
export const TIRE_MAX = 110;               // l'élastique ne s'étire pas plus loin
export const PUISSANCE = 0.2;              // la vitesse au départ, pour chaque pixel d'élastique tiré
export const ZONE_DE_PRISE = 120;          // on attrape le boulet à moins de ça de lui

// La visée à la manette, plus fine que celle du clavier (5° et 0,1 par touche) : la croix, un petit pas par
// appui, puis elle avance d'elle-même quand on la tient ; le stick, d'autant plus vite qu'il est poussé loin
// (à peine poussé, tout doux). L'angle va de -10° à 80°, la force de 0,3 à 1.
export const VISEE_MANETTE = {
  pasAngle: 1, pasForce: 0.02,             // un appui sur la croix
  attente: 300,                            // ms : la croix tenue avance d'elle-même après ça
  angleParSeconde: 40, forceParSeconde: 0.5,   // la croix tenue, ou le stick poussé à fond
};

// La gravité de Matter : 1 × 0,001, sur un pas de 1000/60 ms. Le calcul de la trajectoire prévue
// (tir.ts) refait exactement le même calcul que Matter.
export const GRAVITE = { y: 1, echelle: 0.001 };
export const PAS = 1000 / 60;

// Les boulets. Leur densité fait leur poids : le lourd enfonce la pierre. Le nom et le pouvoir des
// boulets spéciaux s'affichent quand ils arrivent dans la fronde (au doigt, « touche l'écran » ; sinon,
// « clic ou Espace »).
export const BOULETS = {
  boulet: { rayon: 12, densite: 0.004, image: "boulet", nom: "Boulet", pouvoir: "" },
  lourd: { rayon: 15, densite: 0.012, image: "boulet-lourd", nom: "Boulet lourd", pouvoir: "Très lourd : il enfonce même la pierre." },
  triple: {
    rayon: 12, densite: 0.004, image: "boulet-triple", nom: "Boulet triple",
    pouvoir: "En vol, {geste} : il se divise en trois !",
  },
  // Chacun des trois petits frappe un peu plus fort qu'un boulet normal (masse 2,3 contre 1,8) : diviser
  // le triple vaut le coup
  petit: { rayon: 9, densite: 0.009, image: "boulet-petit", nom: "Petit boulet", pouvoir: "" },
} as const;
export type GenreDeBoulet = keyof typeof BOULETS;
export const FROTTEMENT_DE_L_AIR = 0.002;  // presque rien : le boulet va loin
export const ECART_DU_TRIPLE = 0.22;       // l'angle entre les trois petits boulets (en radians)

// Les matières. « resistance » : la part des chocs qu'elle encaisse (la pierre n'en sent que 35 %).
export const MATIERES = {
  bois: { densite: 0.0012, frottement: 0.7, rebond: 0.05, vie: 30, resistance: 1, points: 50, eclat: "eclat-bois" },
  pierre: { densite: 0.0028, frottement: 0.8, rebond: 0.02, vie: 80, resistance: 0.35, points: 100, eclat: "eclat-pierre" },
  glace: { densite: 0.0009, frottement: 0.05, rebond: 0.1, vie: 14, resistance: 1.6, points: 30, eclat: "eclat-glace" },
} as const;
export type Matiere = keyof typeof MATIERES;

export const FORMES = { carre: [40, 40], court: [80, 20], long: [160, 20] } as const;
export type Forme = keyof typeof FORMES;

// Les slimes
export const SLIMES = {
  slime: { rayon: 19, vie: 8, points: 500, image: "slime" },
  chef: { rayon: 27, vie: 22, points: 1000, image: "chef" },
} as const;
export type GenreDeSlime = keyof typeof SLIMES;

// Les chocs. Un choc fait des dégâts au-delà d'une petite vitesse (SEUIL_DE_CHOC), d'autant plus que ce
// qui frappe est lourd (sa masse compte, jusqu'à MASSE_MAX : un mur ne frappe pas plus fort qu'un rocher)
export const SEUIL_DE_CHOC = 1;
export const FORCE_DES_CHOCS = 4;
export const MASSE_MAX = 6;
export const CALME_AU_DEBUT = 1200;        // ms : le château se pose, sans dégâts

// Un tir est fini quand tout est calme (plus rien ne bouge). TIR_MAX n'est qu'un secours, pour un bloc qui
// tremblerait sans fin : un château qui s'écroule encore n'est pas coupé (à 9 s, il l'était : « Raté »,
// puis le dernier slime mourait)
export const VITESSE_CALME = 0.15;
export const TIR_MAX = 20000;

// Les points
export const POINTS_PAR_BOULET_RESTANT = 1000;

// Les sensations (rien qui change le jeu : ce qu'on voit et ce qu'on sent)
// Un gros écroulement : tant de blocs cassés en si peu de temps (ms). L'écran tremble, la manette aussi.
export const ECROULEMENT = { blocs: 4, duree: 1000 };
export const SECOUSSE = { duree: 350, force: 0.008 };
// Le dernier slime éclate : la physique ralentit (à ce rythme), le temps de le voir, puis repart
export const RALENTI = { rythme: 0.25, tenu: 450, retour: 550 };
// Les slimes clignent des yeux (une chance sur tant, pour chacun, tous les quarts de seconde) et ricanent
// quand un tir n'a touché personne (ms)
export const CLIGNEMENT = { chance: 0.04, duree: 140 };
export const RICANEMENT = 1300;
// La trace du tir d'avant : un point tous les tant de ms, tant que le boulet file assez vite
export const TRACE = { tousLes: 45, vitesseMin: 2, max: 150 };

// Les couleurs
export const BRUN = 0x8a5a33;
export const VERT = "#62c94f";
export const SAUVEGARDE = "catapulte";
