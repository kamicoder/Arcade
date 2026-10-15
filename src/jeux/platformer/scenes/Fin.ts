// La fin d'une partie, par-dessus le jeu (qui s'est mis en pause derrière) : gagné ou perdu,
// le score ou la distance, puis rejouer ou s'en aller (l'écran commun : socle/fin.ts). Sert au solo et
// au duo.

import Phaser from "phaser";
import type { Niveau, Fin as Issue } from "./Niveau";
import type { Duo } from "./Duo";
import { nomDeLaCampagne } from "../niveaux";
import { ecranDeFin, type LigneDeFin } from "../../../socle/fin";

export interface DonneesDeFin {
  fin: Issue;
  nouveauRecord?: boolean;
  gagnant?: string;                        // le duo : qui a gagné
}

export class Fin extends Phaser.Scene {
  constructor() {
    super("platformer-fin");
  }

  create(donnees: DonneesDeFin) {
    const niveau = this.scene.isActive("platformer-niveau") ? this.scene.get("platformer-niveau") as Niveau : null;
    const jeu = niveau ?? this.scene.get("platformer-duo") as Duo;
    const mode = niveau?.donnees.mode;

    const lignes: LigneDeFin[] = [];
    if (!niveau) {
      lignes.push({ y: 170, texte: donnees.gagnant + " gagne !", taille: 60, couleur: "#fff096" });
    } else if (donnees.fin === "gagne") {
      lignes.push({ y: 160, texte: mode === "test" ? "Niveau réussi !" : "BRAVO !", taille: 64, couleur: "#78f078" });
      if (mode === "aventure") {
        const campagne = nomDeLaCampagne(niveau.donnees.campagne ?? "aventure");
        lignes.push({ y: 240, texte: `Toute ${campagne} est finie !`, taille: 26, couleur: "#ffffff" });
      }
    } else {
      lignes.push({ y: 160, texte: mode === "infini" ? "PERDU !" : "GAME OVER", taille: 64, couleur: "#f07878" });
    }
    if (mode === "infini") {
      lignes.push({ y: 250, texte: `${niveau!.distance} m    (record : ${niveau!.record} m)`, taille: 28, couleur: "#ffffff" });
    } else if (mode === "aventure") {
      lignes.push({ y: 290, texte: `Score : ${niveau!.donnees.score}`, taille: 28, couleur: "#ffffff" });
    }

    ecranDeFin(this, {
      lignes,
      nouveauRecord: donnees.nouveauRecord,
      rejouer: () => jeu.rejouer(),
      quitter: () => jeu.quitter(),
      ailleurs: mode === "test" ? "L'éditeur" : "Le menu",
      fond: 0x2a2735,
      bord: 0x5fd068,
    });
  }
}
