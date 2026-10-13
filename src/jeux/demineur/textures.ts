// Les images fabriquées du démineur : les cases, les chiffres, le curseur...
// On les dessine une fois, au chargement, sur des CanvasTexture (un canvas du navigateur que Phaser
// transforme en texture) : le dessin 2D du navigateur sait faire des dégradés et du texte, ce qui
// donne de plus jolies cases qu'un Graphics, et des milliers de cases ne coûtent qu'une texture.

import type Phaser from "phaser";
import { POLICE } from "../../socle/style";

// Le côté d'une case, dans le monde de la partie (la caméra zoome ensuite pour faire tenir la grille)
export const TAILLE = 48;
// Les textures sont dessinées deux fois plus fines, puis affichées à moitié : elles restent nettes
// quand on zoome au doigt
export const FINESSE = 2;

// Chaque chiffre a sa couleur, comme dans le vrai démineur
export const COULEURS_CHIFFRES = [
  "", "#2f6fe0", "#2e9a4a", "#e0413a", "#2a3596", "#9a2a2a", "#1f9a9a", "#2a2a2a", "#7a7a86",
];

export const COULEURS = {
  fond: 0x14121c,
  barre: 0x221f2e,
  cache1: "#6f82c2",                       // le haut d'une case fermée (dégradé vers le bas)
  cache2: "#4a5893",
  ouverte1: "#ecebf3",                     // deux tons qui alternent en damier : on lit mieux la grille
  ouverte2: "#dfdce9",
  rouge: 0xff4d4d,
  compteur: "#ff5a50",
};

function arrondi(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, rayon: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, l, h, rayon);
}

// Une texture dessinée au canvas : on reçoit le pinceau à la bonne échelle, on dessine en unités de case
function dessiner(scene: Phaser.Scene, cle: string, cote: number, dessin: (ctx: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(cle)) {
    return;
  }
  const texture = scene.textures.createCanvas(cle, cote * FINESSE, cote * FINESSE)!;
  const ctx = texture.getContext();
  ctx.scale(FINESSE, FINESSE);
  dessin(ctx);
  texture.refresh();                       // le canvas a changé : Phaser renvoie l'image à la carte graphique
}

export function fabriquerTextures(scene: Phaser.Scene) {
  const t = TAILLE;

  // La case fermée : bombée comme un bouton (un dégradé, un reflet en haut, une ombre en bas)
  dessiner(scene, "demineur-cachee", t, (ctx) => {
    arrondi(ctx, 2, 3, t - 4, t - 4, 8);
    ctx.fillStyle = "#2c3359";
    ctx.fill();                            // l'ombre, décalée vers le bas
    const degrade = ctx.createLinearGradient(0, 2, 0, t - 3);
    degrade.addColorStop(0, COULEURS.cache1);
    degrade.addColorStop(1, COULEURS.cache2);
    arrondi(ctx, 2, 1, t - 4, t - 5, 8);
    ctx.fillStyle = degrade;
    ctx.fill();
    arrondi(ctx, 6, 4, t - 12, 6, 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.fill();                            // le reflet
  });

  for (const [cle, couleur] of [["demineur-ouverte1", COULEURS.ouverte1], ["demineur-ouverte2", COULEURS.ouverte2]]) {
    dessiner(scene, cle, t, (ctx) => {
      arrondi(ctx, 1, 1, t - 2, t - 2, 6);
      ctx.fillStyle = couleur;
      ctx.fill();
    });
  }

  // Le fond de la case où la mine a sauté
  dessiner(scene, "demineur-explosee", t, (ctx) => {
    arrondi(ctx, 1, 1, t - 2, t - 2, 6);
    const degrade = ctx.createRadialGradient(t / 2, t / 2, 2, t / 2, t / 2, t * 0.7);
    degrade.addColorStop(0, "#ffd36b");
    degrade.addColorStop(0.45, "#ff5a3c");
    degrade.addColorStop(1, "#b0202a");
    ctx.fillStyle = degrade;
    ctx.fill();
  });

  // Les chiffres, avec un liseré blanc qui les détache du fond
  for (let n = 1; n <= 8; n++) {
    dessiner(scene, "demineur-chiffre-" + n, t, (ctx) => {
      ctx.font = `900 30px ${POLICE}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.strokeText(String(n), t / 2, t / 2 + 2);
      ctx.fillStyle = COULEURS_CHIFFRES[n];
      ctx.fillText(String(n), t / 2, t / 2 + 2);
    });
  }

  dessiner(scene, "demineur-question", t, (ctx) => {
    ctx.font = `900 28px ${POLICE}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffe48a";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowOffsetY = 2;
    ctx.fillText("?", t / 2, t / 2 + 1);
  });

  // La croix rouge sur un drapeau qui était faux
  dessiner(scene, "demineur-croix", t, (ctx) => {
    ctx.strokeStyle = "#ff3030";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(t - 10, t - 10);
    ctx.moveTo(t - 10, 10);
    ctx.lineTo(10, t - 10);
    ctx.stroke();
  });

  // Un voile blanc pour la case survolée ou enfoncée
  dessiner(scene, "demineur-voile", t, (ctx) => {
    arrondi(ctx, 2, 1, t - 4, t - 5, 8);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  });

  // Le curseur du clavier : un cadre doré
  dessiner(scene, "demineur-curseur", t, (ctx) => {
    arrondi(ctx, 2, 2, t - 4, t - 4, 9);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffc83d";
    ctx.shadowColor = "#ffc83d";
    ctx.shadowBlur = 6;
    ctx.stroke();
  });

  // Les confettis de la victoire : un petit rectangle blanc, que les particules teintent
  dessiner(scene, "demineur-confetti", 8, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(1, 0, 6, 8);
  });
}
