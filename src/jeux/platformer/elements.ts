// Ce qu'est un niveau : une liste d'ÉLÉMENTS. Le jeu et l'éditeur lisent les mêmes.
// Du TypeScript pur : rien ne se dessine ici, que des données et des calculs.
//
// Le format est celui des fichiers de l'atelier (mes-niveaux/<nom>.json) : un niveau écrit par le
// jeu Python se joue ici tel quel, et inversement. Un élément a une « sorte » et le coin haut gauche
// de sa boîte (x, y), en pixels du monde (480 de haut, le sol des niveaux de départ est à 440) :
//   {"sorte": "plateforme", "x": 200, "y": 350, "w": 120, "h": 20, "genre": "glace", "force": 2, "sens": 1}
//   {"sorte": "ennemi", "type": "marcheur", "x": 550, "y": 410, "xmin": 450, "xmax": 820}
// Le trajet d'un ennemi (xmin, xmax...) fait partie de l'élément : ce que montre l'éditeur, c'est
// exactement ce que joue le jeu. Les vitesses (« v ») sont en pixels par image, comme dans l'atelier.

export type Sorte = "plateforme" | "mobile" | "piece" | "ennemi" | "boss" | "drapeau" | "depart";
export type TypeEnnemi = "marcheur" | "volant" | "sauteur";

// Un seul type pour toutes les sortes : chaque sorte n'utilise que ses champs à elle
export interface Element {
  sorte: Sorte;
  x: number;
  y: number;
  w?: number;                              // plateforme et mobile : la taille
  h?: number;
  genre?: string;                          // plateforme : son genre (normale, glace, lave...)
  force?: number;                          // plateforme : la force de son effet, de 1 à 3
  sens?: number;                           // plateforme : un tapis roulant va vers la droite (1) ou la gauche (-1)
  axe?: "x" | "y";                         // mobile : de gauche à droite, ou de haut en bas
  dist?: number;                           // mobile : la longueur de son aller
  v?: number;                              // mobile, ennemi : la vitesse, en pixels par image
  type?: TypeEnnemi;
  xmin?: number;                           // ennemi, boss : son trajet
  xmax?: number;
  ymin?: number;                           // volant : le haut et le bas de son cadre
  ymax?: number;
  sol?: number;                            // sauteur : le y sur lequel il rebondit
  taille?: number;                         // ennemi : sa taille (le mode infini en varie)
  hp?: number;                             // boss : ses vies
}

export interface Niveau {
  nom: string;
  largeur: number;
  elements: Element[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// La taille (largeur, hauteur) de ce qui n'est pas une plateforme
export const TAILLES: Record<string, [number, number]> = {
  piece: [16, 16], ennemi: [30, 30], drapeau: [16, 40], depart: [30, 40], boss: [64, 64],
};
export const TYPES_D_ENNEMIS: TypeEnnemi[] = ["marcheur", "volant", "sauteur"];
export const UNIQUES: Sorte[] = ["depart", "drapeau", "boss"];   // un seul par niveau : en poser un déplace l'ancien
export const NOMS: Record<string, string> = {
  plateforme: "Plateforme", mobile: "Plateforme mobile", piece: "Pièce", marcheur: "Ennemi marcheur",
  volant: "Ennemi volant", sauteur: "Ennemi sauteur", depart: "Départ du joueur",
  drapeau: "Drapeau d'arrivée", boss: "Boss",
};

export function estUnePlateforme(e: Element): boolean {
  return e.sorte === "plateforme" || e.sorte === "mobile";
}

export function rectDe(e: Element): Rect {
  if (estUnePlateforme(e)) {
    return { x: e.x, y: e.y, w: e.w!, h: e.h! };
  }
  const [w, h] = e.sorte === "ennemi" && e.taille ? [e.taille, e.taille] : TAILLES[e.sorte];
  return { x: e.x, y: e.y, w, h };
}

export function nomDe(e: Element): string {
  return NOMS[e.sorte === "ennemi" ? e.type! : e.sorte];
}

export function seTouchent(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// Ce qu'on peut poser, tel que la palette de l'éditeur le nomme : ["plateforme", "glace"], ["ennemi", "volant"]...
export type APoser = [Sorte, string?];

// Un élément tout neuf
export function nouvelElement(sorte: APoser, x: number, y: number): Element {
  const e: Element = { sorte: sorte[0], x, y };
  if (sorte[0] === "plateforme") {          // 10 de large : elle s'allonge pendant qu'on la trace
    Object.assign(e, { w: 10, h: 20, genre: sorte[1] ?? "normale", force: 2, sens: 1 });
  } else if (sorte[0] === "mobile") {
    Object.assign(e, { w: 10, h: 20, axe: "x", dist: 140, v: 2 });
  } else if (sorte[0] === "ennemi") {
    e.type = sorte[1] as TypeEnnemi;
  } else if (sorte[0] === "boss") {
    e.hp = 3;
  }
  return e;
}

// ==================================================================== Les trajets des ennemis

// La plateforme solide juste sous ses pieds : elle passe sous le milieu de ses pieds, et son dessus est
// tout près (juste au-dessus, ou jusqu'à 80 pixels plus bas). S'il y en a plusieurs, la plus haute.
export function plateformeSous(r: Rect, elements: Element[], solide: (genre: string) => boolean): Rect | null {
  let meilleure: Rect | null = null;
  const milieu = r.x + r.w / 2;
  const pieds = r.y + r.h;
  for (const e of elements) {
    if (e.sorte === "plateforme" && solide(e.genre!)) {
      const p = rectDe(e);
      if (p.x <= milieu && milieu <= p.x + p.w && pieds - 6 <= p.y && p.y <= pieds + 80) {
        if (!meilleure || p.y < meilleure.y) {
          meilleure = p;
        }
      }
    }
  }
  return meilleure;
}

// Un ennemi (ou le boss) qu'on vient de poser : son trajet suit la plateforme sous ses pieds.
// Le trajet contient toujours l'ennemi : sinon, il ferait demi-tour sur place.
export function calerLeTrajet(e: Element, elements: Element[], solide: (genre: string) => boolean) {
  const r = rectDe(e);
  if (e.sorte === "ennemi" && e.type === "volant") {      // un volant : un cadre autour de lui
    Object.assign(e, { xmin: r.x - 100, xmax: r.x + r.w + 100, ymin: r.y - 60, ymax: r.y + r.h + 60 });
    return;
  }
  if (e.sorte !== "ennemi" && e.sorte !== "boss") {
    return;
  }
  const sol = plateformeSous(r, elements, solide);
  let gauche: number;
  let droite: number;
  if (sol) {                                // un marcheur ou le boss : toute la longueur de sa plateforme
    e.y = sol.y - r.h;                      // il se pose dessus
    gauche = sol.x;
    droite = sol.x + sol.w;
  } else {                                  // en l'air : 100 pixels de chaque côté
    gauche = r.x - 100;
    droite = r.x + r.w + 100;
  }
  e.xmin = Math.min(gauche, e.x);
  e.xmax = Math.max(droite, e.x + r.w);
  if (e.sorte === "ennemi" && e.type === "sauteur") {
    e.sol = e.y + r.h;                      // il rebondit sur le haut de sa plateforme
  }
}

// L'élément, décalé de (dx, dy) par rapport à « depart » (une copie de lui avant le glissement).
// Son trajet le suit.
export function deplacer(e: Element, depart: Element, dx: number, dy: number) {
  for (const cle of ["x", "xmin", "xmax"] as const) {
    if (depart[cle] !== undefined) {
      e[cle] = depart[cle]! + dx;
    }
  }
  for (const cle of ["y", "ymin", "ymax", "sol"] as const) {
    if (depart[cle] !== undefined) {
      e[cle] = depart[cle]! + dy;
    }
  }
}

// ==================================================================== Lire un élément sans risque

const entier = (valeur: unknown): number => {
  const n = Number(valeur);
  if (valeur === null || valeur === "" || typeof valeur === "boolean" || !Number.isFinite(n)) {
    throw new Error("pas un nombre");
  }
  return Math.round(n);
};
const borne = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

// L'élément tel qu'on peut le jouer, ou null s'il est abîmé (une sauvegarde retouchée à la main...).
// On recopie chaque valeur en la vérifiant : un élément abîmé est laissé de côté, le jeu ne plante pas.
export function valider(brut: unknown): Element | null {
  try {
    const e = brut as Record<string, unknown>;
    const sorte = e.sorte as Sorte;
    const propre: Element = { sorte, x: entier(e.x), y: entier(e.y) };
    if (sorte === "plateforme") {
      Object.assign(propre, {
        w: Math.max(10, entier(e.w)), h: Math.max(10, entier(e.h)),
        genre: typeof e.genre === "string" ? e.genre : "normale",
        force: borne(e.force === undefined ? 2 : entier(e.force), 1, 3),
        sens: e.sens === -1 ? -1 : 1,
      });
    } else if (sorte === "mobile") {
      Object.assign(propre, {
        w: Math.max(10, entier(e.w)), h: Math.max(10, entier(e.h)),
        axe: e.axe === "y" ? "y" : "x",
        dist: e.dist === undefined ? 140 : entier(e.dist),
        v: Math.max(1, e.v === undefined ? 2 : entier(e.v)),
      });
    } else if (sorte === "ennemi") {
      if (!TYPES_D_ENNEMIS.includes(e.type as TypeEnnemi)) {
        return null;
      }
      propre.type = e.type as TypeEnnemi;
      for (const cle of ["xmin", "xmax", "ymin", "ymax", "sol"] as const) {
        if (e[cle] !== undefined) {
          propre[cle] = entier(e[cle]);
        }
      }
      if (propre.xmin === undefined || propre.xmax === undefined) {
        return null;
      }
      const [w, h] = TAILLES.ennemi;
      propre.xmax = Math.max(propre.xmax, propre.xmin + w);   // un trajet au moins aussi large que lui
      if (propre.type === "volant") {
        if (propre.ymin === undefined || propre.ymax === undefined) {
          return null;
        }
        propre.ymax = Math.max(propre.ymax, propre.ymin + h);
      }
      if (propre.type === "sauteur" && propre.sol === undefined) {
        propre.sol = propre.y + h;
      }
    } else if (sorte === "boss") {
      Object.assign(propre, { xmin: entier(e.xmin), xmax: entier(e.xmax), hp: Math.max(1, entier(e.hp)) });
      propre.xmax = Math.max(propre.xmax!, propre.xmin! + TAILLES.boss[0]);
    } else if (!(sorte in TAILLES)) {
      return null;
    }
    return propre;
  } catch {
    return null;
  }
}

// Un niveau entier, vérifié : null s'il est illisible. Un élément abîmé est laissé de côté.
export function validerNiveau(brut: unknown, nom: string): Niveau | null {
  try {
    const donnees = brut as Record<string, unknown>;
    if (!Array.isArray(donnees.elements)) {
      return null;
    }
    const largeur = Math.max(800, entier(donnees.largeur));   // au moins un écran de large
    const elements = donnees.elements.map(valider).filter((e): e is Element => e !== null);
    return { nom, largeur, elements };
  } catch {
    return null;
  }
}

// Ce qui empêcherait de finir ce niveau, ou ""
export function probleme(elements: Element[]): string {
  if (!elements.some((e) => e.sorte === "drapeau" || e.sorte === "boss")) {
    return "Pas d'arrivée : pose un drapeau (ou un boss)";
  }
  return "";
}
