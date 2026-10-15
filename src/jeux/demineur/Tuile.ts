// Une case de la grille, telle qu'on la voit : un Container (fond, contenu, couvercle, marque) qui
// sait s'animer. Elle ne décide de rien : c'est la grille (grille.ts) qui sait ce qu'il y a dessous,
// la Tuile se contente de le montrer joliment, avec des tweens.

import Phaser from "phaser";
import type { Case, EtatDeCase } from "./grille";
import { TAILLE, FINESSE } from "./textures";

const S = 1 / FINESSE;                     // l'échelle des textures dessinées deux fois plus fines
const S_IMAGE = 1.5;                       // les images de l'atelier (24 pixels) dans une case de 48

export class Tuile extends Phaser.GameObjects.Container {
  private fond: Phaser.GameObjects.Image;
  private contenu?: Phaser.GameObjects.Image;
  private couvercle: Phaser.GameObjects.Image;
  private marque: Phaser.GameObjects.Image;
  private ouverte = false;
  enfoncee = false;                        // pour les tests : la case est-elle enfoncée ?

  constructor(scene: Phaser.Scene, readonly r: number, readonly c: number) {
    super(scene, c * TAILLE + TAILLE / 2, r * TAILLE + TAILLE / 2);
    // Le damier : deux tons qui alternent, pour suivre une rangée de l'œil
    this.fond = scene.add.image(0, 0, (r + c) % 2 ? "demineur-ouverte2" : "demineur-ouverte1").setScale(S);
    this.couvercle = scene.add.image(0, 0, "demineur-cachee").setScale(S);
    this.marque = scene.add.image(0, 0, "demineur-drapeau").setScale(S_IMAGE).setVisible(false);
    this.add([this.fond, this.couvercle, this.marque]);
    scene.add.existing(this);
  }

  // Une tuile jetée (nouvelle partie) au milieu d'une animation : ses tweens s'arrêtent avec elle
  protected preDestroy() {
    this.scene?.tweens.killTweensOf([this, ...this.list]);
    super.preDestroy();
  }

  // Au début d'une partie, les cases tombent en place l'une après l'autre
  apparaitre(delai: number) {
    this.setScale(0).setAlpha(0);
    this.scene.tweens.add({ targets: this, scale: 1, alpha: 1, delay: delai, duration: 260, ease: "Back.Out" });
  }

  // La case sous le doigt ou la souris s'enfonce un peu : on sent qu'on appuie
  enfoncer(oui: boolean) {
    if (this.ouverte) {
      return;
    }
    this.enfoncee = oui;
    this.couvercle.setScale(oui ? S * 0.88 : S).setTint(oui ? 0xc8d0ff : 0xffffff);
    this.marque.setScale(oui ? S_IMAGE * 0.88 : S_IMAGE);
  }

  // Un accord raté : la case fermée s'enfonce un instant, puis remonte (une minuterie de la scène : elle
  // attend avec la pause)
  flechir() {
    this.enfoncer(true);
    this.scene.time.delayedCall(180, () => {
      if (this.active) {
        this.enfoncer(false);
      }
    });
  }

  // Un accord raté : le chiffre tremble, comme une tête qui fait « non »
  trembler() {
    const x = this.c * TAILLE + TAILLE / 2;
    this.scene.tweens.killTweensOf(this);
    // killTweensOf coupe aussi l'apparition (une case de la cascade, pas encore à sa taille) : on la finit
    this.setX(x).setScale(1).setAlpha(1);
    this.scene.tweens.add({ targets: this, x: x + 4, duration: 45, yoyo: true, repeat: 2, ease: "Sine.InOut" });
  }

  // Le couvercle s'envole, le contenu apparaît en rebondissant
  ouvrir(laCase: Case, delai: number, explosee = false) {
    if (this.ouverte) {
      return;
    }
    this.ouverte = true;
    this.enfoncer(false);
    this.marque.setVisible(false);
    if (explosee) {
      this.fond.setTexture("demineur-explosee");
    }
    if (laCase.mine) {
      this.contenu = this.scene.add.image(0, 0, "demineur-mine").setScale(S_IMAGE);
    } else if (laCase.autour > 0) {
      this.contenu = this.scene.add.image(0, 0, "demineur-chiffre-" + laCase.autour).setScale(S);
    }
    if (this.contenu) {
      this.addAt(this.contenu, 1);         // entre le fond et le couvercle
      const echelle = this.contenu.scale;
      this.contenu.setScale(0);
      this.scene.tweens.add({ targets: this.contenu, scale: echelle, delay: delai + 60, duration: 220, ease: "Back.Out" });
    }
    this.scene.tweens.add({
      targets: this.couvercle,
      scale: S * 0.3,
      alpha: 0,
      angle: Phaser.Math.Between(-25, 25),
      delay: delai,
      duration: 180,
      ease: "Quad.In",
      onComplete: () => this.couvercle.setVisible(false),
    });
  }

  // Drapeau, point d'interrogation, ou rien : la marque saute en place
  marquer(etat: EtatDeCase) {
    if (etat === "drapeau" || etat === "question") {
      this.marque.setTexture(etat === "drapeau" ? "demineur-drapeau" : "demineur-question");
      const echelle = etat === "drapeau" ? S_IMAGE : S;
      this.marque.setVisible(true).setScale(echelle * 1.8).setAngle(etat === "drapeau" ? -20 : 0);
      this.scene.tweens.add({ targets: this.marque, scale: echelle, angle: 0, duration: 220, ease: "Back.Out" });
    } else {
      this.marque.setVisible(false);
    }
  }

  // Un drapeau posé là où il n'y avait pas de mine : barré
  barrer(delai: number) {
    const croix = this.scene.add.image(0, 0, "demineur-croix").setScale(S * 2).setAlpha(0);
    this.add(croix);
    this.scene.tweens.add({ targets: croix, scale: S, alpha: 1, delay: delai, duration: 200, ease: "Back.Out" });
  }

  // La victoire : une petite vague qui fait sautiller la case
  sautiller(delai: number) {
    this.scene.tweens.add({ targets: this, scale: 1.15, delay: delai, duration: 120, yoyo: true, ease: "Quad.Out" });
  }
}
