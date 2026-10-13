// Les images de la course des licornes, fabriquées au lieu d'être chargées.
// On dessine au pinceau du navigateur dans une CanvasTexture (voir dessins.ts) : Phaser la garde dans son
// gestionnaire de textures, et on s'en sert autant qu'on veut (images, sprites, particules).

import Phaser from "phaser";
import { ARC_EN_CIEL, LARGEUR_ROUTE } from "./reglages";
import { dessinerLicorne, peindreDecor, dessinerApercu, formeEtoile, ovale, cheminDeRoute, degradeArcEnCiel } from "./dessins";
import type { Circuit, Point } from "./circuits";
import type { Look } from "./donnees";
import { LARGEUR, HAUTEUR } from "../../socle/style";

// Une CanvasTexture neuve (on remplace l'ancienne du même nom) et son pinceau
function toile(scene: Phaser.Scene, cle: string, largeur: number, hauteur: number) {
  if (scene.textures.exists(cle)) {
    scene.textures.remove(cle);
  }
  const texture = scene.textures.createCanvas(cle, Math.ceil(largeur), Math.ceil(hauteur))!;
  return { texture, p: texture.getContext() };
}

// Les images de tous les jours : une seule fois par partie
export function fabriquerTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("licorne-particules")) {
    return;
  }

  // Les grains des particules : un rond et une étoile, blancs (les particules les teintent),
  // deux « frames » de la même texture
  {
    const { texture, p } = toile(scene, "licorne-particules", 32, 16);
    p.fillStyle = "white";
    ovale(p, 8, 8, 7.5, 7.5);
    p.fill();
    formeEtoile(p, 24, 8.5, 8, 0, 5, 0.45);
    p.fill();
    texture.add("rond", 0, 0, 0, 16, 16);
    texture.add("etoile", 0, 16, 0, 16, 16);
    texture.refresh();
  }

  // L'étoile à ramasser : son halo doré, et l'étoile bordée de blanc
  {
    const { texture, p } = toile(scene, "licorne-etoile", 60, 60);
    p.fillStyle = "rgba(255, 220, 90, 0.35)";
    ovale(p, 30, 30, 26, 26);
    p.fill();
    p.fillStyle = "#ffe066";
    p.strokeStyle = "white";
    p.lineWidth = 3;
    p.lineJoin = "round";
    formeEtoile(p, 30, 30, 17, 0, 5, 0.48);
    p.fill();
    p.stroke();
    texture.refresh();
  }

  // Le bonbon : son halo, son papier, et (à part, pour la faire tourner) sa spirale blanche
  {
    const { texture, p } = toile(scene, "licorne-bonbon", 64, 64);
    p.translate(32, 32);
    p.fillStyle = "rgba(255, 120, 200, 0.3)";
    ovale(p, 0, 0, 30, 30);
    p.fill();
    p.fillStyle = "#ff9fd4";
    for (const cote of [-1, 1]) {
      p.beginPath();
      p.moveTo(cote * 10, 0);
      p.lineTo(cote * 24, -10);
      p.lineTo(cote * 24, 10);
      p.closePath();
      p.fill();
    }
    p.fillStyle = "#ff4fa8";
    ovale(p, 0, 0, 14, 14);
    p.fill();
    texture.refresh();
  }
  {
    const { texture, p } = toile(scene, "licorne-spirale", 24, 24);
    p.translate(12, 12);
    p.strokeStyle = "white";
    p.lineWidth = 3;
    p.lineCap = "butt";
    p.beginPath();
    p.arc(0, 0, 9, 0, 4);
    p.stroke();
    p.beginPath();
    p.arc(0, 0, 4, 2, 6);
    p.stroke();
    texture.refresh();
  }

  // Le nuage d'orage (centré sur (50, 40)), et son éclair à part : il clignote
  {
    const { texture, p } = toile(scene, "licorne-orage", 100, 84);
    p.translate(50, 40);
    p.fillStyle = "rgba(60, 40, 90, 0.2)";
    ovale(p, 4, 10, 42, 30);
    p.fill();
    p.fillStyle = "#7d6f9e";
    for (const [x, y, r] of [[-20, 4, 18], [0, -7, 24], [20, 4, 18], [0, 9, 20]]) {
      ovale(p, x, y, r, r);
      p.fill();
    }
    p.fillStyle = "#958ab3";
    ovale(p, -4, -10, 14, 10);
    p.fill();
    texture.refresh();
  }
  {
    const { texture, p } = toile(scene, "licorne-eclair", 26, 40);
    p.translate(12, 17);                   // le centre du nuage
    p.fillStyle = "#fff176";
    p.strokeStyle = "#ffb300";
    p.lineWidth = 1.5;
    p.beginPath();
    p.moveTo(2, -14);
    p.lineTo(-9, 4);
    p.lineTo(-1, 4);
    p.lineTo(-6, 20);
    p.lineTo(10, -2);
    p.lineTo(2, -2);
    p.closePath();
    p.fill();
    p.stroke();
    texture.refresh();
  }

  // La flèche arc-en-ciel : trois chevrons dont les couleurs défilent. Sept images, une animation.
  {
    const { texture, p } = toile(scene, "licorne-fleche", 7 * 96, 116);
    for (let image = 0; image < 7; image++) {
      p.save();
      p.translate(image * 96 + 48, 58);
      p.fillStyle = "rgba(255, 255, 255, 0.6)";
      p.beginPath();
      p.roundRect(-42, -52, 84, 104, 20);
      p.fill();
      p.lineCap = "round";
      p.lineJoin = "round";
      p.lineWidth = 9;
      for (let k = 0; k < 3; k++) {
        const x = -20 + k * 20;
        p.strokeStyle = ARC_EN_CIEL[(k + 7 - image) % 7];
        p.beginPath();
        p.moveTo(x - 9, -28);
        p.lineTo(x + 9, 0);
        p.lineTo(x - 9, 28);
        p.stroke();
      }
      p.restore();
      texture.add(image, 0, image * 96, 0, 96, 116);
    }
    texture.refresh();
    scene.anims.create({
      key: "licorne-fleche",
      frames: scene.anims.generateFrameNumbers("licorne-fleche", { start: 0, end: 6 }),
      frameRate: 8,
      repeat: -1,
    });
  }

  // Le halo du turbo : du blanc au doré transparent
  {
    const { texture, p } = toile(scene, "licorne-halo", 112, 112);
    const halo = p.createRadialGradient(56, 56, 5, 56, 56, 55);
    halo.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    halo.addColorStop(1, "rgba(255, 220, 120, 0)");
    p.fillStyle = halo;
    p.fillRect(0, 0, 112, 112);
    texture.refresh();
  }

  // Une petite étoile jaune : celles qui tournent autour d'une licorne étourdie, et celles du tableau de bord
  {
    const { texture, p } = toile(scene, "licorne-petite-etoile", 16, 16);
    p.fillStyle = "#ffe066";
    formeEtoile(p, 8, 8.5, 7, 0, 5, 0.45);
    p.fill();
    texture.refresh();
  }
  // Les étoiles du compteur (pleine ou vide), et la grande du bouton turbo au doigt
  const etoilesDuCompteur = [["licorne-compteur-etoile", true, 10], ["licorne-compteur-vide", false, 10], ["licorne-grande-etoile", true, 38]] as const;
  for (const [cle, plein, r] of etoilesDuCompteur) {
    const { texture, p } = toile(scene, cle, r * 2 + 6, r * 2 + 6);
    p.lineWidth = r / 5;
    p.lineJoin = "round";
    p.strokeStyle = "#e0b000";
    p.fillStyle = plein ? "#ffe066" : "rgba(255, 255, 255, 0.6)";
    formeEtoile(p, r + 3, r + 4, r, 0, 5, 0.48);
    p.fill();
    p.stroke();
    texture.refresh();
  }

  // La barre du turbo, en arc-en-ciel
  {
    const { texture, p } = toile(scene, "licorne-barre", 256, 6);
    p.fillStyle = degradeArcEnCiel(p, 0, 256);
    p.beginPath();
    p.roundRect(0, 0, 256, 6, 3);
    p.fill();
    texture.refresh();
  }

  // Un nuage qui passe dans le ciel des menus
  {
    const { texture, p } = toile(scene, "licorne-nuage", 150, 90);
    p.fillStyle = "rgba(255, 255, 255, 0.75)";
    for (const [x, y, r] of [[-40, 6, 26], [0, 0, 36], [42, 8, 24], [18, -14, 26]]) {
      ovale(p, 75 + x, 46 + y, r, r);
      p.fill();
    }
    texture.refresh();
  }

  // Le ciel des menus : un dégradé du bleu au rose, et un grand arc-en-ciel
  {
    const { texture, p } = toile(scene, "licorne-ciel", LARGEUR, HAUTEUR);
    const fond = p.createLinearGradient(0, 0, 0, HAUTEUR);
    fond.addColorStop(0, "#c9e8ff");
    fond.addColorStop(0.55, "#efdcff");
    fond.addColorStop(1, "#ffd6ec");
    p.fillStyle = fond;
    p.fillRect(0, 0, LARGEUR, HAUTEUR);
    p.lineWidth = 16;
    p.globalAlpha = 0.4;
    for (let i = 0; i < ARC_EN_CIEL.length; i++) {
      p.strokeStyle = ARC_EN_CIEL[i];
      p.beginPath();
      p.arc(LARGEUR / 2, 430, 400 - i * 16, Math.PI, 0);
      p.stroke();
    }
    texture.refresh();
  }
}

// ===== Les licornes : une feuille de 16 images de galop par apparence =====

export const IMAGES_DU_GALOP = 16;
const COLONNES = 4;
const CASE_L = 104;                        // la place d'une licorne, ailes et queue comprises
const CASE_H = 80;
// Une image de la feuille par huitième de foulée : la queue et les ailes font un tour en deux foulées (4π)
export const PHASE_PAR_IMAGE = (4 * Math.PI) / IMAGES_DU_GALOP;

// La feuille d'une apparence, dessinée « resolution » fois plus grand (pour rester nette quand on l'agrandit).
// Elle vient avec son animation de galop, « <clé>-galop ». Une clé imposée remplace l'ancienne feuille.
export function textureDeLicorne(scene: Phaser.Scene, look: Look, resolution = 2, cleImposee?: string): string {
  const cle = cleImposee ?? "licorne-look-" + resolution + "-" + empreinte(JSON.stringify(look));
  if (scene.textures.exists(cle) && !cleImposee) {
    return cle;
  }
  if (scene.anims.exists(cle + "-galop")) {
    scene.anims.remove(cle + "-galop");
  }
  const lignes = IMAGES_DU_GALOP / COLONNES;
  const { texture, p } = toile(scene, cle, CASE_L * resolution * COLONNES, CASE_H * resolution * lignes);
  for (let i = 0; i < IMAGES_DU_GALOP; i++) {
    const x = (i % COLONNES) * CASE_L * resolution;
    const y = Math.floor(i / COLONNES) * CASE_H * resolution;
    p.save();
    p.translate(x + CASE_L * resolution / 2, y + CASE_H * resolution / 2);
    p.scale(resolution, resolution);
    dessinerLicorne(p, look, i * PHASE_PAR_IMAGE);
    p.restore();
    texture.add(i, 0, x, y, CASE_L * resolution, CASE_H * resolution);
  }
  texture.refresh();
  scene.anims.create({
    key: cle + "-galop",
    frames: scene.anims.generateFrameNumbers(cle, { start: 0, end: IMAGES_DU_GALOP - 1 }),
    frameRate: 18,
    repeat: -1,
  });
  return cle;
}

// L'image du galop pour une phase donnée
export function imageDuGalop(phase: number): number {
  return Math.floor(phase / PHASE_PAR_IMAGE) % IMAGES_DU_GALOP;
}

function empreinte(texte: string): string {
  let h = 0;
  for (let i = 0; i < texte.length; i++) {
    h = (Math.imul(h, 31) + texte.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// ===== Les circuits =====

// Le décor entier dans une seule grande image. On ne garde que celui du circuit en cours :
// ce sont de grandes images (jusqu'à 3000 × 2300), lourdes pour un téléphone.
export function texturePiste(scene: Phaser.Scene, c: Circuit): string {
  const cle = "licorne-piste-" + c.modele.id + "-" + empreinte(JSON.stringify(c.points));
  for (const autre of scene.textures.getTextureKeys()) {
    if (autre.startsWith("licorne-piste-") && autre !== cle) {
      scene.textures.remove(autre);
    }
  }
  if (!scene.textures.exists(cle)) {
    const { texture, p } = toile(scene, cle, c.modele.largeur, c.modele.hauteur);
    peindreDecor(p, c);
    texture.refresh();
  }
  return cle;
}

// L'aperçu d'un circuit, dans une image à lui (on la redessine quand il change)
export function textureApercu(
  scene: Phaser.Scene, cle: string, monde: { largeur: number; hauteur: number }, points: Point[], w: number, h: number,
): string {
  let texture = scene.textures.exists(cle) ? scene.textures.get(cle) as Phaser.Textures.CanvasTexture : null;
  if (!texture || texture.width !== w || texture.height !== h) {
    texture = toile(scene, cle, w, h).texture;
  }
  const p = texture.getContext();
  p.clearRect(0, 0, w, h);
  dessinerApercu(p, monde, points, 0, 0, w, h);
  texture.refresh();
  return cle;
}

// La petite carte du tableau de bord : la route en lilas
export function textureCarte(scene: Phaser.Scene, c: Circuit, w: number, h: number): string {
  const cle = "licorne-carte";
  const { texture, p } = toile(scene, cle, w, h);
  p.scale(w / c.modele.largeur, h / c.modele.hauteur);
  p.lineJoin = "round";
  p.lineWidth = LARGEUR_ROUTE;
  p.strokeStyle = "#cdb2ff";
  p.stroke(cheminDeRoute(c.points));
  texture.refresh();
  return cle;
}

// Un cadre aux coins ronds : un fond, et une bordure en arc-en-ciel si on veut.
// Les boutons et les cartes des menus en sont faits.
export function textureCadre(
  scene: Phaser.Scene, w: number, h: number, rayon: number, fond: string, bordure = 0,
): string {
  const cle = ["licorne-cadre", w, h, rayon, fond, bordure].join("-");
  if (scene.textures.exists(cle)) {
    return cle;
  }
  const marge = bordure / 2 + 1;
  const { texture, p } = toile(scene, cle, w + 2 * marge, h + 2 * marge);
  p.translate(marge, marge);
  p.fillStyle = fond;
  p.beginPath();
  p.roundRect(0, 0, w, h, rayon);
  p.fill();
  if (bordure > 0) {
    p.strokeStyle = degradeArcEnCiel(p, 0, w);
    p.lineWidth = bordure;
    p.stroke();
  }
  texture.refresh();
  return cle;
}
