// Le classement du Grand Prix, entre deux courses : les points de chacun, puis la course suivante.
// Après la dernière course : le vainqueur, et le retour au menu.
//
// L'état du Grand Prix n'est gardé nulle part ailleurs : il passe de scène en scène dans les données
// de scene.start() (course → classement → course suivante...). Quitter en route, c'est l'oublier.

import Phaser from "phaser";
import {
  classementDuGrandPrix, estLaDerniere, courseSuivante, circuitDeLaCourse, niveauDeLaCourse,
  NOMBRE_DE_COURSES, type GrandPrix as EtatDuGrandPrix,
} from "../grandPrix";
import type { DonneesDeCourse } from "./Course";
import { JOUEUR, ORANGE, FOND } from "../reglages";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { estTactile } from "../../../socle/tactile";
import { fonduPuis } from "../../../socle/retour";

const enCouleur = (couleur: number) => "#" + couleur.toString(16).padStart(6, "0");

export class GrandPrix extends Phaser.Scene {
  private grandPrix!: EtatDuGrandPrix;
  private parti = false;

  constructor() {
    super("voiture-grandprix");
  }

  init(grandPrix: EtatDuGrandPrix) {
    this.grandPrix = grandPrix;
    this.parti = false;
  }

  create() {
    this.cameras.main.setBackgroundColor(FOND).fadeIn(250);
    const gp = this.grandPrix;
    const fini = estLaDerniere(gp);
    const classement = classementDuGrandPrix(gp);
    const texte = (y: number, contenu: string, taille: number, couleur: string) =>
      this.add.text(LARGEUR / 2, y, contenu, {
        fontFamily: POLICE, fontSize: taille + "px", fontStyle: "bold", color: couleur,
      }).setOrigin(0.5);

    let titre: Phaser.GameObjects.Text;
    if (fini) {
      const vainqueur = classement[0];
      const nom = vainqueur.nom === JOUEUR.nom ? "Tu gagnes" : vainqueur.nom + " gagne";
      titre = texte(80, "🏆 " + nom + " le Grand Prix !", 40, "#ffd479");
      this.feuDArtifice(vainqueur.couleur);
    } else {
      titre = texte(80, "Grand Prix : course " + (gp.course + 1) + "/" + NOMBRE_DE_COURSES, 40, "#ff7a1a");
    }
    titre.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: titre, scale: 1, alpha: 1, duration: 400, ease: "Back.Out" });

    // Les lignes du classement arrivent l'une après l'autre, chacune avec une barre à sa mesure
    const maximum = Math.max(1, classement[0].points);
    classement.forEach((concurrent, i) => {
      const y = 170 + i * 62;
      const couleur = enCouleur(concurrent.couleur);
      const nom = this.add.text(200, y, (i + 1) + ". " + concurrent.nom, {
        fontFamily: POLICE, fontSize: "26px", fontStyle: "bold", color: couleur,
      }).setOrigin(0, 0.5);
      const barre = this.add.rectangle(420, y, 0, 26, concurrent.couleur).setOrigin(0, 0.5);
      const points = this.add.text(760, y, concurrent.points + " points", {
        fontFamily: POLICE, fontSize: "24px", fontStyle: "bold", color: "#ffffff",
      }).setOrigin(1, 0.5);
      for (const objet of [nom, points]) {
        objet.setAlpha(0);
        this.tweens.add({ targets: objet, alpha: 1, duration: 300, delay: 200 + i * 150 });
      }
      // Un tween sur la largeur du rectangle : la barre pousse jusqu'aux points du concurrent
      this.tweens.add({
        targets: barre, width: 200 * concurrent.points / maximum, duration: 600, delay: 300 + i * 150, ease: "Cubic.Out",
      });
    });

    const touche = estTactile() ? "Touche l'écran" : "Entrée";
    const suite = fini
      ? touche + " : revenir au menu"
      : touche + " : la course suivante, " + circuitDeLaCourse(courseSuivante(gp)).nom;
    const consigne = texte(HAUTEUR - 50, suite, 20, "#e9e4f0").setAlpha(0);
    this.tweens.add({ targets: consigne, alpha: 1, duration: 300, delay: 900 });

    surTouche(this, "ENTER", () => this.continuer());
    surTouche(this, "ESC", () => this.versLeMenu());
    // On attend un peu avant d'écouter le doigt : il vient peut-être de toucher l'écran d'arrivée
    this.time.delayedCall(600, () => this.input.on("pointerup", () => this.continuer()));
    this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, bouton: Phaser.Input.Gamepad.Button) => {
      if (bouton.index === 0) {
        this.continuer();
      } else if (bouton.index === 1) {
        this.versLeMenu();
      }
    });
  }

  // Des étincelles aux couleurs du vainqueur, qui jaillissent du bas de l'écran
  private feuDArtifice(couleur: number) {
    this.add.particles(0, 0, "etincelle", {
      x: { min: 100, max: LARGEUR - 100 },
      y: HAUTEUR + 10,
      lifespan: 1600,
      speedY: { min: -420, max: -260 },
      speedX: { min: -60, max: 60 },
      gravityY: 250,
      scale: { start: 1.6, end: 0 },
      tint: [couleur, 0xffd479, 0xffffff, ORANGE],
      frequency: 40,
      blendMode: "ADD",
    }).setDepth(-1);
  }

  private continuer() {
    if (this.parti) {
      return;
    }
    if (estLaDerniere(this.grandPrix)) {
      this.versLeMenu();
      return;
    }
    this.parti = true;
    const suivant = courseSuivante(this.grandPrix);
    const donnees: DonneesDeCourse = {
      modele: circuitDeLaCourse(suivant),
      mode: "grandprix",
      niveau: niveauDeLaCourse(suivant),
      grandPrix: suivant,
    };
    fonduPuis(this, () => this.scene.start("voiture-course", donnees));
  }

  private versLeMenu() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    fonduPuis(this, () => this.scene.start("voiture-menu"));
  }
}
