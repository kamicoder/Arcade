// Le chargement de la catapulte : ses images (dessinées par outils/catapulte/dessins.js) et ses sons.
// Puis le menu des niveaux.

import Phaser from "phaser";
import { barreDeChargement } from "../../../socle/chargement";

const MATIERES = ["bois", "pierre", "glace"];
const FORMES = ["carre", "court", "long"];
const IMAGES = [
  ...MATIERES.flatMap((m) => FORMES.flatMap((f) => [`${m}-${f}`, `${m}-${f}-abime`])),
  "slime", "slime-aie", "chef", "chef-aie", "boulet", "boulet-lourd", "boulet-triple", "boulet-petit",
  "fronde", "ciel", "nuage", "collines", "sol", "eclat-bois", "eclat-pierre", "eclat-glace", "goutte",
  "etoile", "etoile-vide",
];
export const SONS = ["tir", "tension", "bois", "pierre", "glace", "slime", "ouille", "victoire", "defaite", "etoile"];

export class Chargement extends Phaser.Scene {
  constructor() {
    super("catapulte-chargement");
  }

  preload() {
    barreDeChargement(this, 0xdc9a52);
    this.load.setPath("catapulte/images");
    for (const nom of IMAGES) {
      this.load.image("catapulte-" + nom, nom + ".png");
    }
    this.load.setPath("catapulte/sons");
    for (const nom of SONS) {
      this.load.audio("catapulte-" + nom, nom + ".wav");
    }
  }

  create() {
    this.scene.start("catapulte-menu");
  }
}
