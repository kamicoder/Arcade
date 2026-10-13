// Ce que les écrans de la course partagent : les textes, les boutons, les cadres, les messages qui
// s'affichent puis s'effacent, le bouton du son, le portrait d'un véhicule. Tout prend l'apparence du
// thème en cours (son habillage : police, couleurs, bordures).

import Phaser from "phaser";
import type { Apparence } from "./theme";
import type { Point } from "./circuits";
import { themeEnCours, preferences } from "./sauvegarde";
import { changerReglageSon, ICONES_REGLAGE_SON, jouer } from "./son";
import { LARGEUR, HAUTEUR } from "../../socle/style";
import { estTactile } from "../../socle/tactile";
import { surTouche } from "../../socle/clavier";

const habillage = () => themeEnCours().habillage;

export const enNombre = (couleur: string) => parseInt(couleur.slice(1, 7), 16);

// Une couleur #rrvvbb un peu plus sombre
export function assombrir(hex: string, part: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const canal = (v: number) => Math.max(0, Math.round(v * (1 - part))).toString(16).padStart(2, "0");
  return "#" + canal((n >> 16) & 255) + canal((n >> 8) & 255) + canal(n & 255);
}

// Le texte d'une touche du clavier : rien au doigt
export function touche(texte: string): string {
  return estTactile() ? "" : texte;
}

interface OptionsTexte {
  contour?: boolean | string;              // vrai : bordé de la couleur du thème ; une couleur : bordé de celle-ci
  origine?: [number, number];
  gras?: boolean;
}

// Un texte dans la police du thème
export function ecrire(
  scene: Phaser.Scene, x: number, y: number, contenu: string, taille: number, couleur: string, options: OptionsTexte = {},
): Phaser.GameObjects.Text {
  const { contour = false, origine = [0.5, 0.5], gras = true } = options;
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: habillage().police,
    fontSize: taille + "px",
    fontStyle: gras ? "bold" : "normal",
    color: couleur,
  };
  if (contour) {
    style.stroke = typeof contour === "string" ? contour : habillage().contour;
    style.strokeThickness = Math.max(3, taille / 5);
  }
  // Un peu de marge : le contour et les lettres rondes débordent un peu
  return scene.add.text(x, y, contenu, style).setOrigin(...origine).setPadding(4, 2, 4, 2);
}

// Un dégradé de gauche à droite, aux couleurs des bordures du thème (l'arc-en-ciel des licornes)
export function degrade(p: CanvasRenderingContext2D, x1: number, x2: number, couleurs = habillage().degrade): CanvasGradient {
  const d = p.createLinearGradient(x1, 0, x2, 0);
  couleurs.forEach((c, i) => d.addColorStop(i / Math.max(1, couleurs.length - 1), c));
  return d;
}

export function titre(scene: Phaser.Scene, y: number, contenu: string, taille = 40): Phaser.GameObjects.Text {
  return habillage().titre(ecrire(scene, LARGEUR / 2, y, contenu, taille, habillage().couleurs.accent, { contour: true }));
}

// Un cadre aux coins ronds : un fond, et une bordure dégradée si on veut.
// Les boutons et les cartes des menus en sont faits.
export function textureCadre(scene: Phaser.Scene, w: number, h: number, rayon: number, fond: string, bordure = 0): string {
  const couleurs = habillage().degrade;
  const cle = ["course-cadre", w, h, rayon, fond, bordure, couleurs.join("")].join("-");
  if (scene.textures.exists(cle)) {
    return cle;
  }
  const marge = bordure / 2 + 1;
  const texture = scene.textures.createCanvas(cle, Math.ceil(w + 2 * marge), Math.ceil(h + 2 * marge))!;
  const p = texture.getContext();
  p.translate(marge, marge);
  p.fillStyle = fond;
  p.beginPath();
  p.roundRect(0, 0, w, h, rayon);
  p.fill();
  if (bordure > 0) {
    p.strokeStyle = degrade(p, 0, w, couleurs);
    p.lineWidth = bordure;
    p.stroke();
  }
  texture.refresh();
  return cle;
}

// L'aperçu d'un circuit (choix du circuit, éditeur), peint par le thème dans une image à lui
export function textureApercu(
  scene: Phaser.Scene, cle: string, monde: { largeur: number; hauteur: number }, points: Point[], w: number, h: number,
): string {
  let texture = scene.textures.exists(cle) ? scene.textures.get(cle) as Phaser.Textures.CanvasTexture : null;
  if (!texture || texture.width !== w || texture.height !== h) {
    if (texture) {
      scene.textures.remove(cle);
    }
    texture = scene.textures.createCanvas(cle, w, h)!;
  }
  const p = texture.getContext();
  p.save();
  p.clearRect(0, 0, w, h);
  themeEnCours().peindreLApercu(p, monde, points, w, h);
  p.restore();
  texture.refresh();
  return cle;
}

// Un bouton en forme de pilule. Discret : sans bordure, pour « Retour », « Menu »...
export function bouton(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, libelle: string, action: () => void, discret = false,
): Phaser.GameObjects.Container {
  const c = habillage().couleurs;
  const fond = scene.add.image(0, 0, textureCadre(scene, w, h, h / 2, discret ? c.fondCarte : c.fondChoisi, discret ? 0 : 3));
  const texte = ecrire(scene, 0, 1, libelle, Math.min(21, h * 0.46), discret ? c.texteDoux : c.accent);
  const boite = scene.add.container(x + w / 2, y + h / 2, [fond, texte]).setSize(w, h);
  boite.setInteractive({ useHandCursor: true });
  boite.on("pointerover", () => scene.tweens.add({ targets: boite, scale: 1.05, duration: 120, ease: "Back.Out" }));
  boite.on("pointerout", () => scene.tweens.add({ targets: boite, scale: 1, duration: 120 }));
  boite.on("pointerup", action);
  return boite;
}

// Une zone qu'on touche, invisible
export function zone(scene: Phaser.Scene, x: number, y: number, w: number, h: number, action: () => void) {
  return scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).on("pointerup", action);
}

// 1er ou 1re, 2e, 3e... (selon le thème : des voitures, des licornes)
export function rangTexte(rang: number): string {
  return rang === 1 ? themeEnCours().mots.premier : rang + "e";
}

// La couleur d'un nom : celle du véhicule, ou celle du texte si elle ne se lirait pas (blanc sur blanc)
export function couleurDuNom(apparence: Apparence): string {
  return themeEnCours().couleur(apparence);
}

// Un véhicule dans un menu : tourné vers le haut (les cartes), ou vers la droite (les classements).
// S'il est animé (le galop), il bouge.
export function portrait(
  scene: Phaser.Scene, x: number, y: number, apparence: Apparence, echelle: number, versLeHaut = true,
): Phaser.GameObjects.Sprite {
  const dessin = themeEnCours().vehicule;
  const cle = dessin.texture(scene, apparence);
  const sprite = scene.add.sprite(x, y, cle, 0)
    .setScale(echelle * dessin.echellePortrait / dessin.resolution).setRotation(versLeHaut ? -Math.PI / 2 : 0);
  if (dessin.anime) {
    sprite.play({ key: cle + "-anim", startFrame: Phaser.Math.Between(0, 15) });
  }
  return sprite;
}

// ===== Les messages : ils apparaissent, restent un peu, puis s'effacent =====

interface Annonce {
  texte: Phaser.GameObjects.Text;
  colonne: number;
  taille: number;
  fin?: Phaser.Time.TimerEvent;
}

export class Annonces {
  private liste: Annonce[] = [];

  // Une colonne par vue de course (et une pour tout l'écran) : où elle est, en x, et la taille des lettres
  constructor(private scene: Phaser.Scene, private colonnes: { x: number; taille: number }[], private haut = 150) {}

  annoncer(contenu: string, couleur: string, colonne = this.colonnes.length - 1) {
    // Le même message déjà affiché : on le prolonge au lieu de l'empiler
    const pareille = this.liste.find((a) => a.texte.text === contenu && a.colonne === colonne);
    if (pareille) {
      this.programmerLaFin(pareille);
      return;
    }
    const { x, taille } = this.colonnes[colonne];
    const texte = ecrire(this.scene, x, 0, contenu, taille, couleur, { contour: true }).setDepth(100).setScale(0.6);
    this.scene.tweens.add({ targets: texte, scale: 1, duration: 250, ease: "Back.Out" });
    const annonce = { texte, colonne, taille };
    this.liste.push(annonce);
    this.programmerLaFin(annonce);
    this.ranger();
  }

  // 1,3 seconde à l'écran, puis une demi-seconde pour s'effacer
  private programmerLaFin(annonce: Annonce) {
    annonce.fin?.remove();
    this.scene.tweens.killTweensOf(annonce.texte);
    annonce.texte.setAlpha(1).setScale(1);
    annonce.fin = this.scene.time.delayedCall(1300, () => {
      this.scene.tweens.add({
        targets: annonce.texte,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          annonce.texte.destroy();
          this.liste = this.liste.filter((a) => a !== annonce);
          this.ranger();
        },
      });
    });
  }

  // Les messages d'une même colonne s'empilent les uns sous les autres
  private ranger() {
    const hauteurs = this.colonnes.map(() => this.haut);
    for (const a of this.liste) {
      a.texte.y = hauteurs[a.colonne];
      hauteurs[a.colonne] += a.taille + 8;
    }
  }
}

// Le petit bouton du son, en bas à droite (et la touche M) : son et musique, son sans musique, son coupé
export function boutonSon(scene: Phaser.Scene, annonces?: Annonces) {
  const taille = estTactile() ? 22 : 15;
  const icone = ecrire(scene, LARGEUR - 16, HAUTEUR - 16, "", taille, habillage().couleurs.texteDoux, { origine: [1, 0.5] });
  const montrer = () => icone.setText(ICONES_REGLAGE_SON[preferences.son] + touche(" M"));
  montrer();
  const changer = () => {
    const nom = changerReglageSon();
    montrer();
    annonces?.annoncer(nom, habillage().couleurs.texteDoux);
    jouer(scene, "menu");
  };
  zone(scene, LARGEUR - 90, HAUTEUR - 44, 90, 44, changer);
  surTouche(scene, "M", changer);
}
