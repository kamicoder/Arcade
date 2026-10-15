// Le monde sans fin du mode infini et du mode 2 joueurs : des plateformes fabriquées au hasard, DEVANT
// la caméra, au fur et à mesure qu'on avance. Du TypeScript pur : il fabrique des éléments (le même
// format que les niveaux), et c'est le Monde qui en fait des objets Phaser.

import type { Element, TypeEnnemi } from "./elements";

const auHasard = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

export type Sorte = "infini" | "duo";

export class Generateur {
  private x = 240;                         // jusqu'où le monde est déjà fabriqué
  private y = 400;                         // la hauteur de la dernière plateforme

  constructor(private sorte: Sorte) {}

  // La plateforme de départ, sous le héros
  depart(): Element[] {
    return [
      { sorte: "plateforme", x: 0, y: 400, w: 240, h: 20, genre: "normale", force: 2, sens: 1 },
      { sorte: "depart", x: 40, y: 360 },
    ];
  }

  // Les éléments à ajouter pour que le monde aille au moins jusqu'à « jusquA »
  suite(jusquA: number): Element[] {
    const nouveaux: Element[] = [];
    while (this.x < jusquA) {
      if (this.sorte === "infini") {
        this.uneInfinie(nouveaux);
      } else {
        this.uneDuDuo(nouveaux);
      }
    }
    return nouveaux;
  }

  // L'Infini : des trous et des hauteurs au hasard, parfois une plateforme mobile ou fragile,
  // et des ennemis de toutes les tailles
  private uneInfinie(nouveaux: Element[]) {
    const x = this.x + auHasard(90, 190);  // le trou avant la plateforme
    const w = auHasard(90, 170);
    this.y = Math.max(240, Math.min(420, this.y + auHasard(-90, 90)));   // on reste dans une bande jouable
    const y = this.y;
    const tirage = Math.random();
    this.x = x + w;
    if (tirage < 0.12) {
      nouveaux.push({ sorte: "mobile", x, y, w, h: 20, axe: Math.random() < 0.5 ? "x" : "y", dist: 100, v: 2 });
      return;
    }
    if (tirage < 0.26) {
      nouveaux.push({ sorte: "plateforme", x, y, w, h: 20, genre: "fragile", force: 2, sens: 1 });
      return;
    }
    // Pièces et ennemis seulement sur une plateforme normale : ils ne suivent pas une plateforme qui
    // bouge, et resteraient en l'air quand une fragile s'écroule
    nouveaux.push({ sorte: "plateforme", x, y, w, h: 20, genre: "normale", force: 2, sens: 1 });
    if (Math.random() < 0.55) {
      nouveaux.push({ sorte: "piece", x: x + w / 2 - 8, y: y - 28 });
    }
    if (Math.random() < 0.4) {
      const type = (["marcheur", "volant", "sauteur"] as TypeEnnemi[])[auHasard(0, 2)];
      const taille = auHasard(26, 42);
      const v = auHasard(1, 4);
      const ex = x + w / 2 - taille / 2;
      if (type === "volant") {
        nouveaux.push({ sorte: "ennemi", type, x: ex, y: y - 100, xmin: x, xmax: x + w, ymin: y - 130, ymax: y - 30, taille, v });
      } else {
        nouveaux.push({ sorte: "ennemi", type, x: ex, y: y - taille, xmin: x, xmax: x + w, sol: y, taille, v });
      }
    }
  }

  // Le duo : plus simple, que des plateformes normales, des pièces et des marcheurs
  private uneDuDuo(nouveaux: Element[]) {
    const x = this.x + auHasard(80, 150);
    const w = auHasard(100, 170);
    this.y = Math.max(260, Math.min(420, this.y + auHasard(-70, 70)));
    const y = this.y;
    nouveaux.push({ sorte: "plateforme", x, y, w, h: 20, genre: "normale", force: 2, sens: 1 });
    if (Math.random() < 0.6) {
      nouveaux.push({ sorte: "piece", x: x + w / 2 - 8, y: y - 28 });
    }
    if (Math.random() < 0.3 && w >= 110) {
      nouveaux.push({ sorte: "ennemi", type: "marcheur", x: x + 10, y: y - 30, xmin: x, xmax: x + w });
    }
    this.x = x + w;
  }
}
