// Les circuits : leur trace, leurs objets, et quelques calculs de géométrie.
// Ici, pas de Phaser : que des calculs. Phaser sait afficher et faire bouger, pas ce qu'est un tour de piste.

import { LARGEUR_ROUTE } from "./reglages";
import type { ModeleDeCircuit } from "./donnees";

export interface Point {
  x: number;
  y: number;
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
}

// Un nuage d'orage : sa place au repos, et de combien il se balance en travers de la route
export interface PlaceDOrage extends Emplacement {
  balancement: number;
  phase: number;                           // pour que les orages ne bougent pas tous ensemble
}

export interface Circuit {
  modele: ModeleDeCircuit;
  points: Point[];
  portes: Point[];                         // une au milieu de chaque côté
  angleDepart: number;
  trace: PointDeTrace[];
  longueur: number;
  fleches: Emplacement[];
  orages: PlaceDOrage[];
  bonbons: Emplacement[];
  etoiles: Emplacement[];
}

export function milieu(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Les portes : une au milieu de chaque côté. La route va de porte en porte, tirée vers chaque point.
export function portesDe(points: Point[]): Point[] {
  return points.map((p, i) => milieu(p, points[(i + 1) % points.length]));
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

// Un circuit prêt à courir : ses portes, sa trace et la place de ses objets
export function preparerCircuit(modele: ModeleDeCircuit): Circuit {
  const points = modele.points;
  const portes = portesDe(points);
  const { trace, longueur } = echantillonner(points, portes);
  const c: Circuit = {
    modele, points, portes, trace, longueur,
    angleDepart: Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x),
    fleches: [], orages: [], bonbons: [], etoiles: [],
  };
  placerObjets(c);
  return c;
}

// La trace : des points tous les 10 pixels environ sur le milieu de la route, de la ligne d'arrivée
// jusqu'à elle. Entre deux portes a et b, la route est une courbe de Bézier tirée vers le point k.
function echantillonner(points: Point[], portes: Point[]) {
  const n = points.length;
  const trace: PointDeTrace[] = [];
  for (let i = 1; i <= n; i++) {
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
  return { trace, longueur };
}

// Le numéro du point de la trace le plus proche de (x, y). Avec autour >= 0, on ne cherche qu'à côté
// de ce point-là : au croisement du Grand Huit, on reste ainsi sur sa propre branche.
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
export function surLaTrace(c: Circuit, place: number, decalage: number): Emplacement {
  const total = c.trace.length;
  const i = Math.floor((((place % 1) + 1) % 1) * total) % total;
  const p = c.trace[i];
  return { x: p.x + p.nx * decalage, y: p.y + p.ny * decalage, angle: Math.atan2(p.ty, p.tx), nx: p.nx, ny: p.ny };
}

function placerObjets(c: Circuit) {
  const { fleches = [], orages = [], bonbons = [] } = c.modele.objets;
  c.fleches = fleches.map(([place, decalage]) => surLaTrace(c, place, decalage));
  c.orages = orages.map(([place, decalage, balancement]) => ({
    ...surLaTrace(c, place, decalage), balancement, phase: place * 20,
  }));
  c.bonbons = bonbons.map(([place, decalage]) => surLaTrace(c, place, decalage));

  // Les étoiles, réparties sur le tour, à côté des autres objets
  const prises = [...fleches, ...orages, ...bonbons].map((objet) => objet[0]);
  const nombre = Math.max(4, Math.round(c.longueur / 1000));
  for (let k = 0; k < nombre; k++) {
    let place = (k + 0.5) / nombre;
    for (const autre of prises) {
      if (Math.abs(place - autre) < 0.03) {
        place += 0.045;
      }
    }
    c.etoiles.push(surLaTrace(c, place, [-45, 0, 45][k % 3]));
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

// Vrai si (x, y) est sur la route arc-en-ciel. On regarde d'abord autour du point « autour »
// (presque toujours suffisant), puis partout (au croisement du Grand Huit, la route d'à côté compte aussi).
export function surLaRoute(c: Circuit, x: number, y: number, autour = -1): boolean {
  const rayon2 = (LARGEUR_ROUTE / 2) ** 2;
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

// 1re, 2e, 3e... (ce sont des licornes)
export function rangTexte(rang: number): string {
  return rang === 1 ? "1re" : rang + "e";
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
