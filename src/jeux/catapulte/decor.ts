// Le paysage de la catapulte, au menu comme dans les niveaux : le ciel, des nuages qui passent, les
// collines au loin et l'herbe. « sol » : la hauteur du haut de l'herbe ; « gauche » : où il commence (un
// niveau élargi au doigt montre un peu de paysage à gauche du monde, en x négatif).

import type Phaser from "phaser";

export function paysage(scene: Phaser.Scene, largeur: number, hauteur: number, sol: number, gauche = 0) {
  scene.add.image(gauche, 0, "catapulte-ciel").setOrigin(0).setDisplaySize(largeur, hauteur).setDepth(-20);
  // Des nuages qui traversent le ciel, lentement, chacun à sa vitesse
  for (let i = 0; i < 4; i++) {
    const y = 40 + i * 55;
    const nuage = scene.add.image(gauche - 200 + i * (largeur / 3), y, "catapulte-nuage").setDepth(-19).setAlpha(0.9)
      .setScale(0.7 + (i % 2) * 0.4);
    scene.tweens.add({
      targets: nuage, x: gauche + largeur + 200, duration: 60000 + i * 15000, repeat: -1,
      onRepeat: () => nuage.setX(gauche - 200),
    });
  }
  scene.add.tileSprite(gauche, sol - 200, largeur, 220, "catapulte-collines").setOrigin(0).setDepth(-18);
  scene.add.tileSprite(gauche, sol - 6, largeur, hauteur - sol + 6, "catapulte-sol").setOrigin(0).setDepth(-5);
}
