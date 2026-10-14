// L'écran de chargement d'un jeu : une barre qui se remplit pendant que Phaser charge ses sons et ses
// images (à appeler dans preload). On en profite pour demander la disposition du clavier : chaque jeu
// peut alors écrire sur ses aides les vraies lettres des touches (« Z Q S D » sur un AZERTY, « W A S D »
// sur un QWERTY : socle/touchesPhysiques.ts).

import type Phaser from "phaser";
import { chargerLaDisposition } from "./touchesPhysiques";

export function barreDeChargement(scene: Phaser.Scene, couleur: number) {
  chargerLaDisposition();
  const largeur = 300;
  const barre = scene.add.rectangle(scene.scale.width / 2 - largeur / 2, scene.scale.height / 2, 0, 12, couleur).setOrigin(0, 0.5);
  // Le chargeur prévient à chaque progrès, de 0 à 1
  scene.load.on("progress", (avancement: number) => {
    barre.width = largeur * avancement;
  });
}
