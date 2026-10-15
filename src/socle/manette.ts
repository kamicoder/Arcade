// La manette : le pendant de surTouche (clavier.ts) pour les boutons d'une manette « standard ».
//
// La règle de l'Arcade, pour qu'on s'y retrouve d'un jeu à l'autre : dans les menus, les listes et les
// fins de partie, A ou Start valide (VALIDER), B revient. En pleine partie, chaque jeu décide ; d'habitude,
// Start met en pause (la course, et socle/pause.ts pour le tir, le platformer, le démineur). La croix se lit ici quand on choisit dans un menu ; un
// jeu qui la tient (courir, piloter) lit la manette à chaque image, comme le clavier.

import type Phaser from "phaser";

// Les numéros des boutons d'une manette « standard » (la disposition d'une manette Xbox)
export const MANETTE = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, SELECT: 8, START: 9, HAUT: 12, BAS: 13, GAUCHE: 14, DROITE: 15,
} as const;

export const VALIDER = [MANETTE.A, MANETTE.START];

// L'action quand on presse l'un de ces boutons, sur n'importe quelle manette (elle la reçoit : les jeux
// à deux savent ainsi qui a appuyé). La scène qui s'arrête emporte l'écoute avec elle.
export function surManette(
  scene: Phaser.Scene,
  boutons: number | readonly number[],
  action: (manette: Phaser.Input.Gamepad.Gamepad) => void,
) {
  const liste: readonly number[] = typeof boutons === "number" ? [boutons] : boutons;
  scene.input.gamepad?.on("down", (manette: Phaser.Input.Gamepad.Gamepad, bouton: Phaser.Input.Gamepad.Button) => {
    if (liste.includes(bouton.index)) {
      action(manette);
    }
  });
}
