// Les images du casse-briques, toutes dessinées ici : un Graphics dessine une fois, et generateTexture en
// fait une image que les sprites partagent (comme le tir spatial).

import Phaser from "phaser";

export const BRIQUE = { largeur: 60, hauteur: 24 };

// La couleur de chaque lettre de la grille (niveaux.ts) : le corps de la brique et son reflet
export const COULEURS_DES_BRIQUES: Record<string, { corps: number; reflet: number }> = {
  r: { corps: 0xe8453c, reflet: 0xff8a80 },
  o: { corps: 0xff8a1e, reflet: 0xffc280 },
  j: { corps: 0xf5d03a, reflet: 0xfff1a0 },
  v: { corps: 0x4fcf5f, reflet: 0xa8f5b0 },
  b: { corps: 0x3f8ff0, reflet: 0x9cc8ff },
  i: { corps: 0x9b6bff, reflet: 0xd0b8ff },
  a: { corps: 0xa7b0c0, reflet: 0xf0f4ff },
  O: { corps: 0xd9a21b, reflet: 0xffe27a },
  "*": { corps: 0xd8304a, reflet: 0xffd23f },
  "#": { corps: 0x4a4e5c, reflet: 0x8a90a2 },
};

export const GENRES_DE_BONUS = ["large", "multi", "feu", "lente", "vie"] as const;
export type GenreDeBonus = typeof GENRES_DE_BONUS[number];

const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

// La clé de l'image d'une brique : sa lettre, et ses fissures (0 : intacte)
export function imageDeBrique(lettre: string, fissures = 0): string {
  return `briques-brique-${lettre === "*" ? "boum" : lettre === "#" ? "metal" : lettre}-${fissures}`;
}

export function fabriquerTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("briques-balle")) {
    return;                                // déjà là (on revient au jeu après être passé par le Hub)
  }
  const g = scene.make.graphics();
  const fin = (cle: string, largeur: number, hauteur: number) => {
    g.generateTexture(cle, largeur, hauteur);
    g.clear();
  };
  const { largeur: L, hauteur: H } = BRIQUE;

  // Les briques : un corps arrondi, un reflet en haut, une ombre en bas. Les dures ont une image de plus
  // par coup reçu, avec des fissures.
  const fissures = (n: number) => {
    g.lineStyle(2, 0x1c1a25, 0.75);
    if (n >= 1) {
      g.strokePoints([V(14, 2), V(20, 10), V(16, 15), V(23, 22)]);
    }
    if (n >= 2) {
      g.strokePoints([V(44, 3), V(39, 11), V(46, 16), V(41, 22)]);
    }
  };
  for (const [lettre, { corps, reflet }] of Object.entries(COULEURS_DES_BRIQUES)) {
    const maxFissures = lettre === "a" ? 1 : lettre === "O" ? 2 : 0;
    for (let n = 0; n <= maxFissures; n++) {
      g.fillStyle(corps).fillRoundedRect(0, 0, L, H, 5);
      g.fillStyle(reflet, 0.55).fillRoundedRect(3, 2, L - 6, 6, 3);
      g.fillStyle(0x000000, 0.22).fillRect(3, H - 5, L - 6, 3);
      if (lettre === "#") {
        // Le métal : quatre rivets
        g.fillStyle(0xc8ccd8);
        for (const [x, y] of [[7, 7], [L - 7, 7], [7, H - 7], [L - 7, H - 7]]) {
          g.fillCircle(x, y, 2.5);
        }
      } else if (lettre === "*") {
        // L'explosive : une étoile jaune au milieu
        g.fillStyle(0xffd23f).fillPoints([
          V(30, 3), V(33, 9), V(40, 7), V(36, 12), V(42, 16), V(34, 16), V(30, 22), V(26, 16), V(18, 16), V(24, 12), V(20, 7), V(27, 9),
        ], true);
      }
      fissures(n);
      fin(imageDeBrique(lettre, n), L, H);
    }
  }

  // La raquette : une pilule bleue, ses bouts plus clairs
  g.fillStyle(0x2a6fd8).fillRoundedRect(0, 0, 110, 20, 10);
  g.fillStyle(0x5ff0ff).fillRoundedRect(0, 0, 18, 20, { tl: 10, bl: 10, tr: 0, br: 0 });
  g.fillStyle(0x5ff0ff).fillRoundedRect(92, 0, 18, 20, { tl: 0, bl: 0, tr: 10, br: 10 });
  g.fillStyle(0xffffff, 0.45).fillRoundedRect(20, 3, 70, 4, 2);
  fin("briques-raquette", 110, 20);

  // La balle : un rond blanc, un reflet
  g.fillStyle(0xffffff).fillCircle(9, 9, 9);
  g.fillStyle(0xbfe8ff).fillCircle(11, 11, 5);
  g.fillStyle(0xffffff).fillCircle(7, 6, 3);
  fin("briques-balle", 18, 18);

  // Une vie, au tableau de bord : une petite raquette
  g.fillStyle(0x5ff0ff).fillRoundedRect(0, 0, 26, 8, 4);
  fin("briques-vie", 26, 8);

  // Les bonus : une capsule, sa couleur et sa lettre disent ce qu'elle donne
  const capsule = (cle: string, couleur: number, dessin: () => void) => {
    g.fillStyle(couleur).fillRoundedRect(0, 0, 44, 22, 11);
    g.lineStyle(2, 0xffffff, 0.9).strokeRoundedRect(1, 1, 42, 20, 10);
    g.fillStyle(0xffffff);
    dessin();
    fin("briques-bonus-" + cle, 44, 22);
  };
  // Large : deux flèches qui s'écartent
  capsule("large", 0x2a8fd8, () => g.fillTriangle(6, 11, 16, 5, 16, 17).fillTriangle(38, 11, 28, 5, 28, 17).fillRect(16, 9, 12, 4));
  // Multi : trois balles
  capsule("multi", 0x3ccf6e, () => g.fillCircle(13, 11, 4).fillCircle(22, 11, 4).fillCircle(31, 11, 4));
  // Feu : une flamme
  capsule("feu", 0xe8453c, () => {
    g.fillStyle(0xffd23f).fillPoints([V(22, 3), V(29, 12), V(26, 19), V(18, 19), V(15, 12), V(19, 9)], true);
  });
  // Lente : un sablier
  capsule("lente", 0x9b6bff, () => g.fillTriangle(15, 4, 29, 4, 22, 11).fillTriangle(15, 18, 29, 18, 22, 11));
  // Une vie : un cœur
  capsule("vie", 0xff4f8a, () => g.fillCircle(18, 9, 4.5).fillCircle(26, 9, 4.5).fillTriangle(13.5, 10.5, 30.5, 10.5, 22, 19));

  g.destroy();

  // Le fond : un dégradé du violet nuit au bleu, avec un quadrillage très pâle. Un canvas plutôt qu'un
  // Graphics : ses dégradés marchent aussi sans WebGL.
  const fond = scene.textures.createCanvas("briques-fond", 960, 540)!;
  const ctx = fond.getContext();
  const degrade = ctx.createLinearGradient(0, 0, 0, 540);
  degrade.addColorStop(0, "#1d1640");
  degrade.addColorStop(1, "#0a0918");
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, 960, 540);
  ctx.strokeStyle = "rgba(155, 107, 255, 0.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= 960; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, 540);
    ctx.stroke();
  }
  for (let y = 0; y <= 540; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(960, y + 0.5);
    ctx.stroke();
  }
  fond.refresh();
}
