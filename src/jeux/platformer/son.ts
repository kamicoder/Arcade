// La musique et le bouton du son (la touche M, partout dans le platformer, comme dans l'atelier).
//
// La musique joue d'une scène à l'autre (menu, niveau, éditeur...) : le gestionnaire de sons est celui
// du jeu entier, pas d'une scène. On la retrouve par sa clé, et on l'arrête en quittant le platformer.
// Couper le son, c'est this.sound.mute : il coupe toute l'Arcade, donc on le remet en partant.

import type Phaser from "phaser";
import { lire, ecrire } from "../../socle/sauvegarde";
import { surTouche } from "../../socle/clavier";
import { SAUVEGARDE } from "./reglages";

const CLE = SAUVEGARDE + "/son";
const MUSIQUE = "platformer-musique";

export function sonAllume(): boolean {
  return lire<boolean>(CLE) !== false;
}

export function lancerLaMusique(scene: Phaser.Scene) {
  scene.sound.mute = !sonAllume();
  if (!scene.sound.get(MUSIQUE)) {
    scene.sound.add(MUSIQUE, { loop: true, volume: 0.35 }).play();
  }
}

export function quitterLePlatformer(scene: Phaser.Scene) {
  scene.sound.removeByKey(MUSIQUE);
  scene.sound.mute = false;
}

export function basculerLeSon(scene: Phaser.Scene) {
  ecrire(CLE, !sonAllume());
  scene.sound.mute = !sonAllume();
}

// La touche M : couper le son, ou le remettre. « quandChange » : pour qu'un bouton affiché suive.
export function toucheDuSon(scene: Phaser.Scene, quandChange?: () => void) {
  surTouche(scene, "M", () => {
    basculerLeSon(scene);
    quandChange?.();
  });
}
