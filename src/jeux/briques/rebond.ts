// Le calcul des rebonds de la balle, en TypeScript pur (testable sans Phaser).
//
// Sur les murs et les briques, la physique Arcade fait rebondir la balle comme une vraie balle. Sur la
// raquette, non : c'est le joueur qui vise. Plus la balle tape loin du milieu, plus elle repart penchée
// de ce côté. C'est la règle de tous les casse-briques, et c'est ce qui rend le jeu jouable.

import { ANGLE_MAX, PENTE_MIN } from "./reglages";

export interface Vitesse {
  x: number;
  y: number;
}

// ecart : où la balle tape la raquette, de -1 (bord gauche) à 1 (bord droit). La balle repart vers le haut.
export function rebondSurLaRaquette(ecart: number, vitesse: number): Vitesse {
  const e = Math.max(-1, Math.min(1, ecart));
  const angle = e * ANGLE_MAX * Math.PI / 180;           // 0 : tout droit vers le haut
  return { x: Math.sin(angle) * vitesse, y: -Math.cos(angle) * vitesse };
}

// Après un choc, la balle garde sa direction mais reprend la vitesse voulue, et ne file jamais presque à
// plat : une balle qui ferait des allers-retours d'un mur à l'autre sans jamais redescendre bloquerait la
// partie.
export function redresser(v: Vitesse, vitesse: number): Vitesse {
  const longueur = Math.hypot(v.x, v.y);
  if (longueur === 0) {
    return { x: 0, y: -vitesse };
  }
  let x = v.x / longueur;
  let y = v.y / longueur;
  if (Math.abs(y) < PENTE_MIN) {
    y = (y < 0 ? -1 : 1) * PENTE_MIN;
    x = Math.sign(x || 1) * Math.sqrt(1 - PENTE_MIN * PENTE_MIN);
  }
  return { x: x * vitesse, y: y * vitesse };
}
