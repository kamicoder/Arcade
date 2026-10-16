// La manette : le pendant de surTouche (clavier.ts) pour les boutons d'une manette « standard ».
//
// La règle de l'Arcade, pour qu'on s'y retrouve d'un jeu à l'autre : dans les menus, les listes et les
// fins de partie, A ou Start valide (VALIDER), B revient. En pleine partie, chaque jeu décide ; d'habitude,
// Start met en pause (la course, et socle/pause.ts pour le tir, le platformer, le démineur). La croix se lit ici quand on choisit dans un menu ; un
// jeu qui la tient (courir, piloter) lit la manette à chaque image, comme le clavier.
//
// Le stick gauche fait comme la croix : un coup de stick, un pas. Phaser n'a pas d'événement pour lui (seulement
// pour les boutons) : on le lit à chaque image de la scène.

import Phaser from "phaser";

// Les numéros des boutons d'une manette « standard » (la disposition d'une manette Xbox)
export const MANETTE = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, SELECT: 8, START: 9, HAUT: 12, BAS: 13, GAUCHE: 14, DROITE: 15,
} as const;

export const VALIDER = [MANETTE.A, MANETTE.START];

const POUSSE = 0.6;                        // le stick poussé au-delà : un pas
const AU_MILIEU = 0.3;                     // revenu en deçà : il est lâché (entre les deux, rien ne change)

// La direction où le stick est poussé (un bouton de la croix), null s'il est au milieu, undefined entre les deux
function directionDuStick(manette: Phaser.Input.Gamepad.Gamepad): number | null | undefined {
  const { x, y } = manette.leftStick;
  const force = Math.max(Math.abs(x), Math.abs(y));
  if (force < AU_MILIEU) {
    return null;
  }
  if (force < POUSSE) {
    return undefined;
  }
  if (Math.abs(x) > Math.abs(y)) {
    return x < 0 ? MANETTE.GAUCHE : MANETTE.DROITE;
  }
  return y < 0 ? MANETTE.HAUT : MANETTE.BAS;
}

// L'action quand on presse l'un de ces boutons, sur n'importe quelle manette (elle la reçoit : les jeux
// à deux savent ainsi qui a appuyé). La scène qui s'arrête emporte l'écoute avec elle.
export function surManette(
  scene: Phaser.Scene,
  boutons: number | readonly number[],
  action: (manette: Phaser.Input.Gamepad.Gamepad) => void,
) {
  const liste: readonly number[] = typeof boutons === "number" ? [boutons] : boutons;
  scene.input.gamepad?.on("down", (manette: Phaser.Input.Gamepad.Gamepad, bouton: Phaser.Input.Gamepad.Button) => {
    if (liste.includes(bouton.index)) {
      action(manette);
    }
  });
  if (liste.some((b) => b === MANETTE.HAUT || b === MANETTE.BAS || b === MANETTE.GAUCHE || b === MANETTE.DROITE)) {
    suivreLeStick(scene, liste, action);
  }
}

// Le stick qui passe dans une direction de la liste : l'action. Un stick déjà poussé quand la scène arrive, ou
// quand elle sort d'une pause, ne compte pas : il faut le relâcher (comme un bouton, voir PIEGES-PHASER.md).
function suivreLeStick(
  scene: Phaser.Scene,
  liste: readonly number[],
  action: (manette: Phaser.Input.Gamepad.Gamepad) => void,
) {
  let avant = new Map<Phaser.Input.Gamepad.Gamepad, number | null>();
  const lire = () => {
    for (const manette of scene.input.gamepad?.getAll() ?? []) {
      const sens = directionDuStick(manette);
      if (sens === undefined) {
        continue;
      }
      const precedent = avant.get(manette);
      avant.set(manette, sens);
      if (precedent !== undefined && sens !== null && sens !== precedent && liste.includes(sens)) {
        action(manette);
      }
    }
  };
  const oublier = () => (avant = new Map());
  scene.events.on(Phaser.Scenes.Events.UPDATE, lire);
  scene.events.on(Phaser.Scenes.Events.RESUME, oublier);
  scene.events.on(Phaser.Scenes.Events.WAKE, oublier);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, lire);
    scene.events.off(Phaser.Scenes.Events.RESUME, oublier);
    scene.events.off(Phaser.Scenes.Events.WAKE, oublier);
  });
}
