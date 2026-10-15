// Le ciel étoilé qui défile : trois couches d'étoiles (textures.ts), les plus proches vont le plus vite.
// Le menu et le fond de la partie (scenes/Fond.ts) en ont chacun un, sur toute la largeur du jeu.

import Phaser from "phaser";
import { HAUTEUR } from "../../socle/style";

const COUCHES = [
  { nom: "loin", vitesse: 30 },
  { nom: "milieu", vitesse: 70 },
  { nom: "pres", vitesse: 160 },
];

export class Etoiles {
  private readonly couches: Phaser.GameObjects.TileSprite[];

  // allure : 1 en partie ; le menu les fait défiler plus doucement
  constructor(scene: Phaser.Scene, private readonly allure = 1) {
    this.couches = COUCHES.map((couche, i) =>
      scene.add.tileSprite(0, 0, scene.scale.width, HAUTEUR, "tir-etoiles-" + couche.nom).setOrigin(0).setDepth(-10 + i));
  }

  // À chaque image (delta : le temps écoulé, en ms)
  defiler(delta: number) {
    this.couches.forEach((couche, i) => (couche.tilePositionY -= COUCHES[i].vitesse * this.allure * delta / 1000));
  }
}
