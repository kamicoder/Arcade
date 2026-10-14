// Une annonce en grand, au milieu de l'écran (« Vague 3 », « Niveau 2 : Grand saut ») : elle arrive en
// grossissant, reste un instant, puis s'en va en montant, et disparaît. Le tir et le platformer ; la
// course, la baston et le démineur ont leurs annonces à eux (des messages empilés, un K.O. qui reste...).

import type Phaser from "phaser";
import { POLICE } from "./style";

export interface StyleDAnnonce {
  y: number;
  taille?: number;                         // en pixels
  couleur?: string;                        // couleur CSS
  reste?: number;                          // le temps à l'écran (ms)
}

export function annoncer(scene: Phaser.Scene, texte: string, style: StyleDAnnonce) {
  const bandeau = scene.add.text(scene.scale.width / 2, style.y, texte, {
    fontFamily: POLICE, fontSize: (style.taille ?? 44) + "px", fontStyle: "bold", color: style.couleur ?? "#ffffff",
    stroke: "#14121c", strokeThickness: 8,
  }).setOrigin(0.5).setScale(0.6).setAlpha(0);
  scene.tweens.chain({
    targets: bandeau,
    tweens: [
      { alpha: 1, scale: 1, duration: 350, ease: "Back.Out" },
      { alpha: 0, y: style.y - 30, duration: 400, delay: style.reste ?? 900, onComplete: () => bandeau.destroy() },
    ],
  });
}
