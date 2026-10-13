// Le point de départ : on crée LE jeu Phaser, un seul pour toute l'Arcade.
// Chaque mini jeu n'est qu'un groupe de scènes qu'on y ajoute quand on le lance (voir Hub.ts).

import Phaser from "phaser";
import { Demarrage } from "./scenes/Demarrage";
import { Hub } from "./scenes/Hub";
import { LARGEUR, HAUTEUR, COULEURS } from "./socle/style";
import { demarrerMiseAJour } from "./socle/miseAJour";
import { corrigerLesSegmentsNuls } from "./socle/correctifs";

const jeu = new Phaser.Game({
  type: Phaser.AUTO,                       // WebGL si possible, sinon canvas 2D
  parent: "jeu",                           // la <div id="jeu"> de index.html
  width: LARGEUR,                          // la taille « logique » : tout le jeu se dessine dans 960 × 540...
  height: HAUTEUR,
  backgroundColor: COULEURS.fond,
  scale: {
    mode: Phaser.Scale.FIT,                // ... puis Phaser agrandit l'image pour remplir l'écran sans la déformer
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3,                     // jusqu'à 3 doigts en même temps (tourner + nitro, par exemple)
    gamepad: true,                         // les manettes
  },
  // Les scènes connues dès le départ ; la première de la liste démarre toute seule
  scene: [Demarrage, Hub],
});

// Le moteur de rendu n'existe qu'une fois le jeu prêt, avant sa première image
jeu.events.once(Phaser.Core.Events.READY, () => corrigerLesSegmentsNuls(jeu));

demarrerMiseAJour();

// En développement, le jeu est visible depuis la console du navigateur (F12) : essaie jeu.scene.getScenes(true)
if (import.meta.env.DEV) {
  (window as unknown as { jeu: Phaser.Game }).jeu = jeu;
}
