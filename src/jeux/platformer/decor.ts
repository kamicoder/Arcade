// Le décor du fond : deux rangées de collines qui défilent moins vite que le niveau (la parallaxe,
// une idée de « Aller plus loin » dans l'atelier). Elles ne suivent pas la caméra (setScrollFactor(0)) :
// c'est nous qui faisons défiler leurs tuiles, d'autant moins vite qu'elles sont loin.

import Phaser from "phaser";

const LARGEUR_TUILE = 480;

function dessinerDesCollines(scene: Phaser.Scene, cle: string, couleur: number, hauteur: number, bosses: number) {
  if (scene.textures.exists(cle)) {
    return;
  }
  const g = scene.make.graphics();
  g.fillStyle(couleur);
  // Une courbe faite de sinus, qui retombe pile à la même hauteur aux deux bouts : les tuiles se raccordent
  const points: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(0, hauteur)];
  for (let x = 0; x <= LARGEUR_TUILE; x += 8) {
    const a = (x / LARGEUR_TUILE) * Math.PI * 2;
    const y = hauteur * 0.45 - Math.sin(a * bosses) * hauteur * 0.2 - Math.sin(a * (bosses + 1) + 1) * hauteur * 0.12;
    points.push(new Phaser.Math.Vector2(x, y));
  }
  points.push(new Phaser.Math.Vector2(LARGEUR_TUILE, hauteur));
  g.fillPoints(points, true);
  // Quatre rangées vides sous les collines : une tuile se répète aussi en hauteur, et sans elles, le bas
  // plein de la tuile déborderait en un trait sur son haut vide (le bas du décor, lui, sort de l'écran)
  g.generateTexture(cle, LARGEUR_TUILE, hauteur + 4);
  g.destroy();
}

export function creerLeDecor(scene: Phaser.Scene): Phaser.GameObjects.TileSprite[] {
  dessinerDesCollines(scene, "platformer-collines-loin", 0x30364a, 260, 2);
  dessinerDesCollines(scene, "platformer-collines-pres", 0x363e56, 200, 3);
  return [
    scene.add.tileSprite(0, 250, 960, 264, "platformer-collines-loin").setOrigin(0).setScrollFactor(0).setDepth(-10).setData("vitesse", 0.15),
    scene.add.tileSprite(0, 330, 960, 204, "platformer-collines-pres").setOrigin(0).setScrollFactor(0).setDepth(-9).setData("vitesse", 0.35),
  ];
}

export function defilerLeDecor(scene: Phaser.Scene, decor: Phaser.GameObjects.TileSprite[]) {
  const x = scene.cameras.main.scrollX;
  for (const rangee of decor) {
    rangee.tilePositionX = x * rangee.getData("vitesse");
  }
}
