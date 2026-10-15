// Le menu du casse-briques : les dix niveaux en deux rangées de cartes (chacune avec ses étoiles et son
// record), et dessous le mode sans fin, qui s'ouvre quand le dernier niveau est gagné. Un niveau s'ouvre
// quand celui d'avant est gagné. Flèches et Entrée, manette, souris ou doigt.

import Phaser from "phaser";
import { NIVEAUX } from "../niveaux";
import { resultats, ouvert, sansFinOuvert, recordSansFin } from "../progression";
import { TEXTE, SAUVEGARDE } from "../reglages";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { estTactile } from "../../../socle/tactile";
import { retourAuHub, fonduPuis } from "../../../socle/retour";
import { boutonArcade } from "../../../socle/boutonArcade";
import { appliquerLeSon, boutonDuSon } from "../../../socle/son";

const PAR_RANGEE = 5;
const CARTE = { largeur: 150, hauteur: 104, ecart: 18, haut: 196 };
const SANS_FIN = NIVEAUX.length;           // la dernière carte, sous les niveaux
const BORD = 0x4a3a80;

interface Carte {
  boite: Phaser.GameObjects.Container;
  fond: Phaser.GameObjects.Rectangle;
  ouverte: boolean;
}

export class Menu extends Phaser.Scene {
  choisi = -1;                             // -1 : pas encore choisi, on prendra le premier niveau à gagner
  private cartes: Carte[] = [];
  private parti = false;

  constructor() {
    super("briques-menu");
  }

  create() {
    this.cartes = [];
    this.parti = false;
    this.cameras.main.fadeIn(250);
    appliquerLeSon(this, SAUVEGARDE);
    this.add.image(0, 0, "briques-fond").setOrigin(0);

    this.add.text(LARGEUR / 2, 62, "Casse-briques", {
      fontFamily: POLICE, fontSize: "56px", fontStyle: "bold", color: "#c8a8ff", stroke: "#14121c", strokeThickness: 8,
    }).setOrigin(0.5);
    this.add.text(LARGEUR / 2, 112, "Vise avec la raquette, casse tout le mur !", {
      fontFamily: POLICE, fontSize: "19px", color: TEXTE,
    }).setOrigin(0.5);

    const tout = resultats();
    NIVEAUX.forEach((niveau, i) => this.creerCarte(i, niveau.nom, tout[i]?.etoiles ?? 0, tout[i]?.score, ouvert(i)));
    this.creerLaCarteSansFin();
    if (this.choisi < 0) {
      // Le premier niveau pas encore gagné, ou le mode sans fin quand tout est gagné
      const aGagner = NIVEAUX.findIndex((_n, i) => !tout[i]);
      this.choisi = aGagner < 0 ? SANS_FIN : aGagner;
    }

    boutonArcade(this, () => this.quitter());
    boutonDuSon(this, SAUVEGARDE);
    const aide = estTactile() ? "Touche un niveau pour jouer !" : "Flèches : choisir    Entrée : jouer    M : le son    Échap : l'Arcade";
    this.add.text(LARGEUR / 2, HAUTEUR - 20, aide, { fontFamily: POLICE, fontSize: "16px", color: TEXTE }).setOrigin(0.5);

    surTouche(this, "LEFT", () => this.allerA(this.choisi - 1));
    surTouche(this, "RIGHT", () => this.allerA(this.choisi + 1));
    surTouche(this, "UP", () => this.monter());
    surTouche(this, "DOWN", () => this.descendre());
    surTouche(this, "ENTER", () => this.lancer());
    surTouche(this, "SPACE", () => this.lancer());
    surTouche(this, "ESC", () => this.quitter());
    surManette(this, MANETTE.GAUCHE, () => this.allerA(this.choisi - 1));
    surManette(this, MANETTE.DROITE, () => this.allerA(this.choisi + 1));
    surManette(this, MANETTE.HAUT, () => this.monter());
    surManette(this, MANETTE.BAS, () => this.descendre());
    surManette(this, VALIDER, () => this.lancer());
    surManette(this, MANETTE.B, () => this.quitter());
    this.choisir(this.choisi);
  }

  private creerCarte(i: number, nom: string, etoiles: number, score: number | undefined, ouverte: boolean) {
    const rangee = Math.floor(i / PAR_RANGEE);
    const colonne = i % PAR_RANGEE;
    const x = LARGEUR / 2 + (colonne - (PAR_RANGEE - 1) / 2) * (CARTE.largeur + CARTE.ecart);
    const y = CARTE.haut + rangee * (CARTE.hauteur + CARTE.ecart);
    const fond = this.add.rectangle(0, 0, CARTE.largeur, CARTE.hauteur, ouverte ? 0x2a2148 : 0x1c1830, 0.95)
      .setRounded(14).setStrokeStyle(3, BORD);
    const contenu: Phaser.GameObjects.GameObject[] = [fond];
    const couleur = ouverte ? "#ffffff" : "#5a5470";
    contenu.push(this.add.text(0, -34, String(i + 1), { fontFamily: POLICE, fontSize: "24px", fontStyle: "bold", color: couleur }).setOrigin(0.5));
    contenu.push(this.add.text(0, -8, nom, { fontFamily: POLICE, fontSize: "15px", fontStyle: "bold", color: couleur }).setOrigin(0.5));
    if (ouverte) {
      contenu.push(this.add.text(0, 18, "★".repeat(etoiles) + "☆".repeat(3 - etoiles), {
        fontFamily: POLICE, fontSize: "20px", color: "#ffd23f",
      }).setOrigin(0.5));
      if (score !== undefined) {
        contenu.push(this.add.text(0, 40, `Record : ${score}`, { fontFamily: POLICE, fontSize: "12px", color: "#a59fc0" }).setOrigin(0.5));
      }
    } else {
      contenu.push(this.add.text(0, 24, "🔒", { fontSize: "24px" }).setOrigin(0.5));
    }
    this.ajouter(this.add.container(x, y, contenu), fond, ouverte, i);
  }

  private creerLaCarteSansFin() {
    const ouverte = sansFinOuvert();
    const fond = this.add.rectangle(0, 0, 420, 70, ouverte ? 0x3a2470 : 0x1c1830, 0.95).setRounded(16).setStrokeStyle(3, BORD);
    const record = recordSansFin();
    const sousTitre = !ouverte
      ? "🔒 Gagne le niveau 10 pour l'ouvrir"
      : record.score > 0 ? `Record : ${record.score} (mur ${record.mur})` : "Des murs sans fin, de plus en plus durs";
    const contenu = [
      fond,
      this.add.text(0, -12, "∞  Sans fin", { fontFamily: POLICE, fontSize: "24px", fontStyle: "bold", color: ouverte ? "#ffffff" : "#5a5470" }).setOrigin(0.5),
      this.add.text(0, 16, sousTitre, { fontFamily: POLICE, fontSize: "14px", color: "#a59fc0" }).setOrigin(0.5),
    ];
    this.ajouter(this.add.container(LARGEUR / 2, 436, contenu), fond, ouverte, SANS_FIN);
  }

  private ajouter(boite: Phaser.GameObjects.Container, fond: Phaser.GameObjects.Rectangle, ouverte: boolean, i: number) {
    fond.setInteractive({ useHandCursor: ouverte });
    fond.on("pointerover", () => this.choisir(i));
    fond.on("pointerup", () => {
      this.choisir(i);
      this.lancer();
    });
    this.cartes.push({ boite, fond, ouverte });
  }

  private allerA(i: number) {
    this.choisir(Phaser.Math.Clamp(i, 0, this.cartes.length - 1));
  }

  private monter() {
    this.allerA(this.choisi === SANS_FIN ? PAR_RANGEE + Math.floor(PAR_RANGEE / 2) : this.choisi - PAR_RANGEE);
  }

  private descendre() {
    this.allerA(this.choisi + PAR_RANGEE >= SANS_FIN ? SANS_FIN : this.choisi + PAR_RANGEE);
  }

  private choisir(i: number) {
    if (this.parti || i < 0) {
      return;
    }
    this.choisi = i;
    this.cartes.forEach((carte, j) => {
      const elue = j === i;
      carte.fond.setStrokeStyle(elue ? 5 : 3, elue ? 0xffd23f : BORD);
      this.tweens.add({ targets: carte.boite, scale: elue ? 1.07 : 1, duration: 120, ease: "Back.Out" });
    });
  }

  private lancer() {
    const carte = this.cartes[this.choisi];
    if (this.parti || !carte) {
      return;
    }
    if (!carte.ouverte) {
      // Pas encore ouvert : la carte dit « non » de la tête
      this.tweens.add({ targets: carte.boite, angle: { from: -4, to: 4 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => carte.boite.setAngle(0) });
      return;
    }
    this.parti = true;
    const donnees = this.choisi === SANS_FIN ? { mode: "sansFin" } : { mode: "niveau", numero: this.choisi };
    fonduPuis(this, () => this.scene.start("briques-partie", donnees));
  }

  private quitter() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    retourAuHub(this);
  }
}
