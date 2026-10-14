// Les transitions entre scènes.

import Phaser from "phaser";
import { retablir } from "./largeur";
import { couper } from "./son";

// Un fondu au noir, puis l'action. Attention : camera.fadeOut() ne fait rien si un autre fondu
// est en cours (le fondu d'entrée de la scène, par exemple). camera.fade(..., true) force le départ.
export function fonduPuis(scene: Phaser.Scene, action: () => void) {
  const camera = scene.cameras.main;
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, action);
  camera.fade(200, 0, 0, 0, true);
}

// Revenir au Hub depuis n'importe quel jeu : un fondu, puis on arrête toutes les scènes du jeu
// (il peut y en avoir plusieurs à la fois, comme une course et son tableau de bord par-dessus).
// Un jeu a pu élargir l'écran (socle/largeur.ts) : le Hub et les autres jeux retrouvent leurs 960 × 540.
// Un jeu a pu couper le son (socle/son.ts) : l'Arcade le retrouve.
export function retourAuHub(scene: Phaser.Scene) {
  const fondu = scene.cameras.main.fadeEffect;
  if (fondu.isRunning && fondu.direction) {
    return;                                // déjà en route (un double clic, par exemple)
  }
  fonduPuis(scene, () => {
    for (const autre of scene.scene.manager.getScenes(true)) {
      if (autre !== scene) {
        autre.scene.stop();
      }
    }
    retablir(scene.game);
    couper(scene, false);
    scene.scene.start("Hub");
  });
}
