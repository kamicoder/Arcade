// Les niveaux de la catapulte : des données, sans Phaser. Chaque bloc donne sa matière, sa forme, son
// centre et son angle (90 : debout). Les fonctions de construction (une porte, une pile, un mur) gardent
// les blocs posés pile les uns sur les autres : une tour mal empilée s'écroulerait toute seule.

import { SOL, type Matiere, type Forme, type GenreDeSlime, type GenreDeBoulet, SLIMES } from "./reglages";

export interface Bloc {
  matiere: Matiere;
  forme: Forme;
  x: number;
  y: number;
  angle?: number;                          // en degrés ; 90 : une poutre debout
}

export interface PlaceDeSlime {
  genre: GenreDeSlime;
  x: number;
  y: number;
}

export interface Niveau {
  nom: string;
  boulets: GenreDeBoulet[];                // dans l'ordre où on les tire
  blocs: Bloc[];
  slimes: PlaceDeSlime[];
}

// —— Les fonctions de construction. « base » : le haut de ce sur quoi on pose (le sol, un étage) ——

// Deux piliers debout et une poutre en travers : une porte de 160 de large et 180 de haut.
// Renvoie ses blocs, et la base de l'étage du dessus.
function porte(x: number, base: number, matiere: Matiere): { blocs: Bloc[]; dessus: number } {
  return {
    blocs: [
      { matiere, forme: "long", x: x - 70, y: base - 80, angle: 90 },
      { matiere, forme: "long", x: x + 70, y: base - 80, angle: 90 },
      { matiere, forme: "long", x, y: base - 170 },
    ],
    dessus: base - 180,
  };
}

// Une petite porte : deux poteaux courts et une planche, 80 de large et 100 de haut
function petitePorte(x: number, base: number, matiere: Matiere): { blocs: Bloc[]; dessus: number } {
  return {
    blocs: [
      { matiere, forme: "court", x: x - 30, y: base - 40, angle: 90 },
      { matiere, forme: "court", x: x + 30, y: base - 40, angle: 90 },
      { matiere, forme: "court", x, y: base - 90 },
    ],
    dessus: base - 100,
  };
}

// Une pile de carrés, de bas en haut
function pile(x: number, base: number, hauteur: number, matiere: Matiere): Bloc[] {
  return Array.from({ length: hauteur }, (_, i) => ({ matiere, forme: "carre" as const, x, y: base - 20 - i * 40 }));
}

// Une pyramide de carrés : « largeur » carrés en bas, un de moins à chaque rang
function pyramide(x: number, base: number, largeur: number, matiere: Matiere): Bloc[] {
  const blocs: Bloc[] = [];
  for (let rang = 0; rang < largeur; rang++) {
    const n = largeur - rang;
    for (let i = 0; i < n; i++) {
      blocs.push({ matiere, forme: "carre", x: x + (i - (n - 1) / 2) * 40, y: base - 20 - rang * 40 });
    }
  }
  return blocs;
}

// Un slime posé sur une base
const slime = (x: number, base: number, genre: GenreDeSlime = "slime"): PlaceDeSlime =>
  ({ genre, x, y: base - SLIMES[genre].rayon });

const etage = (...parties: { blocs: Bloc[] }[]) => parties.flatMap((p) => p.blocs);

// —— Les niveaux ——

function premierTir(): Niveau {
  const p = porte(900, SOL, "bois");
  return { nom: "Premier tir", boulets: ["boulet", "boulet", "boulet"], blocs: p.blocs, slimes: [slime(900, SOL)] };
}

function deuxEtages(): Niveau {
  const bas = porte(920, SOL, "bois");
  const haut = porte(920, bas.dessus, "bois");
  return {
    nom: "Deux étages", boulets: ["boulet", "boulet", "boulet"],
    blocs: etage(bas, haut), slimes: [slime(920, SOL), slime(920, bas.dessus)],
  };
}

function laGlace(): Niveau {
  return {
    nom: "Sur la glace", boulets: ["boulet", "boulet", "boulet"],
    blocs: [...pyramide(960, SOL, 5, "glace")],
    slimes: [slime(960, SOL - 200), slime(1120, SOL)],
  };
}

function leMurDePierre(): Niveau {
  const p = porte(1060, SOL, "bois");
  return {
    nom: "Le mur de pierre", boulets: ["lourd", "boulet", "boulet"],
    blocs: [...pile(820, SOL, 4, "pierre"), ...pile(860, SOL, 4, "pierre"), ...p.blocs],
    slimes: [slime(1060, SOL), slime(1060, p.dessus)],
  };
}

function lesJumelles(): Niveau {
  const a = porte(820, SOL, "bois");
  const b = porte(1100, SOL, "bois");
  const c = petitePorte(1100, b.dessus, "glace");
  return {
    nom: "Les jumelles", boulets: ["triple", "boulet", "boulet"],
    blocs: etage(a, b, c), slimes: [slime(820, SOL), slime(1100, SOL), slime(1100, c.dessus)],
  };
}

function leChef(): Niveau {
  const bas = porte(980, SOL, "pierre");
  const haut = porte(980, bas.dessus, "bois");
  return {
    nom: "Le chef", boulets: ["lourd", "triple", "boulet"],
    blocs: etage(bas, haut),
    slimes: [slime(980, SOL, "chef"), slime(980, bas.dessus), slime(980, haut.dessus)],
  };
}

function leChateau(): Niveau {
  const gauche = porte(820, SOL, "bois");
  const droite = porte(1140, SOL, "bois");
  const milieu = porte(980, SOL, "pierre");
  const tour = porte(980, milieu.dessus, "glace");
  return {
    nom: "Le château", boulets: ["boulet", "triple", "lourd", "boulet"],
    blocs: [...etage(gauche, milieu, droite, tour), ...pile(820, gauche.dessus, 2, "glace"), ...pile(1140, droite.dessus, 2, "glace")],
    slimes: [slime(820, SOL), slime(980, SOL, "chef"), slime(1140, SOL), slime(980, tour.dessus)],
  };
}

function laForteresse(): Niveau {
  const avant = porte(860, SOL, "pierre");
  const arriere = porte(1120, SOL, "pierre");
  const haut1 = petitePorte(860, avant.dessus, "bois");
  const haut2 = petitePorte(1120, arriere.dessus, "bois");
  return {
    nom: "La forteresse", boulets: ["lourd", "triple", "lourd", "boulet"],
    blocs: [...etage(avant, arriere, haut1, haut2), ...pile(990, SOL, 5, "glace")],
    slimes: [slime(860, SOL), slime(1120, SOL, "chef"), slime(860, haut1.dessus), slime(1120, haut2.dessus)],
  };
}

export const NIVEAUX: Niveau[] = [
  premierTir(), deuxEtages(), laGlace(), leMurDePierre(), lesJumelles(), leChef(), leChateau(), laForteresse(),
];
