// Les images du jeu de tir, toutes dessinées ici : un Graphics dessine une fois, et generateTexture en
// fait une image que les sprites partagent. Les vaisseaux regardent vers le haut, les ennemis vers le bas.

import Phaser from "phaser";

const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

export function fabriquerTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("tir-vaisseau")) {
    return;                                // déjà là (on revient au jeu après être passé par le Hub)
  }
  const g = scene.make.graphics();
  const fin = (cle: string, largeur: number, hauteur: number) => {
    g.generateTexture(cle, largeur, hauteur);
    g.clear();
  };

  // Le vaisseau du joueur : une flèche blanche et cyan, deux ailes, un cockpit
  g.fillStyle(0x2a8fd8).fillPoints([V(24, 10), V(46, 44), V(36, 50), V(24, 42), V(12, 50), V(2, 44)], true);
  g.fillStyle(0xe8f4ff).fillPoints([V(24, 0), V(32, 30), V(28, 46), V(20, 46), V(16, 30)], true);
  g.fillStyle(0x5ff0ff).fillEllipse(24, 24, 8, 14);
  g.fillStyle(0xff9a3c).fillRect(19, 46, 4, 6).fillRect(25, 46, 4, 6);   // les réacteurs
  fin("tir-vaisseau", 48, 52);

  // Les ennemis
  // L'éclaireur : un petit losange vert
  g.fillStyle(0x3ccf6e).fillPoints([V(16, 32), V(32, 10), V(16, 0), V(0, 10)], true);
  g.fillStyle(0xb8ffcf).fillCircle(16, 13, 5);
  fin("tir-eclaireur", 32, 32);

  // Le chasseur : des ailes en pointe, rouges
  g.fillStyle(0xd83c4e).fillPoints([V(20, 38), V(40, 4), V(28, 12), V(20, 0), V(12, 12), V(0, 4)], true);
  g.fillStyle(0xffd0d6).fillCircle(20, 16, 5);
  fin("tir-chasseur", 40, 40);

  // Le lourd : un gros octogone violet et blindé
  g.fillStyle(0x7c4bd8).fillPoints([V(20, 0), V(50, 0), V(70, 20), V(70, 46), V(50, 66), V(20, 66), V(0, 46), V(0, 20)], true);
  g.fillStyle(0x5a30a8).fillRect(10, 26, 50, 14);
  g.fillStyle(0xffd23f).fillCircle(35, 33, 9);
  fin("tir-lourd", 70, 66);

  // Le boss : une grande soucoupe rouge sombre, avec trois canons
  g.fillStyle(0x5a1424).fillEllipse(110, 60, 220, 70);
  g.fillStyle(0x9a2238).fillEllipse(110, 48, 160, 60);
  g.fillStyle(0xffd23f).fillCircle(110, 44, 18);
  g.fillStyle(0x14141e).fillCircle(110, 46, 8);
  g.fillStyle(0x3a0e18).fillRect(30, 70, 14, 24).fillRect(103, 80, 14, 26).fillRect(176, 70, 14, 24);
  fin("tir-boss", 220, 106);

  // Les balles : un trait de lumière pour le joueur, une boule rose pour les ennemis
  g.fillStyle(0x5ff0ff).fillRoundedRect(0, 0, 6, 18, 3);
  g.fillStyle(0xffffff).fillRoundedRect(1.5, 2, 3, 12, 1.5);
  fin("tir-balle", 6, 18);
  g.fillStyle(0xff4fa0).fillCircle(7, 7, 7);
  g.fillStyle(0xffd0e8).fillCircle(7, 7, 3);
  fin("tir-balle-ennemie", 14, 14);

  // Les bonus : une capsule, sa couleur et son dessin disent ce qu'elle donne
  const capsule = (cle: string, couleur: number, symbole: () => void) => {
    g.fillStyle(couleur).fillRoundedRect(0, 0, 34, 34, 10);
    g.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(1.5, 1.5, 31, 31, 9);
    g.fillStyle(0xffffff);
    symbole();
    fin(cle, 34, 34);
  };
  // L'arme : une double flèche vers le haut
  capsule("tir-bonus-arme", 0xff8a1e, () => g.fillTriangle(17, 6, 27, 17, 7, 17).fillTriangle(17, 15, 27, 27, 7, 27));
  // Le bouclier : un anneau
  capsule("tir-bonus-bouclier", 0x2a8fd8, () => g.lineStyle(4, 0xffffff).strokeCircle(17, 17, 8));
  // Une vie : un cœur, deux ronds et un triangle
  capsule("tir-bonus-vie", 0xe6465a, () => g.fillCircle(13, 14, 5).fillCircle(21, 14, 5).fillTriangle(8, 16, 26, 16, 17, 26));

  // Une vie, au tableau de bord : un petit vaisseau
  g.fillStyle(0xe8f4ff).fillPoints([V(10, 0), V(20, 18), V(10, 14), V(0, 18)], true);
  fin("tir-vie", 20, 18);

  // Le bouclier : un rond bleu autour du vaisseau
  g.lineStyle(3, 0x7fd8ff, 0.9).strokeCircle(36, 36, 33);
  g.fillStyle(0x7fd8ff, 0.18).fillCircle(36, 36, 33);
  fin("tir-bouclier", 72, 72);

  // Les étoiles, en trois couches : petites et lointaines, puis plus grosses et plus proches.
  // Pas d'étoile au bord de la tuile : une TileSprite répète sa texture, et un point coupé au bord
  // réapparaîtrait de l'autre côté.
  const etoiles = (cle: string, nombre: number, taille: number, alpha: number) => {
    for (let i = 0; i < nombre; i++) {
      g.fillStyle(0xffffff, alpha * Phaser.Math.FloatBetween(0.5, 1))
        .fillCircle(Phaser.Math.Between(4, 252), Phaser.Math.Between(4, 252), taille);
    }
    fin(cle, 256, 256);
  };
  etoiles("tir-etoiles-loin", 40, 0.7, 0.5);
  etoiles("tir-etoiles-milieu", 14, 1.1, 0.75);
  etoiles("tir-etoiles-pres", 5, 1.6, 1);

  g.destroy();
}
