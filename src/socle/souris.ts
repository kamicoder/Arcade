// La souris capturée, pour les jeux où un objet suit le curseur (la raquette du casse-briques, le vaisseau du
// tir) : sans elle, le curseur sort du jeu (dans les bandes noires, sur un autre écran) et l'objet ne le suit
// plus.
//
// Phaser sait demander au navigateur de « prendre » la souris (input.mouse.requestPointerLock, la Pointer Lock
// API) : le curseur disparaît, ne peut plus sortir, et chaque mouvement arrive en déplacement (movementX/Y).
// Le navigateur ne l'accorde que juste après un geste du joueur (un clic, une touche), et la rend sur Échap (il
// l'impose) : le jeu se met alors en pause (quandRendue). On la demande au début de la partie (le clic sur
// « Jouer » ou la touche Entrée qui l'a lancée compte encore : au tir, on ne clique jamais en jouant), au
// retour de la pause, et à chaque clic dans la partie. Un refus (pas de geste récent) ne fait rien.
//
// L'objet suit un curseur imaginaire (ici()), en pixels du jeu : capturée, la souris le déplace ; libre (pas
// de capture possible, ou pas encore de clic), il suit le vrai curseur, comme avant.

import Phaser from "phaser";
import { estTactile } from "./tactile";

export class SourisCapturee {
  private curseur: Phaser.Math.Vector2 | null = null;   // null : la souris ne pilote pas (clavier, doigt)

  // depart : où mettre le curseur imaginaire quand la souris prend la main (la place de l'objet) ;
  // quandRendue : la souris rendue pendant la partie (Échap, ou le jeu qui perd la main) ;
  // bornes : où le curseur imaginaire peut aller, en coordonnées du monde (tout le jeu, par défaut)
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depart: () => Phaser.Math.Vector2,
    quandRendue: () => void,
    bornes?: Phaser.Geom.Rectangle,
  ) {
    const manager = scene.input.manager;
    const souris = scene.input.mouse;
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (pointeur: Phaser.Input.Pointer) => {
      if (!pointeur.wasTouch) {
        this.demander();
      }
    });
    this.demander();
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, (pointeur: Phaser.Input.Pointer) => {
      if (pointeur.wasTouch) {
        return;
      }
      if (souris?.locked) {
        // Le déplacement arrive en pixels de l'écran : displayScale les change en pixels du jeu
        const echelle = scene.scale.displayScale;
        this.curseur ??= this.depart().clone();
        const b = bornes ?? new Phaser.Geom.Rectangle(0, 0, scene.scale.width, scene.scale.height);
        this.curseur.x = Phaser.Math.Clamp(this.curseur.x + pointeur.movementX * echelle.x, b.left, b.right);
        this.curseur.y = Phaser.Math.Clamp(this.curseur.y + pointeur.movementY * echelle.y, b.top, b.bottom);
      } else {
        this.curseur = new Phaser.Math.Vector2(pointeur.worldX, pointeur.worldY);
      }
    });
    // L'événement vient du jeu entier, pas de la scène : on retire l'écouteur nous-mêmes
    const changement = (_evenement: Event, capturee: boolean) => {
      if (!capturee && this.peutCapturer) {
        quandRendue();
      }
    };
    manager.events.on(Phaser.Input.Events.POINTERLOCK_CHANGE, changement);
    // La partie en pause (la pause a ses boutons, il faut le vrai curseur) : la souris est rendue. Elle l'est
    // pendant que la scène est en pause : la pause, déjà ouverte, ne s'ouvre pas une seconde fois.
    const enPause = () => {
      if (souris?.locked) {
        souris.releasePointerLock();
      }
    };
    scene.events.on(Phaser.Scenes.Events.PAUSE, enPause);
    // Le retour de la pause (un clic sur « Reprendre », une touche) : on la reprend
    const auRetour = () => this.demander();
    scene.events.on(Phaser.Scenes.Events.RESUME, auRetour);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      manager.events.off(Phaser.Input.Events.POINTERLOCK_CHANGE, changement);
      scene.events.off(Phaser.Scenes.Events.PAUSE, enPause);
      scene.events.off(Phaser.Scenes.Events.RESUME, auRetour);
      this.rendre();
    });
  }

  // Faux à la fin de la partie : la fin a ses boutons, il faut le vrai curseur
  peutCapturer = true;

  // Demander la souris au navigateur, si on peut. Pas au doigt (il n'y a pas de curseur). On passe par le
  // canvas plutôt que par input.mouse.requestPointerLock : le navigateur répond par une promesse, qu'un refus
  // (pas de geste récent) rejette, et Phaser la laisse sans réponse (une erreur dans la console).
  private demander() {
    const souris = this.scene.input.mouse;
    if (!souris || souris.locked || !this.peutCapturer || estTactile()) {
      return;
    }
    const canvas = this.scene.game.canvas as HTMLCanvasElement & { requestPointerLock?: () => Promise<void> | void };
    try {
      const reponse = canvas.requestPointerLock?.();
      if (reponse instanceof Promise) {
        reponse.catch(() => {
          // refusée : le prochain clic la redemandera
        });
      }
    } catch {
      // ce navigateur ne sait pas faire : la souris reste libre, comme avant
    }
  }

  // Où la souris veut l'objet, ou null si elle ne pilote pas
  ici(): Phaser.Math.Vector2 | null {
    return this.curseur;
  }

  // Le clavier ou la manette reprend la main : l'objet ne suit plus la souris jusqu'à son prochain mouvement
  oublier() {
    this.curseur = null;
  }

  // Rendre la souris (la fin de la partie, le départ) : sans pause
  rendre() {
    this.peutCapturer = false;
    if (this.scene.input.mouse?.locked) {
      this.scene.input.mouse.releasePointerLock();
    }
  }
}
