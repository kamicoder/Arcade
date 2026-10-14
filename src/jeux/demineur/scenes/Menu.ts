// Le menu du démineur : les trois niveaux, côte à côte, chacun avec ses records.
// Flèches et Entrée, manette, souris ou doigt.

import Phaser from "phaser";
import { NIVEAUX, lireLesRecords, enSecondes, type Niveau } from "../niveaux";
import { COULEURS } from "../textures";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { estTactile } from "../../../socle/tactile";
import { retourAuHub, fonduPuis } from "../../../socle/retour";
import { boutonArcade } from "../../../socle/boutonArcade";

const CARTE_L = 270;
const CARTE_H = 340;
const ECART = 30;
const CARTE_Y = 300;                       // le centre des cartes

interface Carte {
  boite: Phaser.GameObjects.Container;
  fond: Phaser.GameObjects.Rectangle;
  niveau: Niveau;
}

export class Menu extends Phaser.Scene {
  private choix = 0;                       // gardé d'une visite à l'autre : on retrouve son niveau
  private cartes: Carte[] = [];
  private parti = false;

  constructor() {
    super("demineur-menu");
  }

  create() {
    this.cartes = [];
    this.parti = false;
    this.cameras.main.setBackgroundColor(COULEURS.fond).fadeIn(250);

    this.creerDecor();
    NIVEAUX.forEach((niveau, i) => this.creerCarte(niveau, i));

    const aide = estTactile()
      ? "Touche un niveau pour jouer !"
      : "◀ ▶ : choisir    Entrée : jouer    1 2 3 : niveau direct    Échap : l'Arcade";
    this.add.text(LARGEUR / 2, HAUTEUR - 22, aide, { fontFamily: POLICE, fontSize: "16px", color: "#a59fc0" })
      .setOrigin(0.5);

    surTouche(this, "LEFT", () => this.choisir(this.choix - 1));
    surTouche(this, "RIGHT", () => this.choisir(this.choix + 1));
    surTouche(this, "ENTER", () => this.lancer());
    surTouche(this, "SPACE", () => this.lancer());
    surTouche(this, "ONE", () => this.lancer(0));
    surTouche(this, "TWO", () => this.lancer(1));
    surTouche(this, "THREE", () => this.lancer(2));
    surTouche(this, "ESC", () => retourAuHub(this));
    surManette(this, MANETTE.GAUCHE, () => this.choisir(this.choix - 1));
    surManette(this, MANETTE.DROITE, () => this.choisir(this.choix + 1));
    surManette(this, VALIDER, () => this.lancer());
    surManette(this, MANETTE.B, () => retourAuHub(this));

    this.choisir(this.choix, false);
  }

  private creerDecor() {
    // Des mines qui tombent doucement derrière les cartes
    this.add.particles(0, 0, "demineur-mine", {
      x: { min: 0, max: LARGEUR },
      y: -20,
      lifespan: 12000,
      speedY: { min: 25, max: 60 },
      rotate: { min: 0, max: 360 },
      scale: { min: 0.6, max: 1.2 },
      alpha: 0.12,
      frequency: 700,
    });

    const titre = this.add.text(LARGEUR / 2 + 22, 54, "Démineur", {
      fontFamily: POLICE, fontSize: "46px", fontStyle: "bold", color: "#4fb3ff",
    }).setOrigin(0.5);
    const mine = this.add.image(titre.x - titre.width / 2 - 34, 54, "demineur-mine").setScale(2);
    this.tweens.add({ targets: mine, angle: 360, duration: 6000, repeat: -1 });

    boutonArcade(this);
  }

  private creerCarte(niveau: Niveau, i: number) {
    const x = LARGEUR / 2 + (i - 1) * (CARTE_L + ECART);
    const fond = this.add.rectangle(0, 0, CARTE_L, CARTE_H, 0x221f2e).setRounded(20).setStrokeStyle(3, 0x3a3550);
    const nom = this.add.text(0, -CARTE_H / 2 + 34, niveau.nom, {
      fontFamily: POLICE, fontSize: "30px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0.5);
    const taille = this.add.text(0, -CARTE_H / 2 + 68, `${niveau.colonnes} × ${niveau.rangees}  ·  ${niveau.mines} mines`, {
      fontFamily: POLICE, fontSize: "16px", color: "#a59fc0",
    }).setOrigin(0.5);

    const objets: Phaser.GameObjects.GameObject[] = [fond, nom, taille, this.apercu(niveau, 0, -12)];

    // Le podium du niveau
    const records = lireLesRecords(niveau);
    const lignes = records.length
      ? records.map((r, k) => `${["🥇", "🥈", "🥉"][k]} ${r.nom}  ${enSecondes(r.temps)}`)
      : ["Pas encore de record"];
    lignes.forEach((ligne, k) => {
      objets.push(this.add.text(0, 92 + k * 26, ligne, {
        fontFamily: POLICE, fontSize: "17px", color: records.length ? "#ffd479" : "#6f6a86",
      }).setOrigin(0.5));
    });

    const boite = this.add.container(x, CARTE_Y, objets);
    fond.setInteractive({ useHandCursor: true });
    fond.on("pointerover", () => this.choisir(i));
    fond.on("pointerup", () => this.lancer(i));
    this.cartes.push({ boite, fond, niveau });

    // Les cartes arrivent d'en bas, l'une après l'autre
    boite.y += 60;
    boite.setAlpha(0);
    this.tweens.add({ targets: boite, y: CARTE_Y, alpha: 1, delay: i * 90, duration: 380, ease: "Back.Out" });
  }

  // La grille du niveau en tout petit, avec quelques cases déjà ouvertes, pour donner l'idée
  private apercu(niveau: Niveau, x: number, y: number): Phaser.GameObjects.Graphics {
    const pas = Math.min(200 / niveau.colonnes, 130 / niveau.rangees);
    const g = this.add.graphics();
    const gauche = x - (niveau.colonnes * pas) / 2;
    const haut = y - (niveau.rangees * pas) / 2;
    for (let r = 0; r < niveau.rangees; r++) {
      for (let c = 0; c < niveau.colonnes; c++) {
        // Une « tache » ouverte au milieu : des cases claires, dans un cercle un peu bosselé
        const dx = (c - niveau.colonnes / 2) / niveau.colonnes;
        const dy = (r - niveau.rangees / 2) / niveau.rangees;
        const ouverte = Math.hypot(dx * 1.4, dy) < 0.28 + 0.06 * Math.sin(r * 1.7 + c * 2.3);
        g.fillStyle(ouverte ? 0xdfdce9 : niveau.couleur, ouverte ? 1 : 0.85);
        g.fillRoundedRect(gauche + c * pas + 0.5, haut + r * pas + 0.5, pas - 1, pas - 1, Math.min(2, pas / 4));
      }
    }
    return g;
  }

  private choisir(i: number, anime = true) {
    if (this.parti) {
      return;
    }
    this.choix = Phaser.Math.Wrap(i, 0, NIVEAUX.length);
    this.cartes.forEach((carte, j) => {
      const elue = j === this.choix;
      carte.fond.setStrokeStyle(elue ? 5 : 3, elue ? carte.niveau.couleur : 0x3a3550);
      this.tweens.add({ targets: carte.boite, scale: elue ? 1.06 : 1, duration: anime ? 140 : 0, ease: "Back.Out" });
    });
  }

  private lancer(i = this.choix) {
    if (this.parti) {
      return;
    }
    this.choisir(i);
    this.parti = true;
    fonduPuis(this, () => this.scene.start("demineur-partie", { niveau: this.choix }));
  }
}
