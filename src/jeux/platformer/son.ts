// La musique du platformer. Le son coupé ou remis (la touche M, le bouton du menu) est celui de tous
// les jeux : socle/son.ts, sous la clé « platformer/son ».
//
// La musique joue d'une scène à l'autre (menu, niveau, éditeur...) : le gestionnaire de sons est celui
// du jeu entier, pas d'une scène. On la retrouve par sa clé, et on l'arrête en quittant le platformer.

import type Phaser from "phaser";
import { appliquerLeSon } from "../../socle/son";
import { SAUVEGARDE } from "./reglages";

const MUSIQUE = "platformer-musique";

export function lancerLaMusique(scene: Phaser.Scene) {
  appliquerLeSon(scene, SAUVEGARDE);
  if (!scene.sound.get(MUSIQUE)) {
    scene.sound.add(MUSIQUE, { loop: true, volume: 0.35 }).play();
  }
}

// En partant : la musique s'arrête (le son, lui, est remis par retourAuHub)
export function quitterLePlatformer(scene: Phaser.Scene) {
  scene.sound.removeByKey(MUSIQUE);
}
