// La fin, par-dessus la partie (en pause derrière). Un niveau gagné : ses étoiles arrivent une à une, puis le
// niveau suivant, rejouer ou revenir aux niveaux. Perdu : rejouer ou revenir. Le mode sans fin : le score,
// le mur atteint, le record. Les boutons : socle/listeDeBoutons.ts.

import Phaser from "phaser";
import type { Partie } from "./Partie";
import type { RecordSansFin } from "../progression";
import { NIVEAUX } from "../niveaux";
import { VIOLET } from "../reglages";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE } from "../../../socle/manette";
import { ListeDeBoutons, type Choix } from "../../../socle/listeDeBoutons";

export interface DonneesDeFin {
  gagne: boolean;
  etoiles: number;
  score: number;
  record: boolean;
  recordSansFin: RecordSansFin;
}

export class Fin extends Phaser.Scene {
  constructor() {
    super("briques-fin");
  }

  create(donnees: DonneesDeFin) {
    const partie = this.scene.get("briques-partie") as Partie;
    this.add.rectangle(0, 0, LARGEUR, HAUTEUR, 0x000000, 0.6).setOrigin(0);
    const titre = (y: number, texte: string, taille: number, couleur: string) =>
      this.add.text(LARGEUR / 2, y, texte, {
        fontFamily: POLICE, fontSize: taille + "px", fontStyle: "bold", color: couleur, stroke: "#14121c", strokeThickness: 7,
      }).setOrigin(0.5);

    const choix: Choix[] = [];
    if (partie.sansFin) {
      titre(80, "GAME OVER", 60, "#f07878");
      titre(160, `Score : ${donnees.score}`, 32, "#ffffff");
      const record = donnees.recordSansFin;
      titre(205, `Mur ${partie.mur}    (record : ${record.score}, mur ${record.mur})`, 20, "#c8b8f0");
    } else if (donnees.gagne) {
      titre(70, "Bravo !", 58, "#9cf08a");
      // Les étoiles arrivent une par une, en tournant
      for (let e = 0; e < 3; e++) {
        const pleine = e < donnees.etoiles;
        const etoile = this.add.text(LARGEUR / 2 + (e - 1) * 80, 150, "★", {
          fontFamily: POLICE, fontSize: "72px", color: pleine ? "#ffd23f" : "#4a4560", stroke: "#14121c", strokeThickness: 6,
        }).setOrigin(0.5).setScale(0).setAngle(-90);
        this.tweens.add({
          targets: etoile, scale: 1, angle: 0, duration: 400, delay: 300 + e * 300, ease: "Back.Out",
          onStart: () => pleine && this.sound.play("briques-bonus", { rate: 1 + e * 0.2 }),
        });
      }
      titre(222, `Score : ${donnees.score}`, 28, "#ffffff");
    } else {
      titre(90, "Plus de balle...", 54, "#f07878");
      titre(160, "Il reste des briques : réessaie !", 26, "#ffffff");
    }
    if (donnees.record && donnees.score > 0) {
      const record = titre(258, "Nouveau record !", 22, "#ffd479");
      this.tweens.add({ targets: record, scale: 1.12, duration: 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }

    if (partie.donnees.mode === "niveau" && donnees.gagne) {
      // Le dernier niveau gagné ouvre le mode sans fin
      const dernier = partie.donnees.numero + 1 >= NIVEAUX.length;
      choix.push({ nom: dernier ? "Le mode sans fin !" : "Niveau suivant", action: () => partie.suivant() });
    }
    choix.push({ nom: "Rejouer", action: () => partie.rejouer() });
    choix.push({ nom: "Les niveaux", action: () => partie.quitter() });
    // On attend un peu avant d'écouter : le joueur avait peut-être encore le doigt sur l'écran
    this.time.delayedCall(700, () => {
      new ListeDeBoutons(this, choix, { x: LARGEUR / 2, y: 320, largeur: 320, hauteur: 56, ecart: 70 }, { couleur: VIOLET });
      surTouche(this, "ESC", () => partie.quitter());
      surManette(this, MANETTE.B, () => partie.quitter());
    });
  }
}
