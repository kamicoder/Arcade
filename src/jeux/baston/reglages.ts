// Les réglages de la baston : change-les, relance, et sens la différence au combat.
//
// L'atelier comptait en « tours de boucle » (60 par seconde) : 5 pixels par tour, 20 tours d'attaque...
// Phaser compte en secondes et en pixels par seconde. Chaque valeur garde son origine en commentaire.

import { LARGEUR } from "../../socle/style";

const TOUR = 1 / 60;                       // un tour de boucle de l'atelier, en secondes

// L'arène
export const SOL = 430;                    // le haut du sol : les pieds des robots s'y posent
export const DEPART = 225;                 // chaque robot démarre à cette distance du milieu (450 pixels entre eux)

// Le robot (les valeurs du « classique » ; les autres modèles changent vitesse, saut et dégâts)
export const ECHELLE = 2;                  // les cases de la planche sont dessinées en petit (56 × 32)
export const CORPS = { largeur: 48, hauteur: 64 };   // la hurtbox : le corps, la zone qui A mal
export const GRAVITE = 1 * 60 * 60;        // 1 pixel par tour, ajouté à chaque tour : 3 600 pixels/s²
export const VIE = 100;
export const JAUGE = 100;                  // la jauge pleine : le coup spécial est prêt
export const TIRS = 2;                     // les tirs qu'un robot peut avoir dans l'arène en même temps

// Les durées des états (en secondes)
export const DUREE = {
  attaque: 20 * TOUR,                      // un tiers de seconde
  tir: 15 * TOUR,
  special: 30 * TOUR,
  touche: 20 * TOUR,                       // sonné : il ne peut rien faire
  invincible: 40 * TOUR,                   // juste après un coup : on ne peut plus le toucher
};

// Les trois temps d'un coup de poing : l'élan (rien ne touche encore), l'actif (il fait mal), le retour
export const ELAN = 5 * TOUR;
export const ACTIF = 5 * TOUR;
export const POING = { largeur: 32, hauteur: 16, hauteurDepuisLeHaut: 36 };   // la hitbox : la zone qui FAIT mal

// Touché, il glisse en arrière, de moins en moins vite
export const RECUL = 8 * 60;               // 8 pixels par tour
export const RECUL_FREIN = 0.8;            // à chaque tour, il garde 80 % de son élan

// La jauge se remplit quand on touche, et quand on est touché (de quoi se venger)
export const JAUGE_POING = 15;
export const JAUGE_TIR = 10;
export const JAUGE_ENCAISSE = 10;

// Les tirs
export const VITESSE_TIR = 9 * 60;         // 9 pixels par tour
export const TIR = { degats: 6, taille: 14 };

// Le match
export const MANCHES_GAGNANTES = 2;
export const DUREE_ANNONCE = 90 * TOUR * 1000;   // en millisecondes : « Manche 1 », personne ne bouge
export const DUREE_KO = 120 * TOUR * 1000;       // pour savourer le K.O. (en temps du jeu : le ralenti l'allonge)

// Le jus
export const SECOUSSE = 5;                 // de combien de pixels l'écran tremble (il tremble « dégâts » tours)
export const RALENTI = { vitesse: 1 / 3, duree: 2000 };   // le K.O. : 20 images par seconde au lieu de 60, 2 secondes
export const COULEUR_ETINCELLES = 0xffe678;
export const BOITES = false;               // true : on voit les hurtbox (vert), les hitbox (rouge) et les états

// Le robot de l'ordinateur : ses chances, à chaque tour de 1/60 s
export const ORDI = {
  frappe: 0.03,                            // d'appuyer sur « frapper », quand il est tout près
  recul: 0.3,                              // de reculer, face à un coup qui arrive
  tir: 0.02,                               // de tirer, quand il est loin
  pres: 70,                                // plus loin que ça, il s'approche
  danger: 110,                             // un tir ou un coup plus près que ça : il réagit
};

// Au doigt, c'est plus difficile qu'au clavier : l'ordinateur frappe un peu moins souvent
export const AIDE_MOBILE = { frappe: 0.7 };

// Les couleurs
export const BLEU = 0x50aaf0;
export const ORANGE = 0xfa963c;
export const FOND = 0x282d3c;
export const COULEUR_SOL = 0x464b5f;
export const GRIS = 0x3c4155;              // les fonds de barres et les cases éteintes
export const JAUNE = 0xfadc5a;

export const MILIEU = LARGEUR / 2;

// Le début du nom des sauvegardes
export const SAUVEGARDE = "baston";

// L'ordre d'affichage dans l'arène : plus le nombre est grand, plus c'est dessus
export const PROFONDEUR = {
  decor: 0,
  trainees: 1,
  robots: 2,
  tirs: 3,
  etincelles: 4,
  boites: 5,
};
