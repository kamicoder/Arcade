// Qui pilote le vaisseau : la souris, le clavier, la manette et le doigt. On ne tire jamais à la main (le vaisseau
// tire tout seul) : il n'y a qu'à se déplacer.
//   - la souris : le vaisseau suit le curseur, sans cliquer ; un clic capture la souris (socle/souris.ts :
//     elle ne peut plus sortir du jeu et perdre le vaisseau, Échap la rend et met en pause) ;
//   - le clavier : les flèches, ou Z Q S D reconnues à leur PLACE (KeyW, KeyA, KeyS, KeyD : voir
//     socle/touchesPhysiques.ts) ;
//   - la manette : la croix ou le stick gauche ;
//   - le doigt : posé n'importe où, il fait glisser le vaisseau comme une souris (le vaisseau suit le
//     mouvement du doigt, pas sa place : le doigt ne cache jamais le vaisseau).
// La souris et le clavier se passent la main : une touche reprend le vaisseau, jusqu'à ce que la souris
// bouge de nouveau.

import Phaser from "phaser";
import { TouchesPhysiques } from "../../socle/touchesPhysiques";
import { SourisCapturee } from "../../socle/souris";
import { LARGEUR, HAUTEUR } from "../../socle/style";

export interface Pilotage {
  dx: number;                              // de -1 (gauche) à 1 (droite)
  dy: number;                              // de -1 (haut) à 1 (bas)
  cible: Phaser.Math.Vector2 | null;       // à la souris ou au doigt : là où le vaisseau doit aller
}

const TOUCHES = {
  gauche: ["ArrowLeft", "KeyA"],
  droite: ["ArrowRight", "KeyD"],
  haut: ["ArrowUp", "KeyW"],
  bas: ["ArrowDown", "KeyS"],
};

export class Commandes {
  private readonly tenues: TouchesPhysiques;
  private doigt: Phaser.Input.Pointer | null = null;
  private readonly souris: SourisCapturee;
  private depart = { doigt: new Phaser.Math.Vector2(), vaisseau: new Phaser.Math.Vector2() };

  // ouLeVaisseau : la place du vaisseau quand un doigt se pose
  // sourisRendue : la souris capturée rendue en pleine partie (Échap) : la pause
  constructor(private scene: Phaser.Scene, private ouLeVaisseau: () => Phaser.Math.Vector2, sourisRendue: () => void) {
    this.tenues = new TouchesPhysiques(scene);
    // Un clic capture la souris (socle/souris.ts) : elle ne peut plus sortir du jeu et perdre le vaisseau.
    // Le curseur imaginaire reste dans l'aire de jeu, même quand le jeu est élargi.
    this.souris = new SourisCapturee(scene, () => this.ouLeVaisseau(), sourisRendue, new Phaser.Geom.Rectangle(0, 0, LARGEUR, HAUTEUR));
    // Les flèches sont pour le jeu : le navigateur ne fait pas défiler la page avec
    scene.input.keyboard!.addCapture("UP,DOWN,LEFT,RIGHT,SPACE");
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (doigt: Phaser.Input.Pointer, dessus: Phaser.GameObjects.GameObject[]) => {
      // La souris pilote sans cliquer ; un bouton (le ✕ du tableau de bord), ou un doigt qui pilote déjà
      if (!doigt.wasTouch || dessus.length > 0 || this.doigt) {
        return;
      }
      this.doigt = doigt;
      this.depart.doigt.set(doigt.x, doigt.y);
      this.depart.vaisseau.copy(this.ouLeVaisseau());
    });
    scene.input.on(Phaser.Input.Events.POINTER_UP, (doigt: Phaser.Input.Pointer) => {
      if (doigt === this.doigt) {
        this.doigt = null;
      }
    });
  }

  // La fin de la partie : la souris est rendue (la fin a ses boutons)
  rendreLaSouris() {
    this.souris.rendre();
  }

  lire(): Pilotage {
    const tenue = (codes: string[]) => codes.some((code) => this.tenues.tenue(code));
    let dx = (tenue(TOUCHES.droite) ? 1 : 0) - (tenue(TOUCHES.gauche) ? 1 : 0);
    let dy = (tenue(TOUCHES.bas) ? 1 : 0) - (tenue(TOUCHES.haut) ? 1 : 0);
    const manette = this.scene.input.gamepad?.pad1;
    if (manette && dx === 0 && dy === 0) {
      const stick = manette.leftStick;
      dx = manette.left ? -1 : manette.right ? 1 : Math.abs(stick.x) > 0.2 ? stick.x : 0;
      dy = manette.up ? -1 : manette.down ? 1 : Math.abs(stick.y) > 0.2 ? stick.y : 0;
    }
    // En diagonale, on ne va pas plus vite qu'en ligne droite
    const longueur = Math.hypot(dx, dy);
    if (longueur > 1) {
      dx /= longueur;
      dy /= longueur;
    }
    if (dx !== 0 || dy !== 0) {
      this.souris.oublier();               // le clavier ou la manette reprend la main
    }
    let cible = this.souris.ici();
    if (this.doigt?.isDown) {
      cible = new Phaser.Math.Vector2(
        this.depart.vaisseau.x + (this.doigt.x - this.depart.doigt.x),
        this.depart.vaisseau.y + (this.doigt.y - this.depart.doigt.y),
      );
    }
    return { dx, dy, cible };
  }
}
