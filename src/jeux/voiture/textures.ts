// Les images de la course, fabriquées au lieu d'être chargées : on les dessine une fois,
// Phaser les garde dans son gestionnaire de textures, et on s'en sert autant qu'on veut.

import Phaser from "phaser";
import { LARGEUR_ROUTE, LIMITE, type Circuit } from "./circuits";

// Phaser veut des Vector2 pour les formes à plusieurs points
const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

export function fabriquerTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("voiture-bidon")) {
    return;                                // déjà faites, à un lancement d'avant
  }
  const g = scene.make.graphics();

  // Le bidon de nitro, avec un N dessiné en trois traits
  g.fillStyle(0xe3262f).fillRect(2, 6, 20, 26);
  g.fillStyle(0x111111).fillRect(8, 1, 8, 5);
  g.lineStyle(3, 0xffffff).strokePoints([v(7, 26), v(7, 12), v(17, 26), v(17, 12)]);
  g.generateTexture("voiture-bidon", 24, 32);
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
}

// Une voiture vue de dessus, le nez vers la droite. Une texture par couleur.
export function textureDeVoiture(scene: Phaser.Scene, couleur: number): string {
  const cle = "voiture-" + couleur.toString(16);
  if (!scene.textures.exists(cle)) {
    const g = scene.make.graphics();
    g.fillStyle(0x111111);                 // les quatre roues
    g.fillRect(6, 1, 10, 5).fillRect(30, 1, 10, 5).fillRect(6, 24, 10, 5).fillRect(30, 24, 10, 5);
    g.fillStyle(couleur).fillRoundedRect(2, 5, 40, 20, 4);   // la carrosserie
    g.fillStyle(0x2a3a4a).fillRect(24, 7, 8, 16);            // le pare-brise, à l'avant
    g.generateTexture(cle, 44, 30);
    g.destroy();
  }
  return cle;
}

// La piste entière dans une seule grande image. Phaser n'a pas de pinceau pour les routes courbes,
// épaisses et en pointillés : on prend le canvas 2D du navigateur (une CanvasTexture), on dessine
// une fois, et pour Phaser ce n'est plus qu'une image comme une autre.
const clePiste = (id: string) => "voiture-piste-" + id;

// La piste d'un circuit qui a changé (le tien, redessiné) : on jette son image, la prochaine course
// la refera. Sans ça, texturePiste rendrait l'ancienne, gardée sous le même nom.
export function oublierLaPiste(scene: Phaser.Scene, id: string) {
  if (scene.textures.exists(clePiste(id))) {
    scene.textures.remove(clePiste(id));
  }
}

export function texturePiste(scene: Phaser.Scene, c: Circuit): string {
  const cle = clePiste(c.modele.id);
  if (scene.textures.exists(cle)) {
    return cle;
  }
  const { largeur, hauteur } = c.modele;
  const texture = scene.textures.createCanvas(cle, largeur, hauteur)!;
  const ctx = texture.getContext();

  // L'herbe, avec des touffes plus claires et plus sombres (toujours les mêmes : le hasard a une graine)
  ctx.fillStyle = "#3f8f3a";
  ctx.fillRect(0, 0, largeur, hauteur);
  const hasard = new Phaser.Math.RandomDataGenerator([c.modele.id]);
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = hasard.pick(["#4a9c43", "#378230", "#56a84e"]);
    ctx.fillRect(hasard.between(0, largeur), hasard.between(0, hauteur), 6, 6);
  }

  // La route : la même courbe que la trace, de porte en porte
  const route = new Path2D();
  const n = c.points.length;
  route.moveTo(c.portes[n - 1].x, c.portes[n - 1].y);
  for (let i = 0; i < n; i++) {
    route.quadraticCurveTo(c.points[i].x, c.points[i].y, c.portes[i].x, c.portes[i].y);
  }
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
      const x = p.x - Math.sin(p.angle) * ecart * cote;
      const y = p.y + Math.cos(p.angle) * ecart * cote;
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

  texture.refresh();                       // envoie le dessin à la carte graphique
  return cle;
}
