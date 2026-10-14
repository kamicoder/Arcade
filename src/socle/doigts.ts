// Des boutons ronds qu'on tient au doigt (◀ ▶ pour courir, ▲ pour sauter, le turbo...), plusieurs à la
// fois, un par doigt. La classe ne retient que quel doigt tient quel bouton ; chaque jeu dessine ses
// ronds, les éclaire, et lit ce qui est tenu (quandChange).
//
// Un doigt se pose sur un bouton, ou y glisse en restant appuyé : il le tient. Il le lâche en se levant
// (même hors du jeu : pointerupoutside), ou en glissant hors du bouton. La zone sensible déborde du
// rond : un pouce, ça ne vise pas au pixel près.

import Phaser from "phaser";

export interface ReglagesDesDoigts<A extends string> {
  quandChange: (tenues: Set<A>) => void;
  // Un doigt vient de prendre ce bouton (« nouveau » : il ne le tenait pas déjà). Le turbo de la course
  // part à ce moment ; la baston retient même une tape plus courte qu'une image.
  quandPose?: (action: A, nouveau: boolean) => void;
  ignorer?: (doigt: Phaser.Input.Pointer) => boolean;   // un doigt qui ne prend jamais de bouton (le joystick)
}

export class BoutonsAuDoigt<A extends string> {
  private readonly doigts = new Map<number, A>();   // pour chaque doigt posé : le bouton qu'il tient

  constructor(scene: Phaser.Scene, private readonly reglages: ReglagesDesDoigts<A>) {
    const lever = (doigt: Phaser.Input.Pointer) => this.lacher(doigt);
    scene.input.on(Phaser.Input.Events.POINTER_UP, lever);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, lever);
  }

  // Un rond devient un bouton ; « sensible » : la zone qui répond, en rayons du rond
  ajouter(rond: Phaser.GameObjects.Arc, action: A, sensible = 1.35): this {
    const rayon = rond.radius;
    // La zone se compte depuis le coin haut gauche du rond
    rond.setInteractive(new Phaser.Geom.Circle(rayon, rayon, rayon * sensible), Phaser.Geom.Circle.Contains);
    rond.on("pointerdown", (doigt: Phaser.Input.Pointer) => this.tenir(doigt, action));
    rond.on("pointerover", (doigt: Phaser.Input.Pointer) => {
      if (doigt.isDown) {
        this.tenir(doigt, action);
      }
    });
    rond.on("pointerout", (doigt: Phaser.Input.Pointer) => this.lacher(doigt));
    return this;
  }

  tenues(): Set<A> {
    return new Set(this.doigts.values());
  }

  // Tout lâcher d'un coup (une manche qui finit, une pause)
  toutLacher() {
    this.doigts.clear();
    this.reglages.quandChange(this.tenues());
  }

  private tenir(doigt: Phaser.Input.Pointer, action: A) {
    if (this.reglages.ignorer?.(doigt)) {
      return;
    }
    const avant = this.doigts.get(doigt.id);
    this.doigts.set(doigt.id, action);
    this.reglages.quandPose?.(action, avant !== action);
    this.reglages.quandChange(this.tenues());
  }

  private lacher(doigt: Phaser.Input.Pointer) {
    if (this.doigts.delete(doigt.id)) {
      this.reglages.quandChange(this.tenues());
    }
  }
}
