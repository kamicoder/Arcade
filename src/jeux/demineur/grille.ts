// La grille du démineur : les mines, les chiffres, la cascade, les drapeaux, gagner ou perdre.
// Du TypeScript pur, sans Phaser : la scène lui dit où l'on a cliqué, la grille lui répond ce qui
// s'est passé (quelles cases se sont ouvertes, et dans quel ordre), et la scène l'anime.

export type EtatDeCase = "cachee" | "ouverte" | "drapeau" | "question";
export type Issue = "" | "gagne" | "perdu";          // "" : on joue encore

export interface Case {
  etat: EtatDeCase;
  mine: boolean;
  autour: number;                                    // les mines qui la touchent, calculées une fois pour toutes
}

export interface Position {
  r: number;                                         // la rangée
  c: number;                                         // la colonne
}

// Une case ouverte par un clic, avec sa « vague » : 0 pour la case cliquée, 1 pour ses voisines
// ouvertes par la cascade, 2 pour les voisines de celles-ci... La scène s'en sert pour faire
// déferler l'ouverture comme une onde, au lieu de tout ouvrir d'un coup.
export interface Ouverture extends Position {
  vague: number;
}

export interface Coup {
  ouvertes: Ouverture[];
  boum: Position | null;                             // la mine qui a sauté
  premier: boolean;                                  // ce coup a posé les mines (et lance le chrono)
  issue: Issue;                                      // où en est la partie après ce coup
}

// Le hasard est une fonction qu'on peut remplacer : les tests imposent leurs mines, ou une graine
export type Hasard = () => number;

// Les 8 décalages vers les voisines
const AUTOUR: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

const SUIVANT: Partial<Record<EtatDeCase, EtatDeCase>> = {
  cachee: "drapeau",
  drapeau: "question",
  question: "cachee",
};

export class Grille {
  readonly cases: Case[][];
  minesPlacees = false;
  issue: Issue = "";
  explosion: Position | null = null;

  constructor(
    readonly rangees: number,
    readonly colonnes: number,
    readonly mines: number,
    private hasard: Hasard = Math.random,
  ) {
    this.cases = [];
    for (let r = 0; r < rangees; r++) {
      const ligne: Case[] = [];
      for (let c = 0; c < colonnes; c++) {
        ligne.push({ etat: "cachee", mine: false, autour: 0 });
      }
      this.cases.push(ligne);
    }
  }

  case(r: number, c: number): Case {
    return this.cases[r][c];
  }

  dedans(r: number, c: number): boolean {
    return r >= 0 && r < this.rangees && c >= 0 && c < this.colonnes;
  }

  voisines(r: number, c: number): Position[] {
    const liste: Position[] = [];
    for (const [dr, dc] of AUTOUR) {
      if (this.dedans(r + dr, c + dc)) {
        liste.push({ r: r + dr, c: c + dc });
      }
    }
    return liste;
  }

  // Les mines tombent au premier clic, jamais sur la case cliquée ni ses voisines : le premier clic
  // ouvre toujours une zone. « imposees » : des positions choisies d'avance (pour les tests).
  placerMines(r: number, c: number, imposees?: Position[]) {
    if (imposees) {
      for (const p of imposees) {
        this.cases[p.r][p.c].mine = true;
      }
    } else {
      const interdite = (p: Position) => Math.abs(p.r - r) <= 1 && Math.abs(p.c - c) <= 1;
      const chapeau: Position[] = [];
      for (let rr = 0; rr < this.rangees; rr++) {
        for (let cc = 0; cc < this.colonnes; cc++) {
          if (!interdite({ r: rr, c: cc })) {
            chapeau.push({ r: rr, c: cc });
          }
        }
      }
      // On tire sans remettre (Fisher-Yates, juste le début) : jamais deux mines sur la même case
      const nombre = Math.min(this.mines, chapeau.length);
      for (let i = 0; i < nombre; i++) {
        const j = i + Math.floor(this.hasard() * (chapeau.length - i));
        [chapeau[i], chapeau[j]] = [chapeau[j], chapeau[i]];
        this.cases[chapeau[i].r][chapeau[i].c].mine = true;
      }
    }
    for (let rr = 0; rr < this.rangees; rr++) {
      for (let cc = 0; cc < this.colonnes; cc++) {
        this.cases[rr][cc].autour = this.voisines(rr, cc).filter((p) => this.cases[p.r][p.c].mine).length;
      }
    }
    this.minesPlacees = true;
  }

  // Le clic principal : ouvrir une case fermée, ou faire « l'accord » sur un chiffre déjà ouvert
  clic(r: number, c: number, imposees?: Position[]): Coup {
    const coup: Coup = { ouvertes: [], boum: null, premier: false, issue: this.issue };
    const visee = this.cases[r][c];
    if (this.issue !== "" || visee.etat === "drapeau") {
      return coup;                                   // un drapeau protège sa case, même au premier clic
    }
    if (!this.minesPlacees) {
      this.placerMines(r, c, imposees);
      coup.premier = true;
    }
    if (visee.etat === "ouverte") {
      this.accord(r, c, coup);
    } else {
      this.ouvrir(r, c, 0, coup);
    }
    if (this.issue === "" && this.toutEstOuvert()) {
      this.gagner();
    }
    coup.issue = this.issue;
    return coup;
  }

  // Le clic droit fait un tour : drapeau, point d'interrogation, rien. Rien à faire sur une case ouverte.
  basculer(r: number, c: number): EtatDeCase {
    const laCase = this.cases[r][c];
    const suivant = SUIVANT[laCase.etat];
    if (this.issue === "" && suivant) {
      laCase.etat = suivant;
    }
    return laCase.etat;
  }

  drapeaux(): number {
    return this.compter((laCase) => laCase.etat === "drapeau");
  }

  // Le compteur de la barre : peut devenir négatif, si on a posé trop de drapeaux
  restantes(): number {
    return this.mines - this.drapeaux();
  }

  // ===== Ce qui se passe dans la grille

  // Ouvre une case. Si aucune mine ne la touche, la cascade ouvre ses voisines, et ainsi de suite.
  // Une file plutôt qu'une fonction qui s'appelle elle-même : on ouvre vague après vague (ce qui
  // donne l'ordre de l'animation), et une grande grille vide ne fait pas déborder la pile.
  private ouvrir(r: number, c: number, vagueDeDepart: number, coup: Coup) {
    const file: Ouverture[] = [{ r, c, vague: vagueDeDepart }];
    while (file.length > 0) {
      const ici = file.shift()!;
      const laCase = this.cases[ici.r][ici.c];
      if (laCase.etat === "ouverte" || laCase.etat === "drapeau") {
        continue;                                    // déjà ouverte, ou protégée par un drapeau
      }
      laCase.etat = "ouverte";
      coup.ouvertes.push(ici);
      if (laCase.mine) {
        this.perdre(ici, coup);
        return;
      }
      if (laCase.autour === 0) {
        for (const p of this.voisines(ici.r, ici.c)) {
          file.push({ ...p, vague: ici.vague + 1 });
        }
      }
    }
  }

  // « L'accord » : sur un chiffre dont tous les drapeaux sont posés, on ouvre le reste autour d'un coup.
  // Un drapeau mal placé, et c'est une mine qui s'ouvre.
  private accord(r: number, c: number, coup: Coup) {
    const laCase = this.cases[r][c];
    const autour = this.voisines(r, c);
    const drapeaux = autour.filter((p) => this.cases[p.r][p.c].etat === "drapeau").length;
    if (laCase.autour === 0 || drapeaux !== laCase.autour) {
      return;
    }
    for (const p of autour) {
      if (this.issue !== "") {
        return;                                      // une mine a sauté : on s'arrête
      }
      this.ouvrir(p.r, p.c, 1, coup);
    }
  }

  private perdre(ici: Position, coup: Coup) {
    this.issue = "perdu";
    this.explosion = { r: ici.r, c: ici.c };
    coup.boum = this.explosion;
    // On montre toutes les mines... sauf celles que l'on avait bien trouvées
    this.parcourir((laCase) => {
      if (laCase.mine && laCase.etat !== "drapeau") {
        laCase.etat = "ouverte";
      }
    });
  }

  private gagner() {
    this.issue = "gagne";
    // Toutes les mines restantes reçoivent leur drapeau : le compteur tombe à zéro
    this.parcourir((laCase) => {
      if (laCase.mine) {
        laCase.etat = "drapeau";
      }
    });
  }

  // Gagné quand il ne reste plus aucune case sans mine encore fermée
  private toutEstOuvert(): boolean {
    return this.compter((laCase) => !laCase.mine && laCase.etat !== "ouverte") === 0;
  }

  private parcourir(action: (laCase: Case, r: number, c: number) => void) {
    this.cases.forEach((ligne, r) => ligne.forEach((laCase, c) => action(laCase, r, c)));
  }

  private compter(test: (laCase: Case) => boolean): number {
    let total = 0;
    this.parcourir((laCase) => {
      if (test(laCase)) {
        total++;
      }
    });
    return total;
  }

  // Les mines à montrer après l'explosion, et les drapeaux qui étaient faux
  minesCachees(): Position[] {
    const liste: Position[] = [];
    this.parcourir((laCase, r, c) => {
      if (laCase.mine && laCase.etat === "ouverte" && !(this.explosion?.r === r && this.explosion?.c === c)) {
        liste.push({ r, c });
      }
    });
    return liste;
  }

  drapeauxFaux(): Position[] {
    const liste: Position[] = [];
    this.parcourir((laCase, r, c) => {
      if (!laCase.mine && laCase.etat === "drapeau") {
        liste.push({ r, c });
      }
    });
    return liste;
  }

  toutesLesMines(): Position[] {
    const liste: Position[] = [];
    this.parcourir((laCase, r, c) => {
      if (laCase.mine) {
        liste.push({ r, c });
      }
    });
    return liste;
  }
}

// Un hasard qui rejoue toujours la même suite à partir d'une graine (mulberry32)
export function hasardAvecGraine(graine: number): Hasard {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
