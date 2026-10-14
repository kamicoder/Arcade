// Les vagues d'ennemis : qui arrive, quand, et par quel chemin. Du TypeScript pur, sans Phaser : la
// partie transforme chaque chemin en courbe (Phaser.Curves.Spline) et y fait glisser l'ennemi.
//
// Les vagues vont par séries de 5 : quatre vagues d'ennemis, puis le boss. Chaque série va plus vite que
// la précédente, avec plus d'ennemis. L'écran fait 960 × 540 ; un chemin commence et finit hors de l'écran,
// sauf pour un ennemi qui s'arrête (« attente ») : il tire un moment à sa place, puis plonge vers le bas.

import { VAGUES_PAR_BOSS, type GenreDEnnemi } from "./reglages";

export interface Point {
  x: number;
  y: number;
}

export interface Apparition {
  genre: GenreDEnnemi;
  delai: number;                           // en ms, depuis le début de la vague
  chemin: Point[];                         // la courbe passe par ces points
  duree: number;                           // le temps pour la parcourir (ms)
  attente?: number;                        // arrivé au bout, il reste là tant de ms avant de plonger
}

export interface Vague {
  numero: number;                          // à partir de 1
  serie: number;                           // 0 pour les 5 premières vagues, 1 pour les 5 suivantes...
  boss: boolean;
  apparitions: Apparition[];
}

// Ce qui fait monter la difficulté d'une série à l'autre
export function allure(serie: number): number {
  return 1 + 0.15 * serie;                 // les ennemis vont 15 % plus vite à chaque série
}

export function vague(numero: number, hasard: () => number = Math.random): Vague {
  const serie = Math.floor((numero - 1) / VAGUES_PAR_BOSS);
  const place = (numero - 1) % VAGUES_PAR_BOSS;   // 0 à 3 : des ennemis ; 4 : le boss
  const v = allure(serie);
  const apparitions: Apparition[] = [];
  const ajouter = (a: Apparition) => apparitions.push({ ...a, duree: a.duree / v, attente: a.attente && a.attente / v });

  if (place === VAGUES_PAR_BOSS - 1) {
    return { numero, serie, boss: true, apparitions };   // le boss : la partie s'en occupe
  }
  if (place === 0) {
    // La pluie : des éclaireurs tombent un peu partout en ondulant
    const nombre = 8 + 2 * serie;
    for (let i = 0; i < nombre; i++) {
      const x = 80 + hasard() * 800;
      const ecart = hasard() < 0.5 ? -50 : 50;
      ajouter({
        genre: "eclaireur", delai: i * 380 / v, duree: 3600,
        chemin: [{ x, y: -30 }, { x: x + ecart, y: 170 }, { x: x - ecart, y: 360 }, { x, y: 580 }],
      });
    }
  } else if (place === 1) {
    // Le serpent : une file d'éclaireurs traverse de gauche à droite, une autre revient de droite à gauche
    const nombre = 6 + serie;
    for (let i = 0; i < nombre; i++) {
      ajouter({
        genre: "eclaireur", delai: i * 260, duree: 4200,
        chemin: [{ x: -40, y: 60 }, { x: 280, y: 230 }, { x: 640, y: 70 }, { x: 1000, y: 240 }],
      });
      ajouter({
        genre: "eclaireur", delai: 2600 + i * 260, duree: 4200,
        chemin: [{ x: 1000, y: 110 }, { x: 680, y: 280 }, { x: 320, y: 120 }, { x: -40, y: 290 }],
      });
    }
  } else if (place === 2) {
    // Le V : des chasseurs prennent leur place en formation, tirent un moment, puis plongent
    const nombre = 5 + 2 * Math.min(serie, 2);
    for (let i = 0; i < nombre; i++) {
      const rang = i - (nombre - 1) / 2;   // de -2 à 2 pour 5 chasseurs : 0 au milieu, en tête
      const x = 480 + rang * 110;
      const y = 170 - Math.abs(rang) * 35;
      const depart = rang < 0 ? -40 : 1000;
      ajouter({
        genre: "chasseur", delai: Math.abs(rang) * 250, duree: 1800, attente: 4500 + Math.abs(rang) * 400,
        chemin: [{ x: depart, y: -40 }, { x: (x + 480) / 2, y: y - 60 }, { x, y }],
      });
    }
  } else {
    // Le mélange : deux lourds au fond, des chasseurs qui passent, des éclaireurs en pluie
    for (const x of [300, 660]) {
      ajouter({
        genre: "lourd", delai: 0, duree: 2500, attente: 8000,
        chemin: [{ x, y: -60 }, { x, y: 110 }],
      });
    }
    for (let i = 0; i < 4 + serie; i++) {
      const gauche = i % 2 === 0;
      ajouter({
        genre: "chasseur", delai: 1500 + i * 900, duree: 4000,
        chemin: gauche
          ? [{ x: -40, y: 200 }, { x: 300, y: 260 }, { x: 700, y: 180 }, { x: 1000, y: -40 }]
          : [{ x: 1000, y: 200 }, { x: 660, y: 260 }, { x: 260, y: 180 }, { x: -40, y: -40 }],
      });
    }
    for (let i = 0; i < 6 + serie; i++) {
      const x = 60 + hasard() * 840;
      ajouter({ genre: "eclaireur", delai: 4000 + i * 500, duree: 3200, chemin: [{ x, y: -30 }, { x, y: 580 }] });
    }
  }
  return { numero, serie, boss: false, apparitions };
}
