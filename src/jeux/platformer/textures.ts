// Les images fabriquées du platformer : ce que l'atelier dessinait avec pygame.draw (le boss, les
// cœurs, la plateforme normale...). On dessine une fois avec un Graphics, et generateTexture en fait
// une image, comme l'étincelle de l'Arcade.

import Phaser from "phaser";
import { textureDuGenre, type Fiche } from "./genres";
import { BOSS, MOBILE } from "./reglages";

export const TUILE = 16;                   // la taille des images de plateforme...
export const ECHELLE_TUILE = 20 / TUILE;   // ... montrées en tuiles de 20 pixels, comme dans l'atelier

// Les images en petits pixels restent nettes une fois agrandies (sinon le navigateur les floute)
export function garderLesPixelsNets(scene: Phaser.Scene, cles: string[]) {
  for (const cle of cles) {
    scene.textures.get(cle).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

const enNombre = ([r, v, b]: number[]) => (r << 16) | (v << 8) | b;

// Une tuile unie, avec un bord deux fois plus sombre (comme « Créer son image » dans l'atelier)
function tuileUnie(scene: Phaser.Scene, cle: string, couleur: number[]) {
  if (scene.textures.exists(cle)) {
    return;
  }
  const g = scene.make.graphics();
  g.fillStyle(enNombre(couleur)).fillRect(0, 0, TUILE, TUILE);
  g.lineStyle(1, enNombre(couleur.map((c) => c >> 1))).strokeRect(0.5, 0.5, TUILE - 1, TUILE - 1);
  g.generateTexture(cle, TUILE, TUILE);
  g.destroy();
  garderLesPixelsNets(scene, [cle]);
}

// La texture d'un genre : son image s'il en a une, sinon une tuile de sa couleur (fabriquée à la demande)
export function texturePour(scene: Phaser.Scene, genre: string, fiche: Fiche): string {
  const cle = textureDuGenre(genre, fiche);
  if (!scene.textures.exists(cle)) {
    tuileUnie(scene, cle, fiche.couleur);
  }
  return cle;
}

export function fabriquerTextures(scene: Phaser.Scene) {
  tuileUnie(scene, "platformer-mobile", [(MOBILE >> 16) & 255, (MOBILE >> 8) & 255, MOBILE & 255]);

  const g = scene.make.graphics();

  // Le boss : un gros carré arrondi, et deux yeux qui regardent en bas
  g.fillStyle(BOSS).fillRoundedRect(0, 0, 64, 64, 10);
  g.fillStyle(0x6e1c2a).fillRoundedRect(0, 52, 64, 12, { tl: 0, tr: 0, bl: 10, br: 10 });
  g.fillStyle(0xffffff).fillCircle(20, 24, 7).fillCircle(44, 24, 7);
  g.fillStyle(0x14141e).fillCircle(20, 26, 3).fillCircle(44, 26, 3);
  g.lineStyle(4, 0x14141e).lineBetween(10, 12, 28, 18).lineBetween(54, 12, 36, 18);   // les sourcils fâchés
  g.generateTexture("platformer-boss", 64, 64);
  g.clear();

  // Un cœur, pour les vies : deux ronds et un triangle, comme dans l'atelier
  g.fillStyle(0xe6465a).fillCircle(6, 6, 6).fillCircle(16, 6, 6).fillTriangle(0, 8, 22, 8, 11, 20);
  g.generateTexture("platformer-coeur", 22, 20);
  g.clear();

  // Une barre de vie du boss
  g.fillStyle(0xffd246).fillRect(0, 0, 18, 8);
  g.generateTexture("platformer-vie-boss", 18, 8);
  g.clear();

  // Un confetti : un petit rectangle blanc, que les particules teintent (la fête du drapeau)
  g.fillStyle(0xffffff).fillRect(0, 0, 8, 4);
  g.generateTexture("platformer-confetti", 8, 4);
  g.destroy();
}
