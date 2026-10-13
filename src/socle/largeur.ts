// Un jeu plus large que 960 × 540, pour remplir un téléphone allongé.
//
// L'Arcade se dessine en 960 × 540 (16/9), et le mode FIT l'agrandit sans la déformer : sur un téléphone
// en 20/9, il reste deux bandes noires sur les côtés. Un jeu qui le veut (la baston, au doigt) peut
// élargir le jeu à la proportion de l'écran : la hauteur reste 540, seule la largeur grandit, et ses
// scènes se placent d'après this.scale.width au lieu de LARGEUR. Les caméras des scènes suivent
// toutes seules (Phaser agrandit celles qui avaient la taille du jeu).
// retourAuHub (socle/retour.ts) rend au Hub et aux autres jeux leurs 960 × 540.

import Phaser from "phaser";
import { LARGEUR, HAUTEUR } from "./style";
import { estTactile } from "./tactile";

const RAPPORT_MAX = 2.4;                   // au-delà (un écran très étiré), on garde des bandes noires
const TOLERANCE = 40;                      // la barre d'adresse qui se montre ou se cache ne change rien

// La largeur qui remplit l'écran, au doigt seulement : au moins 960 (16/9)
export function largeurVoulue(scene: Phaser.Scene): number {
  const ecran = scene.scale.parentSize;
  if (!estTactile() || !ecran.width || !ecran.height) {
    return LARGEUR;
  }
  const rapport = Phaser.Math.Clamp(ecran.width / ecran.height, LARGEUR / HAUTEUR, RAPPORT_MAX);
  return Math.round(HAUTEUR * rapport);
}

// À appeler au début du create() d'une scène, avant de rien dessiner
export function elargir(scene: Phaser.Scene) {
  const largeur = largeurVoulue(scene);
  if (scene.scale.width !== largeur) {
    scene.scale.setGameSize(largeur, HAUTEUR);
  }
}

// Le jeu reprend sa taille de toujours
export function retablir(jeu: Phaser.Game) {
  if (jeu.scale.width !== LARGEUR || jeu.scale.height !== HAUTEUR) {
    jeu.scale.setGameSize(LARGEUR, HAUTEUR);
  }
}

// Pour un menu : si l'écran change de forme (on tourne le téléphone, on passe en plein écran), la
// scène recommence à la nouvelle largeur. Pas pour une scène de jeu : on ne coupe pas une manche,
// elle prendra la nouvelle largeur à son prochain départ.
export function suivreLaLargeur(scene: Phaser.Scene) {
  let relancee = false;
  const verifier = (taille: Phaser.Structs.Size, _base: Phaser.Structs.Size, _ecran: Phaser.Structs.Size, largeurAvant: number) => {
    // La taille du jeu vient de changer : c'est voulu (retablir, en partant au Hub), pas l'écran qui a tourné
    if (taille.width !== largeurAvant) {
      return;
    }
    if (!relancee && Math.abs(largeurVoulue(scene) - scene.scale.width) > TOLERANCE) {
      relancee = true;
      scene.scene.restart(scene.sys.settings.data);
    }
  };
  // Le ScaleManager appartient au jeu, pas à la scène : on retire l'écouteur nous-mêmes
  scene.scale.on(Phaser.Scale.Events.RESIZE, verifier);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, verifier));
}
