// L'éditeur : un circuit à soi, dessiné à la souris ou au doigt.
// Le monde entier (2600 × 1800) est montré en petit. Toucher le fond pose un point (tout près de la route,
// il s'y glisse entre deux autres), glisser un point le déplace, le clic droit l'enlève (au doigt : le
// toucher sans le glisser). La route se dessine à mesure, peinte par le thème.

import Phaser from "phaser";
import { MONDE_EDITEUR, POINTS_MIN, POINTS_MAX, ID_CIRCUIT_DESSINE, type Point } from "../circuits";
import { themeEnCours, pointsDessines, garderCircuitDessine, garderCircuitChoisi } from "../sauvegarde";
import { oublierLesPistes } from "../piste";
import { jouer } from "../son";
import { titre, ecrire, bouton, Annonces, textureApercu, enNombre } from "../interface";
import { LARGEUR } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { estTactile } from "../../../socle/tactile";
import { fonduPuis } from "../../../socle/retour";

const ECHELLE = 0.26;
export const CARTE = {
  x: Math.round((LARGEUR - MONDE_EDITEUR.largeur * ECHELLE) / 2),
  y: 64,
  w: Math.round(MONDE_EDITEUR.largeur * ECHELLE),
  h: Math.round(MONDE_EDITEUR.hauteur * ECHELLE),
};

export class Editeur extends Phaser.Scene {
  points: Point[] = [];                    // en coordonnées du monde (public : les tests le lisent)
  private apercu!: Phaser.GameObjects.Image;
  private ronds!: Phaser.GameObjects.Container;
  private compte!: Phaser.GameObjects.Text;
  private vide!: Phaser.GameObjects.Text;
  private annonces!: Annonces;
  private glisse = -1;                     // le point qu'on déplace, ou -1
  private tenu = -1;                       // le point déjà là sur lequel le doigt s'est posé, ou -1
  private aBouge = false;                  // vrai si ce point a vraiment été glissé
  private pres = 13;                       // en pixels de l'écran : assez près pour toucher un point, ou la route
  private rayon = 9;                       // la taille d'un point
  private survol = -1;
  private parti = false;

  constructor() {
    super("course-editeur");
  }

  create() {
    const theme = themeEnCours();
    const c = theme.habillage.couleurs;
    this.points = pointsDessines() ?? [];
    this.glisse = -1;
    this.tenu = -1;
    this.survol = -1;
    this.parti = false;
    // Un doigt est moins précis qu'une souris : au doigt, les points sont plus gros et plus faciles à attraper
    this.pres = estTactile() ? 24 : 13;
    this.rayon = estTactile() ? 12 : 9;

    this.cameras.main.fadeIn(250);
    theme.habillage.fond(this);
    titre(this, 20, "Dessine ton circuit", 26);
    ecrire(this, LARGEUR / 2, 46, estTactile()
      ? "Touche : un point (sur la route : il s'y glisse)  ·  Glisse-le pour le déplacer  ·  Touche-le pour l'enlever"
      : "Clic : un point (sur la route : il s'y glisse)  ·  Glisser : déplacer  ·  Clic droit : effacer", 13, c.texte);
    bouton(this, 10, 4, 125, 32, "✕ Annuler", () => this.revenir(), true);
    bouton(this, LARGEUR - 270, 4, 125, 32, "↶ Effacer", () => this.effacerLeDernier(), true);
    bouton(this, LARGEUR - 135, 4, 125, 32, "✓ Garder", () => this.garder());

    // Le monde en petit : c'est lui qu'on touche pour poser un point
    this.apercu = this.add.image(CARTE.x, CARTE.y, "__DEFAULT").setOrigin(0);
    this.add.zone(CARTE.x, CARTE.y, CARTE.w, CARTE.h).setOrigin(0).setInteractive({ cursor: "crosshair" })
      .on("pointerdown", (pointeur: Phaser.Input.Pointer) => this.poser(pointeur));
    this.ronds = this.add.container(0, 0);
    this.compte = ecrire(this, CARTE.x + 12, CARTE.y + 16, "", 14, c.texteDoux, { origine: [0, 0.5] });
    this.vide = ecrire(this, LARGEUR / 2, CARTE.y + 234,
      (estTactile() ? "Touche" : "Clique") + " pour poser le premier point : ce sera le départ !", 22, c.texteDoux, { contour: true });
    this.annonces = new Annonces(this, [{ x: LARGEUR / 2, taille: 40 }], 180);

    // Pas de menu du navigateur au clic droit : ici, le clic droit enlève un point. (Phaser a
    // input.mouse.disableContextMenu(), mais son écouteur n'est jamais retiré : on pose le nôtre.)
    const sansMenu = (evenement: Event) => evenement.preventDefault();
    this.game.canvas.addEventListener("contextmenu", sansMenu);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.canvas.removeEventListener("contextmenu", sansMenu));

    this.input.on("pointermove", (pointeur: Phaser.Input.Pointer) => {
      if (this.glisse >= 0) {
        // Un tout petit tremblement du doigt n'est pas un glissé : il commence après 8 pixels
        if (!this.aBouge && Phaser.Math.Distance.Between(pointeur.downX, pointeur.downY, pointeur.x, pointeur.y) < 8) {
          return;
        }
        this.aBouge = true;
        this.points[this.glisse] = this.versLeMonde(pointeur.x, pointeur.y);
        this.redessiner();
      } else if (this.pointSous(pointeur.x, pointeur.y) !== this.survol) {
        this.redessiner();
      }
    });
    this.input.on("pointerup", (pointeur: Phaser.Input.Pointer) => {
      // Au doigt, pas de clic droit : toucher un point sans le glisser l'enlève. Un point qu'on vient
      // de poser n'est pas « tenu » : il reste.
      if (estTactile() && this.tenu >= 0 && !this.aBouge) {
        this.points.splice(this.tenu, 1);
        jouer(this, "non");
      }
      this.tenu = -1;
      if (this.glisse >= 0 || pointeur.wasTouch) {
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
    const marge = themeEnCours().margeEditeur;
    return {
      x: Math.round(Phaser.Math.Clamp((x - CARTE.x) / ECHELLE, marge, MONDE_EDITEUR.largeur - marge)),
      y: Math.round(Phaser.Math.Clamp((y - CARTE.y) / ECHELLE, marge, MONDE_EDITEUR.hauteur - marge)),
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
    const couleurs = themeEnCours().habillage.couleurs;
    const sous = this.pointSous(pointeur.x, pointeur.y);
    this.aBouge = false;
    if (pointeur.rightButtonDown()) {
      if (sous >= 0) {
        this.points.splice(sous, 1);
        jouer(this, "non");
        this.redessiner();
      }
      return;
    }
    if (sous >= 0) {
      this.glisse = sous;                  // on attrape un point déjà là
      this.tenu = sous;
      return;
    }
    if (this.points.length >= POINTS_MAX) {
      this.annonces.annoncer(POINTS_MAX + " points au plus", couleurs.accent);
      jouer(this, "non");
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
    jouer(this, "menu");
    this.redessiner();
  }

  private effacerLeDernier() {
    if (this.points.length > 0) {
      this.points.pop();
      jouer(this, "non");
      this.redessiner();
    }
  }

  private redessiner() {
    const c = themeEnCours().habillage.couleurs;
    this.apercu.setTexture(textureApercu(this, "course-apercu-editeur", MONDE_EDITEUR, this.points, CARTE.w, CARTE.h));
    const pointeur = this.input.activePointer;
    this.survol = this.pointSous(pointeur.x, pointeur.y);
    this.ronds.removeAll(true);
    this.points.forEach((p, i) => {
      const e = this.versLEcran(p);
      const grand = i === this.survol || i === this.glisse;
      const couleur = enNombre(i === 0 ? c.accent : c.accent2);
      this.ronds.add(this.add.circle(e.x, e.y, this.rayon + (grand ? 3 : 0), couleur).setStrokeStyle(3, 0xffffff));
      this.ronds.add(ecrire(this, e.x, e.y + 1, String(i + 1), 10, "#ffffff"));
      if (i === 0) {
        this.ronds.add(ecrire(this, e.x, e.y - 20, "Départ", 14, c.accent, { contour: true }));
      }
    });
    const plein = this.points.length >= POINTS_MAX;
    this.compte.setText(this.points.length + " / " + POINTS_MAX + " points").setColor(plein ? c.accent : c.texteDoux);
    this.vide.setVisible(this.points.length === 0);
  }

  private garder() {
    if (this.parti) {
      return;
    }
    if (this.points.length < POINTS_MIN) {
      this.annonces.annoncer("Il faut au moins " + POINTS_MIN + " points", themeEnCours().habillage.couleurs.accent);
      jouer(this, "non");
      return;
    }
    this.parti = true;
    // Un circuit qui a changé : son ancien record est effacé, et l'image de sa piste sera refaite
    if (garderCircuitDessine(this.points)) {
      oublierLesPistes(this);
    }
    garderCircuitChoisi(ID_CIRCUIT_DESSINE);
    jouer(this, "record");
    fonduPuis(this, () => this.scene.start("course-menu", { annonce: "Circuit enregistré !" }));
  }

  private revenir() {
    if (!this.parti) {
      this.parti = true;
      fonduPuis(this, () => this.scene.start("course-menu"));
    }
  }
}
