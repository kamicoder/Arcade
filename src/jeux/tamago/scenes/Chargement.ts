// Le chargement du Tamago : ses bips (public/tamago/sons/) et la police de son thème. Puis on va
// directement voir le Tamago : pas de menu, c'est lui qui t'accueille.

import Phaser from "phaser";
import { habillage } from "../habillage";
import { LARGEUR, HAUTEUR } from "../../../socle/style";

export const SONS = [
  "bip", "miam", "joie", "non", "appel", "prout", "nettoie", "soin", "gronde", "evolution", "eclosion", "roi",
  "depart", "surprise", "tape",
];

export class Chargement extends Phaser.Scene {
  constructor() {
    super("tamago-chargement");
  }

  preload() {
    const barre = this.add.rectangle(LARGEUR / 2 - 150, HAUTEUR / 2, 0, 12, 0xff2d95).setOrigin(0, 0.5);
    this.load.on("progress", (avancement: number) => {
      barre.width = 300 * avancement;
    });
    habillage.charger(this);
    this.load.setPath("tamago/sons");
    for (const nom of SONS) {
      this.load.audio("tamago-" + nom, nom + ".wav");
    }
  }

  create() {
    this.scene.start("tamago-ecran");
  }
}
