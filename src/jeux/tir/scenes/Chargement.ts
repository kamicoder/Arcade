// Le chargement du jeu de tir : les sons (dans public/tir/sons/), puis les images, toutes dessinées
// (textures.ts). C'est la première scène du jeu : elle passe la main au menu.

import Phaser from "phaser";
import { fabriquerTextures } from "../textures";
import { barreDeChargement } from "../../../socle/chargement";

const SONS = ["tir", "explosion", "touche", "bonus", "boss", "victoire", "choc"];

export class Chargement extends Phaser.Scene {
  constructor() {
    super("tir-chargement");
  }

  preload() {
    barreDeChargement(this, 0x5ff0ff);
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
