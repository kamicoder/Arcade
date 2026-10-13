// Le chargement de la baston : les planches des robots, leurs animations, les sons.
// C'est la première scène du jeu : le Hub la démarre, elle passe la main au titre.

import Phaser from "phaser";
import { creerAnimations, cleDePlanche } from "../textures";
import { chargerLaDisposition } from "../../../socle/touchesPhysiques";
import { ORANGE } from "../reglages";
import { LARGEUR, HAUTEUR } from "../../../socle/style";

export class Chargement extends Phaser.Scene {
  constructor() {
    super("baston-chargement");
  }

  preload() {
    const barre = this.add.rectangle(LARGEUR / 2 - 150, HAUTEUR / 2, 0, 12, ORANGE).setOrigin(0, 0.5);
    this.load.on("progress", (avancement: number) => {
      barre.width = 300 * avancement;
    });

    // Une planche + son atlas : l'image, et le .json qui nomme chaque case (« marche-2 »...)
    this.load.setPath("baston");
    this.load.atlas(cleDePlanche("bleu"), "robot-bleu.png", "robot-bleu.json");
    this.load.atlas(cleDePlanche("orange"), "robot-orange.png", "robot-orange.json");
    for (const son of ["coup", "tir", "special", "ko"]) {
      this.load.audio("baston-" + son, "sons/" + son + ".wav");
    }
  }

  create() {
    creerAnimations(this);
    chargerLaDisposition();                // pour écrire les bonnes lettres sur les touches
    this.scene.start("baston-titre");
  }
}
