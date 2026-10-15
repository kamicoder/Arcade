// Les réglages du casse-briques : change-les, relance, et sens la différence.
// Les vitesses sont en pixels par seconde (la physique Arcade), les durées en millisecondes.

// La balle
export const VITESSE = 380;                // au départ de chaque niveau...
export const VITESSE_PAR_BRIQUE = 3;       // ... elle accélère un peu à chaque brique cassée...
export const VITESSE_MAX = 620;            // ... jusque-là
export const VITESSE_PAR_MUR = 18;         // le mode sans fin : chaque mur part un peu plus vite
export const PENTE_MIN = 0.3;              // la balle ne file jamais presque à plat (une part de sa vitesse va toujours vers le haut ou le bas)
export const ANGLE_MAX = 62;               // en degrés : le bord de la raquette renvoie la balle aussi penchée
export const BALLES_MAX = 8;

// La raquette
export const VITESSE_RAQUETTE = 720;       // au clavier et à la manette
export const VIES = 3;

// Les bonus : la chance qu'une brique cassée en lâche un, leur chute, et la durée des effets
export const CHANCE_DE_BONUS = 0.14;
export const VITESSE_BONUS = 150;
export const DUREE_LARGE = 12000;
export const DUREE_FEU = 7000;
export const DUREE_LENTE = 9000;
export const LENTE = 0.7;                  // la balle lente va à 70 % de sa vitesse

// Les points
export const POINTS_PAR_VIE = 200;         // à la fin d'un niveau gagné, pour chaque vie qui reste
export const COMBO_MAX = 8;                // les briques cassées sans toucher la raquette comptent double, triple...

// Les couleurs
export const FOND = 0x110e22;
export const VIOLET = 0x9b6bff;
export const TEXTE = "#e6dcff";

// Le début du nom de toutes les sauvegardes du casse-briques
export const SAUVEGARDE = "briques";
