// La fin d'un niveau, par-dessus : gagné (ses étoiles arrivent une à une) ou raté, le score, et la
// suite : le niveau suivant, rejouer, ou revenir aux niveaux (socle/listeDeBoutons.ts).

import Phaser from "phaser";
import type { Niveau } from "./Niveau";
import { NIVEAUX } from "../niveaux";
import { HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE } from "../../../socle/manette";
import { ListeDeBoutons, type Choix } from "../../../socle/listeDeBoutons";

export interface DonneesDeFin {
  gagne: boolean;
  etoiles: number;
  score: number;
  record: boolean;
}

export class Fin extends Phaser.Scene {
  constructor() {
    super("catapulte-fin");
  }

  create(donnees: DonneesDeFin) {
    const niveau = this.scene.get("catapulte-niveau") as Niveau;
    const largeur = this.scale.width;      // au doigt, plus large que 960 (le niveau s'élargit)
    this.add.rectangle(0, 0, largeur, HAUTEUR, 0x000000, 0.5).setOrigin(0);
    const titre = (y: number, texte: string, taille: number, couleur: string) =>
      this.add.text(largeur / 2, y, texte, {
        fontFamily: POLICE, fontSize: taille + "px", fontStyle: "bold", color: couleur, stroke: "#3a2410", strokeThickness: 7,
      }).setOrigin(0.5);

    titre(70, donnees.gagne ? "Bravo !" : "Raté...", 56, donnees.gagne ? "#9cf08a" : "#f07878");
    if (donnees.gagne) {
      // Les étoiles arrivent une par une, en tournant
      for (let e = 0; e < 3; e++) {
        const pleine = e < donnees.etoiles;
        const etoile = this.add.image(largeur / 2 + (e - 1) * 80, 150, pleine ? "catapulte-etoile" : "catapulte-etoile-vide")
          .setScale(0).setAngle(-90);
        this.tweens.add({
          targets: etoile, scale: 1.2, angle: 0, duration: 400, delay: 300 + e * 300, ease: "Back.Out",
          onStart: () => pleine && this.sound.play("catapulte-etoile", { rate: 1 + e * 0.15 }),
        });
      }
      titre(212, `Score : ${donnees.score}`, 28, "#ffffff");
      if (donnees.record) {
        const record = titre(246, "Nouveau record !", 20, "#ffd479");
        this.tweens.add({ targets: record, scale: 1.12, duration: 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      }
    } else {
      titre(150, "Il reste des slimes : réessaie !", 26, "#ffffff");
    }

    const choix: Choix[] = [];
    if (donnees.gagne && niveau.numero + 1 < NIVEAUX.length) {
      choix.push({ nom: "Niveau suivant", action: () => niveau.suivant() });
    }
    choix.push({ nom: "Rejouer", action: () => niveau.rejouer() });
    choix.push({ nom: "Les niveaux", action: () => niveau.quitter() });
    // On attend un peu avant d'écouter : le joueur avait peut-être encore le doigt sur l'écran
    this.time.delayedCall(700, () => {
      new ListeDeBoutons(this, choix, { x: largeur / 2, y: 310, largeur: 320, hauteur: 56, ecart: 70 }, { couleur: 0xffd23f });
      surTouche(this, "ESC", () => niveau.quitter());
      surManette(this, MANETTE.B, () => niveau.quitter());
    });
  }
}
