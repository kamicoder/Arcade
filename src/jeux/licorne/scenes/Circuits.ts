// Le choix du circuit, pour la course à deux et le contre-la-montre : un aperçu, ◀ ▶ pour en changer.

import Phaser from "phaser";
import type { DonneesDeCourse } from "./Course";
import { licornesLibres } from "./Menu";
import { NIVEAU_DUO, type ModeleDeCircuit } from "../donnees";
import { COULEURS } from "../reglages";
import { chrono } from "../circuits";
import {
  preferences, listeDesCircuits, lireCircuitChoisi, garderCircuitChoisi, lireRecord, garderLesRivales,
} from "../sauvegarde";
import { sons } from "../sons";
import { textureApercu, textureCadre } from "../textures";
import { fondDeMenu, titre, ecrire, bouton, touche, zone, boutonSon } from "../interface";
import { surChaqueTouche } from "../clavier";
import { LARGEUR } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { estTactile } from "../../../socle/tactile";
import { fonduPuis } from "../../../socle/retour";

const APERCU = { x: 235, y: 80, w: 490, h: 300 };

export class Circuits extends Phaser.Scene {
  private mode: "duo" | "chrono" = "chrono";
  private liste: ModeleDeCircuit[] = [];
  private numero = 0;
  private apercu!: Phaser.GameObjects.Image;
  private nom!: Phaser.GameObjects.Text;
  private position!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private modifier?: Phaser.GameObjects.Container;
  private parti = false;

  constructor() {
    super("licorne-circuits");
  }

  create({ mode }: { mode: "duo" | "chrono" }) {
    this.mode = mode;
    this.liste = listeDesCircuits();
    const id = lireCircuitChoisi();
    this.numero = Math.max(0, this.liste.findIndex((c) => c.id === id));
    this.parti = false;
    this.modifier = undefined;

    this.cameras.main.fadeIn(250);
    fondDeMenu(this);
    titre(this, 40, mode === "duo" ? "Course à deux" : "Contre la montre", 40);
    this.add.image(LARGEUR / 2, 230, textureCadre(this, 520, 320, 24, "rgba(255,255,255,0.6)"));
    this.apercu = this.add.image(APERCU.x + APERCU.w / 2, APERCU.y + APERCU.h / 2, "__DEFAULT");

    const fleche = (x: number, texte: string, sens: number) => {
      const objet = ecrire(this, x, 230, texte, 44, COULEURS.violet, { contour: true });
      zone(this, x - 70, 70, 140, 320, () => this.changer(sens));
      // Elle respire, pour qu'on la remarque
      this.tweens.add({ targets: objet, x: x + 6 * sens, duration: 600, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    };
    fleche(180, "◀", -1);
    fleche(780, "▶", 1);

    this.nom = ecrire(this, LARGEUR / 2, 418, "", 34, COULEURS.rose, { contour: true });
    this.position = ecrire(this, LARGEUR / 2, 448, "", 15, COULEURS.texteClair);
    this.info = ecrire(this, LARGEUR / 2, 474, "", 19, mode === "chrono" ? COULEURS.orange : COULEURS.texte);
    if (mode === "duo") {
      zone(this, LARGEUR / 2 - 260, 460, 520, 30, () => this.changerLesRivales());
    }

    bouton(this, 190, 494, 180, 40, "Retour" + touche(" (Échap)"), () => this.retour(), true);
    bouton(this, 385, 494, 190, 40, "Partir !" + touche(" (Entrée)"), () => this.partir());
    boutonSon(this);

    surTouche(this, "LEFT", () => this.changer(-1));
    surTouche(this, "RIGHT", () => this.changer(1));
    surTouche(this, "ENTER", () => this.partir());
    surTouche(this, "SPACE", () => this.partir());
    surTouche(this, "ESC", () => this.retour());
    surTouche(this, "R", () => this.changerLesRivales());
    surTouche(this, "E", () => this.modifierLeCircuit());
    surChaqueTouche(this, (e) => {
      if (e.code === "KeyA") {
        this.changer(-1);
      } else if (e.code === "KeyD") {
        this.changer(1);
      }
    });
    this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => {
      switch (b.index) {
        case 14: this.changer(-1); break;
        case 15: this.changer(1); break;
        case 0: this.partir(); break;
        case 1: this.retour(); break;
        case 2: this.changerLesRivales(); break;
      }
    });

    this.montrer(0);
  }

  private changer(sens: number) {
    this.numero = Phaser.Math.Wrap(this.numero + sens, 0, this.liste.length);
    sons.menu();
    this.montrer(sens);
  }

  private montrer(sens: number) {
    const modele = this.liste[this.numero];
    this.apercu.setTexture(textureApercu(this, "licorne-apercu", modele, modele.points, APERCU.w, APERCU.h));
    if (sens !== 0) {
      // L'aperçu arrive du côté où l'on va
      this.apercu.setAlpha(0).x = LARGEUR / 2 + 40 * sens;
      this.tweens.add({ targets: this.apercu, alpha: 1, x: LARGEUR / 2, duration: 220, ease: "Cubic.Out" });
    }
    this.nom.setText(modele.nom);
    this.position.setText((this.numero + 1) + " / " + this.liste.length);
    this.montrerInfo();

    this.modifier?.destroy();
    this.modifier = modele.id === "perso"
      ? bouton(this, 590, 494, 180, 40, "Modifier" + touche(" (E)"), () => this.modifierLeCircuit(), true)
      : undefined;
  }

  private montrerInfo() {
    if (this.mode === "chrono") {
      const record = lireRecord(this.liste[this.numero].id);
      this.info.setText(record ? "Record du tour : " + chrono(record.temps) : "Pas encore de record");
    } else {
      const texte = preferences.rivales === 0 ? "aucune, juste vous deux" : preferences.rivales + " licornes de l'ordinateur";
      this.info.setText(touche("R : ") + "rivales : " + texte + (estTactile() ? "  (touche pour changer)" : ""));
    }
  }

  private changerLesRivales() {
    if (this.mode !== "duo") {
      return;
    }
    preferences.rivales = preferences.rivales === 0 ? 2 : 0;
    garderLesRivales();
    sons.menu();
    this.montrerInfo();
  }

  private modifierLeCircuit() {
    if (this.liste[this.numero].id === "perso" && !this.parti) {
      this.parti = true;
      fonduPuis(this, () => this.scene.start("licorne-editeur"));
    }
  }

  private retour() {
    if (!this.parti) {
      this.parti = true;
      fonduPuis(this, () => this.scene.start("licorne-menu"));
    }
  }

  private partir() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    sons.menu();
    const modele = this.liste[this.numero];
    garderCircuitChoisi(modele.id);
    const duo = this.mode === "duo";
    const donnees: DonneesDeCourse = {
      mode: this.mode,
      circuitId: modele.id,
      rivales: duo ? licornesLibres(preferences.choix, preferences.rivales) : [],
      niveau: NIVEAU_DUO,
    };
    fonduPuis(this, () => this.scene.start("licorne-course", donnees));
  }
}
