// Qui pilote la raquette : la souris, le clavier, la manette et le doigt. La raquette ne va que de gauche à
// droite ; il n'y a qu'un geste de plus, lancer la balle qui attend sur la raquette.
//   - la souris : la raquette suit le curseur, sans cliquer ; un clic lance ;
//   - le clavier : les flèches, ou Q D reconnues à leur PLACE (KeyA, KeyD : voir socle/touchesPhysiques.ts) ;
//     Espace ou ↑ lance (la scène les écoute avec surTouche) ;
//   - la manette : la croix ou le stick gauche ; A lance ;
//   - le doigt : posé n'importe où, il fait glisser la raquette (elle suit le mouvement du doigt, pas sa
//     place : le doigt ne cache jamais la balle) ; une tape, sans glisser, lance.
// La souris et le clavier se passent la main, comme au tir spatial.

import Phaser from "phaser";
import { TouchesPhysiques } from "../../socle/touchesPhysiques";

export interface Pilotage {
  dx: number;                              // de -1 (gauche) à 1 (droite)
  cible: number | null;                    // à la souris ou au doigt : où la raquette doit aller
}

const TOUCHES = {
  gauche: ["ArrowLeft", "KeyA"],
  droite: ["ArrowRight", "KeyD"],
};
const TAPE = { duree: 300, distance: 14 };   // un doigt posé et levé vite, sans bouger : une tape

export class Commandes {
  private readonly tenues: TouchesPhysiques;
  private doigt: Phaser.Input.Pointer | null = null;
  private souris: number | null = null;    // là où est le curseur, tant que la souris pilote
  private depart = { doigt: 0, raquette: 0 };

  // ouEstLaRaquette : sa place quand un doigt se pose ; lancer : une tape ou un clic
  constructor(private scene: Phaser.Scene, private ouEstLaRaquette: () => number, lancer: () => void) {
    this.tenues = new TouchesPhysiques(scene);
    // Les flèches sont pour le jeu : le navigateur ne fait pas défiler la page avec
    scene.input.keyboard!.addCapture("UP,LEFT,RIGHT,SPACE");
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (pointeur: Phaser.Input.Pointer, dessus: Phaser.GameObjects.GameObject[]) => {
      if (dessus.length > 0) {
        return;                            // un bouton (le ✕ du tableau de bord)
      }
      if (!pointeur.wasTouch) {
        lancer();
        return;
      }
      if (!this.doigt) {
        this.doigt = pointeur;
        this.depart.doigt = pointeur.x;
        this.depart.raquette = this.ouEstLaRaquette();
      }
    });
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (pointeur: Phaser.Input.Pointer) => {
      if (!pointeur.wasTouch) {
        this.souris = pointeur.worldX;
      }
    });
    scene.input.on(Phaser.Input.Events.POINTER_UP, (pointeur: Phaser.Input.Pointer) => {
      if (pointeur !== this.doigt) {
        return;
      }
      this.doigt = null;
      const glisse = Phaser.Math.Distance.Between(pointeur.downX, pointeur.downY, pointeur.upX, pointeur.upY);
      if (pointeur.upTime - pointeur.downTime < TAPE.duree && glisse < TAPE.distance) {
        lancer();
      }
    });
  }

  // Après une pause : le doigt levé pendant la pause n'a pas été entendu
  toutLacher() {
    this.doigt = null;
  }

  lire(): Pilotage {
    const tenue = (codes: string[]) => codes.some((code) => this.tenues.tenue(code));
    let dx = (tenue(TOUCHES.droite) ? 1 : 0) - (tenue(TOUCHES.gauche) ? 1 : 0);
    const manette = this.scene.input.gamepad?.pad1;
    if (manette && dx === 0) {
      const stick = manette.leftStick.x;
      dx = manette.left ? -1 : manette.right ? 1 : Math.abs(stick) > 0.2 ? stick : 0;
    }
    if (dx !== 0) {
      this.souris = null;                  // le clavier ou la manette reprend la main
    }
    let cible = this.souris;
    if (this.doigt?.isDown) {
      cible = this.depart.raquette + (this.doigt.x - this.depart.doigt);
    }
    return { dx, cible };
  }
}
