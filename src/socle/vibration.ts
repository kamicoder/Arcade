// Faire vibrer la manette et le téléphone : un coup reçu, un choc, un K.O. se sentent dans les mains.
//
// Phaser ne vibre pas lui-même : il donne seulement accès à ce que le navigateur sait faire. La manette,
// par son « actionneur » (pad.vibration, le vibrationActuator de l'API Gamepad : Chrome et Edge) ; le
// téléphone, par navigator.vibrate (Android ; un iPhone ne vibre pas). Ce qui n'existe pas ne fait rien :
// on n'a jamais à vérifier avant d'appeler.
//
// Trois forces, pour que les jeux se ressemblent : « leger » (un choc, un rebond), « moyen » (un coup reçu,
// une vie perdue), « fort » (un K.O., la dernière vie, un boss abattu, un gros écroulement).

import type Phaser from "phaser";
import { estTactile } from "./tactile";

export type Force = "leger" | "moyen" | "fort";

const REGLAGES: Record<Force, { duree: number; fort: number; faible: number }> = {
  leger: { duree: 60, fort: 0, faible: 0.5 },
  moyen: { duree: 140, fort: 0.5, faible: 0.8 },
  fort: { duree: 350, fort: 1, faible: 1 },
};

// Ce que le navigateur donne pour la vibration d'une manette (les types de Phaser ne le décrivent pas)
interface Actionneur {
  playEffect?: (genre: string, options: { duration: number; strongMagnitude: number; weakMagnitude: number }) => Promise<unknown>;
}

// manette : celle du joueur concerné (à deux, chacun sent ses coups) ; sinon, toutes celles branchées.
// Le téléphone ne vibre que si l'on joue au doigt : il est alors dans les mains.
export function vibrer(scene: Phaser.Scene, force: Force, manette?: Phaser.Input.Gamepad.Gamepad | null) {
  const r = REGLAGES[force];
  const manettes = manette ? [manette] : scene.input.gamepad?.gamepads.filter(Boolean) ?? [];
  for (const pad of manettes) {
    const actionneur = (pad as unknown as { vibration?: Actionneur }).vibration;
    actionneur?.playEffect?.("dual-rumble", { duration: r.duree, strongMagnitude: r.fort, weakMagnitude: r.faible })
      .catch(() => {
        // la manette refuse (débranchée entre-temps) : tant pis
      });
  }
  if (estTactile() && typeof navigator.vibrate === "function") {
    navigator.vibrate(r.duree);
  }
}
