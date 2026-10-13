// L'éditeur : un circuit à toi, dessiné à la souris ou au doigt.
// Le monde entier (2600 × 1800) est montré en petit. Toucher l'herbe pose un point, glisser un point
// le déplace, le clic droit l'enlève (au doigt : le toucher sans le glisser). La route se dessine
// à mesure, avec les mêmes calculs que la vraie course : on voit tout de suite ce qu'on obtiendra.

import Phaser from "phaser";
import { preparerCircuit, LARGEUR_ROUTE, type Point } from "../circuits";
import {
  MONDE_EDITEUR, POINTS_MIN, POINTS_MAX, ID_MON_CIRCUIT, modeleDeMonCircuit, lireMesPoints,
  enregistrerMonCircuit, dansLeMonde,
} from "../monCircuit";
import { oublierLaPiste } from "../textures";
import { ORANGE, FOND } from "../reglages";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { estTactile } from "../../../socle/tactile";
import { fonduPuis } from "../../../socle/retour";

// Le monde en petit sur l'écran : il y tient en entier, au milieu
const ECHELLE = 0.26;
const CARTE = {
  x: Math.round((LARGEUR - MONDE_EDITEUR.largeur * ECHELLE) / 2),
  y: 40,
  largeur: MONDE_EDITEUR.largeur * ECHELLE,
  hauteur: MONDE_EDITEUR.hauteur * ECHELLE,
};
const RAYON_POINT = 12;
const BOUTON_FINI = { x: 885, y: 270, taille: 84 };

export class Editeur extends Phaser.Scene {
  points: Point[] = [];                    // en coordonnées du monde (public : les tests le lisent)
  private ronds: Phaser.GameObjects.Arc[] = [];
  private numeros: Phaser.GameObjects.Text[] = [];
  private route!: Phaser.GameObjects.Graphics;
  private aide!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private tenu = -1;                       // le point sur lequel le doigt s'est posé, ou -1
  private aGlisse = false;                 // vrai si ce point a vraiment été glissé
  private parti = false;

  constructor() {
    super("voiture-editeur");
  }

  create() {
    this.points = lireMesPoints() ?? [];
    this.ronds = [];
    this.numeros = [];
    this.tenu = -1;
    this.parti = false;
    this.cameras.main.setBackgroundColor(FOND).fadeIn(250);

    // Pas de menu du navigateur au clic droit : ici, le clic droit enlève un point. Phaser a
    // input.mouse.disableContextMenu(), mais son écouteur n'est jamais retiré (un de plus à chaque
    // visite, et toute l'Arcade perd le menu) : on pose le nôtre, et on le retire en partant.
    const sansMenu = (evenement: Event) => evenement.preventDefault();
    this.game.canvas.addEventListener("contextmenu", sansMenu);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.canvas.removeEventListener("contextmenu", sansMenu));
    // Un tout petit tremblement du doigt n'est pas un glissé : le glissé commence après 8 pixels
    this.input.dragDistanceThreshold = 8;

    // L'herbe : c'est elle qu'on touche pour poser un point
    const herbe = this.add.rectangle(CARTE.x, CARTE.y, CARTE.largeur, CARTE.hauteur, 0x3f8f3a)
      .setOrigin(0).setInteractive({ cursor: "crosshair" });
    herbe.on("pointerdown", (pointeur: Phaser.Input.Pointer) => this.poser(pointeur));

    // La route en aperçu : dessinée à la taille du monde, et c'est l'objet entier qu'on rapetisse
    this.route = this.add.graphics().setPosition(CARTE.x, CARTE.y).setScale(ECHELLE);

    this.aide = this.add.text(LARGEUR / 2, 20, "", { fontFamily: POLICE, fontSize: "15px", color: "#e9e4f0" })
      .setOrigin(0.5);
    this.message = this.add.text(LARGEUR / 2, HAUTEUR - 16, "", {
      fontFamily: POLICE, fontSize: "15px", fontStyle: "bold", color: "#ffd479",
    }).setOrigin(0.5);

    this.creerBoutons();

    surTouche(this, "ENTER", () => this.enregistrer());
    surTouche(this, "ESC", () => this.revenir());

    this.toutRedessiner();
  }

  private creerBoutons() {
    // ✔ : enregistrer. Indispensable au doigt (pas de touche Entrée), pratique à la souris.
    const { x, y, taille } = BOUTON_FINI;
    const fini = this.add.rectangle(x, y, taille, taille, ORANGE).setRounded(16).setInteractive({ useHandCursor: true });
    this.add.text(x, y, "✔", { fontFamily: POLICE, fontSize: "44px", fontStyle: "bold", color: FOND }).setOrigin(0.5);
    fini.on("pointerup", () => this.enregistrer());

    this.add.text(20, 20, "← Menu", { fontFamily: POLICE, fontSize: "18px", color: "#a49cb4" })
      .setOrigin(0, 0.5).setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.revenir());
  }

  // ===== Les coordonnées : le monde (la vraie taille du circuit) et l'écran (la carte en petit) =====

  private versLEcran(p: Point) {
    return { x: CARTE.x + p.x * ECHELLE, y: CARTE.y + p.y * ECHELLE };
  }

  private versLeMonde(x: number, y: number): Point {
    return dansLeMonde((x - CARTE.x) / ECHELLE, (y - CARTE.y) / ECHELLE);
  }

  // ===== La souris et les doigts =====

  private poser(pointeur: Phaser.Input.Pointer) {
    this.tenu = -1;
    if (pointeur.button !== 0 || this.points.length >= POINTS_MAX) {
      return;                              // le clic droit sur l'herbe ne fait rien
    }
    this.points.push(this.versLeMonde(pointeur.x, pointeur.y));
    this.toutRedessiner();
    const rond = this.ronds[this.ronds.length - 1];
    rond.setScale(0);
    this.tweens.add({ targets: rond, scale: 1, duration: 200, ease: "Back.Out" });
  }

  private enlever(i: number) {
    this.points.splice(i, 1);
    this.tenu = -1;
    this.toutRedessiner();
  }

  // Les points sont refaits à chaque point posé ou enlevé (leurs numéros changent) ;
  // pendant un glissé, on ne fait que déplacer celui qu'on tient.
  private toutRedessiner() {
    this.ronds.forEach((rond) => rond.destroy());
    this.numeros.forEach((numero) => numero.destroy());
    const auDoigt = estTactile();
    this.ronds = this.points.map((p, i) => {
      const { x, y } = this.versLEcran(p);
      const rond = this.add.circle(x, y, RAYON_POINT, ORANGE).setStrokeStyle(2, 0xffffff);
      // La zone sensible : plus grande que le rond, surtout au doigt (moins précis qu'une souris).
      // Ses coordonnées se comptent depuis le coin haut gauche du rond.
      const zone = auDoigt ? 26 : 15;
      rond.setInteractive({
        hitArea: new Phaser.Geom.Circle(RAYON_POINT, RAYON_POINT, zone),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
        draggable: true,
        useHandCursor: true,
      });
      rond.on("pointerdown", (pointeur: Phaser.Input.Pointer) => {
        if (pointeur.button === 2) {
          this.enlever(i);
          return;
        }
        this.tenu = i;
        this.aGlisse = false;
      });
      // Le point va sous le pointeur. Pas dragX / dragY : Phaser ne commence le glissé qu'après les
      // 8 pixels de dragDistanceThreshold, et compte à partir de là, alors le point resterait 8 pixels
      // en retard sur le doigt.
      rond.on("drag", (pointeur: Phaser.Input.Pointer) => {
        this.aGlisse = true;
        this.points[i] = this.versLeMonde(pointeur.x, pointeur.y);
        const ecran = this.versLEcran(this.points[i]);
        rond.setPosition(ecran.x, ecran.y);
        this.numeros[i].setPosition(ecran.x, ecran.y);
        this.dessinerLaRoute();
      });
      // Au doigt, pas de clic droit : toucher un point sans le glisser l'enlève. Un point qu'on vient
      // de poser n'a pas reçu son pointerdown (il n'existait pas encore) : il n'est pas « tenu ».
      rond.on("pointerup", (pointeur: Phaser.Input.Pointer) => {
        if (auDoigt && pointeur.button === 0 && this.tenu === i && !this.aGlisse) {
          this.enlever(i);
        }
      });
      return rond;
    });
    this.numeros = this.points.map((p, i) => {
      const { x, y } = this.versLEcran(p);
      return this.add.text(x, y, String(i + 1), {
        fontFamily: POLICE, fontSize: "14px", fontStyle: "bold", color: "#ffffff",
      }).setOrigin(0.5);
    });
    this.dessinerLaRoute();
    this.ecrireLesConsignes();
  }

  // La route passe là où passera la vraie : preparerCircuit fait la même trace que pour la course
  private dessinerLaRoute() {
    const g = this.route.clear();
    if (this.points.length < 3) {
      return;
    }
    const apercu = preparerCircuit(modeleDeMonCircuit(this.points));
    const trace = apercu.trace.map((p) => new Phaser.Math.Vector2(p.x, p.y));
    g.lineStyle(LARGEUR_ROUTE, 0x55535c, 0.9).strokePoints(trace, true, true);
    // La ligne d'arrivée, au milieu entre le point 1 et le point 2 : on part vers le point 2
    const ligne = apercu.portes[0];
    g.fillStyle(0xffffff).fillCircle(ligne.x, ligne.y, 45);
  }

  private ecrireLesConsignes() {
    const nombre = "(" + this.points.length + "/" + POINTS_MAX + ")";
    this.aide.setText(estTactile()
      ? "Touche : un point " + nombre + "   Glisse : le déplacer   Touche-le sans glisser : l'enlever"
      : "Clic : un point " + nombre + "   Glisser : le déplacer   Clic droit : l'enlever");
    const touche = estTactile() ? "✔" : "Entrée ou ✔";
    this.message.setText(this.points.length >= POINTS_MIN
      ? touche + " : enregistrer et revenir au menu"
      : "Il faut au moins " + POINTS_MIN + " points (" + touche + " : revenir sans enregistrer)");
  }

  // ===== Partir =====

  private enregistrer() {
    if (this.points.length < POINTS_MIN) {
      this.revenir();
      return;
    }
    if (this.parti) {
      return;
    }
    this.parti = true;
    // Un circuit qui a changé : son ancien record est effacé, et l'image de sa piste
    // (gardée par Phaser sous le même nom) est jetée pour être refaite à la prochaine course
    if (enregistrerMonCircuit(this.points)) {
      oublierLaPiste(this, ID_MON_CIRCUIT);
    }
    fonduPuis(this, () => this.scene.start("voiture-menu", { circuit: ID_MON_CIRCUIT }));
  }

  private revenir() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    fonduPuis(this, () => this.scene.start("voiture-menu"));
  }
}
