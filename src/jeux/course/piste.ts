// La piste entière dans une seule grande image, peinte par le thème au pinceau du navigateur (une
// CanvasTexture : Phaser n'a pas de pinceau pour les routes courbes et épaisses). On ne garde que celle
// du circuit en cours : ce sont de grandes images (jusqu'à 3000 × 2300), lourdes pour un téléphone.

import type Phaser from "phaser";
import { empreinte, type Circuit } from "./circuits";
import { themeEnCours } from "./sauvegarde";

const DEBUT = "course-piste-";

export function texturePiste(scene: Phaser.Scene, c: Circuit): string {
  const theme = themeEnCours();
  // Le nom dit tout ce que l'image montre : le thème, le circuit, et ses points (le circuit dessiné change)
  const cle = DEBUT + theme.id + "-" + c.modele.id + "-" + empreinte(JSON.stringify(c.points));
  oublierLesPistes(scene, cle);
  if (!scene.textures.exists(cle)) {
    const texture = scene.textures.createCanvas(cle, c.modele.largeur, c.modele.hauteur)!;
    theme.peindreLaPiste(texture.getContext(), c);
    texture.refresh();                     // envoie le dessin à la carte graphique
  }
  return cle;
}

// Les pistes gardées, sauf celle qu'on montre (à ne jamais retirer tant qu'elle est affichée)
export function oublierLesPistes(scene: Phaser.Scene, sauf = "") {
  for (const cle of scene.textures.getTextureKeys()) {
    if (cle.startsWith(DEBUT) && cle !== sauf) {
      scene.textures.remove(cle);
    }
  }
}
