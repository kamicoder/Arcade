// Les touches tenues, d'après leur PLACE sur le clavier et non d'après la lettre écrite dessus.
//
// Phaser reconnaît une touche à son keyCode, qui dépend de la disposition du clavier : sur un clavier
// AZERTY, la touche à gauche de E donne « Z » (keyCode 90), sur un QWERTY elle donne « W » (87).
// Pour deux joueurs sur le même clavier, c'est la place qui compte : la main gauche se pose au même
// endroit quelle que soit la disposition. Le navigateur donne cette place dans event.code, nommée
// d'après un clavier QWERTY : « KeyW » est la touche Z d'un AZERTY. On passe par les événements
// du clavier de Phaser (ils transportent l'événement du navigateur), pas par le navigateur directement :
// la scène qui s'arrête emporte ses écouteurs, et Phaser empêche déjà les doublons.

import Phaser from "phaser";

export class TouchesPhysiques {
  private readonly tenues = new Set<string>();

  constructor(scene: Phaser.Scene) {
    const clavier = scene.input.keyboard!;
    clavier.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, (evenement: KeyboardEvent) => this.tenues.add(evenement.code));
    clavier.on(Phaser.Input.Keyboard.Events.ANY_KEY_UP, (evenement: KeyboardEvent) => this.tenues.delete(evenement.code));

    // La fenêtre perd la main (une autre appli, un appel) : on ne saura jamais quelles touches ont
    // été lâchées pendant ce temps, alors on les lâche toutes. Le jeu n'appartient pas à la scène :
    // cet écouteur-là, on le retire nous-mêmes quand elle s'arrête.
    const toutLacher = () => this.tenues.clear();
    scene.game.events.on(Phaser.Core.Events.BLUR, toutLacher);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.game.events.off(Phaser.Core.Events.BLUR, toutLacher));
  }

  // code : la place de la touche, comme event.code (« ArrowUp », « KeyW », « ShiftRight », « Space »...)
  tenue(code: string): boolean {
    return this.tenues.has(code);
  }
}
