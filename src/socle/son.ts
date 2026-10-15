// Le son allumé ou coupé, pour les jeux qui n'ont que ce réglage (le tir, le platformer, le démineur, le
// Tamago ; la course a le sien, avec la musique à part). La touche M, partout dans le jeu, et le bouton du
// son en haut à droite des menus (et dans la pause). Chaque jeu range son choix sous sa clé : « tir/son », « platformer/son »...
//
// Couper, c'est scene.sound.mute : il coupe toute l'Arcade. retourAuHub (retour.ts) le remet en partant,
// pour qu'aucun jeu ne puisse l'oublier.

import type Phaser from "phaser";
import { lire, ecrire } from "./sauvegarde";
import { surTouche } from "./clavier";
import { POLICE } from "./style";

// On ne relit jamais sound.mute : quand rien ne joue, il peut répondre « coupé » à tort
// (docs/PIEGES-PHASER.md). On sait ce qu'on a demandé : la sauvegarde du jeu le dit.
export function couper(scene: Phaser.Scene, voulu: boolean) {
  scene.sound.mute = voulu;
}

export function sonAllume(jeu: string): boolean {
  return lire<boolean>(jeu + "/son") !== false;
}

// À l'arrivée dans le jeu : le son tel que le joueur l'a laissé
export function appliquerLeSon(scene: Phaser.Scene, jeu: string) {
  couper(scene, !sonAllume(jeu));
}

export function basculerLeSon(scene: Phaser.Scene, jeu: string) {
  ecrire(jeu + "/son", !sonAllume(jeu));
  appliquerLeSon(scene, jeu);
}

// La touche M : couper le son, ou le remettre. « quandChange » : pour qu'un bouton affiché suive.
export function toucheDuSon(scene: Phaser.Scene, jeu: string, quandChange?: () => void) {
  surTouche(scene, "M", () => {
    basculerLeSon(scene, jeu);
    quandChange?.();
  });
}

export interface StyleDuBoutonDuSon {
  police?: string;
  couleur?: string;                        // couleur CSS du texte
}

// Le bouton du son, en haut à droite, avec la touche M qui fait pareil
export function boutonDuSon(scene: Phaser.Scene, jeu: string, style: StyleDuBoutonDuSon = {}): Phaser.GameObjects.Text {
  const bouton = scene.add.text(scene.scale.width - 20, 20, "", {
    fontFamily: style.police ?? POLICE, fontSize: "18px", color: style.couleur ?? "#a49cb4",
  }).setOrigin(1, 0).setPadding(8).setInteractive({ useHandCursor: true }).setDepth(1000);
  const montrer = () => bouton.setText(sonAllume(jeu) ? "🔊 Son (M)" : "🔇 Muet (M)");
  bouton.on("pointerup", () => {
    basculerLeSon(scene, jeu);
    montrer();
  });
  toucheDuSon(scene, jeu, montrer);
  montrer();
  return bouton;
}
