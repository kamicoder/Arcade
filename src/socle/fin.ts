// La fin d'une partie : ce qui se ressemble d'un jeu à l'autre.
//
// uneSeuleFois : une garde contre un double départ. Entrée, un clic et la manette peuvent arriver presque
// ensemble ; seule la première action compte (rejouer OU revenir, jamais les deux).
//
// ecranDeFin : l'écran « GAME OVER » du tir et du platformer. Un voile sur la partie (en pause derrière),
// des lignes qui montent l'une après l'autre, « Nouveau record ! » qui bat, et deux boutons, Rejouer et
// Le menu. On n'écoute qu'après un petit moment : le joueur tenait peut-être encore une touche, ou avait
// le doigt sur l'écran. Les autres jeux ont leur propre fin (le podium de la course, les trois choix de
// la baston, la carte du démineur) : leurs différences sont voulues.

import type Phaser from "phaser";
import { POLICE } from "./style";
import { surTouche } from "./clavier";
import { surManette, MANETTE, VALIDER } from "./manette";

export function uneSeuleFois() {
  let fait = false;
  return (action: () => void) => () => {
    if (!fait) {
      fait = true;
      action();
    }
  };
}

export interface LigneDeFin {
  y: number;
  texte: string;
  taille: number;
  couleur: string;                         // couleur CSS
}

export interface EcranDeFin {
  lignes: LigneDeFin[];
  nouveauRecord?: boolean;                 // « Nouveau record ! », sous les lignes
  rejouer: () => void;
  quitter: () => void;
  ailleurs?: string;                       // le nom du second bouton : « Le menu », « L'éditeur »...
  fond: number;                            // la couleur des boutons...
  bord: number;                            // ... et de leur contour
  delai?: number;                          // avant d'écouter (ms)
}

export function ecranDeFin(scene: Phaser.Scene, options: EcranDeFin) {
  const largeur = scene.scale.width;
  const texte = (y: number, contenu: string, taille: number, couleur: string) =>
    scene.add.text(largeur / 2, y, contenu, {
      fontFamily: POLICE, fontSize: taille + "px", fontStyle: "bold", color: couleur, stroke: "#14121c", strokeThickness: 6,
    }).setOrigin(0.5);

  scene.add.rectangle(0, 0, largeur, scene.scale.height, 0x000000, 0.55).setOrigin(0);
  const lignes = options.lignes.map((l) => texte(l.y, l.texte, l.taille, l.couleur));
  if (options.nouveauRecord) {
    const record = texte(330, "Nouveau record !", 26, "#ffd479");
    scene.tweens.add({ targets: record, scale: 1.15, duration: 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    lignes.push(record);
  }
  // Les lignes arrivent d'en dessous, l'une après l'autre (stagger : le décalage de Phaser)
  for (const ligne of lignes) {
    ligne.setAlpha(0).y += 30;
  }
  scene.tweens.add({ targets: lignes, alpha: 1, y: "-=30", duration: 350, delay: scene.tweens.stagger(120, {}), ease: "Cubic.Out" });

  const bouton = (x: number, nom: string, touches: string, action: () => void) => {
    const fond = scene.add.rectangle(x, 430, 260, 64, options.fond).setRounded(14).setStrokeStyle(3, options.bord)
      .setInteractive({ useHandCursor: true });
    scene.add.text(x, 420, nom, { fontFamily: POLICE, fontSize: "24px", fontStyle: "bold" }).setOrigin(0.5);
    scene.add.text(x, 446, touches, { fontFamily: POLICE, fontSize: "14px", color: "#a49cb4" }).setOrigin(0.5);
    fond.on("pointerup", action);
  };

  const une = uneSeuleFois();
  const rejouer = une(options.rejouer);
  const quitter = une(options.quitter);
  scene.time.delayedCall(options.delai ?? 600, () => {
    bouton(largeur / 2 - 150, "Rejouer", "Entrée, R ou A", rejouer);
    bouton(largeur / 2 + 150, options.ailleurs ?? "Le menu", "Échap ou B", quitter);
    surTouche(scene, "ENTER", rejouer);
    surTouche(scene, "R", rejouer);
    surTouche(scene, "ESC", quitter);
    surManette(scene, VALIDER, rejouer);
    surManette(scene, MANETTE.B, quitter);
  });
}
