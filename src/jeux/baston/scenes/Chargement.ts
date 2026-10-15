// Le chargement de la baston : les planches des robots, leurs animations, les sons.
// C'est la première scène du jeu : le Hub la démarre, elle passe la main au titre.

import Phaser from "phaser";
import { creerAnimations, cleDePlanche } from "../textures";
import { ORANGE } from "../reglages";
import { barreDeChargement } from "../../../socle/chargement";

export class Chargement extends Phaser.Scene {
  constructor() {
    super("baston-chargement");
  }

  preload() {
    barreDeChargement(this, ORANGE);

    // Une planche + son atlas : l'image, et le .json qui nomme chaque case (« marche-2 »...)
    this.load.setPath("baston");
    this.load.atlas(cleDePlanche("bleu"), "robot-bleu.png", "robot-bleu.json");
    this.load.atlas(cleDePlanche("orange"), "robot-orange.png", "robot-orange.json");
    // Les quatre premiers viennent de l'atelier ; les autres sont fabriqués par outils/baston/sons.mjs
    for (const son of ["coup", "tir", "special", "ko", "saut", "bip", "combat", "victoire", "defaite"]) {
      this.load.audio("baston-" + son, "sons/" + son + ".wav");
    }
  }

  create() {
    creerAnimations(this);
    this.scene.start("baston-titre");
  }
}
