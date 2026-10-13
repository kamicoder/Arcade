// La scène de démarrage : elle prépare ce que toute l'Arcade utilise, puis passe la main au Hub.
// Plus tard, c'est ici qu'on chargera les images et les sons communs (dans preload).

import Phaser from "phaser";

export class Demarrage extends Phaser.Scene {
  constructor() {
    super("Demarrage");                    // le nom de la scène, pour this.scene.start("Demarrage")
  }

  create() {
    // Une texture fabriquée au lieu d'être chargée : on dessine avec un Graphics,
    // on en fait une image nommée « etincelle », et on jette le Graphics.
    const pinceau = this.make.graphics();
    pinceau.fillStyle(0xffffff);
    pinceau.fillCircle(4, 4, 4);
    pinceau.generateTexture("etincelle", 8, 8);
    pinceau.destroy();

    this.scene.start("Hub");
  }
}
