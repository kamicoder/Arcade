// Une liste de boutons les uns sous les autres, à choisir au clavier (↑ ↓, Entrée ou Espace), à la
// manette (la croix, A ou Start), à la souris ou au doigt. Le titre et la fin de la baston, le menu du
// platformer. Chaque jeu garde ses touches à lui (Échap, des raccourcis) et sa couleur.

import Phaser from "phaser";
import { POLICE } from "./style";
import { surTouche } from "./clavier";
import { surManette, MANETTE, VALIDER } from "./manette";

export interface Choix {
  nom: string;
  aide?: string;
  // Ce que fait le bouton. S'il répond false, rien n'est lancé : on reste sur la liste (et on peut
  // valider de nouveau)
  action: () => void | boolean;
  possible?: boolean;                      // false : un bouton grisé, qui ne fait rien
}

export interface OptionsDeListe {
  couleur?: number;                        // le fond du bouton choisi
  depart?: number;                         // le bouton choisi au départ
  quandChoisi?: (i: number) => void;       // pour qu'un menu se souvienne du choix d'une visite à l'autre
}

export interface BoutonDeListe {
  fond: Phaser.GameObjects.Rectangle;
  nom: Phaser.GameObjects.Text;
  aide?: Phaser.GameObjects.Text;
  possible: boolean;
}

export class ListeDeBoutons {
  readonly boutons: BoutonDeListe[] = [];
  choisi = 0;
  private valide = false;                  // une seule validation : un double appui ne lance pas deux fois

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly choix: Choix[],
    position: { x: number; y: number; largeur: number; hauteur: number; ecart: number },
    private readonly options: OptionsDeListe = {},
  ) {
    choix.forEach((c, i) => {
      const y = position.y + i * position.ecart;
      const possible = c.possible !== false;
      const fond = scene.add.rectangle(position.x, y, position.largeur, position.hauteur, 0x2a2735)
        .setRounded(12).setStrokeStyle(2, 0x4a4560).setInteractive({ useHandCursor: possible });
      const nom = scene.add.text(position.x, y - (c.aide ? 11 : 0), c.nom, {
        fontFamily: POLICE, fontSize: "24px", fontStyle: "bold",
      }).setOrigin(0.5);
      const aide = c.aide
        ? scene.add.text(position.x, y + 16, c.aide, { fontFamily: POLICE, fontSize: "14px" }).setOrigin(0.5)
        : undefined;
      fond.on("pointerover", () => this.choisir(i));
      fond.on("pointerup", () => {
        this.choisir(i);
        this.valider();
      });
      this.boutons.push({ fond, nom, aide, possible });
    });

    surTouche(scene, "UP", () => this.choisir(this.choisi - 1));
    surTouche(scene, "DOWN", () => this.choisir(this.choisi + 1));
    surTouche(scene, "ENTER", () => this.valider());
    surTouche(scene, "SPACE", () => this.valider());
    surManette(scene, MANETTE.HAUT, () => this.choisir(this.choisi - 1));
    surManette(scene, MANETTE.BAS, () => this.choisir(this.choisi + 1));
    surManette(scene, VALIDER, () => this.valider());
    this.choisir(options.depart ?? 0);
  }

  choisir(i: number) {
    this.choisi = Phaser.Math.Wrap(i, 0, this.choix.length);
    this.options.quandChoisi?.(this.choisi);
    this.boutons.forEach((bouton, j) => {
      const elu = j === this.choisi;
      bouton.fond.setFillStyle(elu ? this.options.couleur ?? 0xffc83d : 0x2a2735);
      bouton.nom.setColor(elu ? "#1c1a25" : bouton.possible ? "#ffffff" : "#6d6880");
      bouton.aide?.setColor(elu ? "#1c1a25" : "#a49cb4");
      // Le bouton choisi grossit un peu : un tween, sur le fond et ses textes ensemble
      this.scene.tweens.add({
        targets: [bouton.fond, bouton.nom, bouton.aide].filter(Boolean),
        scale: elu ? 1.05 : 1,
        duration: 120,
        ease: "Back.Out",
      });
    });
  }

  valider() {
    if (this.valide || !this.boutons[this.choisi].possible) {
      return;
    }
    this.valide = this.choix[this.choisi].action() !== false;
  }
}
