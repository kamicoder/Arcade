// Le chargement du platformer : les images et les sons de l'atelier (dans public/platformer/), puis les
// images fabriquées et les animations du héros. C'est la première scène du jeu : elle passe la main au menu.

import Phaser from "phaser";
import { fabriquerTextures, garderLesPixelsNets } from "../textures";
import { creerLesAnimations, type Descriptif } from "../Heros";
import { AVEC_IMAGE } from "../genres";
import { LARGEUR, HAUTEUR } from "../../../socle/style";

const IMAGES = ["drapeau", "ennemi", "volant", "sauteur", "piece"];
const SONS = ["saut", "piece", "aie", "boss", "vie"];

export class Chargement extends Phaser.Scene {
  constructor() {
    super("platformer-chargement");
  }

  preload() {
    const barre = this.add.rectangle(LARGEUR / 2 - 150, HAUTEUR / 2, 0, 12, 0x5fd068).setOrigin(0, 0.5);
    this.load.on("progress", (avancement: number) => {
      barre.width = 300 * avancement;
    });

    this.load.setPath("platformer/images");
    for (const nom of IMAGES) {
      this.load.image("platformer-" + nom, nom + ".png");
    }
    for (const genre of AVEC_IMAGE) {
      this.load.image("platformer-genre-" + genre, "plateformes/" + genre + ".png");
    }
    // La planche du héros : des cases de 30 × 40, découpées par Phaser (une « spritesheet »)
    this.load.spritesheet("platformer-heros", "heros.png", { frameWidth: 30, frameHeight: 40 });
    this.load.spritesheet("platformer-heros2", "heros2.png", { frameWidth: 30, frameHeight: 40 });
    this.load.json("platformer-descriptif", "heros.json");

    this.load.setPath("platformer/sons");
    for (const nom of SONS) {
      this.load.audio("platformer-" + nom, nom + ".wav");
    }
    this.load.audio("platformer-musique", "musique.wav");
  }

  create() {
    fabriquerTextures(this);
    garderLesPixelsNets(this, [
      "platformer-heros", "platformer-heros2",
      ...AVEC_IMAGE.map((genre) => "platformer-genre-" + genre),
    ]);
    const descriptif = this.cache.json.get("platformer-descriptif") as Descriptif;
    creerLesAnimations(this, "platformer-heros", descriptif);
    creerLesAnimations(this, "platformer-heros2", descriptif);
    this.scene.start("platformer-menu");
  }
}
