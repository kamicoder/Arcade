// Les réglages du platformer : change-les, relance, et sens la différence manette en main.
//
// L'atelier comptait en pixels par IMAGE (60 images par seconde) : VITESSE = 5, GRAVITE = 1, SAUT = -16.
// La physique Arcade compte en pixels par SECONDE : on multiplie par 60 (et par 60 × 60 pour la gravité).
// Les niveaux gardent les nombres de l'atelier (la vitesse « v » d'une plateforme mobile vaut 2, comme
// dans ses fichiers) : c'est en jouant qu'on les convertit, avec IMAGES.

export const IMAGES = 60;                  // les images par seconde de l'atelier, pour convertir ses nombres

// Le monde : 480 pixels de haut, comme la fenêtre de l'atelier (le sol des niveaux est à y = 440)
export const HAUTEUR_MONDE = 480;
export const LARGEUR_VUE = 800;            // la fenêtre de l'atelier : un mode infini qui démarre à sa droite
export const ZOOM = 540 / HAUTEUR_MONDE;   // la caméra agrandit ces 480 pixels pour remplir les 540 de l'Arcade

// Le héros
export const VITESSE = 5 * IMAGES;         // 300 pixels par seconde
export const GRAVITE = 1 * IMAGES * IMAGES;   // 3600 pixels par seconde, chaque seconde
export const SAUT = -16 * IMAGES;          // un saut monte d'environ 130 pixels ; deux sauts en l'air (double saut)
export const NAGE = -5 * IMAGES;           // dans l'eau, un coup de nage (plus doux qu'un saut)
export const CHUTE_DANS_L_EAU = 2 * IMAGES;   // dans l'eau, on ne coule jamais plus vite que ça
export const CHUTE_MAX = 26 * IMAGES;      // assez pour le plus grand ressort ; au-delà, on traverserait le sol
export const REBOND_ECRASE = SAUT / 2;     // sauter sur un ennemi fait rebondir à moitié

// Un saut qui pardonne. Le « coyote time » (sauter encore un instant après avoir quitté un bord) est déjà
// là, et sans limite : tomber d'un bord sans sauter garde ses deux sauts, comme dans l'atelier. Ce qui
// manquait, c'est l'autre bout du saut : un appui un peu trop tôt, juste avant de toucher le sol, alors
// qu'il ne reste plus de saut en l'air. Il est gardé tant de millisecondes : touchant le sol à temps, on saute.
export const SAUT_MEMORISE = 120;

// La force d'un genre de plateforme (1, 2 ou 3, réglée dans l'éditeur) devient un nombre du jeu
export const REBONDS = { 1: -19 * IMAGES, 2: -22 * IMAGES, 3: -26 * IMAGES } as Record<number, number>;
// Sur la glace, l'élan rattrape la vitesse voulue de tant de pixels par seconde, chaque seconde
export const GLISSES = { 1: 0.25 * IMAGES * IMAGES, 2: 0.07 * IMAGES * IMAGES, 3: 0.03 * IMAGES * IMAGES } as Record<number, number>;
export const TAPIS = { 1: 1 * IMAGES, 2: 2 * IMAGES, 3: 4 * IMAGES } as Record<number, number>;
// Une plateforme qui s'écroule tient encore tant de millisecondes après qu'on s'y est posé
export const ECROULEMENTS = { 1: 1000, 2: 500, 3: 200 } as Record<number, number>;

// Les ennemis et le boss
export const VITESSE_ENNEMI = 2;           // en pixels par image, comme dans l'atelier
export const BOND_DU_SAUTEUR = -9 * IMAGES;
export const VITESSE_BOSS = 3 * IMAGES;
export const INVINCIBLE_BOSS = 500;        // après un coup, le boss ne craint rien pendant ce temps (ms)
export const ECRASER = 18;                 // le héros tombe et ses pieds sont à moins de ça du haut de l'ennemi : écrasé
export const ECRASER_BOSS = 24;

// La partie
export const VIES = 3;
export const PIECES_POUR_UNE_VIE = 10;
export const INTOUCHABLE = 1000;           // l'Infini : après une deuxième chance, il clignote, et aucun ennemi ne le touche (ms)
export const OBJECTIF_DUO = 15;            // 2 joueurs : le premier à ce nombre de points gagne

// Les couleurs de l'atelier
export const FOND = 0x282d3c;
export const MOBILE = 0x96c878;
export const BOSS = 0x962838;
export const VERT = "#5fd068";
export const ORANGE = 0xff7a1a;

// Le début du nom de toutes les sauvegardes du platformer
export const SAUVEGARDE = "platformer";
