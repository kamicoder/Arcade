// La barre du haut, par-dessus la partie : les mines qui restent, le smiley, le chrono.
// Au doigt, elle porte aussi le bouton qui bascule entre « creuser » et « drapeau ».
// Sa caméra ne bouge pas, pendant que celle de la grille zoome et glisse.
// Au doigt, le jeu peut être plus large que 960 (socle/largeur.ts) : tout se place d'après this.scale.width.

import Phaser from "phaser";
import { hautBarre, BAS_AIDE, type Partie, type Visage } from "./Partie";
import type { Niveau } from "../niveaux";
import { COULEURS } from "../textures";
import { HAUTEUR, POLICE } from "../../../socle/style";
import { estTactile } from "../../../socle/tactile";
import { boutonPause } from "../../../socle/pause";
import { etiquette } from "../../../socle/touchesPhysiques";

const RAYON_MODE = 48;                     // le bouton du mode, en bas à droite (au doigt)

// Les chiffres rouges des compteurs, comme un vieux réveil : 007, -03
function surTroisChiffres(n: number): string {
  return n < 0 ? "-" + String(Math.min(-n, 99)).padStart(2, "0") : String(Math.min(n, 999)).padStart(3, "0");
}

export class Barre extends Phaser.Scene {
  private partie!: Partie;
  private mines!: Phaser.GameObjects.Text;
  private chrono!: Phaser.GameObjects.Text;
  private smiley!: Phaser.GameObjects.Image;
  private nomNiveau!: Phaser.GameObjects.Text;
  private bouton?: Phaser.GameObjects.Container;
  private iconeMode?: Phaser.GameObjects.Text;
  private legendeMode?: Phaser.GameObjects.Text;
  private haut = 56;                       // la hauteur de la barre

  constructor() {
    super("demineur-barre");
  }

  create() {
    this.partie = this.scene.get("demineur-partie") as Partie;
    this.bouton = undefined;
    const largeur = this.scale.width;
    const milieu = largeur / 2;
    const haut = this.haut = hautBarre();

    this.add.rectangle(0, 0, largeur, haut, COULEURS.barre).setOrigin(0);
    this.add.rectangle(0, haut, largeur, 2, 0x3a3550).setOrigin(0);

    const retour = this.add.text(14, haut / 2, "←", {
      fontFamily: POLICE, fontSize: "28px", fontStyle: "bold", color: "#a59fc0",
    }).setOrigin(0, 0.5).setPadding(10, 4).setInteractive({ useHandCursor: true });
    retour.on("pointerup", () => this.partie.quitter());
    this.nomNiveau = this.add.text(62, haut / 2, "", {
      fontFamily: POLICE, fontSize: "20px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0, 0.5);

    const compteur = { fontFamily: "Consolas, 'Courier New', monospace", fontSize: "34px", fontStyle: "bold", color: COULEURS.compteur };
    this.add.rectangle(milieu - 150, haut / 2, 108, 42, 0x0d0b12).setRounded(8);
    this.add.image(milieu - 182, haut / 2, "demineur-drapeau").setScale(1.1);
    this.mines = this.add.text(milieu - 106, haut / 2, "000", compteur).setOrigin(1, 0.5)
      .setShadow(0, 0, COULEURS.compteur, 8, false, true);
    this.add.rectangle(milieu + 150, haut / 2, 108, 42, 0x0d0b12).setRounded(8);
    this.add.text(milieu + 116, haut / 2, "⏱", { fontSize: "20px" }).setOrigin(0.5);
    this.chrono = this.add.text(milieu + 196, haut / 2, "000", compteur).setOrigin(1, 0.5)
      .setShadow(0, 0, COULEURS.compteur, 8, false, true);

    // Le smiley : un clic dessus relance la partie, comme R
    this.smiley = this.add.image(milieu, haut / 2, "demineur-smiley").setScale(1.25)
      .setInteractive({ useHandCursor: true });
    this.smiley.on("pointerover", () => this.smiley.setScale(1.4));
    this.smiley.on("pointerout", () => this.smiley.setScale(1.25));
    this.smiley.on("pointerup", () => this.partie.nouvellePartie());

    // La pause, à droite de la barre : au doigt, 64 pixels pour un pouce (la barre est plus haute pour lui)
    boutonPause(this, largeur - (estTactile() ? 44 : 40), haut / 2, () => this.partie.ouvrirLaPause());

    if (estTactile()) {
      this.creerBoutonDuMode();
      this.bulle("Touche : creuser    Appui long : drapeau    Glisse ou pince : bouger la grille");
    } else {
      // Toutes les touches, sur deux lignes. Les lettres du curseur reconnues à leur place : Z Q S D sur un
      // AZERTY, W A S D sur un QWERTY
      const lettres = ["KeyW", "KeyA", "KeyS", "KeyD"].map(etiquette).join(" ");
      this.add.text(milieu, HAUTEUR - BAS_AIDE / 2, [
        "Clic : creuser    Clic droit : drapeau    Molette : zoomer    R : rejouer    1 2 3 : niveau    Échap ou P : pause    M : le son",
        `Flèches ou ${lettres} : le curseur    Espace ou Entrée : creuser    F ou X : drapeau`,
      ], {
        fontFamily: POLICE, fontSize: "14px", color: "#a59fc0", align: "center", lineSpacing: 2,
      }).setOrigin(0.5);
    }

    // On écoute la partie. Ces écouteurs sont posés sur une AUTRE scène : on les retire nous-mêmes
    this.partie.events.on("visage", this.changerDeVisage, this);
    this.partie.events.on("mode", this.montrerLeMode, this);
    this.partie.events.on("niveau", this.montrerLeNiveau, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.partie.events.off("visage", this.changerDeVisage, this);
      this.partie.events.off("mode", this.montrerLeMode, this);
      this.partie.events.off("niveau", this.montrerLeNiveau, this);
    });
    if (this.partie.niveau) {
      this.montrerLeNiveau(this.partie.niveau);
    }
  }

  // La partie demande si un point de l'écran est à la barre (et pas à la grille)
  occupe(x: number, y: number): boolean {
    if (y < this.haut) {
      return true;
    }
    return !!this.bouton && Phaser.Math.Distance.Between(x, y, this.bouton.x, this.bouton.y) < RAYON_MODE * 1.3;
  }

  private creerBoutonDuMode() {
    const rayon = RAYON_MODE;
    const x = this.scale.width - 66;
    const y = HAUTEUR - 66;
    const rond = this.add.circle(0, 0, rayon, 0x221f2e, 0.92).setStrokeStyle(4, 0x4fb3ff);
    this.iconeMode = this.add.text(0, -4, "⛏️", { fontSize: "40px" }).setOrigin(0.5);
    this.legendeMode = this.add.text(0, rayon - 14, "creuser", {
      fontFamily: POLICE, fontSize: "13px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0.5);
    this.bouton = this.add.container(x, y, [rond, this.iconeMode, this.legendeMode]);
    // Une zone sensible un peu plus grande que le rond : un pouce, ça déborde
    rond.setInteractive(new Phaser.Geom.Circle(rayon, rayon, rayon * 1.3), Phaser.Geom.Circle.Contains);
    rond.on("pointerdown", () => this.partie.basculerLeMode());
    this.montrerLeMode(this.partie.modeDrapeau);
  }

  private montrerLeMode(drapeau: boolean) {
    if (!this.bouton) {
      return;
    }
    this.iconeMode!.setText(drapeau ? "🚩" : "⛏️");
    this.legendeMode!.setText(drapeau ? "drapeau" : "creuser");
    (this.bouton.list[0] as Phaser.GameObjects.Arc).setStrokeStyle(4, drapeau ? 0xff5a50 : 0x4fb3ff);
    this.bouton.setScale(1.25);
    this.tweens.add({ targets: this.bouton, scale: 1, duration: 220, ease: "Back.Out" });
  }

  private montrerLeNiveau(niveau: Niveau) {
    this.nomNiveau.setText(niveau.nom).setColor("#" + niveau.couleur.toString(16).padStart(6, "0"));
  }

  private changerDeVisage(visage: Visage) {
    const cle = "demineur-" + visage;
    if (this.smiley.texture.key === cle) {
      return;
    }
    this.smiley.setTexture(cle);
    // Le smiley réagit : un petit saut, plus grand quand la partie se termine
    const fin = visage === "smiley_gagne" || visage === "smiley_perdu";
    this.tweens.add({
      targets: this.smiley, y: this.haut / 2 - (fin ? 8 : 3), duration: fin ? 160 : 80, yoyo: true, ease: "Quad.Out",
      repeat: fin ? 2 : 0,
    });
  }

  // Un petit message qui apparaît en bas, puis s'efface
  private bulle(message: string) {
    const texte = this.add.text(this.scale.width / 2 - 40, HAUTEUR - 34, message, {
      fontFamily: POLICE, fontSize: "18px", fontStyle: "bold", color: "#ffffff",
      backgroundColor: "#221f2ee0", padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.chain({
      targets: texte,
      tweens: [
        { alpha: 1, y: HAUTEUR - 44, duration: 300, delay: 600 },
        { alpha: 0, duration: 500, delay: 3500 },
      ],
    });
  }

  update() {
    const partie = this.partie;
    if (!partie.grille) {
      return;
    }
    this.mines.setText(surTroisChiffres(partie.grille.restantes()));
    this.chrono.setText(surTroisChiffres(Math.floor(partie.tempsEcoule() / 1000)));
  }
}
