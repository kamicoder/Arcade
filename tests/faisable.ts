// Un niveau est-il faisable, en théorie ? Du départ, le héros peut-il atteindre le drapeau (ou le boss)
// en courant et en sautant ? Un calcul à part du jeu, grossier exprès : les ennemis ne comptent pas, ni
// les plafonds (seuls les murs qui barrent le passage). Les sauts, eux, suivent la physique du héros
// (reglages.ts), simulée ici pas à pas. La difficulté se juge en jouant ; ceci vérifie seulement qu'un
// niveau de départ n'est pas impossible.
// Les sauts sont des sauts complets : la touche tenue (lâchée tôt, le saut court monte moins, SAUT_COURT).
// Pour le double saut, le joueur la lâche puis la renfonce : le saut d'avant n'est raccourci que pendant
// ce bref instant, que le nouveau saut efface (il repart à pleine vitesse). On n'en tient pas compte.

import { VITESSE, GRAVITE, SAUT, REBONDS, CHUTE_MAX } from "../src/jeux/platformer/reglages";
import type { Element, Niveau, Rect } from "../src/jeux/platformer/elements";

const SOLIDES = ["normale", "glace", "ressort", "tapis", "fragile", "teleporteur"];   // voir genres.ts
const HEROS = { w: 30, h: 40 };
const MARGE = 0.85;                        // on ne compte que sur 85 % de la portée : le joueur n'est pas parfait

type Elan = "sol" | "ressort" | "eau";

// Un endroit d'où l'on saute, ou où l'on arrive : un intervalle de x, à une hauteur
interface Sol {
  x1: number;
  x2: number;
  y: number;                               // la hauteur à atteindre pour y arriver
  yDepart: number;                         // la hauteur des pieds quand on en part
  elan: Elan;
  force: number;
  liens: number[];                         // les sols où l'on va sans sauter (téléporteur, nager, ascenseur)
  sousLEau?: boolean;                      // posé au fond de l'eau : on en part en nageant (voir liens)
}

// ===== Les sauts : combien de temps le héros reste au-dessus d'une hauteur donnée

const PAS = 1 / 120;                       // le pas de la physique du jeu
const IMPULSION = -SAUT;                   // vers le haut, en positif

// Les hauteurs des pieds (vers le haut, depuis le départ) à chaque pas, les sauts en l'air donnés à ces instants
function trajectoire(v0: number, sauts: number[], eau: boolean): number[] {
  const hauteurs: number[] = [];
  let h = 0;
  let v = v0;
  let k = 0;
  for (let i = 0; i < 360; i++) {
    if (k < sauts.length && i * PAS >= sauts[k]) {
      v = IMPULSION;
      k++;
    }
    const g = eau && h < HEROS.h ? GRAVITE / 2 : GRAVITE;   // la tête sortie de l'eau, les pieds dedans
    v = Math.max(v - g * PAS, -CHUTE_MAX);
    h += v * PAS;
    hauteurs.push(h);
  }
  return hauteurs;
}

// Pour chaque montée (de 5 en 5 pixels), le plus long temps passé au-dessus : on peut s'y poser jusque-là
const tables = new Map<string, Map<number, number>>();
function table(elan: Elan, force: number): Map<number, number> {
  const cle = elan + force;
  if (tables.has(cle)) {
    return tables.get(cle)!;
  }
  const v0 = elan === "ressort" ? -REBONDS[force] : IMPULSION;
  const enLAir = elan === "ressort" ? 2 : 1;   // les sauts qui restent une fois parti
  const instants = Array.from({ length: 45 }, (_, i) => 0.05 + i / 30);
  const essais: number[][] = [[]];
  for (const a of instants) {
    essais.push([a]);
    if (enLAir === 2) {
      for (const b of instants.filter((b) => b > a)) {
        essais.push([a, b]);
      }
    }
  }
  const t = new Map<number, number>();
  for (const sauts of essais) {
    const hauteurs = trajectoire(v0, sauts, elan === "eau");
    for (let montee = -500; montee <= 800; montee += 5) {
      let dernier = -1;
      for (let i = hauteurs.length - 1; i >= 0; i--) {
        if (hauteurs[i] >= montee) {
          dernier = i;
          break;
        }
      }
      t.set(montee, Math.max(t.get(montee) ?? -1, dernier < 0 ? -1 : dernier * PAS));
    }
  }
  tables.set(cle, t);
  return t;
}

function tempsAuDessus(sol: Sol, montee: number): number {
  return table(sol.elan, sol.force).get(Math.ceil(montee / 5) * 5) ?? -1;
}

// ===== Le niveau, en sols

function lesSols(niveau: Niveau): { sols: Sol[]; murs: Rect[] } {
  const sols: Sol[] = [];
  const murs: Rect[] = [];
  const teleporteurs: number[] = [];
  const eaux: Rect[] = [];
  const plateformes = niveau.elements.filter((e) => e.sorte === "plateforme" || e.sorte === "mobile");
  for (const e of plateformes) {
    const sol = (x1: number, x2: number, y: number): Sol => ({ x1, x2, y, yDepart: y, elan: "sol", force: 2, liens: [] });
    if (e.sorte === "mobile") {
      if (e.axe === "x") {
        sols.push(sol(e.x, e.x + e.w! + e.dist!, e.y));
      } else {                             // un ascenseur : on monte ou on descend avec lui
        const haut = sols.push(sol(e.x, e.x + e.w!, e.y)) - 1;
        const bas = sols.push(sol(e.x, e.x + e.w!, e.y + e.dist!)) - 1;
        sols[haut].liens.push(bas);
        sols[bas].liens.push(haut);
      }
    } else if (e.genre === "eau") {
      eaux.push({ x: e.x, y: e.y, w: e.w!, h: e.h! });
    } else if (SOLIDES.includes(e.genre!)) {
      murs.push({ x: e.x, y: e.y, w: e.w!, h: e.h! });
      const s = sol(e.x, e.x + e.w!, e.y);
      if (e.genre === "ressort") {
        Object.assign(s, { elan: "ressort", force: e.force ?? 2 });
      }
      const i = sols.push(s) - 1;
      if (e.genre === "teleporteur") {
        teleporteurs.push(i);
      }
    }
  }
  // Un téléporteur envoie sur le suivant (après le dernier, le premier), comme dans Monde.ts
  if (teleporteurs.length > 1) {
    teleporteurs.forEach((i, k) => sols[i].liens.push(teleporteurs[(k + 1) % teleporteurs.length]));
  }
  // L'eau : on y arrive dès qu'on passe au-dessus de son fond, on en part la tête sortie (un vrai saut).
  // Un sol au fond de l'eau mène à sa surface, à la nage.
  for (const eau of eaux) {
    const i = sols.push({
      x1: eau.x, x2: eau.x + eau.w, y: eau.y + eau.h, yDepart: eau.y + HEROS.h - 2, elan: "eau", force: 2, liens: [],
    }) - 1;
    for (const s of sols) {
      if (s.elan !== "eau" && s.x1 < eau.x + eau.w && eau.x < s.x2 && eau.y < s.y && s.y <= eau.y + eau.h) {
        s.sousLEau = true;
        s.liens.push(i);
      }
    }
  }
  return { sols, murs };
}

// Un mur entre deux sols, plus haut que le plus bas des deux et sans place pour passer dessous
function murEntre(a: Sol, b: Sol, murs: Rect[]): boolean {
  const [gauche, droite] = a.x2 <= b.x1 ? [a.x2, b.x1] : b.x2 <= a.x1 ? [b.x2, a.x1] : [0, 0];
  if (gauche >= droite) {
    return false;
  }
  const bas = Math.max(a.y, b.y);
  return murs.some((m) => m.x < droite && gauche < m.x + m.w && m.y < bas - 1 && m.y + m.h > bas - HEROS.h
    && m.y < Math.min(a.y, b.y));
}

function peutSauter(a: Sol, b: Sol, murs: Rect[]): boolean {
  if (a.sousLEau) {
    return false;                          // au fond de l'eau, on nage (voir les liens)
  }
  const montee = a.yDepart - b.y;
  const dessus = a.x1 < b.x2 && b.x1 < a.x2;
  let ecart = dessus ? 0 : Math.max(b.x1 - a.x2, a.x1 - b.x2);
  if (dessus && montee > 0) {
    if (a.x1 >= b.x1 && a.x2 <= b.x2 && a.elan !== "eau") {
      return false;                        // tout entier sous b : sa tête s'y cognerait
    }
    ecart = HEROS.w;                       // il faut sortir de dessous
  }
  if (murEntre(a, b, murs)) {
    return false;
  }
  const temps = tempsAuDessus(a, montee);
  return temps >= 0 && ecart <= MARGE * VITESSE * temps;
}

// Le drapeau (ou le boss) est-il atteignable depuis le départ ?
export function faisable(niveau: Niveau): boolean {
  const { sols, murs } = lesSols(niveau);
  const depart = niveau.elements.find((e) => e.sorte === "depart");
  const arrivee = niveau.elements.find((e) => e.sorte === "drapeau") ?? niveau.elements.find((e) => e.sorte === "boss");
  if (!depart || !arrivee) {
    return false;
  }
  // Le sol sous le départ : le plus haut de ceux qui passent sous ses pieds
  const sousLeDepart = sols
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.elan !== "eau" && s.x1 < depart.x + HEROS.w && depart.x < s.x2 && s.y >= depart.y + HEROS.h - 2)
    .sort((p, q) => p.s.y - q.s.y)[0];
  if (!sousLeDepart) {
    return false;
  }
  const cible = lArrivee(arrivee);
  const vus = new Set([sousLeDepart.i]);
  const aVoir = [sousLeDepart.i];
  while (aVoir.length > 0) {
    const a = sols[aVoir.pop()!];
    if (peutSauter(a, cible, murs)) {
      return true;
    }
    sols.forEach((b, j) => {
      if (!vus.has(j) && (a.liens.includes(j) || peutSauter(a, b, murs))) {
        vus.add(j);
        aVoir.push(j);
      }
    });
  }
  return false;
}

// L'arrivée comme un sol : toucher le bas du drapeau, ou la tête du boss n'importe où sur son trajet
function lArrivee(e: Element): Sol {
  if (e.sorte === "boss") {
    return { x1: e.xmin!, x2: e.xmax!, y: e.y, yDepart: e.y, elan: "sol", force: 2, liens: [] };
  }
  return { x1: e.x, x2: e.x + 16, y: e.y + 40, yDepart: e.y + 40, elan: "sol", force: 2, liens: [] };
}
