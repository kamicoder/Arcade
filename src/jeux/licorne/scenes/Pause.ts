// La pause : la course et son tableau de bord sont en pause (scene.pause), cette scène s'affiche par-dessus.

import Phaser from "phaser";
import type { Course } from "./Course";
import { COULEURS } from "../reglages";
import { ecrire, bouton, touche } from "../interface";
import { LARGEUR, HAUTEUR } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";

export class Pause extends Phaser.Scene {
  constructor() {
    super("licorne-pause");
  }

  create() {
    const course = this.scene.get("licorne-course") as Course;
    this.add.rectangle(0, 0, LARGEUR, HAUTEUR, 0xffffff, 0.6).setOrigin(0);
    const texte = ecrire(this, LARGEUR / 2, HAUTEUR / 2 - 50, "Pause", 70, COULEURS.violet, { contour: true }).setScale(0.7);
    this.tweens.add({ targets: texte, scale: 1, duration: 250, ease: "Back.Out" });
    const reprendre = () => course.reprendre();
    const menu = () => course.quitter();
    bouton(this, LARGEUR / 2 - 200, HAUTEUR / 2 + 10, 190, 50, "Reprendre" + touche(" (P)"), reprendre);
    bouton(this, LARGEUR / 2 + 10, HAUTEUR / 2 + 10, 190, 50, "Menu" + touche(" (Échap)"), menu, true);
    surTouche(this, "P", reprendre);
    surTouche(this, "ESC", menu);
    this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => {
      if (b.index === 9 || b.index === 0) {
        reprendre();
      } else if (b.index === 1) {
        menu();
      }
    });
  }
}
