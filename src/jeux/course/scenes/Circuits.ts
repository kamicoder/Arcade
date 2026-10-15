// Le choix du circuit, pour une course contre l'ordinateur, à deux ou contre la montre :
// un aperçu, ◀ ▶ pour en changer.

import Phaser from "phaser";
import type { DonneesDeCourse, Mode } from "./Piste";
import { rivauxLibres } from "./GrandPrix";
import { chrono, ID_CIRCUIT_DESSINE, type ModeleDeCircuit } from "../circuits";
import {
  themeEnCours, preferences, listeDesCircuits, lireCircuitChoisi, garderCircuitChoisi, lireRecord, garderLesRivaux,
} from "../sauvegarde";
import { jouer } from "../son";
import { titre, ecrire, bouton, touche, zone, boutonSon, textureCadre, textureApercu, menuElargi } from "../interface";
import { LARGEUR } from "../../../socle/style";
import { surTouche, surChaqueTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { estTactile } from "../../../socle/tactile";
import { etiquette } from "../../../socle/touchesPhysiques";
import { fonduPuis } from "../../../socle/retour";

const APERCU = { x: 235, y: 92, w: 490, h: 286 };
const TITRES: Record<string, string> = { course: "Contre l'ordinateur", duo: "Course à deux", chrono: "Contre la montre" };

export class Circuits extends Phaser.Scene {
  private mode: Mode = "chrono";
  private liste: ModeleDeCircuit[] = [];
  private numero = 0;
  private apercu!: Phaser.GameObjects.Image;
  nom!: Phaser.GameObjects.Text;           // public : les tests le lisent
  private position!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private modifier?: Phaser.GameObjects.Container;
  private parti = false;

  constructor() {
    super("course-circuits");
  }

  create({ mode }: { mode: Mode }) {
    const theme = themeEnCours();
    const c = theme.habillage.couleurs;
    this.mode = mode;
    this.liste = listeDesCircuits();
    const id = lireCircuitChoisi();
    this.numero = Math.max(0, this.liste.findIndex((m) => m.id === id));
    this.parti = false;
    this.modifier = undefined;

    menuElargi(this);                      // au doigt, toute la largeur du téléphone
    this.cameras.main.fadeIn(250);
    theme.habillage.fond(this);
    titre(this, 36, TITRES[mode], 40);
    if (!estTactile()) {
      ecrire(this, LARGEUR / 2, 70, this.commandes(), 14, c.texteDoux);
    }
    this.add.image(LARGEUR / 2, 235, textureCadre(this, 520, 306, 24, c.fondCarte));
    this.apercu = this.add.image(APERCU.x + APERCU.w / 2, APERCU.y + APERCU.h / 2, "__DEFAULT");

    const fleche = (x: number, texte: string, sens: number) => {
      const objet = ecrire(this, x, 235, texte, 44, c.accent2, { contour: true });
      zone(this, x - 70, 80, 140, 310, () => this.changer(sens));
      // Elle respire, pour qu'on la remarque
      this.tweens.add({ targets: objet, x: x + 6 * sens, duration: 600, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    };
    fleche(180, "◀", -1);
    fleche(780, "▶", 1);

    this.nom = ecrire(this, LARGEUR / 2, 418, "", 34, c.accent, { contour: true });
    this.position = ecrire(this, LARGEUR / 2, 448, "", 15, c.texteClair);
    this.info = ecrire(this, LARGEUR / 2, 474, "", 19, mode === "chrono" ? c.record : c.texte);
    if (mode === "duo") {
      zone(this, LARGEUR / 2 - 260, 460, 520, 30, () => this.changerLesRivaux());
    }

    bouton(this, 190, 494, 180, 40, "Retour" + touche(" (Échap)"), () => this.retour(), true);
    bouton(this, 385, 494, 190, 40, "Partir !" + touche(" (Entrée)"), () => this.partir());
    boutonSon(this);

    surTouche(this, "LEFT", () => this.changer(-1));
    surTouche(this, "RIGHT", () => this.changer(1));
    surTouche(this, "ENTER", () => this.partir());
    surTouche(this, "SPACE", () => this.partir());
    surTouche(this, "ESC", () => this.retour());
    surTouche(this, "R", () => this.changerLesRivaux());
    surTouche(this, "E", () => this.modifierLeCircuit());
    surChaqueTouche(this, (e) => {
      if (e.code === "KeyA") {
        this.changer(-1);
      } else if (e.code === "KeyD") {
        this.changer(1);
      }
    });
    surManette(this, MANETTE.GAUCHE, () => this.changer(-1));
    surManette(this, MANETTE.DROITE, () => this.changer(1));
    surManette(this, VALIDER, () => this.partir());
    surManette(this, MANETTE.B, () => this.retour());
    surManette(this, MANETTE.X, () => this.changerLesRivaux());

    this.montrer(0);
  }

  // Les touches de la course, écrites comme sur ce clavier-ci
  private commandes(): string {
    const turbo = themeEnCours().mots.turbo;
    if (this.mode === "duo") {
      const zqsd = ["KeyW", "KeyA", "KeyS", "KeyD"].map(etiquette).join(" ");
      return "Joueur 1 : les flèches, Entrée pour le " + turbo + "   ·   Joueur 2 : " + zqsd + ", Espace pour le " + turbo;
    }
    return "Les flèches pour conduire, Espace pour le " + turbo + "   ·   P : pause";
  }

  private changer(sens: number) {
    this.numero = Phaser.Math.Wrap(this.numero + sens, 0, this.liste.length);
    jouer(this, "menu");
    this.montrer(sens);
  }

  private montrer(sens: number) {
    const modele = this.liste[this.numero];
    this.apercu.setTexture(textureApercu(this, "course-apercu", modele, modele.points, APERCU.w, APERCU.h));
    if (sens !== 0) {
      // L'aperçu arrive du côté où l'on va
      this.apercu.setAlpha(0).x = LARGEUR / 2 + 40 * sens;
      this.tweens.add({ targets: this.apercu, alpha: 1, x: LARGEUR / 2, duration: 220, ease: "Cubic.Out" });
    }
    this.nom.setText(modele.nom);
    this.position.setText((this.numero + 1) + " / " + this.liste.length);
    this.montrerInfo();

    this.modifier?.destroy();
    this.modifier = modele.id === ID_CIRCUIT_DESSINE
      ? bouton(this, 590, 494, 180, 40, "Modifier" + touche(" (E)"), () => this.modifierLeCircuit(), true)
      : undefined;
  }

  private montrerInfo() {
    const mots = themeEnCours().mots;
    if (this.mode === "chrono") {
      const record = lireRecord(this.liste[this.numero].id);
      this.info.setText(record ? "Record du tour : " + chrono(record.temps) : "Pas encore de record");
    } else if (this.mode === "course") {
      this.info.setText("3 " + mots.rivaux + ", 3 tours");
    } else {
      const texte = preferences.rivaux === 0 ? mots.aucunRival : preferences.rivaux + " " + mots.rivaux;
      this.info.setText(touche("R : ") + mots.lesRivaux + " : " + texte + (estTactile() ? "  (touche pour changer)" : ""));
    }
  }

  private changerLesRivaux() {
    if (this.mode !== "duo") {
      return;
    }
    preferences.rivaux = preferences.rivaux === 0 ? 2 : 0;
    garderLesRivaux();
    jouer(this, "menu");
    this.montrerInfo();
  }

  private modifierLeCircuit() {
    if (this.liste[this.numero].id === ID_CIRCUIT_DESSINE && !this.parti) {
      this.parti = true;
      fonduPuis(this, () => this.scene.start("course-editeur"));
    }
  }

  private retour() {
    if (!this.parti) {
      this.parti = true;
      fonduPuis(this, () => this.scene.start("course-menu"));
    }
  }

  private partir() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    jouer(this, "menu");
    const modele = this.liste[this.numero];
    garderCircuitChoisi(modele.id);
    const theme = themeEnCours();
    let rivaux: number[] = [];
    if (this.mode === "course") {
      rivaux = rivauxLibres([preferences.joueurs[0]], 3);
    } else if (this.mode === "duo") {
      rivaux = rivauxLibres(preferences.joueurs, preferences.rivaux);
    }
    const donnees: DonneesDeCourse = { mode: this.mode, circuitId: modele.id, rivaux, niveau: theme.niveauDesRivaux };
    fonduPuis(this, () => this.scene.start("course-piste", donnees));
  }
}
