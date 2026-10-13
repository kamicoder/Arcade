// Les outils de l'éditeur. Un outil = une classe, comme dans l'atelier.
//
// Tous les outils ont les mêmes méthodes : appuyer (on clique, ou on pose le doigt), bouger (on
// glisse en tenant), relacher, abandonner (le niveau a changé sous lui), dessiner (ce qu'il montre
// en plus) et aide (la phrase de la barre du bas). L'éditeur ne sait pas ce que fait chaque outil :
// il lui passe le pointeur, c'est tout. Les positions sont celles du NIVEAU (la caméra a déjà
// défait le zoom et le défilement : getWorldPoint).
//
// La règle de tous les clics (sauf ceux de la Gomme et de la Main), dans cet ordre :
//   1. une poignée de l'élément choisi (ses carrés) : on la tire, quel que soit l'outil ;
//   2. un élément : on le prend (Poser laisse les plateformes : il pose dessus) ;
//   3. sinon, le travail de l'outil : la Sélection entoure, Poser pose.

import type Phaser from "phaser";
import {
  NOMS, TAILLES, UNIQUES, calerLeTrajet, deplacer, estUnePlateforme, nouvelElement, plateformeSous, rectDe,
  seTouchent, type APoser, type Element, type Rect,
} from "../elements";
import { EFFETS, type Fiche } from "../genres";
import { HAUTEUR_MONDE } from "../reglages";

export const AIMANT = 10;                  // avec l'aimant, tout se pose sur une grille de 10 pixels
export const CHOISI = 0xff7a1a;

export interface Point {
  x: number;
  y: number;
}

// Ce que les outils demandent à l'éditeur
export interface PourLesOutils {
  elements: Element[];
  selection: Element[];
  largeur: number;
  aPoser: APoser;
  readonly zoom: number;
  readonly multiple: boolean;              // Maj est tenue : on ajoute à la sélection
  aimanter(valeur: number): number;
  elementSous(p: Point): Element | null;
  choisir(elements: Element[]): void;
  choisirLOutil(nom: NomDOutil): void;
  retenir(): void;
  supprimer(elements: Element[]): void;
  fiche(genre: string): Fiche;
  glisserLaVue(dx: number, dy: number): void;   // en pixels d'écran
}

export type NomDOutil = "selection" | "gomme" | "main" | "poser";

const borne = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export abstract class Outil {
  appuyer(_ed: PourLesOutils, _p: Point, _ecran: Point) {}
  bouger(_ed: PourLesOutils, _p: Point, _ecran: Point) {}
  relacher(_ed: PourLesOutils) {}
  abandonner() {}
  dessiner(_g: Phaser.GameObjects.Graphics, _ed: PourLesOutils) {}
  abstract aide(ed: PourLesOutils): string;
}

// Ce qu'on tient : un glissement ou une poignée. Les deux se tirent pareil (bouger).
interface Prise {
  bouger(ed: PourLesOutils, p: Point): void;
}

// Faire glisser les éléments choisis : on garde une copie de chacun au début, et on les décale
// d'autant que le pointeur a bougé depuis. Le niveau n'est retenu (pour Annuler) qu'au premier
// vrai mouvement : un simple clic ne change rien.
class Glissement implements Prise {
  private copies: [Element, Element][];

  constructor(ed: PourLesOutils, private depart: Point, private retenu = false) {
    this.copies = ed.selection.map((e) => [e, { ...e }]);
  }

  bouger(ed: PourLesOutils, p: Point) {
    let dx = ed.aimanter(p.x - this.depart.x);
    let dy = ed.aimanter(p.y - this.depart.y);
    const rects = this.copies.map(([, copie]) => rectDe(copie));
    // Personne ne sort du niveau : on limite le décalage pour tout le groupe
    dx = borne(dx, Math.max(...rects.map((r) => -r.x)), Math.min(...rects.map((r) => ed.largeur - r.x - r.w)));
    dy = borne(dy, Math.max(...rects.map((r) => -r.y)), Math.min(...rects.map((r) => HAUTEUR_MONDE - r.y - r.h)));
    if ((dx || dy) && !this.retenu) {
      ed.retenir();
      this.retenu = true;
    }
    if (this.retenu) {
      for (const [e, copie] of this.copies) {
        deplacer(e, copie, dx, dy);
      }
    }
  }
}

// ==================================================================== Les poignées

const COINS = ["hg", "hd", "bg", "bd"];    // les coins d'une plateforme : en haut à gauche, en haut à droite...

// Les poignées d'un élément : [clé, point du niveau]. Un marcheur ou le boss : les deux bouts de sa
// ligne. Un volant : les quatre côtés de son cadre. Une plateforme : ses quatre coins.
export function poignees(e: Element): [string, Point][] {
  if (e.sorte === "boss" || (e.sorte === "ennemi" && e.type !== "volant")) {
    if (e.sorte === "ennemi" && e.type === "sauteur") {
      return [];                           // le sauteur rebondit sur place
    }
    const r = rectDe(e);
    const y = r.y + r.h - 3;               // à ses pieds
    return [["xmin", { x: e.xmin!, y }], ["xmax", { x: e.xmax!, y }]];
  }
  if (e.sorte === "ennemi") {
    const milieuX = (e.xmin! + e.xmax!) / 2;
    const milieuY = (e.ymin! + e.ymax!) / 2;
    return [["xmin", { x: e.xmin!, y: milieuY }], ["xmax", { x: e.xmax!, y: milieuY }],
      ["ymin", { x: milieuX, y: e.ymin! }], ["ymax", { x: milieuX, y: e.ymax! }]];
  }
  if (estUnePlateforme(e)) {
    const r = rectDe(e);
    return [["hg", { x: r.x, y: r.y }], ["hd", { x: r.x + r.w, y: r.y }],
      ["bg", { x: r.x, y: r.y + r.h }], ["bd", { x: r.x + r.w, y: r.y + r.h }]];
  }
  return [];
}

// La poignée de l'élément choisi sous le pointeur (à 10 pixels d'écran près, quel que soit le zoom)
function poigneeSous(ed: PourLesOutils, p: Point): Poignee | null {
  if (ed.selection.length !== 1) {
    return null;                           // les poignées ne se montrent qu'avec un seul élément choisi
  }
  const e = ed.selection[0];
  const portee = 10 / ed.zoom;
  for (const [cle, point] of poignees(e)) {
    if (Math.abs(point.x - p.x) <= portee && Math.abs(point.y - p.y) <= portee) {
      return new Poignee(e, cle);
    }
  }
  return null;
}

// Tirer une poignée : un bout du trajet d'un ennemi, ou un coin d'une plateforme
class Poignee implements Prise {
  private avant: Rect;
  private retenu = false;

  constructor(private element: Element, private cle: string) {
    this.avant = rectDe(element);          // la plateforme avant qu'on tire : le coin opposé n'en bouge pas
  }

  bouger(ed: PourLesOutils, p: Point) {
    // On essaie sur une copie : si rien ne change (le pointeur bute au bord), rien n'est retenu
    const copie = { ...this.element };
    if (COINS.includes(this.cle)) {
      redimensionner(ed, copie, this.cle, this.avant, p);
    } else {
      tirerLeTrajet(ed, copie, this.cle, p);
    }
    if (JSON.stringify(copie) !== JSON.stringify(this.element)) {
      if (!this.retenu) {
        ed.retenir();
        this.retenu = true;
      }
      Object.assign(this.element, copie);
    }
  }
}

// Un bout du trajet suit le pointeur ; le trajet garde l'ennemi dedans, et reste dans le niveau
function tirerLeTrajet(ed: PourLesOutils, e: Element, cle: string, p: Point) {
  const r = rectDe(e);
  if (cle === "xmin") {
    e.xmin = Math.min(Math.max(ed.aimanter(p.x), 0), r.x);
  } else if (cle === "xmax") {
    e.xmax = Math.max(Math.min(ed.aimanter(p.x), ed.largeur), r.x + r.w);
  } else if (cle === "ymin") {
    e.ymin = Math.min(Math.max(ed.aimanter(p.y), 0), r.y);
  } else {
    e.ymax = Math.max(Math.min(ed.aimanter(p.y), HAUTEUR_MONDE), r.y + r.h);
  }
}

// Le coin tenu suit le pointeur ; le coin opposé ne bouge pas. Au moins 20 de large, 10 de haut.
function redimensionner(ed: PourLesOutils, e: Element, coin: string, avant: Rect, p: Point) {
  const x = borne(ed.aimanter(p.x), 0, ed.largeur);
  const y = borne(ed.aimanter(p.y), 0, HAUTEUR_MONDE);
  let gauche = avant.x;
  let droite = avant.x + avant.w;
  let haut = avant.y;
  let bas = avant.y + avant.h;
  if (coin.includes("g")) {
    gauche = Math.min(x, droite - 20);
  } else {
    droite = Math.max(x, gauche + 20);
  }
  if (coin.includes("h")) {
    haut = Math.min(y, bas - 10);
  } else {
    bas = Math.max(y, haut + 10);
  }
  Object.assign(e, { x: gauche, y: haut, w: droite - gauche, h: bas - haut });
}

function aideDesPoignees(ed: PourLesOutils): string {
  if (ed.selection.length !== 1 || poignees(ed.selection[0]).length === 0) {
    return "";
  }
  return estUnePlateforme(ed.selection[0])
    ? " ; tire ses coins pour la redimensionner"
    : " ; tire les carrés blancs pour changer son trajet";
}

// ==================================================================== La sélection

export class Selection extends Outil {
  private prise: Prise | null = null;
  private lasso: [Point, Point] | null = null;

  appuyer(ed: PourLesOutils, p: Point) {
    this.prise = poigneeSous(ed, p);
    if (this.prise) {
      return;                              // 1. une poignée de l'élément choisi : on la tire
    }
    const element = ed.elementSous(p);
    if (!element) {                        // 3. dans le vide : on entoure (le lasso)
      ed.choisir([]);
      this.lasso = [p, p];
      return;
    }
    const deja = ed.selection.includes(element);   // 2. un élément : était-il déjà choisi ?
    if (ed.multiple) {
      if (!deja) {
        ed.choisir([...ed.selection, element]);   // Maj : on l'ajoute aux autres
      }
    } else if (!deja) {
      ed.choisir([element]);               // sinon, il est le seul choisi (déjà choisi : on garde le groupe)
    }
    this.prise = new Glissement(ed, p);
  }

  bouger(ed: PourLesOutils, p: Point) {
    if (this.prise) {
      this.prise.bouger(ed, p);
    } else if (this.lasso) {
      this.lasso = [this.lasso[0], p];
    }
  }

  relacher(ed: PourLesOutils) {
    if (this.lasso) {                      // tout ce que touche le lasso est choisi
      const cadre = this.cadreDuLasso()!;
      ed.choisir(ed.elements.filter((e) => seTouchent(cadre, rectDe(e))));
    }
    this.abandonner();
  }

  abandonner() {
    this.prise = null;
    this.lasso = null;
  }

  private cadreDuLasso(): Rect | null {
    if (!this.lasso) {
      return null;
    }
    const [a, b] = this.lasso;
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }

  dessiner(g: Phaser.GameObjects.Graphics, ed: PourLesOutils) {
    const cadre = this.cadreDuLasso();
    if (cadre) {
      g.lineStyle(1 / ed.zoom, 0xffffff).strokeRect(cadre.x, cadre.y, cadre.w, cadre.h);
    }
  }

  aide(ed: PourLesOutils): string {
    if (ed.selection.length > 0) {
      return "Glisse pour déplacer" + aideDesPoignees(ed) + " ; Copier, Coller, Suppr. (Maj : en ajouter)";
    }
    return "Clique un élément pour le choisir et le glisser ; entoure pour en prendre plusieurs";
  }
}

// ==================================================================== La gomme

export class Gomme extends Outil {
  private efface = false;                  // le bouton est-il tenu ?

  appuyer(ed: PourLesOutils, p: Point) {
    this.efface = true;
    this.gommer(ed, p);
  }

  bouger(ed: PourLesOutils, p: Point) {
    if (this.efface) {
      this.gommer(ed, p);
    }
  }

  relacher() {
    this.efface = false;
  }

  abandonner() {
    this.efface = false;
  }

  private gommer(ed: PourLesOutils, p: Point) {
    const element = ed.elementSous(p);
    if (element) {
      ed.supprimer([element]);
    }
  }

  aide(): string {
    return "Gomme : touche ou glisse sur ce que tu veux effacer (le départ, lui, reste)";
  }
}

// ==================================================================== La main (pour le doigt)

// Glisser la vue : au doigt, il n'y a ni molette ni bouton du milieu
export class Main extends Outil {
  private dernier: Point | null = null;

  appuyer(_ed: PourLesOutils, _p: Point, ecran: Point) {
    this.dernier = ecran;
  }

  bouger(ed: PourLesOutils, _p: Point, ecran: Point) {
    if (this.dernier) {
      // La vue glisse à l'envers du doigt : on « tire » le niveau avec la main
      ed.glisserLaVue(this.dernier.x - ecran.x, this.dernier.y - ecran.y);
      this.dernier = ecran;
    }
  }

  relacher() {
    this.dernier = null;
  }

  abandonner() {
    this.dernier = null;
  }

  aide(): string {
    return "Main : glisse pour faire défiler le niveau (ou le bouton du milieu, ou les flèches)";
  }
}

// ==================================================================== Poser

// Pose ce qui est choisi dans la palette. Une plateforme se trace en glissant ; le reste se pose d'un
// clic, se glisse tant qu'on tient, et se cale quand on lâche.
export class Poser extends Outil {
  private trace: [Element, Point] | null = null;
  private prise: Prise | null = null;
  private pose: Element | null = null;

  appuyer(ed: PourLesOutils, p: Point) {
    const sorte = ed.aPoser;
    this.prise = poigneeSous(ed, p);
    if (this.prise) {
      return;                              // 1. une poignée de l'élément choisi : on la tire
    }
    const element = ed.elementSous(p);
    if (element && !estUnePlateforme(element)) {
      ed.choisir([element]);               // 2. une pièce, un ennemi... : on le prend, sans en poser un autre dessus
      this.prise = new Glissement(ed, p);
      return;
    }
    ed.retenir();                          // poser change le niveau : on retient tout de suite
    if (sorte[0] === "plateforme" || sorte[0] === "mobile") {
      const debut = { x: borne(ed.aimanter(p.x), 0, ed.largeur - 10), y: borne(ed.aimanter(p.y), 0, HAUTEUR_MONDE - 10) };
      const e = nouvelElement(sorte, debut.x, debut.y);
      ed.elements.push(e);
      this.trace = [e, debut];
      return;
    }
    if (UNIQUES.includes(sorte[0])) {      // un seul départ, un seul drapeau, un seul boss
      ed.elements = ed.elements.filter((e) => e.sorte !== sorte[0]);
    }
    const [w, h] = TAILLES[sorte[0]];
    // L'élément se pose centré sous le pointeur, sans sortir du niveau
    const x = borne(ed.aimanter(p.x - w / 2), 0, ed.largeur - w);
    const y = borne(ed.aimanter(p.y - h / 2), 0, HAUTEUR_MONDE - h);
    const e = nouvelElement(sorte, x, y);
    calerLeTrajet(e, ed.elements, (genre) => ed.fiche(genre).solide);   // un élément est toujours complet, même tenu
    ed.elements.push(e);
    ed.choisir([e]);
    this.pose = e;
    this.prise = new Glissement(ed, p, true);
  }

  bouger(ed: PourLesOutils, p: Point) {
    if (this.trace) {                      // on trace : la plateforme va du point de départ au pointeur
      const [e, debut] = this.trace;
      const x = borne(ed.aimanter(p.x), 0, ed.largeur);
      const y = borne(ed.aimanter(p.y), 0, HAUTEUR_MONDE);
      e.x = Math.min(debut.x, x);
      e.w = Math.max(AIMANT, Math.abs(x - debut.x));
      e.y = Math.min(debut.y, y);
      e.h = Math.max(10, Math.abs(y - debut.y));
    } else if (this.prise) {
      this.prise.bouger(ed, p);
    }
  }

  relacher(ed: PourLesOutils) {
    if (this.trace) {
      const [e] = this.trace;
      if (e.w! <= AIMANT && e.h! <= 20) {   // un simple clic : une plateforme de taille normale
        e.w = Math.min(120, ed.largeur - e.x);
        e.h = 20;
      }
      ed.choisir([e]);
      ed.choisirLOutil("selection");       // pour l'ajuster tout de suite
    } else if (this.pose) {
      const e = this.pose;
      const solide = (genre: string) => ed.fiche(genre).solide;
      if (e.sorte === "depart" || e.sorte === "drapeau") {
        // On cherche un sol à partir d'un peu plus haut, s'il a été posé dans la plateforme
        const r = rectDe(e);
        const sol = plateformeSous({ ...r, y: r.y - 30 }, ed.elements, solide);
        if (sol) {                         // le départ et le drapeau se posent sur le sol
          e.y = sol.y - r.h;
        }
      }
      calerLeTrajet(e, ed.elements, solide);   // un ennemi : son trajet, sur sa plateforme
    }
    this.abandonner();
  }

  abandonner() {
    this.trace = null;
    this.prise = null;
    this.pose = null;
  }

  aide(ed: PourLesOutils): string {
    const sorte = ed.aPoser;
    if (sorte[0] === "plateforme") {
      const fiche = ed.fiche(sorte[1]!);
      const solide = fiche.solide ? "solide" : "traversable";
      return `Glisse pour tracer une plateforme « ${sorte[1]} » (${solide}, effet : ${EFFETS[fiche.effet].toLowerCase()})`;
    }
    if (sorte[0] === "mobile") {
      return "Glisse pour tracer une plateforme mobile";
    }
    return NOMS[sorte[sorte.length - 1]!] + " : touche le niveau pour le poser ; toucher un objet le prend" + aideDesPoignees(ed);
  }
}

// Le cadre orange autour de ce qui est choisi, et ses poignées quand il est seul
export function dessinerLaSelection(g: Phaser.GameObjects.Graphics, ed: PourLesOutils) {
  const z = ed.zoom;
  for (const e of ed.selection) {
    const r = rectDe(e);
    const marge = 3 / z;
    g.lineStyle(4 / z, 0x14141e).strokeRect(r.x - marge, r.y - marge, r.w + 2 * marge, r.h + 2 * marge);
    g.lineStyle(2 / z, CHOISI).strokeRect(r.x - marge, r.y - marge, r.w + 2 * marge, r.h + 2 * marge);
  }
  if (ed.selection.length === 1) {
    const cote = 12 / z;
    for (const [cle, point] of poignees(ed.selection[0])) {
      // Les coins en orange, les bouts du trajet en blanc
      g.fillStyle(COINS.includes(cle) ? CHOISI : 0xffffff).fillRect(point.x - cote / 2, point.y - cote / 2, cote, cote);
      g.lineStyle(1 / z, 0x14141e).strokeRect(point.x - cote / 2, point.y - cote / 2, cote, cote);
    }
  }
}

// Le trajet d'un ennemi choisi, en pointillés : une ligne pour un marcheur (ou le boss), un cadre pour
// un volant. Celui d'une plateforme mobile : où elle ira.
export function dessinerLesTrajets(g: Phaser.GameObjects.Graphics, ed: PourLesOutils) {
  const z = ed.zoom;
  const pointilles = (x1: number, y1: number, x2: number, y2: number) => {
    const longueur = Math.hypot(x2 - x1, y2 - y1);
    const pas = 8 / z;
    for (let d = 0; d < longueur; d += 2 * pas) {
      const a = d / longueur;
      const b = Math.min(1, (d + pas) / longueur);
      g.lineBetween(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b);
    }
  };
  g.lineStyle(2 / z, 0xffffff, 0.8);
  for (const e of ed.selection) {
    const r = rectDe(e);
    if (e.sorte === "ennemi" && e.type === "volant") {
      pointilles(e.xmin!, e.ymin!, e.xmax!, e.ymin!);
      pointilles(e.xmax!, e.ymin!, e.xmax!, e.ymax!);
      pointilles(e.xmax!, e.ymax!, e.xmin!, e.ymax!);
      pointilles(e.xmin!, e.ymax!, e.xmin!, e.ymin!);
    } else if (e.sorte === "boss" || (e.sorte === "ennemi" && e.type === "marcheur")) {
      pointilles(e.xmin!, r.y + r.h - 3, e.xmax!, r.y + r.h - 3);
    } else if (e.sorte === "mobile") {
      const dx = e.axe === "x" ? e.dist! : 0;
      const dy = e.axe === "y" ? e.dist! : 0;
      g.strokeRect(r.x + dx, r.y + dy, r.w, r.h);
      pointilles(r.x + r.w / 2, r.y + r.h / 2, r.x + r.w / 2 + dx, r.y + r.h / 2 + dy);
    }
  }
}
