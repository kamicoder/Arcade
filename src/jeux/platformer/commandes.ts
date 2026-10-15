// Qui commande le héros : le clavier, la manette et les doigts, réunis en trois questions
// (gauche ? droite ? saut ?) à chaque image.
//   - seul : les flèches ou Q D Z, saut aussi sur Espace, la première manette, les doigts ;
//   - à deux : le joueur 1 a Q D Z et la première manette, le joueur 2 les flèches et la deuxième.
//
// Les touches sont reconnues à leur PLACE sur le clavier (event.code, voir socle/touchesPhysiques.ts),
// pas à la lettre écrite dessus : la main gauche se pose au même endroit en AZERTY comme en QWERTY.
// « KeyA », « KeyD », « KeyW », c'est Q, D, Z sur un AZERTY (A, D, W sur un QWERTY).

import Phaser from "phaser";
import type { Entrees } from "./Heros";
import { TouchesPhysiques, etiquette } from "../../socle/touchesPhysiques";

export type Joueur = "seul" | "j1" | "j2";

type Touches = Record<"gauche" | "droite" | "saut", string[]>;

const LETTRES: Touches = { gauche: ["KeyA"], droite: ["KeyD"], saut: ["KeyW"] };
const FLECHES: Touches = { gauche: ["ArrowLeft"], droite: ["ArrowRight"], saut: ["ArrowUp"] };

export const TOUCHES: Record<Joueur, Touches> = {
  j1: LETTRES,
  j2: FLECHES,
  seul: {
    gauche: [...LETTRES.gauche, ...FLECHES.gauche],
    droite: [...LETTRES.droite, ...FLECHES.droite],
    saut: [...LETTRES.saut, ...FLECHES.saut, "Space"],
  },
};

// Les touches du joueur 1, comme elles sont écrites sur ce clavier : « Q D Z » sur un AZERTY
export function lettresDuJoueur1(): string {
  return [LETTRES.gauche[0], LETTRES.droite[0], LETTRES.saut[0]].map(etiquette).join(" ");
}

export class Commandes {
  // Les doigts sur les commandes : le tableau de bord les met à jour
  readonly tactile: Entrees = { gauche: false, droite: false, saut: false };
  private readonly touches: Touches;
  private readonly tenues: TouchesPhysiques;
  private appuiEnAttente = false;

  constructor(private scene: Phaser.Scene, private joueur: Joueur) {
    this.touches = TOUCHES[joueur];
    this.tenues = new TouchesPhysiques(scene);
    // Les flèches et Espace sont pour le jeu : le navigateur ne fait pas défiler la page avec
    scene.input.keyboard!.addCapture("UP,DOWN,LEFT,RIGHT,SPACE");
    // Une frappe plus courte qu'une image (enfoncée et relâchée entre deux update) n'est jamais vue
    // tenue. L'événement d'appui, lui, arrive toujours : on s'en souvient jusqu'à la lecture suivante.
    scene.input.keyboard!.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, (evenement: KeyboardEvent) => {
      if (this.touches.saut.includes(evenement.code) && !evenement.repeat) {
        this.appuiEnAttente = true;
      }
    });
  }

  // La manette de ce joueur (celle qui vibre quand il est touché), s'il en a une
  get manette(): Phaser.Input.Gamepad.Gamepad | null {
    return (this.joueur === "j2" ? this.scene.input.gamepad?.pad2 : this.scene.input.gamepad?.pad1) ?? null;
  }

  lire(): Entrees {
    const tenue = (codes: string[]) => codes.some((code) => this.tenues.tenue(code));
    const e: Entrees = {
      gauche: tenue(this.touches.gauche),
      droite: tenue(this.touches.droite),
      saut: tenue(this.touches.saut),
      appui: this.appuiEnAttente,
    };
    this.appuiEnAttente = false;
    // La manette : la croix ou le stick gauche pour courir, A (ou B) pour sauter
    const manette = this.manette;
    if (manette) {
      e.gauche ||= manette.left || manette.leftStick.x < -0.4;
      e.droite ||= manette.right || manette.leftStick.x > 0.4;
      e.saut ||= manette.A || manette.B || manette.up;
    }
    e.gauche ||= this.tactile.gauche;
    e.droite ||= this.tactile.droite;
    e.saut ||= this.tactile.saut;
    return e;
  }
}
