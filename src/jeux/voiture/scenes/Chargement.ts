// Le chargement de la course de voitures : ses sons, et ses images fabriquées.
// C'est la première scène du jeu : le Hub la démarre, elle passe la main au menu.

import Phaser from "phaser";
import { fabriquerTextures } from "../textures";
import { LARGEUR, HAUTEUR } from "../../../socle/style";
import { ORANGE } from "../reglages";

export class Chargement extends Phaser.Scene {
  constructor() {
    super("voiture-chargement");
  }

  // preload : Phaser charge tout ce qu'on lui demande ici, et n'appelle create() qu'une fois tout arrivé
  preload() {
    // Une barre qui se remplit : le chargeur prévient à chaque progrès (de 0 à 1)
    const barre = this.add.rectangle(LARGEUR / 2 - 150, HAUTEUR / 2, 0, 12, ORANGE).setOrigin(0, 0.5);
    this.load.on("progress", (avancement: number) => {
      barre.width = 300 * avancement;
    });

    this.load.setPath("voiture/sons");
    this.load.audio("voiture-bip", "bip.wav");
    this.load.audio("voiture-moteur", "moteur.wav");
    this.load.audio("voiture-moteur-mobile", "moteur-mobile.wav");
  }

  create() {
    fabriquerTextures(this);
    this.scene.start("voiture-menu");
  }
}
