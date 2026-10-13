// Les commandes d'un robot : « gauche », « frapper »... vraies ou fausses.
//
// Le clavier, la manette, les doigts et le robot de l'ordinateur fabriquent tous ce même objet :
// le robot ne sait pas qui le joue, et c'est très bien (c'est l'idée de l'atelier).

import Phaser from "phaser";
import { TouchesPhysiques } from "../../socle/touchesPhysiques";

export const NOMS_DES_COMMANDES = ["gauche", "droite", "saut", "frapper", "tirer", "special"] as const;
export type NomDeCommande = typeof NOMS_DES_COMMANDES[number];
export type Commandes = Record<NomDeCommande, boolean>;

export function aucuneCommande(): Commandes {
  return { gauche: false, droite: false, saut: false, frapper: false, tirer: false, special: false };
}

export type Cote = "gauche" | "droite";

// Les touches de chaque joueur, d'après leur PLACE sur le clavier (event.code, nommé d'après un QWERTY) :
// à deux sur un clavier, chacun pose sa main au même endroit, quelle que soit la disposition.
// « KeyA », « KeyW » : le Q et le Z d'un clavier AZERTY, les touches de l'atelier.
// Le coup spécial n'a pas de touche à lui : on tire avec la jauge pleine.
export const TOUCHES: Record<Cote, Record<Exclude<NomDeCommande, "special">, string>> = {
  gauche: { gauche: "KeyA", droite: "KeyD", saut: "KeyW", frapper: "KeyF", tirer: "KeyG" },
  droite: { gauche: "ArrowLeft", droite: "ArrowRight", saut: "ArrowUp", frapper: "KeyK", tirer: "KeyL" },
};

// Ce qui est écrit sur ces touches, pour les afficher : etiquette(), dans le socle (touchesPhysiques.ts).

// Le clavier d'une scène : les touches tenues (le socle), et celles enfoncées depuis la dernière
// lecture. Phaser traite les touches une fois par image : un appui très bref (enfoncée puis relâchée
// dans la même image) ne serait jamais vu « tenu ». On s'en souvient jusqu'à la lecture suivante.
export class Clavier {
  private readonly tenues: TouchesPhysiques;
  private readonly appuyees = new Set<string>();

  // surAppui : appelée une fois par appui (pour les menus)
  constructor(scene: Phaser.Scene, surAppui?: (code: string) => void) {
    this.tenues = new TouchesPhysiques(scene);
    // Phaser 4.2 peut rendre deux fois le même événement (voir socle/clavier.ts) : on s'en souvient
    const dejaVus = new WeakSet<KeyboardEvent>();
    scene.input.keyboard!.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, (evenement: KeyboardEvent) => {
      if (dejaVus.has(evenement)) {
        return;
      }
      dejaVus.add(evenement);
      this.appuyees.add(evenement.code);
      surAppui?.(evenement.code);
    });
  }

  lire(cote: Cote, commandes = aucuneCommande()): Commandes {
    for (const [nom, code] of Object.entries(TOUCHES[cote]) as [NomDeCommande, string][]) {
      commandes[nom] ||= this.tenues.tenue(code) || this.appuyees.has(code);
    }
    return commandes;
  }

  // À la fin de chaque image : les appuis lus sont oubliés
  oublierLesAppuis() {
    this.appuyees.clear();
  }
}

// Les boutons d'une manette « standard » : A saute, X frappe, Y tire (sur PlayStation : ✕, □, △)
const BOUTONS = { saut: 0, frapper: 2, tirer: 3 };

// La manette : le stick gauche ou la croix pour marcher, et ses trois boutons
export function lireManette(manette: Phaser.Input.Gamepad.Gamepad | undefined, commandes = aucuneCommande()): Commandes {
  if (!manette) {
    return commandes;
  }
  commandes.gauche ||= manette.left || manette.leftStick.x < -0.5;
  commandes.droite ||= manette.right || manette.leftStick.x > 0.5;
  for (const [nom, bouton] of Object.entries(BOUTONS) as [NomDeCommande, number][]) {
    commandes[nom] ||= manette.isButtonDown(bouton);
  }
  return commandes;
}

// Les manettes branchées, dans l'ordre : la première joue le bleu, la deuxième l'orange
export function manettes(scene: Phaser.Scene): Phaser.Input.Gamepad.Gamepad[] {
  return scene.input.gamepad?.getAll() ?? [];
}
