// Les bruitages des voitures que les fichiers n'ont pas : le tour, la victoire, le record, la nitro et
// les chocs. Fabriqués par le synthétiseur du jeu (son.ts), comme ceux des licornes, mais plus « garage » :
// des notes carrées et du bruit grave. Le bip du départ et le moteur restent des fichiers (public/course/voitures).

import { note, bruit } from "../../son";

export const sons = {
  // Un tour de plus : deux bips qui montent
  tour: () => {
    note(880, 0, 0.1, "square", 0.045);
    note(1320, 0.09, 0.16, "square", 0.045);
  },
  // La victoire : une petite fanfare, ta-ta-ta-taaa, avec sa tierce en dessous
  victoire: () => {
    const air: [number, number, number][] = [[784, 0, 0.12], [784, 0.14, 0.12], [784, 0.28, 0.12], [1047, 0.42, 0.6]];
    for (const [f, debut, duree] of air) {
      note(f, debut, duree, "square", 0.05);
      note(f * 0.8, debut, duree, "triangle", 0.07);
    }
  },
  // Un nouveau record : un arpège qui file vers l'aigu
  record: () => [1047, 1319, 1568, 2093].forEach((f, i) => note(f, 0.3 + i * 0.06, 0.2, "square", 0.04)),
  // La nitro : un souffle qui siffle, et le moteur qui monte d'un coup
  nitro: () => {
    bruit(0.55, 0.22, 2600);
    note(110, 0, 0.5, "sawtooth", 0.05, 330);
  },
  // Un choc : un « bonk » sourd, plus fort quand on tape fort
  choc: (fort: boolean) => {
    note(fort ? 150 : 210, 0, fort ? 0.18 : 0.1, "square", fort ? 0.09 : 0.05, 60);
    bruit(fort ? 0.2 : 0.08, fort ? 0.3 : 0.12, 700);
  },
};
