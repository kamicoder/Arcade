// Qui commande le héros : le clavier, la manette et les doigts, réunis en trois questions
// (gauche ? droite ? saut ?) à chaque image.
//   - seul : les flèches ou Q/D (A/D en qwerty), saut Espace, Haut ou Z (W), la première manette, les doigts ;
//   - à deux : le joueur 1 a Q/D/Z et la première manette, le joueur 2 les flèches et la deuxième.

import Phaser from "phaser";
import type { Entrees } from "./Heros";

export type Joueur = "seul" | "j1" | "j2";

type Touches = Record<"gauche" | "droite" | "saut", Phaser.Input.Keyboard.Key[]>;

export class Commandes {
  // Les doigts sur les commandes : le tableau de bord les met à jour
  readonly tactile: Entrees = { gauche: false, droite: false, saut: false };
  private touches: Touches;

  constructor(private scene: Phaser.Scene, private joueur: Joueur) {
    const clavier = scene.input.keyboard!;
    const k = (...noms: string[]) => noms.map((nom) => clavier.addKey(nom));
    const lettres: Touches = { gauche: k("Q", "A"), droite: k("D"), saut: k("Z", "W") };
    const fleches: Touches = { gauche: k("LEFT"), droite: k("RIGHT"), saut: k("UP") };
    if (joueur === "j1") {
      this.touches = lettres;
    } else if (joueur === "j2") {
      this.touches = fleches;
    } else {
      this.touches = {
        gauche: [...lettres.gauche, ...fleches.gauche],
        droite: [...lettres.droite, ...fleches.droite],
        saut: [...lettres.saut, ...fleches.saut, ...k("SPACE")],
      };
    }
    // Une frappe plus courte qu'une image (enfoncée et relâchée entre deux update) : isDown ne la voit
    // jamais, et Phaser oublie son JustDown au relâchement. L'événement d'appui, lui, arrive toujours.
    const codes = this.touches.saut.map((touche) => touche.keyCode);
    clavier.on("keydown", (evenement: KeyboardEvent) => {
      if (codes.includes(evenement.keyCode) && !evenement.repeat) {
        this.appuiEnAttente = true;
      }
    });
  }

  private appuiEnAttente = false;

  lire(): Entrees {
    const tenue = (touches: Phaser.Input.Keyboard.Key[]) => touches.some((touche) => touche.isDown);
    const e: Entrees = {
      gauche: tenue(this.touches.gauche),
      droite: tenue(this.touches.droite),
      saut: tenue(this.touches.saut),
      appui: this.appuiEnAttente,
    };
    this.appuiEnAttente = false;
    // La manette : la croix ou le stick gauche pour courir, A (ou B) pour sauter
    const manette = this.joueur === "j2" ? this.scene.input.gamepad?.pad2 : this.scene.input.gamepad?.pad1;
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
