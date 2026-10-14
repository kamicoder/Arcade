// Le menu du jeu de tir : le titre, le record, et un seul bouton, « Jouer ».
// Entrée, Espace, A de la manette, un clic ou le doigt lancent la partie.

import Phaser from "phaser";
import { lireLeRecord } from "./Partie";
import { FOND, CYAN, VIES } from "../reglages";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { estTactile } from "../../../socle/tactile";
import { retourAuHub, fonduPuis } from "../../../socle/retour";
import { boutonArcade } from "../../../socle/boutonArcade";
import { appliquerLeSon, boutonDuSon } from "../../../socle/son";
import { etiquette } from "../../../socle/touchesPhysiques";

export class Menu extends Phaser.Scene {
  private parti = false;
  private etoiles: Phaser.GameObjects.TileSprite[] = [];

  constructor() {
    super("tir-menu");
  }

  create() {
    this.parti = false;
    this.cameras.main.setBackgroundColor(FOND).fadeIn(250);
    appliquerLeSon(this, "tir");

    // Les étoiles défilent déjà, et le vaisseau flotte : le jeu donne envie
    this.etoiles = ["loin", "milieu", "pres"].map((couche) =>
      this.add.tileSprite(0, 0, LARGEUR, HAUTEUR, "tir-etoiles-" + couche).setOrigin(0));
    const vaisseau = this.add.image(LARGEUR / 2, 300, "tir-vaisseau").setScale(1.6);
    this.tweens.add({ targets: vaisseau, y: 285, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    for (const [x, genre] of [[200, "chasseur"], [760, "chasseur"], [330, "eclaireur"], [630, "eclaireur"]] as const) {
      const ennemi = this.add.image(x, 170, "tir-" + genre).setAlpha(0.8);
      this.tweens.add({ targets: ennemi, x: x + 20, duration: 1500 + x, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }

    this.add.text(LARGEUR / 2, 80, "Tir spatial", {
      fontFamily: POLICE, fontSize: "56px", fontStyle: "bold", color: CYAN, stroke: "#14121c", strokeThickness: 8,
    }).setOrigin(0.5);
    const record = lireLeRecord();
    this.add.text(LARGEUR / 2, 130, record > 0 ? `Record : ${record}` : "Des vagues d'ennemis, et un boss toutes les 5 vagues", {
      fontFamily: POLICE, fontSize: "20px", color: "#ffd23f",
    }).setOrigin(0.5);

    boutonArcade(this, () => this.quitter());

    // Le bouton « Jouer »
    const fond = this.add.rectangle(LARGEUR / 2, 400, 300, 74, 0x2a8fd8).setRounded(18)
      .setStrokeStyle(3, 0x5ff0ff).setInteractive({ useHandCursor: true });
    const jouer = this.add.text(LARGEUR / 2, 400, "Jouer", { fontFamily: POLICE, fontSize: "34px", fontStyle: "bold" }).setOrigin(0.5);
    this.tweens.add({ targets: [fond, jouer], scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    fond.on("pointerup", () => this.lancer());

    // Les lettres de pilotage, reconnues à leur place : Z Q S D sur un AZERTY, W A S D sur un QWERTY
    const lettres = ["KeyW", "KeyA", "KeyS", "KeyD"].map(etiquette).join(" ");
    const aide = estTactile()
      ? `Glisse le doigt pour piloter : ton vaisseau tire tout seul.  ${VIES} vies.`
      : `Souris, flèches ou ${lettres} : piloter (il tire tout seul)    M : le son    Échap : l'Arcade`;
    this.add.text(LARGEUR / 2, 490, aide, { fontFamily: POLICE, fontSize: "16px", color: "#e9e4f0" }).setOrigin(0.5);
    this.add.text(LARGEUR / 2, 515, "Bonus :  orange = plus de tirs    bleu = bouclier    rouge = une vie", {
      fontFamily: POLICE, fontSize: "14px", color: "#a59fc0",
    }).setOrigin(0.5);

    boutonDuSon(this, "tir");

    surTouche(this, "ENTER", () => this.lancer());
    surTouche(this, "SPACE", () => this.lancer());
    surTouche(this, "ESC", () => this.quitter());
    surManette(this, VALIDER, () => this.lancer());
    surManette(this, MANETTE.B, () => this.quitter());
  }

  update(_temps: number, delta: number) {
    this.etoiles.forEach((couche, i) => (couche.tilePositionY -= [20, 50, 120][i] * delta / 1000));
  }

  private lancer() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    fonduPuis(this, () => this.scene.start("tir-partie"));
  }

  private quitter() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    retourAuHub(this);
  }
}
