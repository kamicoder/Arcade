// Le fond de la partie, sous elle : le ciel étoilé sur toute la largeur du jeu.
//
// Au doigt, le jeu prend la proportion du téléphone (socle/largeur.ts), mais les vagues sont écrites pour
// un écran de 960 de large : les ennemis entrent et sortent juste au bord. La partie garde donc son aire de
// 960, au milieu (sa caméra ne montre qu'elle : un ennemi qui arrive de côté n'apparaît qu'en y entrant), et
// cette scène, dessous, prolonge le ciel jusqu'aux bords de l'écran. Les côtés, hors de l'aire, sont un peu
// voilés, avec un trait léger : on voit où les ennemis peuvent être. À l'ordinateur, l'aire fait tout l'écran.

import Phaser from "phaser";
import { Etoiles } from "../etoiles";
import { FOND } from "../reglages";
import { LARGEUR, HAUTEUR } from "../../../socle/style";

export class Fond extends Phaser.Scene {
  private etoiles!: Etoiles;

  constructor() {
    super("tir-fond");
  }

  create() {
    this.cameras.main.setBackgroundColor(FOND).fadeIn(300);
    this.etoiles = new Etoiles(this);
    const marge = (this.scale.width - LARGEUR) / 2;
    if (marge > 0) {
      for (const x of [0, marge + LARGEUR]) {
        this.add.rectangle(x, 0, marge, HAUTEUR, 0x000000, 0.35).setOrigin(0);
      }
      for (const x of [marge, marge + LARGEUR]) {
        this.add.rectangle(x, 0, 2, HAUTEUR, 0x5ff0ff, 0.25).setOrigin(0.5, 0);
      }
    }
  }

  // Le ciel ralentit avec la partie (le choc d'un coup reçu, le boss abattu)
  update(_temps: number, delta: number) {
    this.etoiles.defiler(delta * this.scene.get("tir-partie").time.timeScale);
  }
}
