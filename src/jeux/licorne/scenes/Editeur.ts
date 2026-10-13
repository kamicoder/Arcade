// L'éditeur : un circuit à soi, dessiné à la souris ou au doigt.
// Le monde entier (2600 × 1800) est montré en petit. Toucher le ciel pose un point (tout près de la
// route, il s'y glisse entre deux autres), glisser un point le déplace, le clic droit l'enlève.
// La route arc-en-ciel se dessine à mesure.

import Phaser from "phaser";
import { MONDE_EDITEUR, POINTS_MIN_EDITEUR, POINTS_MAX_EDITEUR } from "../donnees";
import { COULEURS } from "../reglages";
import type { Point } from "../circuits";
import { circuitPerso, garderCircuitPerso } from "../sauvegarde";
import { sons } from "../sons";
import { textureApercu } from "../textures";
import { fondDeMenu, titre, ecrire, bouton, Annonces } from "../interface";
import { LARGEUR } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { estTactile } from "../../../socle/tactile";
import { fonduPuis } from "../../../socle/retour";

const ECHELLE = 0.26;
const CARTE = {
  x: Math.round((LARGEUR - MONDE_EDITEUR.largeur * ECHELLE) / 2),
  y: 64,
  w: Math.round(MONDE_EDITEUR.largeur * ECHELLE),
  h: Math.round(MONDE_EDITEUR.hauteur * ECHELLE),
};
const MARGE = 230;                         // les points restent loin du bord du monde

export class Editeur extends Phaser.Scene {
  points: Point[] = [];                    // en coordonnées du monde (public : les tests le lisent)
  private apercu!: Phaser.GameObjects.Image;
  private ronds!: Phaser.GameObjects.Container;
  private compte!: Phaser.GameObjects.Text;
  private vide!: Phaser.GameObjects.Text;
  private annonces!: Annonces;
  private glisse = -1;                     // le point qu'on déplace, ou -1
  private pres = 13;                       // en pixels de l'écran : assez près pour toucher un point, ou la route
  private rayon = 9;                       // la taille d'un point
  private survol = -1;
  private parti = false;

  constructor() {
    super("licorne-editeur");
  }

  create() {
    this.points = (circuitPerso()?.points ?? []).map((p) => ({ x: p.x, y: p.y }));
    this.glisse = -1;
    this.survol = -1;
    this.parti = false;
    // Un doigt est moins précis qu'une souris : au doigt, les points sont plus gros et plus faciles à attraper
    this.pres = estTactile() ? 24 : 13;
    this.rayon = estTactile() ? 12 : 9;

    this.cameras.main.fadeIn(250);
    fondDeMenu(this);
    titre(this, 20, "Dessine ton circuit", 26);
    ecrire(this, LARGEUR / 2, 46, estTactile()
      ? "Touche : un point (sur la route : il s'y glisse)  ·  Glisse un point pour le déplacer"
      : "Clic : un point (sur la route : il s'y glisse)  ·  Glisser : déplacer  ·  Clic droit : effacer", 13, COULEURS.texte);
    bouton(this, 10, 4, 125, 32, "✕ Annuler", () => this.revenir(), true);
    bouton(this, LARGEUR - 270, 4, 125, 32, "↶ Effacer", () => this.effacerLeDernier(), true);
    bouton(this, LARGEUR - 135, 4, 125, 32, "✓ Garder", () => this.garder());

    // Le ciel du monde en petit : c'est lui qu'on touche pour poser un point
    this.apercu = this.add.image(CARTE.x, CARTE.y, "__DEFAULT").setOrigin(0);
    this.add.zone(CARTE.x, CARTE.y, CARTE.w, CARTE.h).setOrigin(0).setInteractive({ cursor: "crosshair" })
      .on("pointerdown", (pointeur: Phaser.Input.Pointer) => this.poser(pointeur));
    this.ronds = this.add.container(0, 0);
    this.compte = ecrire(this, CARTE.x + 12, CARTE.y + 16, "", 14, COULEURS.texteDoux, { origine: [0, 0.5] });
    this.vide = ecrire(this, LARGEUR / 2, CARTE.y + 234,
      (estTactile() ? "Touche" : "Clique") + " pour poser le premier point : ce sera le départ !", 22, COULEURS.texteDoux);
    this.annonces = new Annonces(this, [{ x: LARGEUR / 2, taille: 40 }], 180);

    // Pas de menu du navigateur au clic droit : ici, le clic droit enlève un point. (Phaser a
    // input.mouse.disableContextMenu(), mais son écouteur n'est jamais retiré : on pose le nôtre.)
    const sansMenu = (evenement: Event) => evenement.preventDefault();
    this.game.canvas.addEventListener("contextmenu", sansMenu);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.canvas.removeEventListener("contextmenu", sansMenu));

    this.input.on("pointermove", (pointeur: Phaser.Input.Pointer) => {
      if (this.glisse >= 0) {
        this.points[this.glisse] = this.versLeMonde(pointeur.x, pointeur.y);
        this.redessiner();
      } else if (this.pointSous(pointeur.x, pointeur.y) !== this.survol) {
        this.redessiner();
      }
    });
    this.input.on("pointerup", () => {
      if (this.glisse >= 0) {
        this.glisse = -1;
        this.redessiner();
      }
    });

    surTouche(this, "ESC", () => this.revenir());
    surTouche(this, "BACKSPACE", () => this.effacerLeDernier());
    surTouche(this, "DELETE", () => this.effacerLeDernier());
    surTouche(this, "ENTER", () => this.garder());

    this.redessiner();
  }

  // ===== Les coordonnées : le monde (la vraie taille du circuit) et l'écran (la carte en petit) =====

  private versLEcran(p: Point): Point {
    return { x: CARTE.x + p.x * ECHELLE, y: CARTE.y + p.y * ECHELLE };
  }

  private versLeMonde(x: number, y: number): Point {
    return {
      x: Math.round(Phaser.Math.Clamp((x - CARTE.x) / ECHELLE, MARGE, MONDE_EDITEUR.largeur - MARGE)),
      y: Math.round(Phaser.Math.Clamp((y - CARTE.y) / ECHELLE, MARGE, MONDE_EDITEUR.hauteur - MARGE)),
    };
  }

  private pointSous(x: number, y: number): number {
    for (let i = this.points.length - 1; i >= 0; i--) {
      const e = this.versLEcran(this.points[i]);
      if (Math.hypot(e.x - x, e.y - y) < this.pres) {
        return i;
      }
    }
    return -1;
  }

  // Le côté du circuit le plus proche, s'il est tout près : on y glissera le nouveau point
  private coteSous(x: number, y: number): number {
    const n = this.points.length;
    let meilleur = -1;
    let distanceMin = this.pres + 1;
    for (let i = 0; i < n && n >= 2; i++) {
      const a = this.versLEcran(this.points[i]);
      const b = this.versLEcran(this.points[(i + 1) % n]);
      // Le point du segment [a, b] le plus proche : t de 0 (en a) à 1 (en b)
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Phaser.Math.Clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
      if (d < distanceMin) {
        distanceMin = d;
        meilleur = i;
      }
    }
    return meilleur;
  }

  // ===== La souris et les doigts =====

  private poser(pointeur: Phaser.Input.Pointer) {
    const sous = this.pointSous(pointeur.x, pointeur.y);
    if (pointeur.rightButtonDown()) {
      if (sous >= 0) {
        this.points.splice(sous, 1);
        sons.pouf();
        this.redessiner();
      }
      return;
    }
    if (sous >= 0) {
      this.glisse = sous;                  // on attrape un point déjà là
      return;
    }
    if (this.points.length >= POINTS_MAX_EDITEUR) {
      this.annonces.annoncer(POINTS_MAX_EDITEUR + " points au plus", COULEURS.rose);
      sons.non();
      return;
    }
    const cote = this.coteSous(pointeur.x, pointeur.y);
    const p = this.versLeMonde(pointeur.x, pointeur.y);
    if (cote >= 0 && this.points.length >= 3) {
      this.points.splice(cote + 1, 0, p);
      this.glisse = cote + 1;
    } else {
      this.points.push(p);
      this.glisse = this.points.length - 1;
    }
    sons.menu();
    this.redessiner();
  }

  private effacerLeDernier() {
    if (this.points.length > 0) {
      this.points.pop();
      sons.pouf();
      this.redessiner();
    }
  }

  private redessiner() {
    this.apercu.setTexture(textureApercu(this, "licorne-apercu-editeur", MONDE_EDITEUR, this.points, CARTE.w, CARTE.h));
    const pointeur = this.input.activePointer;
    this.survol = this.pointSous(pointeur.x, pointeur.y);
    this.ronds.removeAll(true);
    this.points.forEach((p, i) => {
      const e = this.versLEcran(p);
      const grand = i === this.survol || i === this.glisse;
      this.ronds.add(this.add.circle(e.x, e.y, this.rayon + (grand ? 3 : 0), i === 0 ? 0xff5e9e : 0x8a5cd6).setStrokeStyle(3, 0xffffff));
      this.ronds.add(ecrire(this, e.x, e.y + 1, String(i + 1), 10, "#ffffff"));
      if (i === 0) {
        this.ronds.add(ecrire(this, e.x, e.y - 20, "Départ", 14, COULEURS.rose, { contour: true }));
      }
    });
    const plein = this.points.length >= POINTS_MAX_EDITEUR;
    this.compte.setText(this.points.length + " / " + POINTS_MAX_EDITEUR + " points").setColor(plein ? COULEURS.rose : COULEURS.texteDoux);
    this.vide.setVisible(this.points.length === 0);
  }

  private garder() {
    if (this.parti) {
      return;
    }
    if (this.points.length < POINTS_MIN_EDITEUR) {
      this.annonces.annoncer("Il faut au moins " + POINTS_MIN_EDITEUR + " points", COULEURS.rose);
      sons.non();
      return;
    }
    this.parti = true;
    garderCircuitPerso(this.points);
    sons.record();
    fonduPuis(this, () => this.scene.start("licorne-menu", { annonce: "Circuit enregistré !" }));
  }

  private revenir() {
    if (!this.parti) {
      this.parti = true;
      fonduPuis(this, () => this.scene.start("licorne-menu"));
    }
  }
}
