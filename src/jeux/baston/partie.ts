// Ce que les scènes se passent d'une à l'autre, et ce qu'on garde d'une partie à l'autre.

import type { Cote } from "./commandes";
import { MODELES } from "./modeles";
import { SAUVEGARDE } from "./reglages";
import { lire, ecrire } from "../../socle/sauvegarde";

export interface DonneesDeCombat {
  solo: boolean;                           // vrai : le robot orange est joué par l'ordinateur
  modeles: Record<Cote, number>;           // le numéro du modèle choisi par chaque joueur
  manches: Record<Cote, number>;           // les manches déjà gagnées par chacun
}

// Le dernier choix de robots : on le retrouve à la partie suivante
export function lireLeChoix(): Record<Cote, number> {
  const choix = lire<Record<Cote, number>>(SAUVEGARDE + "/choix");
  const valide = (n: unknown) => typeof n === "number" && n >= 0 && n < MODELES.length;
  return {
    gauche: valide(choix?.gauche) ? choix!.gauche : 0,
    droite: valide(choix?.droite) ? choix!.droite : 0,
  };
}

export function ecrireLeChoix(choix: Record<Cote, number>) {
  ecrire(SAUVEGARDE + "/choix", choix);
}

// Les matchs contre l'ordinateur : gagnés et perdus
export interface Bilan {
  victoires: number;
  defaites: number;
}

export function lireLeBilan(): Bilan {
  const bilan = lire<Bilan>(SAUVEGARDE + "/contre-ordinateur");
  return { victoires: bilan?.victoires ?? 0, defaites: bilan?.defaites ?? 0 };
}

export function compterUnMatch(gagne: boolean) {
  const bilan = lireLeBilan();
  if (gagne) {
    bilan.victoires++;
  } else {
    bilan.defaites++;
  }
  ecrire(SAUVEGARDE + "/contre-ordinateur", bilan);
}
