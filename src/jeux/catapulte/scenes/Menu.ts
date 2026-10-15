// Le menu de la catapulte : les niveaux, en deux rangées de cartes, chacune avec son nom, ses étoiles
// et son meilleur score. Un niveau s'ouvre quand celui d'avant est gagné.
// Flèches et Entrée, manette, souris ou doigt.

import Phaser from "phaser";
import { NIVEAUX } from "../niveaux";
import { resultats, ouvert } from "../progression";
import { paysage } from "../decor";
import { BRUN, SAUVEGARDE } from "../reglages";
import { HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { estTactile } from "../../../socle/tactile";
import { retourAuHub, fonduPuis } from "../../../socle/retour";
import { boutonArcade } from "../../../socle/boutonArcade";
import { elargir, suivreLaLargeur } from "../../../socle/largeur";
import { appliquerLeSon, boutonDuSon } from "../../../socle/son";

const PAR_RANGEE = 4;
const CARTE = { largeur: 190, hauteur: 140, ecart: 22, haut: 210 };

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
    super("catapulte-menu");
  }

  create() {
    // Au doigt, le menu prend la proportion du téléphone, et la reprend si l'écran tourne
    elargir(this);
    suivreLaLargeur(this);
    const largeur = this.scale.width;
    this.cartes = [];
    this.parti = false;
    this.cameras.main.fadeIn(250);
    appliquerLeSon(this, SAUVEGARDE);
    paysage(this, largeur, HAUTEUR, HAUTEUR - 50);

    this.add.text(largeur / 2, 62, "Catapulte", {
      fontFamily: POLICE, fontSize: "56px", fontStyle: "bold", color: "#ffd23f", stroke: "#5a3414", strokeThickness: 10,
    }).setOrigin(0.5);
    this.add.text(largeur / 2, 112, "Le château contre les slimes", {
      fontFamily: POLICE, fontSize: "20px", fontStyle: "bold", color: "#ffffff", stroke: "#5a3414", strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.image(90, HAUTEUR - 115, "catapulte-fronde").setScale(0.9);
    this.add.image(largeur - 80, HAUTEUR - 70, "catapulte-chef").setScale(0.9);

    const tout = resultats();
    NIVEAUX.forEach((niveau, i) => this.creerCarte(i, niveau.nom, tout[i]?.etoiles ?? 0, tout[i]?.score, ouvert(i)));
    if (this.choisi < 0) {
      // Le premier niveau pas encore gagné (ou le dernier)
      const aGagner = NIVEAUX.findIndex((_n, i) => !tout[i]);
      this.choisi = aGagner < 0 ? NIVEAUX.length - 1 : aGagner;
    }

    boutonArcade(this, () => this.quitter(), { fond: BRUN, fondAlpha: 0.85 });
    boutonDuSon(this, SAUVEGARDE, { couleur: "#ffffff" });
    const aide = estTactile() ? "Touche un niveau pour jouer !" : "Flèches : choisir    Entrée : jouer    M : le son    Échap : l'Arcade";
    this.add.text(largeur / 2, HAUTEUR - 22, aide, {
      fontFamily: POLICE, fontSize: "16px", color: "#ffffff", stroke: "#3a2410", strokeThickness: 4,
    }).setOrigin(0.5);

    surTouche(this, "LEFT", () => this.deplacer(-1));
    surTouche(this, "RIGHT", () => this.deplacer(1));
    surTouche(this, "UP", () => this.deplacer(-PAR_RANGEE));
    surTouche(this, "DOWN", () => this.deplacer(PAR_RANGEE));
    surTouche(this, "ENTER", () => this.lancer());
    surTouche(this, "SPACE", () => this.lancer());
    surTouche(this, "ESC", () => this.quitter());
    surManette(this, MANETTE.GAUCHE, () => this.deplacer(-1));
    surManette(this, MANETTE.DROITE, () => this.deplacer(1));
    surManette(this, MANETTE.HAUT, () => this.deplacer(-PAR_RANGEE));
    surManette(this, MANETTE.BAS, () => this.deplacer(PAR_RANGEE));
    surManette(this, VALIDER, () => this.lancer());
    surManette(this, MANETTE.B, () => this.quitter());
    this.choisir(this.choisi);
  }

  private creerCarte(i: number, nom: string, etoiles: number, score: number | undefined, ouverte: boolean) {
    const rangee = Math.floor(i / PAR_RANGEE);
    const colonne = i % PAR_RANGEE;
    const x = this.scale.width / 2 + (colonne - (PAR_RANGEE - 1) / 2) * (CARTE.largeur + CARTE.ecart);
    const y = CARTE.haut + rangee * (CARTE.hauteur + CARTE.ecart);
    const fond = this.add.rectangle(0, 0, CARTE.largeur, CARTE.hauteur, ouverte ? 0xfff4e0 : 0x8a7d70, 0.95)
      .setRounded(16).setStrokeStyle(4, BRUN);
    const contenu: Phaser.GameObjects.GameObject[] = [fond];
    contenu.push(this.add.text(0, -46, String(i + 1), {
      fontFamily: POLICE, fontSize: "30px", fontStyle: "bold", color: ouverte ? "#5a3414" : "#3a3430",
    }).setOrigin(0.5));
    contenu.push(this.add.text(0, -12, nom, {
      fontFamily: POLICE, fontSize: "17px", fontStyle: "bold", color: ouverte ? "#3a2410" : "#3a3430",
    }).setOrigin(0.5));
    if (ouverte) {
      for (let e = 0; e < 3; e++) {
        contenu.push(this.add.image((e - 1) * 36, 26, e < etoiles ? "catapulte-etoile" : "catapulte-etoile-vide").setScale(0.62));
      }
      if (score !== undefined) {
        contenu.push(this.add.text(0, 56, `Record : ${score}`, { fontFamily: POLICE, fontSize: "13px", color: "#7a5a3a" }).setOrigin(0.5));
      }
    } else {
      contenu.push(this.add.text(0, 30, "🔒", { fontSize: "34px" }).setOrigin(0.5));
    }
    const boite = this.add.container(x, y, contenu);
    fond.setInteractive({ useHandCursor: ouverte });
    fond.on("pointerover", () => this.choisir(i));
    fond.on("pointerup", () => {
      this.choisir(i);
      this.lancer();
    });
    this.cartes.push({ boite, fond, ouverte });
  }

  private deplacer(pas: number) {
    this.choisir(Phaser.Math.Clamp(this.choisi + pas, 0, this.cartes.length - 1));
  }

  private choisir(i: number) {
    if (this.parti) {
      return;
    }
    this.choisi = i;
    this.cartes.forEach((carte, j) => {
      const elue = j === i;
      carte.fond.setStrokeStyle(elue ? 6 : 4, elue ? 0xffd23f : BRUN);
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
    fonduPuis(this, () => this.scene.start("catapulte-niveau", { numero: this.choisi }));
  }

  private quitter() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    retourAuHub(this);
  }
}
