// Le tableau de bord, par-dessus le niveau (sa caméra ne zoome pas : les textes restent nets) : le
// niveau, le score, une aide pour viser, et la fiche du boulet spécial qui attend dans la fronde (son
// image et son pouvoir), annoncé en grand quand il arrive.

import Phaser from "phaser";
import type { Niveau } from "./Niveau";
import { BOULETS, type GenreDeBoulet } from "../reglages";
import { HAUTEUR, POLICE } from "../../../socle/style";
import { estTactile } from "../../../socle/tactile";
import { boutonFermer } from "../../../socle/boutonArcade";
import { annoncer } from "../../../socle/annonce";

export class Tableau extends Phaser.Scene {
  private niveau!: Niveau;
  private score!: Phaser.GameObjects.Text;
  private aide!: Phaser.GameObjects.Text;
  fiche!: Phaser.GameObjects.Container;   // les tests y lisent le pouvoir montré
  private ficheImage!: Phaser.GameObjects.Image;
  private ficheTexte!: Phaser.GameObjects.Text;
  private dernierBoulet: unknown = null;   // pour n'annoncer chaque boulet qu'une fois, à son arrivée

  constructor() {
    super("catapulte-tableau");
  }

  create() {
    this.niveau = this.scene.get("catapulte-niveau") as Niveau;
    this.dernierBoulet = null;
    const largeur = this.scale.width;      // au doigt, plus large que 960 (le niveau s'élargit)
  const style = { fontFamily: POLICE, fontSize: "20px", fontStyle: "bold", color: "#ffffff", stroke: "#3a2410", strokeThickness: 5 };
    this.add.text(16, 16, `Niveau ${this.niveau.numero + 1} : ${this.niveau.niveau.nom}`, style);
    this.score = this.add.text(largeur / 2, 16, "", style).setOrigin(0.5, 0);
    boutonFermer(this, largeur - 26, 26, () => this.niveau.quitter());
    this.aide = this.add.text(largeur / 2, HAUTEUR - 26, "", {
      fontFamily: POLICE, fontSize: "17px", color: "#ffffff", stroke: "#3a2410", strokeThickness: 4,
    }).setOrigin(0.5);

    // La fiche du boulet spécial : un cadre, son image, son nom et son pouvoir
    const fond = this.add.rectangle(0, 0, 330, 58, 0x3a2410, 0.75).setOrigin(0).setStrokeStyle(2, 0xffd23f);
    this.ficheImage = this.add.image(32, 29, "catapulte-boulet");
    this.ficheTexte = this.add.text(62, 29, "", {
      fontFamily: POLICE, fontSize: "15px", color: "#ffffff", wordWrap: { width: 258 },
    }).setOrigin(0, 0.5);
    this.fiche = this.add.container(16, 52, [fond, this.ficheImage, this.ficheTexte]).setVisible(false);
  }

  update() {
    const n = this.niveau;
    this.score.setText(`Score : ${n.score}`);
    this.aide.setText(n.etat === "pret" || n.etat === "vise"
      ? estTactile()
        ? "Tire l'élastique vers l'arrière, et lâche !"
        : "Tire l'élastique à la souris, ou : ↑ ↓ l'angle, ← → la force, Espace pour tirer"
      : "");

    // Le boulet spécial dans la fronde ; et le triple, encore en vol, tant qu'il ne s'est pas divisé
    let special: GenreDeBoulet | undefined;
    if ((n.etat === "pret" || n.etat === "vise") && n.boulet) {
      special = n.boulet.genre as GenreDeBoulet;
    } else if (n.etat === "vol" && n.enVol[0]?.genre === "triple") {
      special = "triple";
    }
    const fiche = special ? BOULETS[special] : null;
    if (fiche?.pouvoir) {
      const geste = estTactile() ? "touche l'écran" : "clic ou Espace";
      this.ficheImage.setTexture("catapulte-" + fiche.image);
      this.ficheTexte.setText(`${fiche.nom} : ${fiche.pouvoir.replace("{geste}", geste)}`);
    }
    this.fiche.setVisible(!!fiche?.pouvoir);

    // Un boulet spécial vient d'arriver dans la fronde : son nom, en grand
    if (n.boulet && n.boulet !== this.dernierBoulet) {
      this.dernierBoulet = n.boulet;
      if (fiche?.pouvoir) {
        annoncer(this, fiche.nom + " !", { y: HAUTEUR / 2 - 60, taille: 40, couleur: "#ffd23f" });
      }
    }
  }
}
