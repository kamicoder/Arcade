// Réagir à une touche qu'on enfonce, une seule fois par appui.
//
// Phaser 4.2 a un défaut : il traite chaque touche dès qu'elle arrive, mais ne vide sa file qu'une fois
// par image. Si l'appui et le relâchement tombent dans la même image (une frappe très rapide, ou une
// image lente sur un téléphone), l'appui est traité deux fois : un menu sauterait deux lignes, un bouton
// serait lancé deux fois. Le même événement du navigateur revient alors deux fois : on s'en souvient.

import type Phaser from "phaser";

export function surTouche(scene: Phaser.Scene, touche: string, action: () => void) {
  const dejaVus = new WeakSet<KeyboardEvent>();
  scene.input.keyboard!.on("keydown-" + touche, (evenement: KeyboardEvent) => {
    if (dejaVus.has(evenement)) {
      return;
    }
    dejaVus.add(evenement);
    action();
  });
}
