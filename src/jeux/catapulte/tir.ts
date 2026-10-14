// Le tir et les chocs, en TypeScript pur : la vitesse d'un tir d'après l'élastique tiré, la trajectoire
// prévue (les pointillés), et les dégâts d'un choc. Sans Phaser : la scène s'en sert, les tests aussi.

import {
  REPOS, TIRE_MAX, PUISSANCE, GRAVITE, PAS, FROTTEMENT_DE_L_AIR, SEUIL_DE_CHOC, FORCE_DES_CHOCS, MASSE_MAX,
} from "./reglages";

export interface Point {
  x: number;
  y: number;
}

// Où est le boulet quand on tire l'élastique jusqu'à ce point : jamais plus loin que TIRE_MAX du repos
export function tirerJusqua(pointeur: Point): Point {
  const dx = pointeur.x - REPOS.x;
  const dy = pointeur.y - REPOS.y;
  const longueur = Math.hypot(dx, dy);
  if (longueur <= TIRE_MAX) {
    return { x: pointeur.x, y: pointeur.y };
  }
  return { x: REPOS.x + (dx / longueur) * TIRE_MAX, y: REPOS.y + (dy / longueur) * TIRE_MAX };
}

// L'élastique tiré en arrière lance le boulet dans l'autre sens, d'autant plus fort qu'il est tendu
export function vitesseDuTir(boulet: Point): Point {
  return { x: (REPOS.x - boulet.x) * PUISSANCE, y: (REPOS.y - boulet.y) * PUISSANCE };
}

// Le même tir, réglé par un angle (en degrés, 0 = vers la droite, positif vers le haut) et une force
// (de 0 à 1) : pour le clavier et la manette
export function tirParAngle(angle: number, force: number): Point {
  const a = (angle * Math.PI) / 180;
  return { x: REPOS.x - Math.cos(a) * TIRE_MAX * force, y: REPOS.y + Math.sin(a) * TIRE_MAX * force };
}

// Les points de la trajectoire, pas à pas, calculés comme Matter les calcule : le frottement de l'air,
// puis la gravité, puis le déplacement
export function trajectoire(depart: Point, vitesse: Point, pas = 60, tousLes = 3): Point[] {
  const points: Point[] = [];
  const chute = GRAVITE.y * GRAVITE.echelle * PAS * PAS;
  let { x, y } = depart;
  let vx = vitesse.x;
  let vy = vitesse.y;
  for (let n = 1; n <= pas; n++) {
    vx *= 1 - FROTTEMENT_DE_L_AIR;
    vy = vy * (1 - FROTTEMENT_DE_L_AIR) + chute;
    x += vx;
    y += vy;
    if (n % tousLes === 0) {
      points.push({ x, y });
    }
  }
  return points;
}

// Les dégâts d'un choc pour l'une des deux choses qui se cognent : la vitesse de l'une par rapport à
// l'autre, au-delà d'un petit seuil, fois la masse de CE QUI LA FRAPPE (un mur, de masse infinie, compte
// comme sa propre masse), fois la fragilité de sa matière
export function degats(vitesseRelative: number, masseDeLAutre: number, masse: number, resistance: number): number {
  if (vitesseRelative <= SEUIL_DE_CHOC) {
    return 0;
  }
  const frappe = Math.min(Number.isFinite(masseDeLAutre) ? masseDeLAutre : masse, MASSE_MAX);
  return (vitesseRelative - SEUIL_DE_CHOC) * frappe * FORCE_DES_CHOCS * resistance;
}

// Les étoiles d'un niveau gagné : une, plus une par boulet qui restait (au plus trois)
export function etoiles(bouletsRestants: number): number {
  return Math.min(3, 1 + bouletsRestants);
}
