// Les bruitages et la musique des licornes, fabriqués par le navigateur (le synthétiseur du jeu, son.ts) :
// aucun fichier son, comme dans l'ancien jeu.

import { note, bruit, type Air } from "../../son";

export const sons = {
  bip: () => note(660, 0, 0.18, "square", 0.05),
  partez: () => {
    note(1320, 0, 0.4, "square", 0.06);
    note(1760, 0.05, 0.4, "triangle", 0.06);
  },
  sabot: (aigu: boolean) => note(aigu ? 520 : 400, 0, 0.06, "triangle", 0.035, 180),
  etoile: () => [1568, 2093, 2637].forEach((f, i) => note(f, i * 0.06, 0.2, "triangle", 0.1)),
  turbo: () => {
    note(300, 0, 0.5, "sawtooth", 0.04, 1200);
    note(600, 0.05, 0.5, "triangle", 0.07, 2400);
  },
  fleche: () => note(500, 0, 0.25, "triangle", 0.07, 1500),
  bonbon: () => {
    note(200, 0, 0.5, "sine", 0.12, 900);
    note(400, 0.1, 0.5, "triangle", 0.06, 1600);
  },
  orage: () => {
    bruit(0.9, 0.35, 500);
    note(140, 0, 0.6, "sawtooth", 0.05, 60);
  },
  pouf: () => bruit(0.15, 0.12, 1200),
  tour: () => [784, 988, 1175].forEach((f, i) => note(f, i * 0.08, 0.2, "triangle", 0.09)),
  record: () => [1047, 1319, 1568, 2093, 2637].forEach((f, i) => note(f, 0.3 + i * 0.07, 0.25, "sine", 0.1)),
  victoire: () => {
    const air = [523, 659, 784, 1047, 0, 784, 1047];
    air.forEach((f, i) => {
      if (f > 0) {
        note(f, i * 0.14, i === air.length - 1 ? 0.7 : 0.18, "triangle", 0.1);
      }
    });
  },
  menu: () => note(988, 0, 0.1, "sine", 0.08),
  non: () => note(300, 0, 0.15, "square", 0.04, 200),
};

// La musique : une mélodie et une basse (les notes comptent les demi-tons à partir du do du milieu)
export const MUSIQUES: { menu: Air; course: Air } = {
  menu: {
    tempo: 96, timbre: "triangle", volume: 0.045,
    melodie: [16, null, 19, null, 21, null, 19, 16, 14, null, 12, null, 9, null, 12, null,
      14, null, 16, null, 19, null, 16, 14, 12, null, null, null, null, null, null, null],
    basse: [0, 0, -3, -3, 5, 5, 7, 7, 0, 0, -3, -3, 5, 7, 0, 0],
  },
  course: {
    tempo: 138, timbre: "square", volume: 0.025,
    melodie: [12, null, 16, 19, 21, 19, 16, null, 14, null, 16, 14, 12, null, 9, null,
      12, null, 16, 19, 24, 21, 19, null, 21, 19, 16, 14, 12, null, null, null,
      17, null, 21, 24, 26, 24, 21, null, 19, null, 23, 19, 14, null, 11, null,
      12, null, 16, 19, 24, null, 19, 16, 21, 19, 16, 14, 12, null, 12, null],
    basse: [0, 0, 7, 7, -3, -3, 4, 4, 5, 5, 0, 0, 7, 7, 2, 2,
      5, 5, 9, 9, 7, 7, 2, 2, 0, 0, 5, 5, 7, 7, 0, 0],
  },
};
