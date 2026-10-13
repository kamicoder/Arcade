// Le chargement de la course des licornes : sa police, ses images fabriquées, son musicien.
// C'est la première scène du jeu : le Hub la démarre, elle passe la main au menu.

import Phaser from "phaser";
// La police ronde de l'ancien jeu, Fredoka (licence libre SIL OFL). Elle voyage DANS le code du jeu
// (?inline : Vite l'écrit en data:...) : elle marche donc sans réseau, comme le reste de l'Arcade.
import fredoka from "../fredoka.woff2?inline";
import { fabriquerTextures } from "../textures";
import { brancherLeSon, musicien } from "../sons";
import { LARGEUR, HAUTEUR } from "../../../socle/style";

export class Chargement extends Phaser.Scene {
  constructor() {
    super("licorne-chargement");
  }

  preload() {
    // Déjà là, à un lancement d'avant ? (document.fonts.check ne sert à rien ici : il répond oui
    // pour une police qu'il ne connaît pas du tout)
    const dejaLa = [...document.fonts].some((police) => police.family === "Fredoka" && police.status === "loaded");
    if (!dejaLa) {
      const barre = this.add.rectangle(LARGEUR / 2 - 150, HAUTEUR / 2, 0, 12, 0xff8fd0).setOrigin(0, 0.5);
      this.load.on("progress", (avancement: number) => {
        barre.width = 300 * avancement;
      });
      this.load.font("Fredoka", fredoka, "woff2", { weight: "300 700" });
    }
  }

  create() {
    fabriquerTextures(this);
    brancherLeSon(this);
    // La musique passe d'une scène à l'autre : elle a sa propre scène, qui tourne à côté des autres
    this.scene.launch("licorne-musique");
    this.scene.start("licorne-menu");
  }
}

// Le musicien : une scène sans rien à montrer, dont la minuterie prépare les notes à venir.
// retourAuHub l'arrête avec les autres scènes du jeu : la musique s'arrête avec elle.
export class Musique extends Phaser.Scene {
  constructor() {
    super("licorne-musique");
  }

  create() {
    this.time.addEvent({ delay: 30, loop: true, callback: () => musicien.preparer() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      musicien.air = null;
    });
  }
}
