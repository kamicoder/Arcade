// La fin d'une partie, par-dessus la partie (qui s'est mise en pause derrière) : le score, la vague
// atteinte, peut-être un record, puis rejouer ou revenir au menu (l'écran commun : socle/fin.ts).

import Phaser from "phaser";
import type { Partie } from "./Partie";
import { ecranDeFin } from "../../../socle/fin";

export interface DonneesDeFin {
  nouveauRecord: boolean;
}

export class Fin extends Phaser.Scene {
  constructor() {
    super("tir-fin");
  }

  create(donnees: DonneesDeFin) {
    const partie = this.scene.get("tir-partie") as Partie;
    ecranDeFin(this, {
      lignes: [
        { y: 150, texte: "GAME OVER", taille: 64, couleur: "#f07878" },
        { y: 240, texte: `Score : ${partie.score}`, taille: 32, couleur: "#ffffff" },
        { y: 285, texte: `Vague ${partie.vague.numero}    (record : ${partie.record})`, taille: 22, couleur: "#a59fc0" },
      ],
      nouveauRecord: donnees.nouveauRecord,
      rejouer: () => partie.rejouer(),
      quitter: () => partie.quitter(),
      fond: 0x1c2a44,
      bord: 0x5ff0ff,
    });
  }
}
