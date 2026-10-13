// Les images de la course de voitures, fabriquées au lieu d'être chargées : on les dessine une fois,
// Phaser les garde dans son gestionnaire de textures, et on s'en sert autant qu'on veut.

import Phaser from "phaser";
import { cheminDeRoute, portesDe, empreinte, type Circuit, type Point } from "../../circuits";

// Phaser veut des Vector2 pour les formes à plusieurs points
const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

export const ORANGE = "#ff7a1a";

// L'apparence d'une voiture (l'atelier peut la changer)
export interface LookDeVoiture {
  nom: string;
  carrosserie: string;
  decalco: string;                         // aucune, flammes, bandes, damier, eclair, etoiles, numero
  couleurDecalco: string;
  piece: string;                           // aucune, aileron, prise-air, gyrophare, echappements
  numero: string;                          // son numéro de course (la décalco « numéro »)
}

export function fabriquerTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("voiture-bidon")) {
    return;                                // déjà faites, à un lancement d'avant
  }
  const g = scene.make.graphics();

  // Le bidon de nitro, avec un N dessiné en trois traits (en trois tailles : la route, le tableau de bord,
  // le gros bouton au doigt), et le bidon vide du tableau de bord
  const bidon = (cle: string, e: number, plein: boolean) => {
    g.clear();
    g.fillStyle(plein ? 0xe3262f : 0x55505f, plein ? 1 : 0.6).fillRect(2 * e, 6 * e, 20 * e, 26 * e);
    g.fillStyle(0x111111, plein ? 1 : 0.6).fillRect(8 * e, 1 * e, 8 * e, 5 * e);
    g.lineStyle(3 * e, 0xffffff, plein ? 1 : 0.4).strokePoints([v(7 * e, 26 * e), v(7 * e, 12 * e), v(17 * e, 26 * e), v(17 * e, 12 * e)]);
    g.generateTexture(cle, Math.ceil(24 * e), Math.ceil(32 * e));
  };
  bidon("voiture-bidon", 1, true);
  bidon("voiture-bidon-petit", 0.6, true);
  bidon("voiture-bidon-vide", 0.6, false);
  bidon("voiture-bidon-grand", 1.5, true);
  g.clear();

  // La flèche au sol : trois chevrons, la pointe vers la droite (l'angle 0 de Phaser)
  g.fillStyle(0xffd23f);
  for (let k = -1; k <= 1; k++) {
    const x = k * 22 + 40;
    g.fillPoints([v(x - 8, 4), v(x + 10, 28), v(x - 8, 52), v(x - 2, 28)], true);
  }
  g.generateTexture("voiture-fleche", 80, 56);
  g.clear();

  // La flaque d'huile, et son reflet violet
  g.fillStyle(0x16141a).fillEllipse(36, 24, 68, 44);
  g.fillStyle(0x8c78ff, 0.35).fillEllipse(30, 19, 24, 12);
  g.generateTexture("voiture-huile", 72, 48);
  g.clear();

  // Une marque de pneu
  g.fillStyle(0x1e1e1e).fillRect(0, 0, 6, 6);
  g.generateTexture("voiture-pneu", 6, 6);
  g.destroy();

  // La barre de la nitro, du jaune à l'orange (un dégradé : le pinceau du navigateur)
  const barre = scene.textures.createCanvas("voiture-barre", 256, 6)!;
  const p = barre.getContext();
  const degrade = p.createLinearGradient(0, 0, 256, 0);
  degrade.addColorStop(0, "#ffd23f");
  degrade.addColorStop(1, "#ff5a1a");
  p.fillStyle = degrade;
  p.beginPath();
  p.roundRect(0, 0, 256, 6, 3);
  p.fill();
  barre.refresh();
}

// ===== Une voiture vue de dessus, le nez vers la droite =====

// Le dessin fait 44 × 30 ; la feuille a une marge autour pour l'aileron (le milieu reste le milieu)
const MARGE_X = 4;
const MARGE_Y = 2;
const LARGEUR_VOITURE = 44 + 2 * MARGE_X;
const HAUTEUR_VOITURE = 30 + 2 * MARGE_Y;

function etoile(p: CanvasRenderingContext2D, x: number, y: number, r: number) {
  p.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = i * Math.PI / 5 - Math.PI / 2;
    p.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  p.closePath();
  p.fill();
}

function polygone(p: CanvasRenderingContext2D, points: number[][]) {
  p.beginPath();
  for (const [x, y] of points) {
    p.lineTo(x, y);
  }
  p.closePath();
  p.fill();
}

// La décalco, peinte sur la carrosserie (elle n'en déborde pas)
function peindreDecalco(p: CanvasRenderingContext2D, look: LookDeVoiture) {
  p.save();
  p.beginPath();
  p.roundRect(2, 5, 40, 20, 4);
  p.clip();
  p.fillStyle = look.couleurDecalco;
  switch (look.decalco) {
    case "flammes":                        // des flammes qui lèchent le capot depuis le nez
      polygone(p, [[43, 6], [33, 8.5], [37.5, 11], [30, 13.5], [36, 15], [30, 16.5], [37.5, 19], [33, 21.5], [43, 24]]);
      break;
    case "bandes":                         // deux bandes de course, d'un bout à l'autre
      p.fillRect(2, 11.6, 40, 2.6);
      p.fillRect(2, 15.8, 40, 2.6);
      break;
    case "damier":                         // un damier sur le toit et le coffre
      for (let x = 3; x < 23; x += 3.4) {
        for (let y = 5; y < 25; y += 3.4) {
          if (Math.round((x - 3) / 3.4 + (y - 5) / 3.4) % 2 === 0) {
            p.fillRect(x, y, 3.4, 3.4);
          }
        }
      }
      break;
    case "eclair":                         // un éclair en travers
      polygone(p, [[4, 7], [15, 12.5], [12, 14], [24, 23], [10, 16.5], [13, 15], [3, 10]]);
      break;
    case "etoiles":
      etoile(p, 8, 10, 3.2);
      etoile(p, 8, 20, 3.2);
      etoile(p, 17, 15, 3.8);
      break;
    case "numero":                         // un rond, et le numéro de course
      p.beginPath();
      p.arc(11, 15, 6.3, 0, Math.PI * 2);
      p.fill();
      p.fillStyle = look.carrosserie;
      p.font = "bold 10px system-ui, sans-serif";
      p.textAlign = "center";
      p.textBaseline = "middle";
      // Le chiffre se lit de l'arrière vers l'avant : tourné comme la voiture
      p.translate(11, 15.5);
      p.rotate(Math.PI / 2);
      p.fillText(look.numero, 0, 0);
      break;
  }
  p.restore();
}

// La pièce en plus
function peindrePiece(p: CanvasRenderingContext2D, look: LookDeVoiture, dessus: boolean) {
  switch (look.piece) {
    case "aileron":                        // derrière la voiture, plus large qu'elle (dessous : ses pattes)
      if (!dessus) {
        p.fillStyle = "#222222";
        p.fillRect(1, 10, 4, 2);
        p.fillRect(1, 18, 4, 2);
      } else {
        p.fillStyle = "#1a1a1a";
        p.fillRect(-3, 1, 5, 28);
        p.fillStyle = look.couleurDecalco;
        p.fillRect(-2, 2, 3, 26);
      }
      break;
    case "prise-air":                      // une prise d'air sur le capot
      if (dessus) {
        p.fillStyle = "#1a1a1a";
        p.beginPath();
        p.roundRect(33, 11, 7, 8, 1.5);
        p.fill();
        p.fillStyle = "#555555";
        p.fillRect(38, 12.5, 1.4, 5);
        p.fillRect(35.5, 12.5, 1.4, 5);
      }
      break;
    case "gyrophare":                      // un gyrophare sur le toit, rouge et bleu
      if (dessus) {
        p.fillStyle = "#222222";
        p.fillRect(18.5, 10, 5, 10);
        p.fillStyle = "#ff3b3b";
        p.beginPath();
        p.arc(21, 12, 2.4, 0, Math.PI * 2);
        p.fill();
        p.fillStyle = "#3b8bff";
        p.beginPath();
        p.arc(21, 18, 2.4, 0, Math.PI * 2);
        p.fill();
      }
      break;
    case "echappements":                   // deux gros pots, à l'arrière
      if (!dessus) {
        p.fillStyle = "#9aa0aa";
        p.fillRect(-2, 8, 5, 3);
        p.fillRect(-2, 19, 5, 3);
        p.fillStyle = "#3a3a3a";
        p.fillRect(-2, 8.8, 1.4, 1.4);
        p.fillRect(-2, 19.8, 1.4, 1.4);
      }
      break;
  }
}

export function peindreVoiture(p: CanvasRenderingContext2D, look: LookDeVoiture) {
  peindrePiece(p, look, false);
  p.fillStyle = "#111111";                 // les quatre roues
  for (const [x, y] of [[6, 1], [30, 1], [6, 24], [30, 24]]) {
    p.fillRect(x, y, 10, 5);
  }
  p.fillStyle = look.carrosserie;          // la carrosserie
  p.beginPath();
  p.roundRect(2, 5, 40, 20, 4);
  p.fill();
  peindreDecalco(p, look);
  p.fillStyle = "#2a3a4a";                 // le pare-brise, à l'avant
  p.fillRect(24, 7, 8, 16);
  peindrePiece(p, look, true);
}

// La feuille d'une voiture : une seule image, dessinée « resolution » fois plus grand.
// Une clé imposée remplace l'ancienne image (l'atelier).
export function textureDeVoiture(scene: Phaser.Scene, look: LookDeVoiture, resolution = 2, cleImposee?: string): string {
  const cle = cleImposee ?? "voiture-look-" + resolution + "-" + empreinte(JSON.stringify(look));
  if (scene.textures.exists(cle)) {
    if (!cleImposee) {
      return cle;
    }
    scene.textures.remove(cle);
  }
  const texture = scene.textures.createCanvas(cle, LARGEUR_VOITURE * resolution, HAUTEUR_VOITURE * resolution)!;
  const p = texture.getContext();
  p.scale(resolution, resolution);
  p.translate(MARGE_X, MARGE_Y);
  peindreVoiture(p, look);
  texture.refresh();
  return cle;
}

// ===== Les circuits =====

export const LARGEUR_ROUTE = 150;
export const LIMITE = LARGEUR_ROUTE / 2 + 75;   // plus loin du milieu de la route : la barrière de pneus

// La piste entière : l'herbe, la route et ses bordures, la barrière de pneus, la ligne d'arrivée
export function peindrePiste(ctx: CanvasRenderingContext2D, c: Circuit) {
  const { largeur, hauteur } = c.modele;

  // L'herbe, avec des touffes plus claires et plus sombres (toujours les mêmes : le hasard a une graine)
  ctx.fillStyle = "#3f8f3a";
  ctx.fillRect(0, 0, largeur, hauteur);
  const hasard = new Phaser.Math.RandomDataGenerator([c.modele.id]);
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = hasard.pick(["#4a9c43", "#378230", "#56a84e"]);
    ctx.fillRect(hasard.between(0, largeur), hasard.between(0, hauteur), 6, 6);
  }

  // La route : la même courbe que la trace, de porte en porte
  const route = cheminDeRoute(c.points);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = LARGEUR_ROUTE + 20;      // les bordures, rouges et blanches
  ctx.strokeStyle = "#d8322e";
  ctx.stroke(route);
  ctx.setLineDash([30, 30]);
  ctx.lineCap = "butt";
  ctx.strokeStyle = "white";
  ctx.stroke(route);
  ctx.setLineDash([]);
  ctx.lineCap = "round";
  ctx.lineWidth = LARGEUR_ROUTE;           // le goudron
  ctx.strokeStyle = "#55535c";
  ctx.stroke(route);
  ctx.lineWidth = 4;                       // la ligne du milieu
  ctx.setLineDash([24, 24]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.stroke(route);
  ctx.setLineDash([]);

  // La barrière : une rangée de pneus de chaque côté, peints en rouge et blanc. Pas de pneu là où il
  // couperait une autre partie de la route (le croisement du Huit, l'intérieur d'un virage serré).
  const ecart = LIMITE + 6;                // le bord d'une voiture arrêtée par la barrière touche les pneus
  const trace = c.trace;
  const assezLoin = (x: number, y: number) =>
    trace.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= (ecart - 3) ** 2);
  for (const cote of [-1, 1]) {
    let numero = 0;
    for (let i = 0; i < trace.length; i += 2) {
      const p = trace[i];
      const x = p.x + p.nx * ecart * cote;
      const y = p.y + p.ny * ecart * cote;
      if (!assezLoin(x, y)) {
        continue;
      }
      numero++;
      ctx.fillStyle = numero % 2 === 0 ? "#d8322e" : "#f2f2f2";
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#1d1d1f";           // le trou du pneu
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // La ligne d'arrivée : un damier en travers de la route
  ctx.save();
  ctx.translate(c.portes[0].x, c.portes[0].y);
  ctx.rotate(c.angleDepart);
  const carre = LARGEUR_ROUTE / 10;
  for (let rangee = 0; rangee < 2; rangee++) {
    for (let colonne = 0; colonne < 10; colonne++) {
      ctx.fillStyle = (rangee + colonne) % 2 === 0 ? "white" : "black";
      ctx.fillRect(rangee * carre - carre, colonne * carre - LARGEUR_ROUTE / 2, carre, carre);
    }
  }
  ctx.restore();
}

// L'aperçu d'un circuit : l'herbe, la route grise, et un rond blanc sur la ligne d'arrivée
export function peindreApercu(
  p: CanvasRenderingContext2D, monde: { largeur: number; hauteur: number }, points: Point[], w: number, h: number,
) {
  const echelle = Math.min(w / monde.largeur, h / monde.hauteur);
  const lw = monde.largeur * echelle;
  const lh = monde.hauteur * echelle;
  p.translate((w - lw) / 2, (h - lh) / 2);
  p.fillStyle = "#3f8f3a";
  p.beginPath();
  p.roundRect(0, 0, lw, lh, 12);
  p.fill();
  if (points.length < 3) {
    return;
  }
  p.scale(echelle, echelle);
  p.lineJoin = "round";
  p.lineCap = "round";
  p.lineWidth = LARGEUR_ROUTE;
  p.strokeStyle = "#55535c";
  p.stroke(cheminDeRoute(points));
  const ligne = portesDe(points)[0];
  p.fillStyle = "white";
  p.beginPath();
  p.arc(ligne.x, ligne.y, 50, 0, Math.PI * 2);
  p.fill();
}
