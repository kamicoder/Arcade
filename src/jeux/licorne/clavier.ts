// Réagir à toutes les touches, une seule fois par appui : le cousin de surTouche (socle/clavier.ts) pour
// quand on a besoin de l'événement du navigateur lui-même. Son code physique (e.code : KeyW est le Z d'un
// clavier français), pour ZQSD ; sa lettre (e.key), pour taper le nom d'une licorne.
// Même défaut de Phaser 4.2 que pour surTouche : un appui peut arriver deux fois, on s'en souvient.

import type Phaser from "phaser";

export function surChaqueTouche(scene: Phaser.Scene, action: (evenement: KeyboardEvent) => void) {
  const dejaVus = new WeakSet<KeyboardEvent>();
  scene.input.keyboard!.on("keydown", (evenement: KeyboardEvent) => {
    if (dejaVus.has(evenement)) {
      return;
    }
    dejaVus.add(evenement);
    action(evenement);
  });
}
