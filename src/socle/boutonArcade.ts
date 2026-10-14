// Les boutons que tous les jeux partagent. « ← Arcade », dans le menu de chaque jeu : un vrai bouton,
// avec un fond, que le doigt touche partout (le texte seul était trop petit sur un téléphone). Plus grand
// au doigt qu'à la souris. Et le ✕ qui ferme.

import Phaser from "phaser";
import { POLICE } from "./style";
import { estTactile } from "./tactile";
import { retourAuHub } from "./retour";

export interface StyleDuBoutonArcade {
  police?: string;
  texte?: string;                          // couleur CSS du texte
  fond?: number;                           // couleur du fond (0xRRVVBB)
  fondAlpha?: number;
}

// En haut à gauche de l'écran. action : ce que fait le bouton (par défaut, revenir au Hub ; un jeu qui
// doit d'abord ranger quelque chose, sa musique par exemple, passe la sienne).
export function boutonArcade(
  scene: Phaser.Scene,
  action: () => void = () => retourAuHub(scene),
  style: StyleDuBoutonArcade = {},
): Phaser.GameObjects.Container {
  const auDoigt = estTactile();
  // Au doigt, 64 pixels de jeu font environ 46 pixels d'écran sur un téléphone en paysage :
  // la taille conseillée pour une cible au doigt
  const hauteur = auDoigt ? 64 : 44;
  const fondAlpha = style.fondAlpha ?? 0.35;
  const fondCouleur = style.fond ?? 0x000000;

  const texte = scene.add.text(0, 0, "← Arcade", {
    fontFamily: style.police ?? POLICE,
    fontSize: (auDoigt ? 24 : 18) + "px",
    fontStyle: "bold",
    color: style.texte ?? "#ffffff",
  }).setOrigin(0.5);
  const largeur = Math.ceil(texte.width) + (auDoigt ? 44 : 30);
  const fond = scene.add.rectangle(0, 0, largeur, hauteur, fondCouleur, fondAlpha)
    .setRounded(hauteur / 2)
    .setStrokeStyle(2, 0xffffff, 0.35);
  const bouton = scene.add.container(12 + largeur / 2, 12 + hauteur / 2, [fond, texte]).setDepth(1000);

  // Tout le fond répond, texte compris : il est dessous
  fond.setInteractive({ useHandCursor: true });
  fond.on("pointerover", () => fond.setFillStyle(fondCouleur, Math.min(1, fondAlpha + 0.2)));
  fond.on("pointerout", () => {
    fond.setFillStyle(fondCouleur, fondAlpha);
    bouton.setScale(1);
  });
  fond.on("pointerdown", () => scene.tweens.add({ targets: bouton, scale: 0.94, duration: 80 }));
  fond.on("pointerup", () => {
    bouton.setScale(1);
    action();
  });
  return bouton;
}

// Le ✕ qui ferme ou quitte (le tableau de bord d'une partie, un panneau) : un grand padding, pour le doigt
export function boutonFermer(
  scene: Phaser.Scene, x: number, y: number, action: () => void,
  style: { police?: string; couleur?: string; taille?: number } = {},
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, "✕", {
    fontFamily: style.police ?? POLICE, fontSize: (style.taille ?? 26) + "px", color: style.couleur ?? "#ffffff",
  }).setOrigin(0.5).setPadding(10).setInteractive({ useHandCursor: true }).on("pointerup", action);
}
