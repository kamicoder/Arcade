// Le chargement du casse-briques : les sons (dans public/briques/sons/, fabriqués par
// outils/briques/sons.mjs), puis les images, toutes dessinées (textures.ts). Puis le menu des niveaux.

import Phaser from "phaser";
import { fabriquerTextures } from "../textures";
import { barreDeChargement } from "../../../socle/chargement";
import { VIOLET } from "../reglages";

const SONS = ["rebond", "mur", "brique", "dure", "metal", "boum", "bonus", "perdu", "victoire", "defaite"];

export class Chargement extends Phaser.Scene {
  constructor() {
    super("briques-chargement");
  }

  preload() {
    barreDeChargement(this, VIOLET);
    this.load.setPath("briques/sons");
    for (const nom of SONS) {
      this.load.audio("briques-" + nom, nom + ".wav");
    }
  }

  create() {
    fabriquerTextures(this);
    this.scene.start("briques-menu");
  }
}
