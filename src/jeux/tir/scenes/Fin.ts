// La fin d'une partie, par-dessus la partie (qui s'est mise en pause derrière) : le score, la vague
// atteinte, peut-être un record, puis rejouer ou revenir au menu.

import Phaser from "phaser";
import type { Partie } from "./Partie";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";

export interface DonneesDeFin {
  nouveauRecord: boolean;
}

export class Fin extends Phaser.Scene {
  constructor() {
    super("tir-fin");
  }

  create(donnees: DonneesDeFin) {
    const partie = this.scene.get("tir-partie") as Partie;
    const texte = (y: number, contenu: string, taille: number, couleur: string) =>
      this.add.text(LARGEUR / 2, y, contenu, {
        fontFamily: POLICE, fontSize: taille + "px", fontStyle: "bold", color: couleur, stroke: "#14121c", strokeThickness: 6,
      }).setOrigin(0.5);

    this.add.rectangle(0, 0, LARGEUR, HAUTEUR, 0x000000, 0.55).setOrigin(0);
    const lignes = [
      texte(150, "GAME OVER", 64, "#f07878"),
      texte(240, `Score : ${partie.score}`, 32, "#ffffff"),
      texte(285, `Vague ${partie.vague.numero}    (record : ${partie.record})`, 22, "#a59fc0"),
    ];
    if (donnees.nouveauRecord) {
      const record = texte(330, "Nouveau record !", 26, "#ffd479");
      this.tweens.add({ targets: record, scale: 1.15, duration: 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      lignes.push(record);
    }
    lignes.forEach((ligne, i) => {
      ligne.setAlpha(0).y += 30;
      this.tweens.add({ targets: ligne, alpha: 1, y: ligne.y - 30, duration: 350, delay: i * 120, ease: "Cubic.Out" });
    });

    const bouton = (x: number, nom: string, touche: string, action: () => void) => {
      const fond = this.add.rectangle(x, 430, 260, 64, 0x1c2a44).setRounded(14).setStrokeStyle(3, 0x5ff0ff)
        .setInteractive({ useHandCursor: true });
      this.add.text(x, 420, nom, { fontFamily: POLICE, fontSize: "24px", fontStyle: "bold" }).setOrigin(0.5);
      this.add.text(x, 446, touche, { fontFamily: POLICE, fontSize: "14px", color: "#a49cb4" }).setOrigin(0.5);
      fond.on("pointerup", action);
    };

    // On attend un peu avant d'écouter : le joueur avait peut-être encore le doigt sur l'écran
    let fini = false;
    const une = (action: () => void) => () => {
      if (!fini) {
        fini = true;
        action();
      }
    };
    const rejouer = une(() => partie.rejouer());
    const quitter = une(() => partie.quitter());
    this.time.delayedCall(600, () => {
      bouton(LARGEUR / 2 - 150, "Rejouer", "Entrée, R ou A", rejouer);
      bouton(LARGEUR / 2 + 150, "Le menu", "Échap ou B", quitter);
      surTouche(this, "ENTER", rejouer);
      surTouche(this, "R", rejouer);
      surTouche(this, "ESC", quitter);
      this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => {
        if (b.index === 0 || b.index === 9) {
          rejouer();
        } else if (b.index === 1) {
          quitter();
        }
      });
    });
  }
}
