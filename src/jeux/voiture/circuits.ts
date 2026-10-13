// Les circuits : leurs points, leur trace, et ce qu'on trouve sur la route.
// Ici, pas de Phaser : que des calculs. Phaser sait afficher et faire bouger, pas ce qu'est un tour de piste.

export const LARGEUR_ROUTE = 150;
export const LIMITE = LARGEUR_ROUTE / 2 + 75;   // plus loin du milieu de la route : la barrière de pneus

export interface Point {
  x: number;
  y: number;
}

// Un objet sur la route : sa place le long du tour (0 : la ligne d'arrivée, 0.5 : la moitié)
// et son décalage sur le côté (0 : au milieu de la route)
type PlaceSurLeTour = [place: number, decalage: number];

export interface ModeleDeCircuit {
  id: string;                              // le nom de sa sauvegarde
  nom: string;
  largeur: number;
  hauteur: number;
  points: Point[];                         // la route passe près de ces points, dans l'ordre, puis revient au premier
  bidons: PlaceSurLeTour[];
  fleches: PlaceSurLeTour[];
  huiles: PlaceSurLeTour[];
}

// Un point de la trace : le milieu de la route, sa distance depuis la ligne (d) et la direction de la route
export interface PointDeTrace extends Point {
  d: number;
  angle: number;
}

export interface Emplacement extends Point {
  angle: number;
}

export interface Circuit {
  modele: ModeleDeCircuit;
  points: Point[];
  portes: Point[];                         // une au milieu de chaque côté
  angleDepart: number;
  trace: PointDeTrace[];
  longueur: number;
  bidons: Emplacement[];
  fleches: Emplacement[];
  huiles: Emplacement[];
}

export const CIRCUITS: ModeleDeCircuit[] = [
  {
    id: "mon-premier-circuit",
    nom: "Le Vallon",
    largeur: 2600,
    hauteur: 1800,
    points: [
      { x: 400, y: 1100 }, { x: 400, y: 450 }, { x: 550, y: 250 }, { x: 950, y: 250 },
      { x: 1150, y: 500 }, { x: 1300, y: 800 }, { x: 1500, y: 500 }, { x: 1700, y: 280 },
      { x: 2200, y: 280 }, { x: 2380, y: 500 }, { x: 2380, y: 950 }, { x: 2150, y: 1100 },
      { x: 1650, y: 1100 }, { x: 1300, y: 1250 }, { x: 1100, y: 1600 }, { x: 600, y: 1650 },
      { x: 400, y: 1450 },
    ],
    bidons: [[0.2, -30], [0.2, 30], [0.65, 0]],
    fleches: [[0.08, 0], [0.55, 0]],
    huiles: [[0.35, -35], [0.85, 35]],
  },
  {
    id: "grande-boucle",
    nom: "La Grande Boucle",
    largeur: 2600,
    hauteur: 1500,
    points: [
      { x: 500, y: 1150 }, { x: 350, y: 750 }, { x: 500, y: 350 }, { x: 1000, y: 250 },
      { x: 1400, y: 450 }, { x: 1800, y: 250 }, { x: 2200, y: 350 }, { x: 2300, y: 750 },
      { x: 2150, y: 1150 }, { x: 1700, y: 1250 }, { x: 1300, y: 1050 }, { x: 900, y: 1250 },
    ],
    bidons: [[0.3, 0], [0.75, -30], [0.75, 30]],
    fleches: [[0.12, 0], [0.45, 0], [0.9, 0]],
    huiles: [[0.6, 0]],
  },
  {
    id: "huit",
    nom: "Le Huit",
    largeur: 2600,
    hauteur: 1800,
    points: [
      { x: 2350, y: 900 }, { x: 2150, y: 1450 }, { x: 1790, y: 1500 }, { x: 1520, y: 1240 },
      { x: 1300, y: 900 }, { x: 1080, y: 560 }, { x: 810, y: 300 }, { x: 450, y: 350 },
      { x: 250, y: 900 }, { x: 450, y: 1450 }, { x: 810, y: 1500 }, { x: 1080, y: 1240 },
      { x: 1300, y: 900 }, { x: 1520, y: 560 }, { x: 1790, y: 310 }, { x: 2150, y: 350 },
    ],
    bidons: [[0.15, 0], [0.5, -30], [0.5, 30], [0.85, 0]],
    fleches: [[0.05, 0], [0.4, 0], [0.7, 0]],
    huiles: [[0.25, 35], [0.62, -35], [0.95, 0]],
  },
];

function milieu(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// La différence entre deux angles, ramenée entre -π et π : de combien tourner, et de quel côté
export function angleEntre(a: number, b: number): number {
  let ecart = a - b;
  while (ecart > Math.PI) {
    ecart -= 2 * Math.PI;
  }
  while (ecart < -Math.PI) {
    ecart += 2 * Math.PI;
  }
  return ecart;
}

// Un circuit prêt à courir : ses portes, sa trace et ses objets
export function preparerCircuit(modele: ModeleDeCircuit): Circuit {
  const points = modele.points;
  const n = points.length;
  // Les portes : une au milieu de chaque côté. La route va de porte en porte, tirée vers chaque point.
  const portes = points.map((p, i) => milieu(p, points[(i + 1) % n]));
  const { trace, longueur } = tracer(points, portes);
  const c: Circuit = {
    modele,
    points,
    portes,
    angleDepart: Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x),
    trace,
    longueur,
    bidons: [],
    fleches: [],
    huiles: [],
  };
  c.bidons = modele.bidons.map(([place, decalage]) => surLaTrace(c, place, decalage));
  c.fleches = modele.fleches.map(([place, decalage]) => surLaTrace(c, place, decalage));
  c.huiles = modele.huiles.map(([place, decalage]) => surLaTrace(c, place, decalage));
  return c;
}

// La trace : des points tous les 10 pixels environ, au milieu de la route, depuis la ligne d'arrivée.
// Entre deux portes a et b, la route est une courbe de Bézier tirée vers le point k.
function tracer(points: Point[], portes: Point[]) {
  const n = points.length;
  const trace: PointDeTrace[] = [];
  for (let i = 1; i <= n; i++) {
    const a = portes[i - 1];
    const k = points[i % n];
    const b = portes[i % n];
    const longueur = Math.hypot(k.x - a.x, k.y - a.y) + Math.hypot(b.x - k.x, b.y - k.y);
    const pas = Math.ceil(longueur / 10);
    for (let j = 0; j < pas; j++) {
      const t = j / pas;                   // de 0 (en a) à presque 1 (en b)
      const u = 1 - t;
      trace.push({
        x: u * u * a.x + 2 * u * t * k.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * k.y + t * t * b.y,
        d: 0,
        angle: 0,
      });
    }
  }
  const total = trace.length;
  let d = 0;
  for (let i = 0; i < total; i++) {
    const point = trace[i];
    const avant = trace[(i - 1 + total) % total];
    const apres = trace[(i + 1) % total];
    if (i > 0) {
      d += Math.hypot(point.x - avant.x, point.y - avant.y);
    }
    point.d = d;
    point.angle = Math.atan2(apres.y - avant.y, apres.x - avant.x);
  }
  const longueur = d + Math.hypot(trace[0].x - trace[total - 1].x, trace[0].y - trace[total - 1].y);
  return { trace, longueur };
}

// Le numéro du point de la trace le plus proche de (x, y). On ne cherche qu'autour de celui
// d'avant : au croisement du Huit, on reste ainsi sur sa branche.
export function plusProche(c: Circuit, x: number, y: number, autour: number): number {
  const total = c.trace.length;
  let meilleur = autour;
  let distanceMin = Infinity;
  for (let k = -40; k <= 40; k++) {
    const i = (autour + k + total) % total;
    const distance = Math.hypot(c.trace[i].x - x, c.trace[i].y - y);
    if (distance < distanceMin) {
      distanceMin = distance;
      meilleur = i;
    }
  }
  return meilleur;
}

// Vrai si (x, y) est sur la route : à moins d'une demi-route d'un point de la trace, n'importe lequel
export function surLaRoute(c: Circuit, x: number, y: number): boolean {
  const rayon2 = (LARGEUR_ROUTE / 2) ** 2;
  for (const p of c.trace) {
    const dx = p.x - x;
    const dy = p.y - y;
    if (dx * dx + dy * dy < rayon2) {
      return true;
    }
  }
  return false;
}

// Un endroit du circuit : une place le long du tour, et un décalage sur le côté
export function surLaTrace(c: Circuit, place: number, decalage: number): Emplacement {
  const point = c.trace[Math.floor(place * c.trace.length) % c.trace.length];
  return {
    x: point.x - Math.sin(point.angle) * decalage,   // le côté : la direction de la route, tournée d'un quart de tour
    y: point.y + Math.cos(point.angle) * decalage,
    angle: point.angle,
  };
}

// Un temps en secondes, écrit comme un chrono : 1:05.32
export function chrono(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  return minutes + ":" + (secondes % 60).toFixed(2).padStart(5, "0");
}

// 1er, 2e, 3e...
export function rang(place: number): string {
  return place === 1 ? "1er" : place + "e";
}
