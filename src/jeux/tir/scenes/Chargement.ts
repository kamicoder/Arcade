// Le chargement du jeu de tir : les sons (dans public/tir/sons/), puis les images, toutes dessinées
// (textures.ts). C'est la première scène du jeu : elle passe la main au menu.

import Phaser from "phaser";
import { fabriquerTextures } from "../textures";
import { LARGEUR, HAUTEUR } from "../../../socle/style";

const SONS = ["tir", "explosion", "touche", "bonus", "boss", "victoire", "choc"];

export class Chargement extends Phaser.Scene {
  constructor() {
    super("tir-chargement");
  }

  preload() {
    const barre = this.add.rectangle(LARGEUR / 2 - 150, HAUTEUR / 2, 0, 12, 0x5ff0ff).setOrigin(0, 0.5);
    this.load.on("progress", (avancement: number) => {
      barre.width = 300 * avancement;
    });
    this.load.setPath("tir/sons");
    for (const nom of SONS) {
      this.load.audio("tir-" + nom, nom + ".wav");
    }
  }

  create() {
    fabriquerTextures(this);
    this.scene.start("tir-menu");
  }
}
