// Le menu du platformer : l'Aventure, l'Infini, les 2 joueurs et l'éditeur de niveaux.
// Au clavier (↑ ↓ Entrée), à la manette (croix + A), à la souris ou au doigt.

import Phaser from "phaser";
import { chargerTous, liste } from "../niveaux";
import { lancerLaMusique, quitterLePlatformer } from "../son";
import { lireLeRecord, type DonneesDeNiveau } from "./Niveau";
import { lettresDuJoueur1 } from "../commandes";
import { texturePour, ECHELLE_TUILE } from "../textures";
import { Genres } from "../genres";
import { FOND, VERT, VIES, SAUVEGARDE } from "../reglages";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { estTactile } from "../../../socle/tactile";
import { retourAuHub, fonduPuis } from "../../../socle/retour";
import { boutonArcade } from "../../../socle/boutonArcade";
import { boutonDuSon } from "../../../socle/son";

type Choix = "aventure" | "infini" | "duo" | "editeur";

interface Bouton {
  choix: Choix;
  fond: Phaser.GameObjects.Rectangle;
  nom: Phaser.GameObjects.Text;
  aide: Phaser.GameObjects.Text;
  possible: boolean;
}

const BOUTON = { largeur: 440, hauteur: 58, haut: 150, ecart: 68 };

export class Menu extends Phaser.Scene {
  private choisi = 0;                      // gardé d'une visite à l'autre
  private boutons: Bouton[] = [];
  private parti = false;
  private alerte!: Phaser.GameObjects.Text;

  constructor() {
    super("platformer-menu");
  }

  create() {
    this.boutons = [];
    this.parti = false;
    this.cameras.main.setBackgroundColor(FOND).fadeIn(250);
    lancerLaMusique(this);

    this.creerDecor();
    this.add.text(LARGEUR / 2, 70, "Super Platformer", {
      fontFamily: POLICE, fontSize: "50px", fontStyle: "bold", color: VERT, stroke: "#14121c", strokeThickness: 8,
    }).setOrigin(0.5);

    boutonArcade(this, () => this.quitter());

    const record = lireLeRecord();
    const auDoigt = estTactile();
    this.creerBouton("aventure", `Aventure (${liste().length} niveaux)`, `${VIES} vies, un boss au bout`, true);
    this.creerBouton("infini", "Infini", record > 0 ? `Record : ${record} m` : "Jusqu'où iras-tu ?", true);
    this.creerBouton("duo", "2 joueurs", auDoigt ? "Au clavier ou à deux manettes" : `${lettresDuJoueur1()} contre les flèches : le premier à 15 points`, !auDoigt);
    this.creerBouton("editeur", "Éditeur de niveaux", "Dessine tes niveaux, joue-les tout de suite", true);

    this.alerte = this.add.text(LARGEUR / 2, 432, "", { fontFamily: POLICE, fontSize: "18px", color: "#f07878" }).setOrigin(0.5);
    const aide = auDoigt ? "Touche un mode pour jouer !" : "↑ ↓ : choisir    Entrée : jouer    M : le son    Échap : l'Arcade";
    this.add.text(LARGEUR / 2, 515, aide, { fontFamily: POLICE, fontSize: "16px", color: "#e9e4f0" }).setOrigin(0.5);

    boutonDuSon(this, SAUVEGARDE);

    surTouche(this, "UP", () => this.choisir(this.choisi - 1));
    surTouche(this, "DOWN", () => this.choisir(this.choisi + 1));
    surTouche(this, "ENTER", () => this.lancer());
    surTouche(this, "SPACE", () => this.lancer());
    surTouche(this, "ESC", () => this.quitter());
    surManette(this, MANETTE.HAUT, () => this.choisir(this.choisi - 1));
    surManette(this, MANETTE.BAS, () => this.choisir(this.choisi + 1));
    surManette(this, VALIDER, () => this.lancer());
    surManette(this, MANETTE.B, () => this.quitter());
    this.choisir(this.choisi);
  }

  // Un sol de tuiles, des pièces qui flottent, et le héros qui se promène : le jeu donne envie
  private creerDecor() {
    const genres = new Genres();
    this.add.tileSprite(0, HAUTEUR - 70, LARGEUR, 70, texturePour(this, "normale", genres.fiche("normale")))
      .setOrigin(0).setTileScale(ECHELLE_TUILE * 1.5);
    const heros = this.add.sprite(120, HAUTEUR - 70, "platformer-heros").setOrigin(0.5, 1).setScale(1.5).play("platformer-heros-marche");
    // Un tween qui l'emmène d'un bord à l'autre et le ramène ; il se retourne à chaque bout
    this.tweens.add({
      targets: heros, x: LARGEUR - 120, duration: 6000, yoyo: true, repeat: -1, ease: "Sine.InOut",
      onYoyo: () => heros.setFlipX(true), onRepeat: () => heros.setFlipX(false),
    });
    for (let k = 0; k < 5; k++) {
      const piece = this.add.image(140 + k * 170, HAUTEUR - 130, "platformer-piece").setScale(0.75);
      this.tweens.add({ targets: piece, y: piece.y - 10, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: k * 140 });
    }
  }

  private creerBouton(choix: Choix, texte: string, phrase: string, possible: boolean) {
    const i = this.boutons.length;
    const y = BOUTON.haut + i * BOUTON.ecart;
    const fond = this.add.rectangle(LARGEUR / 2, y, BOUTON.largeur, BOUTON.hauteur, 0x2a2735)
      .setRounded(12).setInteractive({ useHandCursor: possible });
    const nom = this.add.text(LARGEUR / 2, y - 10, texte, { fontFamily: POLICE, fontSize: "22px", fontStyle: "bold" }).setOrigin(0.5);
    const aide = this.add.text(LARGEUR / 2, y + 15, phrase, { fontFamily: POLICE, fontSize: "14px" }).setOrigin(0.5);
    fond.on("pointerover", () => this.choisir(i));
    fond.on("pointerup", () => {
      this.choisir(i);
      this.lancer();
    });
    this.boutons.push({ choix, fond, nom, aide, possible });
  }

  private choisir(i: number) {
    this.choisi = Phaser.Math.Wrap(i, 0, this.boutons.length);
    this.boutons.forEach((bouton, j) => {
      const elu = j === this.choisi;
      bouton.fond.setFillStyle(elu ? 0x5fd068 : 0x2a2735);
      bouton.nom.setColor(elu ? "#14121c" : bouton.possible ? "#ffffff" : "#6d6880");
      bouton.aide.setColor(elu ? "#14121c" : "#a49cb4");
      this.tweens.add({ targets: [bouton.fond, bouton.nom, bouton.aide], scale: elu ? 1.04 : 1, duration: 120, ease: "Back.Out" });
    });
  }

  private lancer() {
    const bouton = this.boutons[this.choisi];
    if (this.parti || !bouton.possible) {
      return;
    }
    let scene = "platformer-niveau";
    let donnees: DonneesDeNiveau | undefined;
    if (bouton.choix === "aventure") {
      const niveaux = chargerTous();         // relus à chaque partie : l'éditeur a pu les changer
      if (niveaux.length === 0) {
        this.alerte.setText("Aucun niveau jouable : ouvre l'éditeur");
        return;
      }
      donnees = { mode: "aventure", niveaux, numero: 0, score: 0, vies: VIES, pieces: 0 };
    } else if (bouton.choix === "infini") {
      donnees = { mode: "infini", niveaux: [], numero: 0, score: 0, vies: 1, pieces: 0 };
    } else if (bouton.choix === "duo") {
      scene = "platformer-duo";
    } else {
      scene = "platformer-editeur";
    }
    this.parti = true;
    fonduPuis(this, () => this.scene.start(scene, donnees));
  }

  private quitter() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    quitterLePlatformer(this);
    retourAuHub(this);
  }
}
