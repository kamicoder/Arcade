// Ce que plusieurs scènes de la baston partagent : l'arène dessinée, et une liste de boutons
// qu'on choisit au clavier, à la manette, à la souris ou au doigt.

import Phaser from "phaser";
import { FOND, COULEUR_SOL, SOL, ORANGE, PROFONDEUR } from "./reglages";
import { HAUTEUR, POLICE } from "../../socle/style";
import { surTouche } from "../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../socle/manette";

export const enCouleur = (couleur: number) => "#" + couleur.toString(16).padStart(6, "0");

// L'arène : un mur du fond, deux projecteurs, et le sol. Toute la largeur du jeu : au doigt, elle
// peut dépasser 960 (voir socle/largeur.ts).
export function dessinerArene(scene: Phaser.Scene) {
  const largeur = scene.scale.width;
  scene.cameras.main.setBackgroundColor(FOND);
  const g = scene.add.graphics().setDepth(PROFONDEUR.decor);
  // Des bandes un peu plus claires sur le mur du fond
  for (let x = 0; x < largeur; x += 120) {
    g.fillStyle(0xffffff, 0.025).fillRect(x, 0, 60, SOL);
  }
  // Les projecteurs : des triangles de lumière, presque transparents
  g.fillStyle(0xfff3c4, 0.05);
  g.fillTriangle(largeur * 0.25, -10, largeur * 0.05, SOL, largeur * 0.45, SOL);
  g.fillTriangle(largeur * 0.75, -10, largeur * 0.55, SOL, largeur * 0.95, SOL);
  // Le sol, et son bord éclairé
  g.fillStyle(COULEUR_SOL).fillRect(0, SOL, largeur, HAUTEUR - SOL);
  g.fillStyle(0x6a708a).fillRect(0, SOL, largeur, 4);
  return g;
}

export interface Choix {
  nom: string;
  aide?: string;
  action: () => void;
}

// Des boutons les uns sous les autres. ↑ ↓ (ou la croix) pour choisir, Entrée (ou A) pour valider.
export class ListeDeBoutons {
  private readonly fonds: Phaser.GameObjects.Rectangle[] = [];
  private readonly noms: Phaser.GameObjects.Text[] = [];
  private readonly aides: (Phaser.GameObjects.Text | undefined)[] = [];
  private choisi = 0;
  private valide = false;                  // une seule validation : un double appui ne lance pas deux fois

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly choix: Choix[],
    position: { x: number; y: number; largeur: number; hauteur: number; ecart: number },
    private readonly couleur = ORANGE,
  ) {
    choix.forEach((c, i) => {
      const y = position.y + i * position.ecart;
      const fond = scene.add.rectangle(position.x, y, position.largeur, position.hauteur, 0x2a2735)
        .setRounded(12).setStrokeStyle(2, 0x4a4560).setInteractive({ useHandCursor: true });
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
      this.fonds.push(fond);
      this.noms.push(nom);
      this.aides.push(aide);
    });

    surTouche(scene, "UP", () => this.choisir(this.choisi - 1));
    surTouche(scene, "DOWN", () => this.choisir(this.choisi + 1));
    surTouche(scene, "ENTER", () => this.valider());
    surTouche(scene, "SPACE", () => this.valider());
    surManette(scene, MANETTE.HAUT, () => this.choisir(this.choisi - 1));
    surManette(scene, MANETTE.BAS, () => this.choisir(this.choisi + 1));
    surManette(scene, VALIDER, () => this.valider());
    this.choisir(0);
  }

  choisir(i: number) {
    this.choisi = Phaser.Math.Wrap(i, 0, this.choix.length);
    this.fonds.forEach((fond, j) => {
      const elu = j === this.choisi;
      fond.setFillStyle(elu ? this.couleur : 0x2a2735);
      this.noms[j].setColor(elu ? "#1c1a25" : "#ffffff");
      this.aides[j]?.setColor(elu ? "#1c1a25" : "#a49cb4");
      // Le bouton choisi grossit un peu : un tween, sur le fond et ses textes ensemble
      this.scene.tweens.add({
        targets: [fond, this.noms[j], this.aides[j]].filter(Boolean),
        scale: elu ? 1.05 : 1,
        duration: 120,
        ease: "Back.Out",
      });
    });
  }

  valider() {
    if (this.valide) {
      return;
    }
    this.valide = true;
    this.choix[this.choisi].action();
  }
}
