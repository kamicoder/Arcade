// La pause : la course et son tableau de bord sont en pause (scene.pause), cette scène s'affiche par-dessus.

import Phaser from "phaser";
import type { Piste } from "./Piste";
import { themeEnCours } from "../sauvegarde";
import { ecrire, bouton, touche } from "../interface";
import { LARGEUR, HAUTEUR } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";

export class Pause extends Phaser.Scene {
  constructor() {
    super("course-pause");
  }

  create() {
    const c = themeEnCours().habillage.couleurs;
    const course = this.scene.get("course-piste") as Piste;
    this.add.rectangle(0, 0, LARGEUR, HAUTEUR, c.voile, c.alphaVoile * 0.75).setOrigin(0);
    const texte = ecrire(this, LARGEUR / 2, HAUTEUR / 2 - 50, "Pause", 70, c.accent2, { contour: true }).setScale(0.7);
    this.tweens.add({ targets: texte, scale: 1, duration: 250, ease: "Back.Out" });
    const reprendre = () => course.reprendre();
    const menu = () => course.quitter();
    bouton(this, LARGEUR / 2 - 200, HAUTEUR / 2 + 10, 190, 50, "Reprendre" + touche(" (P)"), reprendre);
    bouton(this, LARGEUR / 2 + 10, HAUTEUR / 2 + 10, 190, 50, "Menu" + touche(" (Échap)"), menu, true);
    surTouche(this, "P", reprendre);
    surTouche(this, "ESC", menu);
    surManette(this, VALIDER, reprendre);
    surManette(this, MANETTE.B, menu);
  }
}
