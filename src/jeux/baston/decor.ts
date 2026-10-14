// Ce que plusieurs scènes de la baston partagent : l'arène dessinée. (Sa liste de boutons est devenue
// celle de toute l'Arcade : socle/listeDeBoutons.ts.)

import Phaser from "phaser";
import { FOND, COULEUR_SOL, SOL, PROFONDEUR } from "./reglages";
import { HAUTEUR } from "../../socle/style";

export const enCouleur = (couleur: number) => "#" + couleur.toString(16).padStart(6, "0");

// L'arène : un mur du fond, deux projecteurs, et le sol. Toute la largeur du jeu : au doigt, elle
// peut dépasser 960 (voir socle/largeur.ts).
export function dessinerArene(scene: Phaser.Scene) {
  const largeur = scene.scale.width;
  scene.cameras.main.setBackgroundColor(FOND);
  const g = scene.add.graphics().setDepth(PROFONDEUR.decor);
  // Des bandes un peu plus claires sur le mur du fond
  for (let x = 0; x < largeur; x += 120) {
    g.fillStyle(0xffffff, 0.025).fillRect(x, 0, 60, SOL);
  }
  // Les projecteurs : des triangles de lumière, presque transparents
  g.fillStyle(0xfff3c4, 0.05);
  g.fillTriangle(largeur * 0.25, -10, largeur * 0.05, SOL, largeur * 0.45, SOL);
  g.fillTriangle(largeur * 0.75, -10, largeur * 0.55, SOL, largeur * 0.95, SOL);
  // Le sol, et son bord éclairé
  g.fillStyle(COULEUR_SOL).fillRect(0, SOL, largeur, HAUTEUR - SOL);
  g.fillStyle(0x6a708a).fillRect(0, SOL, largeur, 4);
  return g;
}
