// La fin du match : le vainqueur, par-dessus le combat (arrêté derrière), et la suite.

import Phaser from "phaser";
import type { Combat } from "./Combat";
import { enCouleur } from "../decor";
import { ListeDeBoutons } from "../../../socle/listeDeBoutons";
import { BLEU, ORANGE, MANCHES_GAGNANTES } from "../reglages";
import { HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE } from "../../../socle/manette";

export class Fin extends Phaser.Scene {
  constructor() {
    super("baston-fin");
  }

  create() {
    const combat = this.scene.get("baston-combat") as Combat;
    const milieu = this.scale.width / 2;   // la baston peut être plus large que 960 (au doigt)
    const bleuGagne = combat.manches.gauche >= MANCHES_GAGNANTES;
    let titre = bleuGagne ? "Le robot bleu gagne !" : "Le robot orange gagne !";
    if (combat.solo) {
      titre = bleuGagne ? "Tu gagnes !" : "L'ordinateur gagne !";
    }

    const voile = this.add.rectangle(0, 0, this.scale.width, HAUTEUR, 0x000000, 0.6).setOrigin(0).setAlpha(0);
    this.tweens.add({ targets: voile, alpha: 1, duration: 300 });
    const lignes = [
      this.add.text(milieu, 120, titre, {
        fontFamily: POLICE, fontSize: "56px", fontStyle: "bold", color: enCouleur(bleuGagne ? BLEU : ORANGE),
        stroke: "#1c1a25", strokeThickness: 8,
      }).setOrigin(0.5),
      // Le score du vainqueur d'abord : « 2 manches à 1 »
      this.add.text(milieu, 185, `${MANCHES_GAGNANTES} manches à ${Math.min(combat.manches.gauche, combat.manches.droite)}`, {
        fontFamily: POLICE, fontSize: "26px", fontStyle: "bold", color: "#ffffff",
      }).setOrigin(0.5),
    ];
    // Les lignes arrivent l'une après l'autre
    lignes.forEach((ligne, i) => {
      ligne.setAlpha(0).y += 30;
      this.tweens.add({ targets: ligne, alpha: 1, y: ligne.y - 30, duration: 350, delay: 200 + i * 150, ease: "Cubic.Out" });
    });

    // On attend un peu avant d'écouter : le pouce, ou la touche de frappe, était peut-être encore enfoncé
    this.time.delayedCall(800, () => {
      new ListeDeBoutons(this, [
        { nom: "Revanche", action: () => combat.revanche() },
        { nom: "Changer de robots", action: () => combat.quitter("baston-choix") },
        { nom: "Menu", action: () => combat.quitter() },
      ], { x: milieu, y: 280, largeur: 340, hauteur: 58, ecart: 74 }, { couleur: ORANGE });
      surTouche(this, "ESC", () => combat.quitter());
      surManette(this, MANETTE.B, () => combat.quitter());
    });
  }
}
