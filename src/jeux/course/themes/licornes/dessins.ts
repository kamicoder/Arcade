// Les dessins au pinceau du navigateur (canvas 2D) : la licorne, le décor du circuit, l'aperçu d'un circuit.
// Phaser n'a pas de pinceau pour les courbes épaisses aux bouts arrondis, les dégradés ou les ovales tournés :
// on dessine ici une fois, dans une CanvasTexture (voir textures.ts), et pour Phaser ce n'est plus
// qu'une image comme une autre.

import { ARC_EN_CIEL, LARGEUR_ROUTE, LIMITE, type Look } from "./reglages";
import { portesDe, distanceALaTrace, hasard, cheminDeRoute, type Circuit, type Point } from "../../circuits";

type Pinceau = CanvasRenderingContext2D;

export function ovale(p: Pinceau, x: number, y: number, rx: number, ry: number) {
  p.beginPath();
  p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

export function formeEtoile(p: Pinceau, x: number, y: number, r: number, rotation: number, branches: number, creux: number) {
  p.beginPath();
  for (let i = 0; i < branches * 2; i++) {
    const rr = i % 2 === 0 ? r : r * creux;
    const a = rotation + i * Math.PI / branches - Math.PI / 2;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) {
      p.moveTo(px, py);
    } else {
      p.lineTo(px, py);
    }
  }
  p.closePath();
}

export function degradeArcEnCiel(p: Pinceau, x1: number, x2: number): CanvasGradient {
  const d = p.createLinearGradient(x1, 0, x2, 0);
  ARC_EN_CIEL.forEach((c, i) => d.addColorStop(i / (ARC_EN_CIEL.length - 1), c));
  return d;
}

// ===== La licorne =====

// Une licorne vue de dessus, centrée en (0, 0), le nez vers la droite.
// phase : où en est le galop (les jambes, la queue, la crinière, les ailes).
export function dessinerLicorne(p: Pinceau, look: Look, phase: number) {
  const galop = Math.sin(phase);
  const n = look.criniere.length;

  p.fillStyle = "rgba(90, 50, 140, 0.13)";   // son ombre
  ovale(p, 3, 0, 28, 12);
  p.fill();

  if (look.accessoire === "ailes") {
    dessinerAiles(p, look, phase);
  }

  // La queue, qui ondule
  p.lineCap = "round";
  p.lineWidth = 4;
  for (let i = 0; i < n; i++) {
    const ecart = (i - (n - 1) / 2) * 3.5;
    p.strokeStyle = look.criniere[i];
    p.beginPath();
    p.moveTo(-18, ecart * 0.3);
    p.quadraticCurveTo(-30, ecart + Math.sin(phase * 0.5 + i) * 5, -42, ecart * 1.4 + Math.sin(phase * 0.5 + i + 1.5) * 8);
    p.stroke();
  }
  if (look.accessoire === "nœud") {
    p.fillStyle = "#ff4f9a";
    for (const cote of [-1, 1]) {
      p.beginPath();
      p.moveTo(-20, 0);
      p.lineTo(-25, cote * 7);
      p.lineTo(-15, cote * 7);
      p.closePath();
      p.fill();
    }
    ovale(p, -20, 0, 2.2, 2.2);
    p.fill();
  }

  // Les jambes vont et viennent avec le galop
  const jambes = [[13, -1, galop], [13, 1, -galop], [-12, -1, -galop], [-12, 1, galop]];
  for (const [x, cote, elan] of jambes) {
    const jx = x + elan * 7;
    const jy = cote * 10.5;
    p.fillStyle = look.ombre;
    ovale(p, jx, jy, 5.5, 3);
    p.fill();
    p.fillStyle = "#a78bc9";               // le sabot
    ovale(p, jx + 4, jy, 2.2, 2.3);
    p.fill();
  }

  // Le corps, le cou, la tête
  p.fillStyle = look.corps;
  p.strokeStyle = look.ombre;
  p.lineWidth = 1.8;
  ovale(p, 0, 0, 21, 9.5);
  p.fill();
  p.stroke();
  ovale(p, 19, 0, 8, 5.5);
  p.fill();
  ovale(p, 28, 0, 8.5, 6.8);
  p.fill();
  p.stroke();
  p.fillStyle = look.ombre;                // le museau et ses naseaux
  ovale(p, 35, 0, 4.2, 5);
  p.fill();
  p.fillStyle = "rgba(90, 60, 120, 0.6)";
  ovale(p, 37.6, -1.8, 0.8, 1);
  p.fill();
  ovale(p, 37.6, 1.8, 0.8, 1);
  p.fill();

  p.fillStyle = look.corps;                // les oreilles
  for (const cote of [-1, 1]) {
    p.beginPath();
    p.moveTo(26, cote * 4.5);
    p.lineTo(21, cote * 10);
    p.lineTo(22.5, cote * 3.5);
    p.closePath();
    p.fill();
    p.stroke();
  }

  for (const cote of [-1, 1]) {            // les yeux, avec leur reflet
    p.fillStyle = "#3b2a55";
    ovale(p, 30, cote * 5, 1.9, 1.8);
    p.fill();
    p.fillStyle = "white";
    ovale(p, 30.7, cote * 5 - 0.6, 0.7, 0.7);
    p.fill();
  }

  // La crinière : des boucles de couleur de la tête jusqu'au dos
  for (let k = 0; k < 8; k++) {
    const t = k / 7;
    p.fillStyle = look.criniere[k % n];
    ovale(p, 24 - t * 20, Math.sin(phase * 0.8 + k) * 1.3, 3.9 - t * 1.3, 3.9 - t * 1.3);
    p.fill();
  }

  dessinerChapeau(p, look);

  // La corne, avec ses spirales
  p.fillStyle = look.corne === "arc" ? degradeArcEnCiel(p, 29, 48) : look.corne;
  p.strokeStyle = "rgba(150, 100, 60, 0.6)";
  p.lineWidth = 0.9;
  p.beginPath();
  p.moveTo(29, -2.5);
  p.lineTo(48, 0);
  p.lineTo(29, 2.5);
  p.closePath();
  p.fill();
  p.stroke();
  for (const sx of [33, 38, 43]) {
    const r = 2.5 * (48 - sx) / 19;
    p.beginPath();
    p.moveTo(sx - 1, -r);
    p.lineTo(sx + 1, r);
    p.stroke();
  }
}

function dessinerAiles(p: Pinceau, look: Look, phase: number) {
  const bat = Math.sin(phase * 0.5) * 0.5 + 0.5;
  for (const cote of [-1, 1]) {
    p.save();
    p.scale(1, cote);
    p.fillStyle = "rgba(255, 255, 255, 0.95)";
    p.strokeStyle = look.criniere[0];
    p.lineWidth = 1.5;
    p.beginPath();
    p.moveTo(10, 5);
    p.quadraticCurveTo(10, 20 + bat * 8, -2, 30 + bat * 6);
    p.quadraticCurveTo(-6, 20, -14, 22 + bat * 4);
    p.quadraticCurveTo(-8, 11, -6, 5);
    p.closePath();
    p.fill();
    p.stroke();
    p.beginPath();
    p.moveTo(4, 8);
    p.lineTo(-1, 21 + bat * 5);
    p.moveTo(-2, 8);
    p.lineTo(-9, 18 + bat * 3);
    p.stroke();
    p.restore();
  }
}

// Ce qui se porte sur la tête
function dessinerChapeau(p: Pinceau, look: Look) {
  const a = look.accessoire;
  if (a === "couronne") {
    p.fillStyle = "#ffd23f";
    p.strokeStyle = "#d99a00";
    p.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const t = i * Math.PI * 2 / 5;
      p.beginPath();
      p.moveTo(26 + Math.cos(t - 0.45) * 4.5, Math.sin(t - 0.45) * 4.5);
      p.lineTo(26 + Math.cos(t) * 9, Math.sin(t) * 9);
      p.lineTo(26 + Math.cos(t + 0.45) * 4.5, Math.sin(t + 0.45) * 4.5);
      p.closePath();
      p.fill();
      p.stroke();
    }
    p.lineWidth = 2.2;
    p.strokeStyle = "#ffd23f";
    ovale(p, 26, 0, 5, 5);
    p.stroke();
    p.fillStyle = "#ff4f9a";
    ovale(p, 26, 0, 1.6, 1.6);
    p.fill();
  } else if (a === "fleurs") {
    const couleurs = ["#ff7eb6", "#ffd36e", "#ffffff", "#b98bff"];
    for (let i = 0; i < 7; i++) {
      const t = i * Math.PI * 2 / 7;
      const fx = 26 + Math.cos(t) * 8;
      const fy = Math.sin(t) * 7.5;
      p.fillStyle = couleurs[i % couleurs.length];
      ovale(p, fx, fy, 2.7, 2.7);
      p.fill();
      p.fillStyle = "#ffb300";
      ovale(p, fx, fy, 1, 1);
      p.fill();
    }
  } else if (a === "lunettes") {
    p.fillStyle = "rgba(30, 20, 50, 0.9)";
    ovale(p, 30, -5, 3.2, 3.2);
    p.fill();
    ovale(p, 30, 5, 3.2, 3.2);
    p.fill();
    p.strokeStyle = "rgba(30, 20, 50, 0.9)";
    p.lineWidth = 1.3;
    p.beginPath();
    p.moveTo(30, -2);
    p.lineTo(30, 2);
    p.moveTo(28, -7.5);
    p.lineTo(22, -8);
    p.moveTo(28, 7.5);
    p.lineTo(22, 8);
    p.stroke();
  } else if (a === "chapeau") {
    p.fillStyle = "#5b3b8c";
    ovale(p, 25, 0, 11, 11);
    p.fill();
    p.fillStyle = "#7a52b3";
    ovale(p, 25, 0, 6, 6);
    p.fill();
    p.fillStyle = "#ffe066";
    formeEtoile(p, 25, 0, 3.4, 0, 5, 0.45);
    p.fill();
  }
}

// ===== Le décor d'un circuit : le ciel, les nuages, la route arc-en-ciel, la barrière, la ligne =====

export function peindreDecor(g: Pinceau, c: Circuit) {
  const { largeur: w, hauteur: h, id } = c.modele;
  const route = cheminDeRoute(c.points);
  const rnd = hasard(id.charCodeAt(0) * 977 + id.length * 31 + c.points.length);

  const ciel = g.createLinearGradient(0, 0, w * 0.3, h);
  ciel.addColorStop(0, "#bfe4ff");
  ciel.addColorStop(0.5, "#e4dcff");
  ciel.addColorStop(1, "#ffd8ee");
  g.fillStyle = ciel;
  g.fillRect(0, 0, w, h);

  for (let i = 0; i < 260; i++) {
    g.fillStyle = "rgba(255, 255, 255, " + (0.5 + rnd() * 0.5) + ")";
    formeEtoile(g, rnd() * w, rnd() * h, 2 + rnd() * 4, rnd(), 4, 0.4);
    g.fill();
  }

  // Les nuages : des grappes de bulles, avec une ombre lilas dessous
  for (let i = 0; i < 95; i++) {
    const cx = rnd() * w;
    const cy = rnd() * h;
    const bulles: { x: number; y: number; r: number }[] = [];
    const nombre = 4 + Math.floor(rnd() * 5);
    for (let k = 0; k < nombre; k++) {
      bulles.push({ x: cx + (rnd() - 0.5) * 160, y: cy + (rnd() - 0.5) * 50, r: 30 + rnd() * 45 });
    }
    g.fillStyle = "rgba(180, 160, 230, 0.35)";
    for (const b of bulles) {
      ovale(g, b.x, b.y + 12, b.r, b.r);
      g.fill();
    }
    g.fillStyle = "rgba(255, 255, 255, 0.92)";
    for (const b of bulles) {
      ovale(g, b.x, b.y, b.r, b.r);
      g.fill();
    }
  }

  // Au-delà des barrières, le ciel est voilé : on ne peut pas y aller
  const voile = document.createElement("canvas");
  voile.width = w;
  voile.height = h;
  const v = voile.getContext("2d")!;
  v.fillStyle = "rgba(110, 80, 170, 0.17)";
  v.fillRect(0, 0, w, h);
  v.globalCompositeOperation = "destination-out";
  v.lineJoin = "round";
  v.lineCap = "round";
  v.lineWidth = LIMITE * 2;
  v.stroke(route);
  g.drawImage(voile, 0, 0);

  // La route : un halo blanc, puis les sept bandes de l'arc-en-ciel
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = "rgba(255, 255, 255, 0.3)";
  g.lineWidth = LARGEUR_ROUTE + 60;
  g.stroke(route);
  g.strokeStyle = "rgba(255, 255, 255, 0.6)";
  g.lineWidth = LARGEUR_ROUTE + 34;
  g.stroke(route);
  g.strokeStyle = "white";
  g.lineWidth = LARGEUR_ROUTE + 14;
  g.stroke(route);
  for (let i = 0; i < ARC_EN_CIEL.length; i++) {
    g.strokeStyle = ARC_EN_CIEL[i];
    g.lineWidth = LARGEUR_ROUTE * (ARC_EN_CIEL.length - i) / ARC_EN_CIEL.length;
    g.stroke(route);
  }

  // Des paillettes sur la route
  g.lineWidth = LARGEUR_ROUTE;
  for (let i = 0; i < 2500; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    if (g.isPointInStroke(route, x, y)) {
      g.fillStyle = "rgba(255, 255, 255, 0.55)";
      formeEtoile(g, x, y, 3 + rnd() * 3, rnd(), 4, 0.35);
      g.fill();
    }
  }

  // La barrière : des boules de nuage blanches et roses, tout le long des deux bords
  const boules: { x: number; y: number; rose: boolean }[] = [];
  const t = c.trace;
  for (let i = 0; i < t.length; i += 3) {
    for (const cote of [-1, 1]) {
      const x = t[i].x + t[i].nx * cote * (LIMITE + 10);
      const y = t[i].y + t[i].ny * cote * (LIMITE + 10);
      if (distanceALaTrace(c, x, y) < LIMITE + 6) {
        continue;                          // ce bord-là est dans un virage serré
      }
      boules.push({ x, y, rose: (i / 3) % 2 === 0 });
    }
  }
  g.fillStyle = "rgba(140, 110, 200, 0.35)";
  for (const b of boules) {
    ovale(g, b.x, b.y + 6, 15, 15);
    g.fill();
  }
  for (const b of boules) {
    g.fillStyle = b.rose ? "#ffd3ec" : "#ffffff";
    ovale(g, b.x, b.y, 15, 15);
    g.fill();
  }

  // La ligne d'arrivée : un damier blanc et violet en travers de la route
  g.save();
  g.translate(c.portes[0].x, c.portes[0].y);
  g.rotate(c.angleDepart);
  const carre = LARGEUR_ROUTE / 10;
  for (let rangee = 0; rangee < 2; rangee++) {
    for (let colonne = 0; colonne < 10; colonne++) {
      g.fillStyle = (rangee + colonne) % 2 === 0 ? "white" : "#8a5cd6";
      g.fillRect(rangee * carre - carre, colonne * carre - LARGEUR_ROUTE / 2, carre, carre);
    }
  }
  g.restore();
}

// ===== L'aperçu d'un circuit (choix du circuit, éditeur) =====

export function dessinerApercu(
  p: Pinceau, monde: { largeur: number; hauteur: number }, points: Point[], x: number, y: number, w: number, h: number,
) {
  const echelle = Math.min(w / monde.largeur, h / monde.hauteur);
  const lw = monde.largeur * echelle;
  const lh = monde.hauteur * echelle;
  const ox = x + (w - lw) / 2;
  const oy = y + (h - lh) / 2;
  const ciel = p.createLinearGradient(0, oy, 0, oy + lh);
  ciel.addColorStop(0, "#d4ecff");
  ciel.addColorStop(1, "#ffe0f1");
  p.fillStyle = ciel;
  p.beginPath();
  p.roundRect(ox, oy, lw, lh, 16);
  p.fill();
  if (points.length < 3) {
    return;
  }
  const route = cheminDeRoute(points);
  const portes = portesDe(points);
  p.save();
  p.translate(ox, oy);
  p.scale(echelle, echelle);
  p.lineJoin = "round";
  p.lineCap = "round";
  p.strokeStyle = "rgba(255, 255, 255, 0.8)";
  p.lineWidth = LIMITE * 2;
  p.stroke(route);
  for (let i = 0; i < ARC_EN_CIEL.length; i++) {
    p.strokeStyle = ARC_EN_CIEL[i];
    p.lineWidth = LARGEUR_ROUTE * (ARC_EN_CIEL.length - i) / ARC_EN_CIEL.length;
    p.stroke(route);
  }
  // La ligne d'arrivée et le sens de la course
  const a = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
  p.translate(portes[0].x, portes[0].y);
  p.rotate(a);
  p.fillStyle = "white";
  p.fillRect(-14, -LARGEUR_ROUTE / 2 - 20, 28, LARGEUR_ROUTE + 40);
  p.fillStyle = "#8a5cd6";
  p.beginPath();
  p.moveTo(60, -50);
  p.lineTo(150, 0);
  p.lineTo(60, 50);
  p.closePath();
  p.fill();
  p.restore();
}
