// La fin d'une partie, par-dessus le jeu (qui s'est mis en pause derrière) : gagné ou perdu,
// le score ou la distance, puis rejouer ou s'en aller. Sert au solo et au duo.

import Phaser from "phaser";
import type { Niveau, Fin as Issue } from "./Niveau";
import type { Duo } from "./Duo";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";

export interface DonneesDeFin {
  fin: Issue;
  nouveauRecord?: boolean;
  gagnant?: string;                        // le duo : qui a gagné
}

export class Fin extends Phaser.Scene {
  constructor() {
    super("platformer-fin");
  }

  create(donnees: DonneesDeFin) {
    const niveau = this.scene.isActive("platformer-niveau") ? this.scene.get("platformer-niveau") as Niveau : null;
    const jeu = niveau ?? this.scene.get("platformer-duo") as Duo;
    const texte = (y: number, contenu: string, taille: number, couleur: string) =>
      this.add.text(LARGEUR / 2, y, contenu, {
        fontFamily: POLICE, fontSize: taille + "px", fontStyle: "bold", color: couleur, stroke: "#14121c", strokeThickness: 6,
      }).setOrigin(0.5);

    this.add.rectangle(0, 0, LARGEUR, HAUTEUR, 0x000000, 0.55).setOrigin(0);
    const lignes: Phaser.GameObjects.Text[] = [];
    const mode = niveau?.donnees.mode;
    if (!niveau) {
      lignes.push(texte(170, donnees.gagnant + " gagne !", 60, "#fff096"));
    } else if (donnees.fin === "gagne") {
      lignes.push(texte(160, mode === "test" ? "Niveau réussi !" : "BRAVO !", 64, "#78f078"));
      if (mode === "aventure") {
        lignes.push(texte(240, "Toute l'Aventure est finie !", 26, "#ffffff"));
      }
    } else {
      lignes.push(texte(160, mode === "infini" ? "PERDU !" : "GAME OVER", 64, "#f07878"));
    }
    if (mode === "infini") {
      lignes.push(texte(250, `${niveau!.distance} m    (record : ${niveau!.record} m)`, 28, "#ffffff"));
    } else if (mode === "aventure") {
      lignes.push(texte(290, `Score : ${niveau!.donnees.score}`, 28, "#ffffff"));
    }
    if (donnees.nouveauRecord) {
      const record = texte(330, "Nouveau record !", 26, "#ffd479");
      this.tweens.add({ targets: record, scale: 1.15, duration: 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      lignes.push(record);
    }
    lignes.forEach((ligne, i) => {
      ligne.setAlpha(0).y += 30;
      this.tweens.add({ targets: ligne, alpha: 1, y: ligne.y - 30, duration: 350, delay: i * 120, ease: "Cubic.Out" });
    });

    const ailleurs = mode === "test" ? "L'éditeur" : "Le menu";
    const bouton = (x: number, nom: string, touche: string, action: () => void) => {
      const fond = this.add.rectangle(x, 430, 260, 64, 0x2a2735).setRounded(14).setStrokeStyle(3, 0x5fd068)
        .setInteractive({ useHandCursor: true });
      this.add.text(x, 420, nom, { fontFamily: POLICE, fontSize: "24px", fontStyle: "bold" }).setOrigin(0.5);
      this.add.text(x, 446, touche, { fontFamily: POLICE, fontSize: "14px", color: "#a49cb4" }).setOrigin(0.5);
      fond.on("pointerup", action);
    };

    // On attend un peu avant d'écouter : le joueur tenait peut-être encore le saut
    let fini = false;
    const une = (action: () => void) => () => {
      if (!fini) {
        fini = true;
        action();
      }
    };
    const rejouer = une(() => jeu.rejouer());
    const quitter = une(() => jeu.quitter());
    this.time.delayedCall(600, () => {
      bouton(LARGEUR / 2 - 150, "Rejouer", "Entrée, R ou A", rejouer);
      bouton(LARGEUR / 2 + 150, ailleurs, "Échap ou B", quitter);
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
