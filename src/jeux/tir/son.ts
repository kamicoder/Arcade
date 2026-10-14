// Le son du jeu de tir, et son bouton (la touche M, au menu comme en jeu).
// Couper le son, c'est this.sound.mute : il coupe toute l'Arcade, donc on le remet en partant.

import type Phaser from "phaser";
import { lire, ecrire } from "../../socle/sauvegarde";
import { surTouche } from "../../socle/clavier";
import { SAUVEGARDE } from "./reglages";

const CLE = SAUVEGARDE + "/son";

export function sonAllume(): boolean {
  return lire<boolean>(CLE) !== false;
}

export function appliquerLeSon(scene: Phaser.Scene) {
  scene.sound.mute = !sonAllume();
}

export function quitterLeTir(scene: Phaser.Scene) {
  scene.sound.mute = false;
}

export function basculerLeSon(scene: Phaser.Scene) {
  ecrire(CLE, !sonAllume());
  appliquerLeSon(scene);
}

// La touche M : couper le son, ou le remettre. « quandChange » : pour qu'un bouton affiché suive.
export function toucheDuSon(scene: Phaser.Scene, quandChange?: () => void) {
  surTouche(scene, "M", () => {
    basculerLeSon(scene);
    quandChange?.();
  });
}
