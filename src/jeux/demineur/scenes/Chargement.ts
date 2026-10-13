// Le chargement du démineur : les images et les sons de l'atelier, et les textures fabriquées.
// C'est la première scène du jeu : le Hub la démarre, elle passe la main au menu des niveaux.

import Phaser from "phaser";
import { fabriquerTextures } from "../textures";
import { LARGEUR, HAUTEUR } from "../../../socle/style";

export class Chargement extends Phaser.Scene {
  constructor() {
    super("demineur-chargement");
  }

  preload() {
    const barre = this.add.rectangle(LARGEUR / 2 - 150, HAUTEUR / 2, 0, 12, 0x4fb3ff).setOrigin(0, 0.5);
    this.load.on("progress", (avancement: number) => {
      barre.width = 300 * avancement;
    });

    this.load.setPath("demineur");
    for (const nom of ["mine", "drapeau", "smiley", "smiley_oh", "smiley_gagne", "smiley_perdu"]) {
      this.load.image("demineur-" + nom, "images/" + nom + ".png");
    }
    for (const nom of ["clic", "boum", "victoire"]) {
      this.load.audio("demineur-" + nom, "sons/" + nom + ".wav");
    }
  }

  create() {
    fabriquerTextures(this);
    this.scene.start("demineur-menu");
  }
}
