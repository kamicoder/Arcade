// Les réglages du jeu de tir : change-les, relance, et sens la différence.
// Les vitesses sont en pixels par seconde (la physique Arcade), les durées en millisecondes.

// Le vaisseau
export const VITESSE = 420;
export const CADENCE = 160;                // un tir toutes les 160 ms, tout seul : on n'appuie jamais pour tirer
export const VITESSE_BALLE = 900;
export const ARME_MAX = 4;                 // 1 : un tir, 2 : deux tirs, 3 : trois en éventail, 4 : cinq
export const INVINCIBLE = 2000;            // après un coup, le vaisseau clignote et ne craint rien
export const VIES = 3;
export const HAUT_DU_VAISSEAU = 200;       // le vaisseau ne monte pas plus haut : il faut voir venir les ennemis

// Les ennemis : leur santé, ce qu'ils rapportent, et le temps entre deux tirs (0 : ils ne tirent pas)
export const ENNEMIS = {
  eclaireur: { vie: 1, points: 100, tir: 0 },
  chasseur: { vie: 2, points: 150, tir: 1600 },
  lourd: { vie: 12, points: 500, tir: 1300 },
} as const;
export type GenreDEnnemi = keyof typeof ENNEMIS;
// Le lourd qui percute le vaisseau ne s'écrase pas comme les petits : il perd 4 points de vie (sur 12) et
// continue sa route. Le vaisseau, lui, perd quand même une vie (ou son bouclier).
export const CHOC_DU_LOURD = 4;

export const VITESSE_BALLE_ENNEMIE = 260;
export const BOSS = { vie: 140, points: 3000 };
export const VAGUES_PAR_BOSS = 5;          // un boss à la fin de chaque série de 5 vagues

// Les bonus : la chance qu'un ennemi abattu en lâche un, et ce qu'on y trouve
export const CHANCE_DE_BONUS = 0.12;
export const VITESSE_BONUS = 120;

// Les couleurs
export const FOND = 0x0a0a1e;
export const CYAN = "#5ff0ff";

// Le début du nom de toutes les sauvegardes du jeu de tir
export const SAUVEGARDE = "tir";
