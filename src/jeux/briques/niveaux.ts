// Les murs du casse-briques : les dix niveaux dessinés à la main, et ceux du mode sans fin, tirés au
// hasard. Du TypeScript pur, sans Phaser : un mur n'est qu'une grille de lettres, que la partie lit.
//
// Un niveau se dessine comme on le verrait, une ligne de 12 lettres par rangée de briques :
//   .  rien
//   r o j v b i   une brique simple (rouge, orange, jaune, vert, bleu, violet) : un coup
//   a   argent : deux coups        O   or : trois coups
//   *   explosive : elle casse ses voisines
//   #   métal : incassable, il n'est pas à casser pour gagner

export const COLONNES = 12;

export type GenreDeBrique = "simple" | "argent" | "or" | "explosive" | "metal";

export interface Brique {
  ligne: number;
  colonne: number;
  genre: GenreDeBrique;
  couleur: string;                         // la lettre de la grille : elle choisit l'image
  coups: number;                           // les coups qu'il faut pour la casser (0 : jamais)
}

export interface Niveau {
  nom: string;
  grille: string[];
}

const SIMPLES = "rojvbi";
const GENRES: Record<string, { genre: GenreDeBrique; coups: number }> = {
  a: { genre: "argent", coups: 2 },
  O: { genre: "or", coups: 3 },
  "*": { genre: "explosive", coups: 1 },
  "#": { genre: "metal", coups: 0 },
};

export const NIVEAUX: Niveau[] = [
  {
    nom: "Premier mur",
    grille: [
      "............",
      "rrrrrrrrrrrr",
      "oooooooooooo",
      "jjjjjjjjjjjj",
      "vvvvvvvvvvvv",
      "bbbbbbbbbbbb",
    ],
  },
  {
    nom: "La pyramide",
    grille: [
      ".....rr.....",
      "....oooo....",
      "...jjjjjj...",
      "..vvvvvvvv..",
      ".bbbbbbbbbb.",
      "iiiiiiiiiiii",
    ],
  },
  {
    nom: "Les blindées",
    grille: [
      "aaaaaaaaaaaa",
      "rrrrrrrrrrrr",
      "oo..oooo..oo",
      "jj..jjjj..jj",
      "vvvvvvvvvvvv",
    ],
  },
  {
    nom: "Le damier",
    grille: [
      "r.r.r.r.r.r.",
      ".o.o.o.o.o.o",
      "j.j.j.j.j.j.",
      ".v.v.v.v.v.v",
      "b.b.b.b.b.b.",
      ".i.i.i.i.i.i",
    ],
  },
  {
    nom: "Boum !",
    grille: [
      "rrrrrrrrrrrr",
      "oooo*oo*oooo",
      "jjjjjjjjjjjj",
      "vv*vvvvvv*vv",
      "bbbbbbbbbbbb",
      "iiii*ii*iiii",
    ],
  },
  {
    nom: "La forteresse",
    grille: [
      "#aaaaaaaaaa#",
      "#rrrrrrrrrr#",
      "#oooooooooo#",
      "#jjjjjjjjjj#",
      "####....####",
    ],
  },
  {
    nom: "L'envahisseur",
    grille: [
      "..v......v..",
      "...v....v...",
      "..vvvvvvvv..",
      ".vv*vvvv*vv.",
      "vvvvvvvvvvvv",
      "v.vvvvvvvv.v",
      "v.v......v.v",
      "...vv..vv...",
    ],
  },
  {
    nom: "Le cœur",
    grille: [
      ".rrr....rrr.",
      "rrrrr..rrrrr",
      "rraar**raarr",
      ".rrrrrrrrrr.",
      "..rrrrrrrr..",
      "...rrrrrr...",
      "....rrrr....",
      ".....rr.....",
    ],
  },
  {
    nom: "Le labyrinthe",
    grille: [
      "OOOOOOOOOOOO",
      "#...#..#...#",
      "#.j.#..#.j.#",
      "#.j.####.j.#",
      "#.j......j.#",
      "#.aaaaaaaa.#",
      "#..........#",
    ],
  },
  {
    nom: "Le grand final",
    grille: [
      "OOOOOOOOOOOO",
      "a*aaaaaaaa*a",
      "rrrr####rrrr",
      "oooooooooooo",
      "jj*jjjjjj*jj",
      "vvvvvvvvvvvv",
      "#bbbbbbbbbb#",
      "iiiiiiiiiiii",
    ],
  },
];

// Les briques d'une grille, une par lettre (les « . » n'en donnent pas)
export function lireLaGrille(grille: string[]): Brique[] {
  const briques: Brique[] = [];
  grille.forEach((rangee, ligne) => {
    [...rangee].forEach((lettre, colonne) => {
      if (SIMPLES.includes(lettre)) {
        briques.push({ ligne, colonne, genre: "simple", couleur: lettre, coups: 1 });
      } else if (GENRES[lettre]) {
        briques.push({ ligne, colonne, couleur: lettre, ...GENRES[lettre] });
      }
    });
  });
  return briques;
}

// Un mur est gagné quand il ne reste plus que du métal
export function aCasser(briques: Pick<Brique, "genre">[]): number {
  return briques.filter((b) => b.genre !== "metal").length;
}

// Les voisines d'une brique explosive : les huit cases autour d'elle
export function voisines<T extends Pick<Brique, "ligne" | "colonne">>(centre: T, briques: T[]): T[] {
  return briques.filter((b) => b !== centre
    && Math.abs(b.ligne - centre.ligne) <= 1 && Math.abs(b.colonne - centre.colonne) <= 1);
}

// —— Le mode sans fin ——

// Un mur tiré au hasard, de plus en plus dur avec son numéro (1, 2, 3...). Il est dessiné à moitié puis
// recopié en miroir : un mur symétrique a l'air voulu, pas jeté au hasard. hasard : comme Math.random
// (un test lui passe une suite connue).
export function murSansFin(numero: number, hasard: () => number = Math.random): string[] {
  const rangees = Math.min(4 + Math.floor(numero / 2), 9);
  const dur = Math.min(0.08 + numero * 0.04, 0.45);        // la part des briques argent ou or
  const metal = numero >= 3 ? Math.min(0.03 + numero * 0.01, 0.1) : 0;
  const trous = 0.12 + hasard() * 0.18;
  const grille: string[] = [];
  for (let ligne = 0; ligne < rangees; ligne++) {
    const couleur = SIMPLES[(ligne + numero) % SIMPLES.length];
    let moitie = "";
    for (let colonne = 0; colonne < COLONNES / 2; colonne++) {
      const t = hasard();
      if (t < trous) {
        moitie += ".";
      } else if (t < trous + metal && ligne > 0) {
        moitie += "#";
      } else if (t < trous + metal + 0.05) {
        moitie += "*";
      } else if (hasard() < dur) {
        moitie += hasard() < 0.3 + numero * 0.03 ? "O" : "a";
      } else {
        moitie += couleur;
      }
    }
    grille.push(moitie + [...moitie].reverse().join(""));
  }
  // Un mur sans rien à casser (tout en trous ou en métal) ne se gagnerait jamais
  if (aCasser(lireLaGrille(grille)) === 0) {
    grille[0] = SIMPLES[numero % SIMPLES.length].repeat(COLONNES);
  }
  return grille;
}
