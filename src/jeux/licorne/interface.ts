// Ce que les écrans des licornes partagent : les textes bordés de blanc, les boutons, le ciel des menus,
// les confettis, les messages qui s'affichent puis s'effacent, le bouton du son.

import Phaser from "phaser";
import { ARC_EN_CIEL, COULEURS, POLICE_LICORNE } from "./reglages";
import { textureCadre } from "./textures";
import { changerReglageSon, ICONES_REGLAGE_SON, sons } from "./sons";
import { preferences } from "./sauvegarde";
import { LARGEUR, HAUTEUR } from "../../socle/style";
import { estTactile } from "../../socle/tactile";
import { surTouche } from "../../socle/clavier";

export const enNombre = (couleur: string) => parseInt(couleur.slice(1), 16);
export const ARC_EN_CIEL_NOMBRES = ARC_EN_CIEL.map(enNombre);

// Le texte d'une touche du clavier : rien au doigt
export function touche(texte: string): string {
  return estTactile() ? "" : texte;
}

interface OptionsTexte {
  contour?: boolean | string;              // vrai : bordé de blanc ; une couleur : bordé de cette couleur
  origine?: [number, number];
  gras?: boolean;
}

// Un texte dans la police des licornes, bordé de blanc comme dans l'ancien jeu
export function ecrire(
  scene: Phaser.Scene, x: number, y: number, contenu: string, taille: number, couleur: string, options: OptionsTexte = {},
): Phaser.GameObjects.Text {
  const { contour = false, origine = [0.5, 0.5], gras = true } = options;
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: POLICE_LICORNE,
    fontSize: taille + "px",
    fontStyle: gras ? "bold" : "normal",
    color: couleur,
  };
  if (contour) {
    style.stroke = typeof contour === "string" ? contour : "#ffffff";
    style.strokeThickness = Math.max(3, taille / 5);
  }
  // Un peu de marge : le contour et les lettres rondes de Fredoka débordent un peu
  return scene.add.text(x, y, contenu, style).setOrigin(...origine).setPadding(4, 2, 4, 2);
}

// Remplir un texte d'un dégradé arc-en-ciel, de gauche à droite.
// À refaire après un setText : le dégradé est calé sur la largeur du texte.
export function arcEnCiel(texte: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
  const degrade = texte.context.createLinearGradient(0, 0, texte.width, 0);
  ARC_EN_CIEL.forEach((c, i) => degrade.addColorStop(i / (ARC_EN_CIEL.length - 1), c));
  return texte.setFill(degrade);
}

export function titre(scene: Phaser.Scene, y: number, contenu: string, taille = 40): Phaser.GameObjects.Text {
  return arcEnCiel(ecrire(scene, LARGEUR / 2, y, contenu, taille, "#ff5e9e", { contour: true }));
}

// Un bouton en forme de pilule. Discret : sans bordure arc-en-ciel, pour « Retour », « Menu »...
export function bouton(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, libelle: string, action: () => void, discret = false,
): Phaser.GameObjects.Container {
  const fond = scene.add.image(0, 0, textureCadre(scene, w, h, h / 2, discret ? "rgba(255,255,255,0.6)" : "#ffffff", discret ? 0 : 3));
  const texte = ecrire(scene, 0, 1, libelle, Math.min(21, h * 0.46), discret ? COULEURS.texteDoux : COULEURS.rose);
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

// Les confettis de l'arc-en-ciel, qui tombent du haut de l'écran en tournant.
// frequence : un confetti toutes les tant de millisecondes (0 : seulement quand on lance une pluie).
export function confettis(scene: Phaser.Scene, frequence: number): Phaser.GameObjects.Particles.ParticleEmitter {
  type Confetti = Phaser.GameObjects.Particles.Particle & { tourne?: number };
  return scene.add.particles(0, 0, "licorne-particules", {
    frame: ["rond", "etoile"],
    x: { min: 0, max: LARGEUR },
    y: { min: -80, max: -10 },
    speedX: { min: -40, max: 40 },
    speedY: { min: 60, max: 160 },
    scale: { min: 0.6, max: 1.4 },
    // Chaque confetti tourne à sa vitesse : on la choisit à sa naissance, on l'applique à chaque image
    rotate: {
      onEmit: (p?: Confetti) => {
        if (p) {
          p.tourne = Phaser.Math.FloatBetween(-340, 340);
        }
        return Phaser.Math.Between(0, 360);
      },
      onUpdate: (p: Confetti, _cle: string, t: number, valeur: number) => valeur + (p.tourne ?? 0) * t * 0.03,
    },
    tint: ARC_EN_CIEL_NOMBRES,
    lifespan: 8000,
    frequency: frequence > 0 ? frequence : -1,
    maxParticles: 400,
  });
}

// Le ciel des menus : le dégradé, l'arc-en-ciel, des nuages qui passent, quelques confettis
export function fondDeMenu(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  scene.add.image(0, 0, "licorne-ciel").setOrigin(0);
  for (let i = 0; i < 6; i++) {
    const y = 80 + (i * 97) % 380;
    const vitesse = 12 + i * 5;                       // pixels par seconde
    const depart = ((i * 230) % (LARGEUR + 300)) - 150;
    const nuage = scene.add.image(depart, y, "licorne-nuage");
    // Un tween qui traverse l'écran, puis un autre qui recommence de la gauche, sans fin
    const traverser = (de: number) => {
      nuage.x = de;
      scene.tweens.add({
        targets: nuage,
        x: LARGEUR + 150,
        duration: (LARGEUR + 150 - de) / vitesse * 1000,
        onComplete: () => traverser(-150),
      });
    };
    traverser(depart);
  }
  return confettis(scene, 200);
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

  vider() {
    for (const a of this.liste) {
      a.fin?.remove();
      a.texte.destroy();
    }
    this.liste = [];
  }
}

// Le petit bouton du son, en bas à droite (et la touche M) : son et musique, son sans musique, son coupé
export function boutonSon(scene: Phaser.Scene, annonces?: Annonces) {
  const taille = estTactile() ? 22 : 15;
  const icone = ecrire(scene, LARGEUR - 16, HAUTEUR - 16, "", taille, COULEURS.texteDoux, { origine: [1, 0.5] });
  const montrer = () => icone.setText(ICONES_REGLAGE_SON[preferences.son] + touche(" M"));
  montrer();
  const changer = () => {
    const nom = changerReglageSon();
    montrer();
    annonces?.annoncer(nom, COULEURS.texteDoux);
    sons.menu();
  };
  zone(scene, LARGEUR - 90, HAUTEUR - 44, 90, 44, changer);
  surTouche(scene, "M", changer);
}
