// Les circuits : leur trace, la place de leurs objets, et quelques calculs de géométrie.
// Ici, pas de Phaser : que des calculs. Phaser sait afficher et faire bouger, pas ce qu'est un tour de piste.

import type { Theme, TypeDObjet } from "./theme";

export interface Point {
  x: number;
  y: number;
}

// Un objet posé sur le tour : sa place (0 = la ligne, 0.5 = la moitié), son décalage sur le côté,
// et de combien il se balance en travers de la route (0 : il ne bouge pas)
export type PlaceSurLeTour = [place: number, decalage: number, balancement?: number];

export interface ModeleDeCircuit {
  id: string;                              // le nom de sa sauvegarde (course/<theme>/record/<id>)
  nom: string;
  largeur: number;
  hauteur: number;
  points: Point[];                         // la route passe près de ces points, dans l'ordre, puis revient au premier
  objets: Record<string, PlaceSurLeTour[]>;   // pour chaque type d'objet du thème, ses places
}

// Un point de la trace : le milieu de la route, sa distance depuis la ligne (s),
// la direction de la route (tx, ty) et son côté droit (nx, ny), tous deux longs de 1
export interface PointDeTrace extends Point {
  s: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
}

export interface Emplacement extends Point {
  angle: number;
  nx: number;
  ny: number;
  balancement: number;
  phase: number;                           // pour que les objets qui bougent ne bougent pas tous ensemble
}

export interface Circuit {
  modele: ModeleDeCircuit;
  points: Point[];
  portes: Point[];                         // une au milieu de chaque côté
  distancesDesPortes: number[];            // où est chaque porte le long du tour (la première : la ligne, 0)
  angleDepart: number;
  trace: PointDeTrace[];
  longueur: number;
  largeurRoute: number;
  barriere: number;                        // la distance de la barrière au milieu de la route
  objets: { type: TypeDObjet; place: Emplacement }[];
}

// Le monde des circuits dessinés, et combien de points on peut y poser
export const MONDE_EDITEUR = { largeur: 2600, hauteur: 1800 };
export const POINTS_MIN = 4;
export const POINTS_MAX = 10;              // au-delà, le circuit devient vite un sac de nœuds
export const ID_CIRCUIT_DESSINE = "dessine";

export function milieu(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Les portes : une au milieu de chaque côté. La route va de porte en porte, tirée vers chaque point.
export function portesDe(points: Point[]): Point[] {
  return points.map((p, i) => milieu(p, points[(i + 1) % points.length]));
}

// Le chemin de la route pour le pinceau du navigateur : la même courbe que la trace
export function cheminDeRoute(points: Point[]): Path2D {
  const n = points.length;
  const portes = portesDe(points);
  const route = new Path2D();
  route.moveTo(portes[n - 1].x, portes[n - 1].y);
  for (let i = 0; i < n; i++) {
    route.quadraticCurveTo(points[i].x, points[i].y, portes[i].x, portes[i].y);
  }
  return route;
}

// Un angle ramené entre -π et π : de combien tourner, et de quel côté
export function angleEntre(a: number): number {
  while (a > Math.PI) {
    a -= Math.PI * 2;
  }
  while (a < -Math.PI) {
    a += Math.PI * 2;
  }
  return a;
}

// Le circuit dessiné dans l'éditeur, avec les objets que le thème y met
export function modeleDuCircuitDessine(theme: Theme, points: Point[]): ModeleDeCircuit {
  return {
    id: ID_CIRCUIT_DESSINE, nom: "Mon circuit", largeur: MONDE_EDITEUR.largeur, hauteur: MONDE_EDITEUR.hauteur,
    points, objets: theme.objetsDuCircuitDessine,
  };
}

// Un circuit prêt à courir : ses portes, sa trace et la place de ses objets
export function preparerCircuit(modele: ModeleDeCircuit, theme: Theme): Circuit {
  const points = modele.points;
  const portes = portesDe(points);
  const { trace, longueur, distancesDesPortes } = echantillonner(points, portes);
  const c: Circuit = {
    modele, points, portes, distancesDesPortes, trace, longueur,
    largeurRoute: theme.route.largeur,
    barriere: theme.route.barriere,
    angleDepart: Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x),
    objets: [],
  };
  placerObjets(c, theme.objets);
  return c;
}

// La trace : des points tous les 10 pixels environ sur le milieu de la route, de la ligne d'arrivée
// jusqu'à elle. Entre deux portes a et b, la route est une courbe de Bézier tirée vers le point k.
function echantillonner(points: Point[], portes: Point[]) {
  const n = points.length;
  const trace: PointDeTrace[] = [];
  const debuts: number[] = [];             // le point de la trace où commence chaque côté : sa porte
  for (let i = 1; i <= n; i++) {
    debuts.push(trace.length);
    const a = portes[i - 1];
    const k = points[i % n];
    const b = portes[i % n];
    const pas = Math.max(2, Math.ceil((Math.hypot(k.x - a.x, k.y - a.y) + Math.hypot(b.x - k.x, b.y - k.y)) / 10));
    for (let j = 0; j < pas; j++) {
      const t = j / pas;
      const u = 1 - t;
      trace.push({
        x: u * u * a.x + 2 * u * t * k.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * k.y + t * t * b.y,
        s: 0, tx: 1, ty: 0, nx: 0, ny: 1,
      });
    }
  }
  const total = trace.length;
  let s = 0;
  for (let i = 0; i < total; i++) {
    if (i > 0) {
      s += Math.hypot(trace[i].x - trace[i - 1].x, trace[i].y - trace[i - 1].y);
    }
    const p = trace[i];
    p.s = s;
    const avant = trace[(i - 1 + total) % total];
    const apres = trace[(i + 1) % total];
    const dx = apres.x - avant.x;
    const dy = apres.y - avant.y;
    const d = Math.hypot(dx, dy) || 1;
    p.tx = dx / d;
    p.ty = dy / d;
    p.nx = -dy / d;
    p.ny = dx / d;
  }
  const longueur = s + Math.hypot(trace[0].x - trace[total - 1].x, trace[0].y - trace[total - 1].y);
  return { trace, longueur, distancesDesPortes: debuts.map((i) => trace[i].s) };
}

// Le numéro du point de la trace le plus proche de (x, y). Avec autour >= 0, on ne cherche qu'à côté
// de ce point-là : au croisement d'un huit, on reste ainsi sur sa propre branche.
export function plusProche(c: Circuit, x: number, y: number, autour: number): number {
  const t = c.trace;
  const total = t.length;
  let meilleur = 0;
  let distanceMin = Infinity;
  const debut = autour < 0 ? 0 : -60;
  const fin = autour < 0 ? total - 1 : 60;
  for (let k = debut; k <= fin; k++) {
    const i = autour < 0 ? k : (autour + k + total) % total;
    const d = (t[i].x - x) ** 2 + (t[i].y - y) ** 2;
    if (d < distanceMin) {
      distanceMin = d;
      meilleur = i;
    }
  }
  return meilleur;
}

// Une place le long du tour (0 à 1) et un décalage sur le côté
export function surLaTrace(c: Circuit, place: number, decalage: number, balancement = 0): Emplacement {
  const total = c.trace.length;
  const i = Math.floor((((place % 1) + 1) % 1) * total) % total;
  const p = c.trace[i];
  return {
    x: p.x + p.nx * decalage, y: p.y + p.ny * decalage, angle: Math.atan2(p.ty, p.tx), nx: p.nx, ny: p.ny,
    balancement, phase: place * 20,
  };
}

function placerObjets(c: Circuit, types: TypeDObjet[]) {
  const places = c.modele.objets;
  for (const type of types.filter((t) => !t.auto)) {
    for (const [place, decalage, balancement] of places[type.id] ?? []) {
      c.objets.push({ type, place: surLaTrace(c, place, decalage, balancement ?? 0) });
    }
  }
  // Les objets posés tout seuls (les étoiles) : répartis sur le tour, à côté des autres objets
  const prises = Object.values(places).flat().map((objet) => objet[0]);
  for (const type of types.filter((t) => t.auto)) {
    const nombre = Math.max(4, Math.round(c.longueur / 1000));
    for (let k = 0; k < nombre; k++) {
      let place = (k + 0.5) / nombre;
      for (const autre of prises) {
        if (Math.abs(place - autre) < 0.03) {
          place += 0.045;
        }
      }
      c.objets.push({ type, place: surLaTrace(c, place, [-45, 0, 45][k % 3]) });
    }
  }
}

// La distance de (x, y) au milieu de la route, en cherchant partout
export function distanceALaTrace(c: Circuit, x: number, y: number): number {
  let distanceMin = Infinity;
  for (const p of c.trace) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < distanceMin) {
      distanceMin = d;
    }
  }
  return Math.sqrt(distanceMin);
}

// Vrai si (x, y) est sur la route. On regarde d'abord autour du point « autour » (presque toujours
// suffisant), puis partout (au croisement d'un huit, la route d'à côté compte aussi).
export function surLaRoute(c: Circuit, x: number, y: number, autour = -1): boolean {
  const rayon2 = (c.largeurRoute / 2) ** 2;
  const t = c.trace;
  const total = t.length;
  if (autour >= 0) {
    for (let k = -30; k <= 30; k++) {
      const p = t[(autour + k + total) % total];
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < rayon2) {
        return true;
      }
    }
  }
  for (const p of t) {
    if ((p.x - x) ** 2 + (p.y - y) ** 2 < rayon2) {
      return true;
    }
  }
  return false;
}

// Un temps en secondes, écrit comme un chrono : 1:05.32
export function chrono(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  return minutes + ":" + (secondes % 60).toFixed(2).padStart(5, "0");
}

// Un hasard qui donne toujours les mêmes nombres : le décor ne change pas d'une partie à l'autre
export function hasard(graine: number): () => number {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function melanger<T>(liste: T[]): T[] {
  const copie = liste.slice();
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

// Une empreinte courte d'un texte : pour nommer une texture d'après ce qu'elle montre
export function empreinte(texte: string): string {
  let h = 0;
  for (let i = 0; i < texte.length; i++) {
    h = (Math.imul(h, 31) + texte.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
